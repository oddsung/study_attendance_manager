export interface Meeting {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface Session {
  id: string;
  meetingId: string;
  title: string;
  date: string;
  startTime: string;
  lateTime: string;
  createdAt: string;
}

export interface Member {
  id: string;
  meetingId: string;
  name: string;
  department: string;
}

export interface Attendance {
  id: string;
  sessionId: string;
  memberName: string;
  department: string;
  status: '출석' | '지각';
  attendedAt: string;
  deviceToken?: string;
}

// In-Memory Database Class with Singleton Pattern
class InMemoryDatabase {
  private meetings: Meeting[] = [];
  private sessions: Session[] = [];
  private members: Member[] = [];
  private attendances: Attendance[] = [];

  constructor() {
    this.initializeDummyData();
  }

  private initializeDummyData() {
    // 1. 기본 모임 생성
    const aiMeetingId = 'ai-study-101';
    this.meetings.push({
      id: aiMeetingId,
      title: '사내 Generative AI 스터디',
      description: 'LLM부터 RAG, AI Agent까지 최신 생성형 AI 트렌드와 프레임워크를 실습하는 모임',
      createdAt: new Date(2026, 4, 1).toISOString(),
    });

    this.meetings.push({
      id: 'frontend-trend',
      title: 'React & Next.js 모던 웹 기술 세미나',
      description: 'Next.js 15 App Router와 React 19의 변경점을 연구하고 실무에 도입하는 모임',
      createdAt: new Date(2026, 4, 10).toISOString(),
    });

    // 2. AI 스터디 세션(회차) 생성
    const session1Id = 'ai-session-1';
    const session2Id = 'ai-session-2';
    const session3Id = 'ai-session-3';

    this.sessions.push(
      {
        id: session1Id,
        meetingId: aiMeetingId,
        title: '1회차 - LLM 기초 및 Prompt Engineering 실무',
        date: '2026-05-20',
        startTime: '19:00',
        lateTime: '19:10',
        createdAt: new Date(2026, 4, 19).toISOString(),
      },
      {
        id: session2Id,
        meetingId: aiMeetingId,
        title: '2회차 - RAG (검색 증강 생성) 아키텍처와 벡터 DB 구축',
        date: '2026-05-27',
        startTime: '19:00',
        lateTime: '19:10',
        createdAt: new Date(2026, 4, 26).toISOString(),
      },
      {
        id: session3Id,
        meetingId: aiMeetingId,
        title: '3회차 - AI Agent & Autopilot 워크플로우 실무 설계',
        date: '2026-06-03',
        startTime: '19:00',
        lateTime: '19:10',
        createdAt: new Date(2026, 4, 29).toISOString(),
      }
    );

    // 3. AI 스터디 사전 등록 멤버 생성
    const dummyNames = [
      { name: '김민수', dept: 'AI개발팀' },
      { name: '이영희', dept: '서비스기획팀' },
      { name: '박준서', dept: '플랫폼개발실' },
      { name: '최지우', dept: 'UX/UI디자인그룹' },
      { name: '정우성', dept: '인프라운영팀' },
      { name: '한지원', dept: '데이터분석팀' },
      { name: '윤지민', dept: '인사(HR)팀' },
      { name: 'Scott', dept: 'AI이노베이션 TF' },
    ];

    dummyNames.forEach((member, index) => {
      this.members.push({
        id: `mem-${index + 1}`,
        meetingId: aiMeetingId,
        name: member.name,
        department: member.dept,
      });
    });

    // Frontend 세미나 멤버
    const frontendNames = [
      { name: '강동원', dept: '웹프론트엔드팀' },
      { name: '송혜교', dept: '플랫폼실' },
      { name: '유재석', dept: '서비스개발본부' },
      { name: 'Scott', dept: 'AI이노베이션 TF' },
    ];

    frontendNames.forEach((member, index) => {
      this.members.push({
        id: `femem-${index + 1}`,
        meetingId: 'frontend-trend',
        name: member.name,
        department: member.dept,
      });
    });

    // 4. 지난 세션 출석 데이터 미리 생성 (1회차 & 2회차)
    // 1회차 출석 (지각자 몇 명 포함)
    this.attendances.push(
      {
        id: 'att-1-1',
        sessionId: session1Id,
        memberName: '김민수',
        department: 'AI개발팀',
        status: '출석',
        attendedAt: '2026-05-20T18:52:10.000Z',
      },
      {
        id: 'att-1-2',
        sessionId: session1Id,
        memberName: '이영희',
        department: '서비스기획팀',
        status: '출석',
        attendedAt: '2026-05-20T18:55:30.000Z',
      },
      {
        id: 'att-1-3',
        sessionId: session1Id,
        memberName: '박준서',
        department: '플랫폼개발실',
        status: '출석',
        attendedAt: '2026-05-20T18:58:45.000Z',
      },
      {
        id: 'att-1-4',
        sessionId: session1Id,
        memberName: '최지우',
        department: 'UX/UI디자인그룹',
        status: '지각',
        attendedAt: '2026-05-20T19:12:05.000Z',
      },
      {
        id: 'att-1-5',
        sessionId: session1Id,
        memberName: '정우성',
        department: '인프라운영팀',
        status: '출석',
        attendedAt: '2026-05-20T19:03:20.000Z',
      },
      {
        id: 'att-1-6',
        sessionId: session1Id,
        memberName: 'Scott',
        department: 'AI이노베이션 TF',
        status: '출석',
        attendedAt: '2026-05-20T18:48:15.000Z',
      }
    );

    // 2회차 출석
    this.attendances.push(
      {
        id: 'att-2-1',
        sessionId: session2Id,
        memberName: '김민수',
        department: 'AI개발팀',
        status: '출석',
        attendedAt: '2026-05-27T18:50:11.000Z',
      },
      {
        id: 'att-2-2',
        sessionId: session2Id,
        memberName: '이영희',
        department: '서비스기획팀',
        status: '출석',
        attendedAt: '2026-05-27T18:58:22.000Z',
      },
      {
        id: 'att-2-3',
        sessionId: session2Id,
        memberName: '한지원',
        department: '데이터분석팀',
        status: '출석',
        attendedAt: '2026-05-27T19:02:40.000Z',
      },
      {
        id: 'att-2-4',
        sessionId: session2Id,
        memberName: 'Scott',
        department: 'AI이노베이션 TF',
        status: '지각',
        attendedAt: '2026-05-27T19:11:45.000Z',
      },
      {
        id: 'att-2-5',
        sessionId: session2Id,
        memberName: '최지우',
        department: 'UX/UI디자인그룹',
        status: '출석',
        attendedAt: '2026-05-27T18:54:30.000Z',
      }
    );
  }

  // --- API Methods ---

  // Meetings
  public getMeetings(): Meeting[] {
    return [...this.meetings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getMeeting(id: string): Meeting | undefined {
    return this.meetings.find(m => m.id === id);
  }

  public addMeeting(title: string, description: string): Meeting {
    const newMeeting: Meeting = {
      id: `mt-${Date.now()}`,
      title,
      description,
      createdAt: new Date().toISOString(),
    };
    this.meetings.push(newMeeting);
    return newMeeting;
  }

  public updateMeeting(id: string, title: string, description: string): Meeting | undefined {
    const meeting = this.meetings.find(m => m.id === id);
    if (meeting) {
      meeting.title = title;
      meeting.description = description;
      return meeting;
    }
    return undefined;
  }

  // Sessions
  public getSessions(meetingId: string): Session[] {
    return this.sessions
      .filter(s => s.meetingId === meetingId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }

  public getSession(id: string): Session | undefined {
    return this.sessions.find(s => s.id === id);
  }

  public addSession(meetingId: string, title: string, date: string, startTime: string, lateTime: string): Session {
    const newSession: Session = {
      id: `ss-${Date.now()}`,
      meetingId,
      title,
      date,
      startTime,
      lateTime,
      createdAt: new Date().toISOString(),
    };
    this.sessions.push(newSession);
    return newSession;
  }

  // Members
  public getMembers(meetingId: string): Member[] {
    return this.members.filter(m => m.meetingId === meetingId).sort((a, b) => a.name.localeCompare(b.name));
  }

  public addMember(meetingId: string, name: string, department: string): Member {
    const newMember: Member = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      meetingId,
      name,
      department,
    };
    this.members.push(newMember);
    return newMember;
  }

  public deleteMember(id: string): boolean {
    const initialLen = this.members.length;
    this.members = this.members.filter(m => m.id !== id);
    return this.members.length < initialLen;
  }

  // Attendances
  public getAttendances(sessionId: string): Attendance[] {
    return this.attendances
      .filter(a => a.sessionId === sessionId)
      .sort((a, b) => new Date(a.attendedAt).getTime() - new Date(b.attendedAt).getTime());
  }

  public addAttendance(
    sessionId: string,
    memberName: string,
    department: string,
    status: '출석' | '지각',
    deviceToken?: string
  ): Attendance | { error: string } {
    // 세션 존재 여부 확인
    const session = this.getSession(sessionId);
    if (!session) {
      return { error: '세션을 찾을 수 없습니다.' };
    }

    // 중복 출석 확인 (동일 세션에 같은 이름 혹은 같은 디바이스 토큰이 있는지 확인)
    const alreadyAttended = this.attendances.find(
      a =>
        a.sessionId === sessionId &&
        (a.memberName.toLowerCase() === memberName.toLowerCase() ||
          (deviceToken && a.deviceToken === deviceToken))
    );

    if (alreadyAttended) {
      return { error: '이미 출석이 완료되었습니다.' };
    }

    const newAttendance: Attendance = {
      id: `att-${Date.now()}`,
      sessionId,
      memberName,
      department,
      status,
      attendedAt: new Date().toISOString(),
      deviceToken,
    };

    this.attendances.push(newAttendance);
    return newAttendance;
  }
}

// Next.js hot-reloading safe singleton pattern
const globalForDb = globalThis as unknown as {
  db: InMemoryDatabase | undefined;
};

export const db = globalForDb.db ?? new InMemoryDatabase();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}
