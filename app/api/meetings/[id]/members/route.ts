import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id: meetingId } = await params;
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '멤버 목록을 불러오는 도중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<any> }
) {
  try {
    const { id: meetingId } = await params;
    const body = await request.json();

    if (Array.isArray(body)) {
      const membersToInsert = body
        .map((item: any) => ({
          meeting_id: meetingId,
          name: item.name?.trim(),
          department: item.department?.trim() || '',
        }))
        .filter((item: any) => item.name);

      if (membersToInsert.length === 0) {
        return NextResponse.json({ error: '등록할 유효한 이름이 없습니다.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('members')
        .insert(membersToInsert)
        .select();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    } else {
      const { name, department } = body;

      if (!name) {
        return NextResponse.json({ error: '이름은 필수 입력 항목입니다.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('members')
        .insert([
          {
            meeting_id: meetingId,
            name: name.trim(),
            department: department?.trim() || '',
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '멤버 추가 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
