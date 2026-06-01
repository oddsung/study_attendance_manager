import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { memberId } = await params;
    const deleted = db.deleteMember(memberId);
    
    if (!deleted) {
      return NextResponse.json({ error: '존재하지 않는 멤버이거나 이미 삭제되었습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '멤버 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
