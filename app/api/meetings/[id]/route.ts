import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '존재하지 않는 모임입니다.' }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '모임 정보를 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, default_start_time, default_late_time, default_end_time, is_closed } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (default_start_time !== undefined) updateData.default_start_time = default_start_time;
    if (default_late_time !== undefined) updateData.default_late_time = default_late_time;
    if (default_end_time !== undefined) updateData.default_end_time = default_end_time;
    if (is_closed !== undefined) updateData.is_closed = is_closed;

    const { data, error } = await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '모임 정보 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id } = await params;
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '모임 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
