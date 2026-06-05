import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '모임 목록을 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, default_start_time, default_late_time, default_end_time } = body;

    if (!title) {
      return NextResponse.json({ error: '모임 주제는 필수 입력 항목입니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('meetings')
      .insert([
        {
          title,
          description,
          default_start_time,
          default_late_time,
          default_end_time,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '모임 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
