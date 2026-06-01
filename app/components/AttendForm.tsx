'use client';

import React, { useEffect, useState } from 'react';
import { getSession, submitAttendance, Session, Meeting } from '@/lib/api';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Smartphone, 
  User, 
  FileText, 
  Building2, 
  Clock, 
  Calendar 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AttendFormProps {
  sessionId: string;
}

export default function AttendForm({ sessionId }: AttendFormProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form input states
  const [name, setName] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Attendance completion states
  const [isAttended, setIsAttended] = useState(false);
  const [attendanceDetail, setAttendanceDetail] = useState<{
    member_name: string;
    employee_number: string;
    department: string;
    status: '출석' | '지각';
    attended_at: string;
  } | null>(null);

  useEffect(() => {
    // 1. 이미 이 세션에 출석했는지 브라우저 LocalStorage 확인
    const saved = localStorage.getItem(`attended_session_${sessionId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setIsAttended(true);
        setAttendanceDetail(parsed);
      } catch (e) {
        console.error('Failed to parse saved attendance:', e);
      }
    }

    // 2. 세션 및 모임 메타데이터 조회
    async function loadSessionData() {
      try {
        const sessionData = await getSession(sessionId);
        if (!sessionData) {
          setError('해당 세션을 찾을 수 없거나 유효하지 않은 QR 코드입니다.');
          return;
        }
        setSession(sessionData);

        // 모임 정보 로딩
        const { getMeeting } = await import('@/lib/api');
        const meetingData = await getMeeting(sessionData.meeting_id);
        setMeeting(meetingData);
      } catch (err) {
        console.error('Failed to load session data:', err);
        setError('세션 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    loadSessionData();
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !employeeNumber.trim() || !department.trim()) return;

    setIsSubmitting(true);
    setError('');

    // 기기 식별용 토큰 생성 또는 조회
    let deviceToken = localStorage.getItem('attendance_device_token');
    if (!deviceToken) {
      deviceToken = `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('attendance_device_token', deviceToken);
    }

    try {
      const result = await submitAttendance(
        sessionId,
        name.trim(),
        employeeNumber.trim().toUpperCase(),
        department.trim(),
        deviceToken
      );

      // 성공 데이터 상태 세팅
      const attInfo = {
        member_name: result.member_name,
        employee_number: result.employee_number,
        department: result.department,
        status: result.status,
        attended_at: result.attended_at,
      };
      
      setAttendanceDetail(attInfo);
      setIsAttended(true);

      // 브라우저에 출석 처리 기록 (중복 방지용)
      localStorage.setItem(`attended_session_${sessionId}`, JSON.stringify(attInfo));

      // 폰에서 폭죽 축하 효과
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err: any) {
      console.error('Failed to submit attendance:', err);
      setError(err.message || '출석 제출에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-gray-500 text-sm font-semibold">출석 체크 화면 로딩 중...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="glass-panel p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center space-y-4 shadow-xl">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-black text-gray-900 dark:text-white">접속 오류</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        <div className="text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-4">
          사내 스크린에 띄워진 최신 QR 코드를 다시 확인해 주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 1. 출석 완료 화면 */}
      {isAttended && attendanceDetail ? (
        <div className="glass-panel p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center space-y-6 shadow-2xl animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex gap-1 items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black text-emerald-400 tracking-wider uppercase mx-auto">
              <Sparkles className="w-3.5 h-3.5" />
              <span>출석 완료</span>
            </span>
            <h3 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white mt-2">
              출석 인증 성공!
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {meeting?.title} • {session?.title}
            </p>
          </div>

          {/* User Attendance Card */}
          <div className="bg-gray-50 dark:bg-gray-900/60 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 text-left space-y-3">
            <div className="flex justify-between border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase">성명 (사번)</span>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                {attendanceDetail.member_name} ({attendanceDetail.employee_number})
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase">소속 부서</span>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {attendanceDetail.department}
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-100 dark:border-gray-800/80 pb-2.5">
              <span className="text-[11px] font-bold text-gray-400 uppercase">판정 상태</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                attendanceDetail.status === '출석' 
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
              }`}>
                {attendanceDetail.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase">스캔 시각</span>
              <span className="text-xs font-mono text-gray-500">
                {new Date(attendanceDetail.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-400 text-center leading-relaxed">
            이제 브라우저를 닫으셔도 좋습니다.<br />관리자 스크린 대시보드에 실시간으로 반영되었습니다.
          </div>
        </div>
      ) : (
        /* 2. 출석 작성 화면 */
        <div className="glass-panel p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl space-y-6">
          <div className="text-center space-y-2 border-b border-gray-100 dark:border-gray-800/80 pb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-500/20 mb-2">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">출석 인증 및 제출</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {meeting?.title || '스터디 모임'}
            </p>
            <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-950/20 inline-flex items-center gap-1.5 px-3 py-1 rounded-full mt-1.5 border border-indigo-100/50 dark:border-indigo-900/50">
              <Clock className="w-3 h-3" />
              <span>{session?.title}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 입력 */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 uppercase tracking-wide">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>성명 (필수)</span>
              </label>
              <input
                type="text"
                required
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>

            {/* 사번 입력 */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 uppercase tracking-wide">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>사번 (필수)</span>
              </label>
              <input
                type="text"
                required
                placeholder="EMP001"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>

            {/* 부서 입력 */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 uppercase tracking-wide">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>소속 부서 (필수)</span>
              </label>
              <input
                type="text"
                required
                placeholder="AI개발팀"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !employeeNumber.trim() || !department.trim()}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/10 hover-lift disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>출석 제출 중...</span>
                  </span>
                ) : (
                  <span>출석 완료하기</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
