import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { memberName, employeeNumber, department, deviceToken } = body;

    if (!memberName || !department || !deviceToken) {
      return NextResponse.json({ error: '필수 입력 항목이 누락되었습니다.' }, { status: 400 });
    }

    // 1. 세션 정보 조회
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      return NextResponse.json({ error: '세션 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 1-1. 모임 종료 여부 검증
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('is_closed')
      .eq('id', session.meeting_id)
      .single();

    if (meetingError) {
      return NextResponse.json({ error: '모임 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (meeting.is_closed) {
      return NextResponse.json({ error: '이미 종료된 스터디 모임입니다. 출석체크가 불가능합니다.' }, { status: 400 });
    }

    // 1-2. 한국 시간(Asia/Seoul)으로 현재 날짜 및 시간 계산
    const now = new Date();
    const koreaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const yyyy = koreaDate.getFullYear();
    const mm = String(koreaDate.getMonth() + 1).padStart(2, '0');
    const dd = String(koreaDate.getDate()).padStart(2, '0');
    const localDateString = `${yyyy}-${mm}-${dd}`;

    // 1-2. 날짜 검증
    if (localDateString !== session.date) {
      return NextResponse.json({ error: '오늘은 이 회차의 모임 날짜가 아닙니다. 지정된 날짜에 출석해 주세요.' }, { status: 400 });
    }

    // 1-3. 시간 검증 (시작 1시간 전부터 종료 시간까지만 출석 가능)
    const currentHour = koreaDate.getHours();
    const currentMinute = koreaDate.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = session.start_time.split(':').map(Number);
    const [lateHour, lateMinute] = session.late_time.split(':').map(Number);
    const [endHour, endMinute] = session.end_time.split(':').map(Number);

    const startTimeVal = startHour * 60 + startMinute;
    const lateTimeVal = lateHour * 60 + lateMinute;
    const endTimeVal = endHour * 60 + endMinute;

    // 모임 시작 1시간 전부터 출석 체크 오픈
    const openTimeVal = startTimeVal - 60;

    if (currentTimeVal < openTimeVal) {
      return NextResponse.json({ error: `아직 출석체크 가능 시간이 아닙니다. 모임 시작 1시간 전부터 가능합니다.` }, { status: 400 });
    }

    if (currentTimeVal > endTimeVal) {
      return NextResponse.json({ error: `모임 시간이 종료되어 출석할 수 없습니다. (종료 시간: ${session.end_time.substring(0, 5)})` }, { status: 400 });
    }

    // 2. 사전 등록 멤버 매칭 검증 (이름 + 부서 조합)
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('meeting_id', session.meeting_id)
      .eq('name', memberName.trim())
      .eq('department', department.trim())
      .maybeSingle();

    if (memberError) throw memberError;
    let activeMember = member;
    if (!activeMember) {
      const { data: newMember, error: insertMemberError } = await supabase
        .from('members')
        .insert([
          {
            meeting_id: session.meeting_id,
            name: memberName.trim(),
            department: department.trim(),
            is_auto_added: true,
          },
        ])
        .select()
        .single();

      if (insertMemberError) throw insertMemberError;
      activeMember = newMember;
    }

    // 3. 기 중복 출석 여부 조회
    const { data: existing, error: checkError } = await supabase
      .from('attendances')
      .select('id')
      .eq('session_id', sessionId)
      .eq('member_name', memberName.trim())
      .eq('department', department.trim())
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
      return NextResponse.json({ error: '이미 출석이 완료되었습니다.' }, { status: 400 });
    }

    // 4. 지각 판정
    let status: '출석' | '지각' = '출석';
    if (currentTimeVal > lateTimeVal) {
      status = '지각';
    }

    // 5. 출석 기록 인서트
    const { data, error } = await supabase
      .from('attendances')
      .insert([
        {
          session_id: sessionId,
          member_name: memberName.trim(),
          employee_number: employeeNumber || `MANUAL-${memberName.trim()}-${Math.random().toString(36).substring(2, 7)}`,
          department: department.trim(),
          status,
          device_token: deviceToken,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 출석 기록이 존재합니다.' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '출석 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { memberName, department, status, memo } = body;

    if (!memberName || !department || !status) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    // 1. 기존 출석부 기록이 있는지 조회
    const { data: existing, error: findError } = await supabase
      .from('attendances')
      .select('*')
      .eq('session_id', sessionId)
      .eq('member_name', memberName.trim())
      .eq('department', department.trim())
      .maybeSingle();

    if (findError) throw findError;

    // 만약 상태가 '결석'이면서 메모도 비어있다면 DB 용량 관리 및 청결을 위해 삭제
    if (status === '결석' && !memo) {
      if (existing) {
        const { error: deleteError } = await supabase
          .from('attendances')
          .delete()
          .eq('id', existing.id);
        if (deleteError) throw deleteError;
      }
      return NextResponse.json({ success: true, status: '결석', member_name: memberName, department });
    }

    let result;
    if (existing) {
      // 2. 존재하면 업데이트
      const { data, error } = await supabase
        .from('attendances')
        .update({
          status,
          memo,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // 3. 존재하지 않으면 새로 생성 (결석 상태 메모 포함 등)
      const { data, error } = await supabase
        .from('attendances')
        .insert([
          {
            session_id: sessionId,
            member_name: memberName.trim(),
            department: department.trim(),
            employee_number: `MANUAL-${memberName.trim()}-${Math.random().toString(36).substring(2, 7)}`,
            device_token: 'MANUAL',
            status,
            memo,
            attended_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '출석 정보 수동 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
