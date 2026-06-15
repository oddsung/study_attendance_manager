'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  getSession, 
  submitAttendance, 
  getMeeting, 
  getSessions, 
  getMeetingAttendances, 
  Session, 
  Meeting, 
  Attendance 
} from '@/lib/api';
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
  Calendar,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AttendFormProps {
  sessionId: string;
}

const isSessionFinished = (session: Session) => {
  if (!session.date || !session.end_time) return false;
  try {
    const now = new Date();
    const koreaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const yyyy = koreaDate.getFullYear();
    const mm = String(koreaDate.getMonth() + 1).padStart(2, '0');
    const dd = String(koreaDate.getDate()).padStart(2, '0');
    const currentDateStr = `${yyyy}-${mm}-${dd}`;
    
    if (currentDateStr > session.date) return true;
    if (currentDateStr === session.date) {
      const currentHour = koreaDate.getHours();
      const currentMinute = koreaDate.getMinutes();
      const currentTimeVal = currentHour * 60 + currentMinute;
      
      const [endHour, endMinute] = session.end_time.split(':').map(Number);
      const endTimeVal = (endHour || 0) * 60 + (endMinute || 0);
      return currentTimeVal > endTimeVal;
    }
  } catch (e) {
    console.error('Error checking if session is finished:', e);
  }
  return false;
};

