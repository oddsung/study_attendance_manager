import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    
    // 1. 세션 조회
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json({ error: '존재하지 않는 세션입니다.' }, { status: 404 });
      }
      throw sessionError;
    }

    // 2. 모임 조회
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', session.meeting_id)
      .single();

    if (meetingError && meetingError.code !== 'PGRST116') {
      throw meetingError;
    }

    // 3. 출석자 목록 조회
    const { data: attendances, error: attendanceError } = await supabase
      .from('attendances')
      .select('*')
      .eq('session_id', id)
      .order('attended_at', { ascending: true });

    if (attendanceError) {
      throw attendanceError;
    }

    return NextResponse.json({
      session,
      meeting,
      attendances: attendances || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '세션 상세 정보를 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, date, startTime, lateTime, endTime } = body;

    const { data, error } = await supabase
      .from('sessions')
      .update({
        title,
        date,
        start_time: startTime,
        late_time: lateTime,
        end_time: endTime,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '세션 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '세션 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
