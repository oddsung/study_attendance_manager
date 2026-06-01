import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    const session = db.getSession(id);
    
    if (!session) {
      return NextResponse.json({ error: '존재하지 않는 세션입니다.' }, { status: 404 });
    }

    const meeting = db.getMeeting(session.meetingId);
    const attendances = db.getAttendances(id);
    const members = db.getMembers(session.meetingId);

    return NextResponse.json({
      session,
      meeting,
      attendances,
      members,
    });
  } catch (error) {
    return NextResponse.json({ error: '세션 상세 정보를 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}
