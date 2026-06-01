import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    const meeting = db.getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: '존재하지 않는 모임입니다.' }, { status: 404 });
    }
    const sessions = db.getSessions(id);
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: '세션 목록을 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, date, startTime, lateTime } = body;

    if (!title || !date || !startTime || !lateTime) {
      return NextResponse.json({ error: '필수 항목(주제, 날짜, 시작시간, 지각시간)이 누락되었습니다.' }, { status: 400 });
    }

    const meeting = db.getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: '존재하지 않는 모임입니다.' }, { status: 404 });
    }

    const newSession = db.addSession(id, title, date, startTime, lateTime);
    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '세션 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