export default function AttendForm({ sessionId }: AttendFormProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const retryCountRef = useRef(0);
  
  // Form input states
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Attendance completion states
  const [isAttended, setIsAttended] = useState(false);
  const [attendanceDetail, setAttendanceDetail] = useState<Attendance | null>(null);

  // History states
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<Session[]>([]);
  const [historyAttendances, setHistoryAttendances] = useState<Attendance[]>([]);
  const [historyError, setHistoryError] = useState('');

  // Service Worker 등록 (ngrok 인터스티셜 바이패스)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/ngrok-sw.js').then((existing) => {
        if (existing) return; // 이미 등록된 경우 스킵
        navigator.serviceWorker
          .register('/ngrok-sw.js', { scope: '/' })
          .then((registration) => {
            console.log('[ngrok-sw] Service Worker registered:', registration.scope);
            // SW가 처음 활성화되면 페이지를 리로드하여 이후 모든 요청에 헤더가 추가되도록 함
            const sw = registration.installing || registration.waiting;
            if (sw) {
              sw.addEventListener('statechange', (e: Event) => {
                if ((e.target as ServiceWorker)?.state === 'activated') {
                  console.log('[ngrok-sw] Service Worker activated, reloading page...');
                  window.location.reload();
                }
              });
            }
          })
          .catch((err) => {
            console.warn('[ngrok-sw] Service Worker registration failed:', err);
          });
      });
    }
  }, []);

  // 세션 데이터 로드 함수 (재시도 가능하도록 분리)
  const loadSessionData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setLoadingTimedOut(false);

    try {
      const sessionData = await getSession(sessionId);
      if (!sessionData) {
        setError('해당 세션을 찾을 수 없거나 유효하지 않은 QR 코드입니다.');
        return;
      }
      setSession(sessionData);

      // 모임 정보 로딩
      const meetingData = await getMeeting(sessionData.meeting_id);
      setMeeting(meetingData);
    } catch (err) {
      console.error('Failed to load session data:', err);
      setError('세션 정보를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    // 1. 이미 이 세션에 출석했는지 브라우저 LocalStorage 확인 (iOS 프라이빗 탭 / 인앱브라우저 예외 대응)
    try {
      const saved = localStorage.getItem(`attended_session_${sessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setIsAttended(true);
        setAttendanceDetail(parsed);
      } else {
        // 1-2. 최근 출석 정보가 있으면 입력 필드 자동 완성 (편의성 제공)
        const savedName = localStorage.getItem('last_attended_name');
        const savedDept = localStorage.getItem('last_attended_department');
        if (savedName) setName(savedName);
        if (savedDept) setDepartment(savedDept);
      }
    } catch (e) {
      console.warn('LocalStorage is blocked or not supported on this browser/mode:', e);
    }

    // 2. 세션 및 모임 메타데이터 조회
    loadSessionData();

    // 3. 로딩 타임아웃 설정 (15초 후 자동 1회 재시도, 그래도 안되면 에러 표시)
    const timeoutId = setTimeout(() => {
      setLoadingTimedOut(true);
      // 자동 1회 재시도
      if (retryCountRef.current === 0) {
        retryCountRef.current = 1;
        console.log('[attend] Loading timed out, auto-retrying...');
        loadSessionData();
      }
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [sessionId, loadSessionData]);

  // 이전 출석 내역 로드 함수
  const fetchHistory = useCallback(async () => {
    if (!meeting?.id || !attendanceDetail) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const [sessionsData, attendancesData] = await Promise.all([
        getSessions(meeting.id),
        getMeetingAttendances(meeting.id),
      ]);
      setHistorySessions(sessionsData);
      setHistoryAttendances(attendancesData);
    } catch (err) {
      console.error('Failed to load attendance history:', err);
      setHistoryError('출석 내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  }, [meeting?.id, attendanceDetail]);

  useEffect(() => {
    if (isAttended && meeting?.id && attendanceDetail) {
      fetchHistory();
    }
  }, [isAttended, meeting?.id, attendanceDetail, fetchHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !department.trim()) return;

    setIsSubmitting(true);
    setError('');

    // 기기 식별용 토큰 생성 또는 조회 (iOS 인앱브라우저 대응 예외 처리)
    let deviceToken = '';
    try {
      deviceToken = localStorage.getItem('attendance_device_token') || '';
      if (!deviceToken) {
        deviceToken = `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('attendance_device_token', deviceToken);
      }
    } catch (e) {
      console.warn('LocalStorage is not available for device token, using memory fallback:', e);
      // 로컬 스토리지가 막혀 있는 경우 일회성 메모리 토큰으로 안전한 대체 작동 유도
      deviceToken = `dev-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }

    // 사번 대신 기기 토큰 기반의 고유 가상 사번 생성 (예: dev-1776940... -> EMP-1776940...)
    const cleanToken = deviceToken.replace('dev-', '');
    const generatedEmployeeNumber = `EMP-${cleanToken.split('-')[0] || cleanToken.substring(0, 8)}`;

    try {
      const result = await submitAttendance(
        sessionId,
        name.trim(),
        generatedEmployeeNumber,
        department.trim(),
        deviceToken
      );

      setAttendanceDetail(result);
      setIsAttended(true);

      // 브라우저에 출석 처리 기록 (중복 방지용 - 예외 처리 포함)
      try {
        localStorage.setItem(`attended_session_${sessionId}`, JSON.stringify(result));
        localStorage.setItem('last_attended_name', result.member_name);
        localStorage.setItem('last_attended_department', result.department);
      } catch (e) {
        console.warn('Could not save attendance to localStorage due to browser restrictions:', e);
      }

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

  // 내역 통계 계산
  const userAttendances = attendanceDetail 
    ? historyAttendances.filter(
        a => a.member_name.trim() === attendanceDetail.member_name.trim() && 
             a.department.trim() === attendanceDetail.department.trim()
      )
    : [];

  const attendedCount = userAttendances.filter(a => a.status === '출석').length;
  const tardyCount = userAttendances.filter(a => a.status === '지각').length;
  const manualAbsentCount = userAttendances.filter(a => a.status === '결석').length;

  const autoAbsentCount = historySessions.filter(s => {
    const finished = isSessionFinished(s);
    const hasRecord = userAttendances.some(a => a.session_id === s.id);
    return finished && !hasRecord;
  }).length;

  const absentCount = manualAbsentCount + autoAbsentCount;
  const totalSessions = historySessions.length;
  const attendanceRate = totalSessions > 0 
    ? Math.round(((attendedCount + tardyCount) / totalSessions) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-6">
        <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
        <p className="text-slate-800 text-xl font-extrabold tracking-wide">출석 체크 화면 로딩 중...</p>
        {loadingTimedOut && (
          <div className="text-center space-y-4 animate-fade-in">
            <p className="text-base font-bold text-amber-700 bg-amber-50 px-5 py-3 rounded-xl border border-amber-200">
              연결이 지연되고 있습니다. 자동 재시도 중...
            </p>
            <button
              onClick={() => {
                retryCountRef.current = 0;
                loadSessionData();
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-base font-bold shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-5 h-5" />
              <span>수동 새로고침</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="bg-white p-10 rounded-3xl border-2 border-red-100 text-center space-y-6 shadow-2xl">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
        <h3 className="text-2xl font-black text-slate-900">접속 오류</h3>
        <p className="text-lg font-bold text-slate-700 leading-relaxed">{error}</p>
        <div className="text-sm font-semibold text-slate-500 border-t-2 border-slate-100 pt-6">
          사내 스크린에 띄워진 최신 QR 코드를 다시 확인해 주세요.
        </div>
      </div>
    );
  }

  if (meeting?.is_closed && !isAttended) {
    return (
      <div className="bg-white p-10 rounded-3xl border-2 border-red-100 text-center space-y-6 shadow-2xl">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
        <h3 className="text-2xl font-black text-slate-900">모임 종료</h3>
        <p className="text-lg font-bold text-slate-700 leading-relaxed">
          이 스터디 모임은 이미 종료되었습니다.<br />종료된 모임의 출석체크는 진행할 수 없습니다.
        </p>
        <div className="text-sm font-semibold text-slate-500 border-t-2 border-slate-100 pt-6">
          기타 문의사항은 스터디 관리자에게 문의해 주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 1. 출석 완료 화면 */}
      {isAttended && attendanceDetail ? (
        <div className="bg-white p-8 md:p-12 rounded-3xl border-2 border-indigo-100 text-center space-y-8 shadow-2xl animate-scale-in">
          <div className="w-24 h-24 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-inner">
            <CheckCircle2 className="w-14 h-14" />
          </div>

          <div className="space-y-3">
            <span className="inline-flex gap-1.5 items-center px-4 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-sm font-extrabold text-emerald-800 tracking-wider uppercase mx-auto">
              <Sparkles className="w-4 h-4" />
              <span>출석 완료</span>
            </span>
            <h3 className="text-3xl font-black tracking-tight text-slate-900 mt-4">
              출석 인증 성공!
            </h3>
            <p className="text-lg font-bold text-slate-600">
              {meeting?.title} • {session?.title}
            </p>
          </div>

          {/* User Attendance Card */}
          <div className="bg-slate-50 border-2 border-slate-100 p-6 md:p-8 rounded-2xl text-left space-y-5">
            <div className="flex justify-between items-center border-b-2 border-slate-200/60 pb-3.5">
              <span className="text-base font-black text-slate-500 uppercase">성명</span>
              <span className="text-2xl font-black text-slate-900">
                {attendanceDetail.member_name}
              </span>
            </div>
            <div className="flex justify-between items-center border-b-2 border-slate-200/60 pb-3.5">
              <span className="text-base font-black text-slate-500 uppercase">소속 부서</span>
              <span className="text-2xl font-black text-slate-900">
                {attendanceDetail.department}
              </span>
            </div>
            <div className="flex justify-between items-center border-b-2 border-slate-200/60 pb-3.5">
              <span className="text-base font-black text-slate-500 uppercase">판정 상태</span>
              <span className={`inline-flex px-4 py-1 rounded-xl text-lg font-extrabold border ${
                attendanceDetail.status === '출석' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {attendanceDetail.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-black text-slate-500 uppercase">스캔 시각</span>
              <span className="text-xl font-bold text-slate-800">
                {new Date(attendanceDetail.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          {/* 나의 출석 히스토리 섹션 */}
          <div className="border-t-2 border-dashed border-indigo-100 pt-8 mt-6 text-left">
            <h4 className="text-xl font-black text-slate-900 flex items-center gap-2 mb-5">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <FileText className="w-5.5 h-5.5" />
              </span>
              <span>나의 출석 히스토리</span>
            </h4>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm font-semibold text-slate-500">이전 출석 내역을 가져오고 있습니다...</p>
              </div>
            ) : historyError ? (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm font-medium flex items-center justify-between">
                <span>{historyError}</span>
                <button 
                  onClick={fetchHistory}
                  className="px-3 py-1 bg-white hover:bg-rose-100 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  재시도
                </button>
              </div>
            ) : historySessions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">등록된 회차가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {/* 요약 대시보드 카드 */}
                <div className="bg-indigo-50/30 border border-indigo-100/80 rounded-2xl p-4.5 grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-sm flex flex-col justify-center">
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">출석률</span>
                    <span className="text-xl font-black text-indigo-600">{attendanceRate}%</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-sm flex flex-col justify-center">
                    <span className="block text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider">출석</span>
                    <span className="text-xl font-black text-emerald-600">{attendedCount}회</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-sm flex flex-col justify-center">
                    <span className="block text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">지각</span>
                    <span className="text-xl font-black text-amber-600">{tardyCount}회</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-50 shadow-sm flex flex-col justify-center">
                    <span className="block text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">결석</span>
                    <span className="text-xl font-black text-rose-600">{absentCount}회</span>
                  </div>
                </div>

                {/* 회차 목록 타임라인 */}
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {historySessions.map((s) => {
                    const att = historyAttendances.find(
                      a => a.session_id === s.id && 
                           a.member_name.trim() === attendanceDetail.member_name.trim() && 
                           a.department.trim() === attendanceDetail.department.trim()
                    );
                    
                    const isCurrent = s.id === sessionId;
                    const finished = isSessionFinished(s);

                    let statusLabel = '대기 중';
                    let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
                    let statusIcon = <Calendar className="w-4 h-4 text-slate-400" />;
                    let detailText = '';

                    if (att) {
                      if (att.status === '출석') {
                        statusLabel = '출석';
                        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        statusIcon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                        detailText = new Date(att.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      } else if (att.status === '지각') {
                        statusLabel = '지각';
                        badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                        statusIcon = <Clock className="w-4 h-4 text-amber-600" />;
                        detailText = new Date(att.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      } else if (att.status === '결석') {
                        statusLabel = '결석';
                        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                        statusIcon = <AlertCircle className="w-4 h-4 text-rose-600" />;
                        detailText = att.memo || '결석 처리됨';
                      }
                    } else if (finished) {
                      statusLabel = '결석';
                      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                      statusIcon = <AlertCircle className="w-4 h-4 text-rose-600" />;
                      detailText = '결석 (미출석)';
                    }

                    return (
                      <div 
                        key={s.id} 
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          isCurrent 
                            ? 'bg-indigo-50/40 border-indigo-200 ring-2 ring-indigo-100' 
                            : 'bg-white border-slate-100 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isCurrent ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-slate-100'
                          }`}>
                            {statusIcon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-black truncate ${isCurrent ? 'text-indigo-900' : 'text-slate-800'}`}>
                                {s.title}
                              </span>
                              {isCurrent && (
                                <span className="inline-flex px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-700 bg-indigo-100 rounded border border-indigo-200 animate-pulse">
                                  현재 회차
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                              일시: {s.date} {s.start_time.substring(0, 5)}
                            </span>
                            {att?.memo && (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 block mt-1 w-fit">
                                💬 메모: {att.memo}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-lg border uppercase tracking-wider ${badgeClass}`}>
                            {statusLabel}
                          </span>
                          {detailText && (
                            <span className="text-[10px] font-bold text-slate-500">
                              {detailText}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="text-base font-bold text-slate-700 text-center leading-relaxed bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
            이제 브라우저를 닫으셔도 좋습니다.<br />관리자 스크린 대시보드에 실시간으로 반영되었습니다.
          </div>
        </div>
      ) : (
        /* 2. 출석 작성 화면 */
        <div className="bg-white p-8 md:p-12 rounded-3xl border-2 border-indigo-100 shadow-2xl space-y-8">
          <div className="text-center space-y-3 border-b-2 border-slate-100 pb-6">
            <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-200 mb-3 shadow-inner">
              <Smartphone className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">출석 인증 및 제출</h3>
            <p className="text-lg font-bold text-slate-600">
              {meeting?.title || '스터디 모임'}
            </p>
            <div className="text-sm text-indigo-700 font-extrabold bg-indigo-50 inline-flex items-center gap-2 px-4 py-2 rounded-full mt-2 border-2 border-indigo-100">
              <Smartphone className="w-4 h-4 text-indigo-500" />
              <span>{session?.title}</span>
            </div>

            {session && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-xs font-bold text-slate-500 mt-3 bg-slate-50/50 py-2.5 px-4 rounded-xl border border-slate-100 w-full">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500/70" />
                  <span>날짜: {session.date}</span>
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-500/70" />
                  <span>시간: {session.start_time?.substring(0, 5)} ~ {session.end_time?.substring(0, 5)}</span>
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 border-2 border-red-100 rounded-2xl text-base font-extrabold flex items-center gap-2.5">
              <AlertCircle className="w-5.5 h-5.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이름 입력 */}
            <div className="space-y-2">
              <label className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-wide uppercase">
                <User className="w-5.5 h-5.5 text-indigo-500" />
                <span>성명 (필수)</span>
              </label>
              <input
                type="text"
                required
                placeholder="예) 홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-6 py-5 rounded-2xl border-2 border-indigo-200 bg-slate-50 text-xl font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-600 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* 부서 입력 */}
            <div className="space-y-2">
              <label className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-wide uppercase">
                <Building2 className="w-5.5 h-5.5 text-indigo-500" />
                <span>소속 부서 (필수)</span>
              </label>
              <input
                type="text"
                required
                placeholder="예) AI개발팀"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-6 py-5 rounded-2xl border-2 border-indigo-200 bg-slate-50 text-xl font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-600 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !department.trim()}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xl font-black shadow-xl shadow-indigo-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
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
