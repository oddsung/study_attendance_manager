import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const meetings = db.getMeetings();
    return NextResponse.json(meetings);
  } catch (error) {
    return NextResponse.json({ error: '모임 목록을 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description } = body;

    if (!title) {
      return NextResponse.json({ error: '모임 주제는 필수 입력 항목입니다.' }, { status: 400 });
    }

    const newMeeting = db.addMeeting(title, description || '');
    return NextResponse.json(newMeeting, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '모임 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
