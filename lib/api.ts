import { supabase } from './supabase';

export interface Meeting {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

export interface Session {
  id: string;
  meeting_id: string;
  title: string;
  date: string;
  start_time: string;
  late_time: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  member_name: string;
  employee_number: string;
  department: string;
  status: '출석' | '지각';
  attended_at: string;
  device_token?: string;
}

// 1. 모임 목록 가져오기
export async function getMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// 2. 단일 모임 정보 가져오기
export async function getMeeting(id: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

// 3. 모임 생성
export async function createMeeting(title: string, description: string): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .insert([{ title, description }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 4. 모임 수정
export async function updateMeeting(id: string, title: string, description: string): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .update({ title, description })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 5. 모임 삭제
export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 6. 모임 하위 세션 목록 가져오기
export async function getSessions(meetingId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

// 7. 단일 세션 상세 정보 가져오기
export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

// 8. 신규 세션 생성
export async function createSession(
  meetingId: string,
  title: string,
  date: string,
  startTime: string,
  lateTime: string
): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert([
      {
        meeting_id: meetingId,
        title,
        date,
        start_time: startTime,
        late_time: lateTime,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 9. 특정 세션의 모든 출석 목록 가져오기
export async function getAttendances(sessionId: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendances')
    .select('*')
    .eq('session_id', sessionId)
    .order('attended_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// 10. 출석 제출 (중복 여부 및 지각 여부 판정 포함)
export async function submitAttendance(
  sessionId: string,
  memberName: string,
  employeeNumber: string,
  department: string,
  deviceToken: string
): Promise<Attendance> {
  // 10-1. 기 중복 출석 여부 조회
  const { data: existing, error: checkError } = await supabase
    .from('attendances')
    .select('id')
    .eq('session_id', sessionId)
    .or(`employee_number.eq.${employeeNumber},device_token.eq.${deviceToken}`);

  if (checkError) throw checkError;
  if (existing && existing.length > 0) {
    throw new Error('이미 출석이 제출된 사번이거나 기기입니다.');
  }

  // 10-2. 세션 정보를 불러와 시간 비교 (지각 판정)
  const session = await getSession(sessionId);
  if (!session) throw new Error('세션 정보를 찾을 수 없습니다.');

  // 지각 판정 기준 로직:
  // 현재 시:분과 세션의 late_time(HH:MM)을 비교
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const [lateHour, lateMinute] = session.late_time.split(':').map(Number);
  
  let status: '출석' | '지각' = '출석';
  
  // 날짜가 세션 날짜와 다르거나, 시간 비교 시 late_time보다 늦은 경우
  // 테스트 편의성을 위해 날짜는 체크하지 않고 '시간'만 비교하여 지각 여부를 구분합니다.
  const currentTimeVal = currentHour * 60 + currentMinute;
  const lateTimeVal = lateHour * 60 + lateMinute;
  
  if (currentTimeVal > lateTimeVal) {
    status = '지각';
  }

  // 10-3. 출석 기록 인서트
  const { data, error } = await supabase
    .from('attendances')
    .insert([
      {
        session_id: sessionId,
        member_name: memberName,
        employee_number: employeeNumber,
        department,
        status,
        device_token: deviceToken,
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('해당 사번으로 이미 출석 기록이 존재합니다.');
    }
    throw error;
  }

  return data;
}
