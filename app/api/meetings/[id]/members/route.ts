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
    const members = db.getMembers(id);
    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json({ error: '멤버 목록을 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, department } = body;

    if (!name || !department) {
      return NextResponse.json({ error: '이름과 소속 부서는 필수 입력 항목입니다.' }, { status: 400 });
    }

    const meeting = db.getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: '존재하지 않는 모임입니다.' }, { status: 404 });
    }

    const newMember = db.addMember(id, name, department);
    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '멤버 추가 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
