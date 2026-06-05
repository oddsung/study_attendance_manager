import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id: meetingId } = await params;
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('sort_order', { ascending: true })
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '세션 목록을 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id: meetingId } = await params;
    const body = await request.json();
    const { title, date, startTime, lateTime, endTime } = body;

    if (!title || !date || !startTime || !lateTime || !endTime) {
      return NextResponse.json({ error: '필수 항목(주제, 날짜, 시작시간, 지각시간, 종료시간)이 누락되었습니다.' }, { status: 400 });
    }

    // 최댓값 sort_order 조회하여 다음 순서 계산
    const { data: maxSession, error: maxError } = await supabase
      .from('sessions')
      .select('sort_order')
      .eq('meeting_id', meetingId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) throw maxError;
    const nextSortOrder = maxSession ? (maxSession.sort_order || 0) + 1 : 0;

    const { data, error } = await supabase
      .from('sessions')
      .insert([
        {
          meeting_id: meetingId,
          title,
          date,
          start_time: startTime,
          late_time: lateTime,
          end_time: endTime,
          sort_order: nextSortOrder,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '세션 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id: meetingId } = await params;
    const body = await request.json();
    const { sessionIds } = body;

    if (!Array.isArray(sessionIds)) {
      return NextResponse.json({ error: '올바르지 않은 세션 ID 목록입니다.' }, { status: 400 });
    }

    // 트랜잭션 대신 순차 처리 혹은 Promise.all로 병렬 업데이트
    const promises = sessionIds.map((id, index) =>
      supabase
        .from('sessions')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('meeting_id', meetingId)
    );

    const results = await Promise.all(promises);
    const firstError = results.find((r) => r.error);
    if (firstError) throw firstError.error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '순서 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
