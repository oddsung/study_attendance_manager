import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { memberId } = await params;
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '멤버 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
