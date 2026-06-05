// 이 파일은 클라이언트 컴포넌트(아이폰, 모바일 등)의 브라우저에서 
// 직접 Supabase API를 호출할 때 발생하는 CORS 및 크로스 사이트 보호 기능(방화벽/애드블록) 오작동을
// 원천 차단하기 위해, Next.js 백엔드 프록시 API(/api/...)를 통해 안전하게 연동하도록 설계되었습니다.

export interface Meeting {
  id: string;
  title: string;
  description: string;
  created_at: string;
  default_start_time?: string;
  default_late_time?: string;
  default_end_time?: string;
  is_closed?: boolean;
}

export interface Session {
  id: string;
  meeting_id: string;
  title: string;
  date: string;
  start_time: string;
  late_time: string;
  end_time: string;
  created_at: string;
  sort_order?: number;
}

export interface Attendance {
  id: string;
  session_id: string;
  member_name: string;
  employee_number: string;
  department: string;
  status: '출석' | '지각' | '결석';
  attended_at: string;
  device_token?: string;
  memo?: string;
}

export interface Member {
  id: string;
  meeting_id: string;
  name: string;
  department: string;
  is_auto_added?: boolean;
}

// Helper to handle API requests
async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // ngrok 무료 인터스티셜(경고) 페이지를 바이패스하여
      // iOS Safari에서도 정상적으로 JSON 응답을 수신할 수 있도록 합니다.
      'ngrok-skip-browser-warning': 'true',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${res.status}`);
  }
  // ngrok 인터스티셜이 HTML을 반환하는 경우를 감지 (iOS Safari ITP 대응)
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('서버가 올바른 응답을 반환하지 않았습니다. 네트워크 연결을 확인해 주세요.');
  }
  return res.json();
}

// 1. 모임 목록 가져오기
export async function getMeetings(): Promise<Meeting[]> {
  return fetchAPI('/api/meetings');
}

// 2. 단일 모임 정보 가져오기
export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    return await fetchAPI(`/api/meetings/${id}`);
  } catch (error) {
    console.error('Failed to get meeting:', error);
    return null;
  }
}

// 3. 모임 생성
export async function createMeeting(
  title: string,
  description: string,
  defaultStartTime?: string,
  defaultLateTime?: string,
  defaultEndTime?: string
): Promise<Meeting> {
  return fetchAPI('/api/meetings', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description,
      default_start_time: defaultStartTime,
      default_late_time: defaultLateTime,
      default_end_time: defaultEndTime,
    }),
  });
}

// 4. 모임 수정
export async function updateMeeting(
  id: string,
  title: string,
  description: string,
  defaultStartTime?: string,
  defaultLateTime?: string,
  defaultEndTime?: string
): Promise<Meeting> {
  return fetchAPI(`/api/meetings/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title,
      description,
      default_start_time: defaultStartTime,
      default_late_time: defaultLateTime,
      default_end_time: defaultEndTime,
    }),
  });
}

// 5. 모임 삭제
export async function deleteMeeting(id: string): Promise<void> {
  await fetchAPI(`/api/meetings/${id}`, {
    method: 'DELETE',
  });
}

// 6. 모임 하위 세션 목록 가져오기
export async function getSessions(meetingId: string): Promise<Session[]> {
  return fetchAPI(`/api/meetings/${meetingId}/sessions`);
}

// 7. 단일 세션 상세 정보 가져오기
export async function getSession(id: string): Promise<Session | null> {
  try {
    const data = await fetchAPI(`/api/sessions/${id}`);
    return data.session;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

// 8. 신규 세션 생성
export async function createSession(
  meetingId: string,
  title: string,
  date: string,
  startTime: string,
  lateTime: string,
  endTime: string
): Promise<Session> {
  return fetchAPI(`/api/meetings/${meetingId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title, date, startTime, lateTime, endTime }),
  });
}

// 8-2. 기존 세션 수정
export async function updateSession(
  id: string,
  title: string,
  date: string,
  startTime: string,
  lateTime: string,
  endTime: string
): Promise<Session> {
  return fetchAPI(`/api/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, date, startTime, lateTime, endTime }),
  });
}

// 8-3. 세션 삭제
export async function deleteSession(id: string): Promise<void> {
  await fetchAPI(`/api/sessions/${id}`, {
    method: 'DELETE',
  });
}

// 8-4. 세션 순서 일괄 업데이트
export async function reorderSessions(meetingId: string, sessionIds: string[]): Promise<void> {
  await fetchAPI(`/api/meetings/${meetingId}/sessions`, {
    method: 'PUT',
    body: JSON.stringify({ sessionIds }),
  });
}

// 9. 특정 세션의 모든 출석 목록 가져오기
export async function getAttendances(sessionId: string): Promise<Attendance[]> {
  try {
    const data = await fetchAPI(`/api/sessions/${sessionId}`);
    return data.attendances || [];
  } catch (error) {
    console.error('Failed to get attendances:', error);
    return [];
  }
}

// 10. 출석 제출 (중복 여부 및 지각 여부 판정 포함)
export async function submitAttendance(
  sessionId: string,
  memberName: string,
  employeeNumber: string,
  department: string,
  deviceToken: string
): Promise<Attendance> {
  return fetchAPI(`/api/sessions/${sessionId}/attend`, {
    method: 'POST',
    body: JSON.stringify({
      memberName,
      employeeNumber,
      department,
      deviceToken,
    }),
  });
}

// 11. 멤버 목록 가져오기
export async function getMembers(meetingId: string): Promise<Member[]> {
  return fetchAPI(`/api/meetings/${meetingId}/members`);
}

// 12. 멤버 추가
export async function addMember(meetingId: string, name: string, department: string): Promise<Member> {
  return fetchAPI(`/api/meetings/${meetingId}/members`, {
    method: 'POST',
    body: JSON.stringify({ name, department }),
  });
}

// 12-2. 멤버 일괄 추가
export async function addMembersBulk(
  meetingId: string,
  members: { name: string; department: string }[]
): Promise<Member[]> {
  return fetchAPI(`/api/meetings/${meetingId}/members`, {
    method: 'POST',
    body: JSON.stringify(members),
  });
}

// 13. 멤버 삭제
export async function deleteMember(id: string): Promise<void> {
  await fetchAPI(`/api/members/${id}`, {
    method: 'DELETE',
  });
}

// 14. 출석 정보 수동 수정 (관리자 기능)
export async function updateAttendanceManual(
  sessionId: string,
  memberName: string,
  department: string,
  status: '출석' | '지각' | '결석',
  memo: string
): Promise<Attendance> {
  return fetchAPI(`/api/sessions/${sessionId}/attend`, {
    method: 'PUT',
    body: JSON.stringify({
      memberName,
      department,
      status,
      memo,
    }),
  });
}

// 15. 모임 종료/활성화 상태 토글
export async function toggleMeetingStatus(id: string, isClosed: boolean): Promise<Meeting> {
  return fetchAPI(`/api/meetings/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_closed: isClosed }),
  });
}

// 16. 모임 전체의 모든 출석 목록 가져오기
export async function getMeetingAttendances(meetingId: string): Promise<Attendance[]> {
  try {
    const data = await fetchAPI(`/api/meetings/${meetingId}/attendances`);
    return data.attendances || [];
  } catch (error) {
    console.error('Failed to get meeting attendances:', error);
    return [];
  }
}
