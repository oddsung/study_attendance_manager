import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id: meetingId } = await params;

    // 1. 모임에 속한 모든 세션 ID 조회
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id')
      .eq('meeting_id', meetingId);

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ attendances: [] });
    }

    const sessionIds = sessions.map((s) => s.id);

    // 2. 해당 세션들의 모든 출석 기록 조회
    const { data: attendances, error: attendancesError } = await supabase
      .from('attendances')
      .select('*')
      .in('session_id', sessionIds)
      .order('attended_at', { ascending: true });

    if (attendancesError) throw attendancesError;

    return NextResponse.json({ attendances: attendances || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '출석 기록을 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}
