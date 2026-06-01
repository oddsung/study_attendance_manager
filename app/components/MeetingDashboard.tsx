'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import {
  getMeeting,
  getSessions,
  getAttendances,
  createSession,
  Meeting,
  Session,
  Attendance,
} from '@/lib/api';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  QrCode,
  Printer,
  Gift,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  PartyPopper,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MeetingDashboardProps {
  meetingId: string;
}

export default function MeetingDashboard({ meetingId }: MeetingDashboardProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  
  // States for session creation
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionStart, setSessionStart] = useState('19:00');
  const [sessionLate, setSessionLate] = useState('19:10');
  
  // Loading & UI States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  
  // Lucky Draw State
  const [isLuckyDrawOpen, setIsLuckyDrawOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [winner, setWinner] = useState<Attendance | null>(null);
  const [drawSpeed, setDrawSpeed] = useState(100);
  const [drawIndex, setDrawIndex] = useState(0);

  // Realtime notification toast
  const [recentAttendee, setRecentAttendee] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const meetingData = await getMeeting(meetingId);
        if (!meetingData) {
          setError('모임을 찾을 수 없습니다.');
          return;
        }
        setMeeting(meetingData);
        
        const sessionsData = await getSessions(meetingId);
        setSessions(sessionsData);
        
        // 기본으로 가장 마지막 세션(가장 최근 일자의 세션)을 선택해 둡니다.
        if (sessionsData.length > 0) {
          setSelectedSession(sessionsData[sessionsData.length - 1]);
        }
      } catch (err) {
        console.error('Failed to load meeting dashboard:', err);
        setError('데이터를 불러오는 데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [meetingId]);

  // 선택된 세션이 변경될 때마다 출석 데이터 로드 및 QR 생성
  useEffect(() => {
    if (!selectedSession) {
      setAttendances([]);
      setQrCodeDataUrl('');
      return;
    }

    async function loadAttendances() {
      try {
        const attData = await getAttendances(selectedSession!.id);
        setAttendances(attData);
      } catch (err) {
        console.error('Failed to load attendances:', err);
      }
    }
    
    // QR 코드 생성
    const host = window.location.origin;
    const qrUrl = `${host}/attend/${selectedSession.id}`;
    QRCode.toDataURL(qrUrl, { width: 400, margin: 2 })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('QR code generation failed:', err));

    loadAttendances();

    // --- SUPABASE REALTIME SUBSCRIPTION ---
    // attendances 테이블의 insert 이벤트를 감지하여 실시간 업데이트 수행
    const channel = supabase
      .channel(`public:attendances:session_${selectedSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendances',
          filter: `session_id=eq.${selectedSession.id}`,
        },
        (payload) => {
          const newAttendance = payload.new as Attendance;
          setAttendances((prev) => {
            // 중복 방지 체크
            if (prev.some((a) => a.id === newAttendance.id)) return prev;
            return [...prev, newAttendance];
          });

          // 실시간으로 참석한 스터디원 알림 팝업 효과
          setRecentAttendee(`${newAttendance.member_name}님이 출석을 완료했습니다! 🎉`);
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.8 },
          });

          setTimeout(() => {
            setRecentAttendee(null);
          }, 4000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSession]);

  const handleAddSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim() || !sessionDate || !sessionStart || !sessionLate) return;

    setIsSubmittingSession(true);
    try {
      const newSession = await createSession(
        meetingId,
        sessionTitle,
        sessionDate,
        sessionStart,
        sessionLate
      );
      setSessions((prev) => [...prev, newSession].sort((a, b) => a.date.localeCompare(b.date)));
      setSelectedSession(newSession);
      setSessionTitle('');
      setIsAddingSession(false);
    } catch (err) {
      console.error('Failed to create session:', err);
      alert('세션 생성에 실패했습니다.');
    } finally {
      setIsSubmittingSession(false);
    }
  };

  // 럭키드로우 시작 로직
  const handleStartLuckyDraw = () => {
    if (attendances.length === 0) {
      alert('출석한 스터디원이 아직 없습니다!');
      return;
    }
    setIsLuckyDrawOpen(true);
    setWinner(null);
  };

  const handleDrawWinner = () => {
    if (attendances.length === 0 || isDrawing) return;

    setIsDrawing(true);
    setWinner(null);
    let speed = 80;
    let count = 0;
    const maxCounts = 35; // 룰렛 회전 수
    
    const cycle = () => {
      setDrawIndex((prevIndex) => (prevIndex + 1) % attendances.length);
      count++;
      
      if (count < maxCounts) {
        // 뒤로 갈수록 속도를 늦추어 긴장감 조성
        if (count > maxCounts - 10) speed += 30;
        else if (count > maxCounts - 5) speed += 65;
        
        setTimeout(cycle, speed);
      } else {
        // 최종 당첨자 선정
        const finalWinner = attendances[Math.floor(Math.random() * attendances.length)];
        setWinner(finalWinner);
        setIsDrawing(false);
        
        // 폭죽 효과
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    };
    
    setTimeout(cycle, speed);
  };

  // CSV 다운로드 기능
  const downloadCSV = () => {
    if (attendances.length === 0) return;
    
    const headers = ['성명', '사번', '부서', '출석상태', '출석일시'];
    const rows = attendances.map(a => [
      a.member_name,
      a.employee_number,
      a.department,
      a.status,
      new Date(a.attended_at).toLocaleString()
    ]);
    
    const csvContent = 
      '\uFEFF' + // UTF-8 BOM
      [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${meeting?.title}_${selectedSession?.title}_출석부.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printView = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-gray-500 text-sm font-medium">대시보드를 구성하는 중입니다...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{error || '모임을 찾을 수 없습니다.'}</h3>
        <Link href="/" className="inline-flex items-center gap-1 text-indigo-600 hover:underline text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>홈으로 돌아가기</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {/* Realtime Toast Pop */}
      {recentAttendee && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-500 text-white px-5 py-4 rounded-2xl shadow-2xl animate-bounce border border-emerald-400 max-w-sm">
          <PartyPopper className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm font-bold leading-tight">{recentAttendee}</div>
        </div>
      )}

      {/* Print Only Header (Hidden on Web Screen, Visible on Print) */}
      <div className="print-only-header">
        <h1>{meeting.title} 출석부</h1>
        <p>일시: {selectedSession ? `${selectedSession.date} ${selectedSession.start_time}` : '-'}</p>
        <p>세션주제: {selectedSession?.title}</p>
        <p>출석 인원: 총 {attendances.length}명 (지각: {attendances.filter(a => a.status === '지각').length}명)</p>
      </div>

      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 text-sm font-semibold transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>목록으로</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={printView}
            disabled={!selectedSession}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>출석부 인쇄</span>
          </button>
          
          <button
            onClick={downloadCSV}
            disabled={attendances.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV 저장</span>
          </button>

          <button
            onClick={handleStartLuckyDraw}
            disabled={attendances.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>럭키드로우 추첨</span>
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {meeting.title}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-2xl leading-relaxed">
            {meeting.description || '스터디 모임에 대한 간단한 설명을 등록해보세요.'}
          </p>
        </div>

        <div className="flex items-center gap-4 border-t border-gray-100 dark:border-gray-800/60 pt-4 md:border-t-0 md:pt-0">
          <div className="text-center bg-gray-50 dark:bg-gray-900/60 px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-800">
            <span className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">총 회차</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{sessions.length}회</span>
          </div>
          <div className="text-center bg-gray-50 dark:bg-gray-900/60 px-5 py-3 rounded-2xl border border-gray-100 dark:border-gray-800">
            <span className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">오늘 출석</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{attendances.length}명</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
        {/* Left Side: Sessions List & Add Session */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">회차 선택</h3>
              <button
                onClick={() => setIsAddingSession(!isAddingSession)}
                className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 rounded-lg text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Session Add Form */}
            {isAddingSession && (
              <form onSubmit={handleAddSessionSubmit} className="p-4 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3 animate-fade-in">
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400">새 회차 만들기</h4>
                
                <div className="space-y-1">
                  <input
                    type="text"
                    required
                    placeholder="예: 3주차 스터디 - RAG 설계"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">날짜</label>
                    <input
                      type="date"
                      required
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">시작 시간</label>
                    <input
                      type="time"
                      required
                      value={sessionStart}
                      onChange={(e) => setSessionStart(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">지각 판정 시간</label>
                  <input
                    type="time"
                    required
                    value={sessionLate}
                    onChange={(e) => setSessionLate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingSession(false)}
                    className="flex-1 py-1.5 text-[11px] border border-gray-200 dark:border-gray-800 rounded-lg font-semibold hover:bg-gray-100 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSession}
                    className="flex-1 py-1.5 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    생성
                  </button>
                </div>
              </form>
            )}

            {/* Sessions List */}
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">등록된 회차가 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1 cursor-pointer ${
                      selectedSession?.id === session.id
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                    }`}
                  >
                    <span className={`text-xs font-bold ${
                      selectedSession?.id === session.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {session.title}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-1">
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        {session.date}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {session.start_time} (지각: {session.late_time})
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center/Right: Selected Session Dashboard & Attendance List */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSession ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* QR Board (Large Screen display) */}
              <div className="md:col-span-5 bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-between gap-4 text-center">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 rounded-full text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                    <QrCode className="w-3 h-3" />
                    <span>실시간 출석 QR</span>
                  </div>
                  <h4 className="text-sm font-black text-gray-900 dark:text-white mt-1.5 line-clamp-1">{selectedSession.title}</h4>
                </div>

                {qrCodeDataUrl ? (
                  <div className="relative group p-1.5 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodeDataUrl} alt="Session QR" className="w-40 h-40 max-w-full" />
                  </div>
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center border border-gray-100 rounded-2xl bg-gray-50">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                  </div>
                )}

                <button
                  onClick={() => setIsPresentationMode(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 border border-indigo-100 hover:border-indigo-600 dark:border-indigo-950 dark:hover:border-indigo-500 bg-indigo-50/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>스크린 전체화면 모드</span>
                </button>
              </div>

              {/* Attendance Table */}
              <div className="md:col-span-7 glass-panel p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <h4 className="font-bold text-gray-950 dark:text-white text-sm">출석자 현황 ({attendances.length}명)</h4>
                  </div>
                  <span className="text-[10px] text-gray-400">지각: {attendances.filter(a => a.status === '지각').length}명</span>
                </div>

                {attendances.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500">
                      <QrCode className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200">출석 대기 중...</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">화면의 QR 코드를 스캔하여 출석을 시작해 주세요.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto max-h-56 pr-1 space-y-2">
                    {attendances.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-3 bg-white/40 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800/60 rounded-xl hover:bg-white/70 dark:hover:bg-gray-900/60 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-black text-xs">
                            {a.member_name[0]}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                              <span>{a.member_name}</span>
                              <span className="text-[9px] text-gray-400 font-normal">({a.employee_number})</span>
                            </div>
                            <div className="text-[9px] text-gray-400 mt-0.5">{a.department}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            a.status === '출석'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                          }`}>
                            {a.status}
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono">
                            {new Date(a.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/20 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
              <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">선택된 세션이 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1">대시보드를 확인하려면 회차를 추가하거나 선택하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* Screen Presentation Mode (Overlay) */}
      {isPresentationMode && selectedSession && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 text-white select-none animate-fade-in">
          <button
            onClick={() => setIsPresentationMode(false)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
          >
            <Minimize2 className="w-6 h-6" />
          </button>

          <div className="max-w-2xl w-full text-center space-y-8 animate-scale-in">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-xs font-black text-indigo-400 uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                <span>출석 인증 바코드 스캔</span>
              </span>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                {meeting.title}
              </h2>
              <p className="text-indigo-200 text-lg md:text-xl font-medium max-w-xl mx-auto line-clamp-1">
                {selectedSession.title}
              </p>
            </div>

            <div className="relative inline-block p-6 bg-white rounded-3xl shadow-[0_0_80px_rgba(99,102,241,0.25)] border-4 border-indigo-500/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeDataUrl} alt="Presentation QR" className="w-72 h-72 md:w-96 md:h-96 mx-auto select-none pointer-events-none" />
            </div>

            <div className="space-y-2">
              <p className="text-gray-300 md:text-lg font-light">
                스마트폰 카메라로 QR 코드를 스캔한 후, <span className="text-indigo-400 font-bold">성명/사번/부서</span>를 입력해 주세요.
              </p>
              <div className="text-xs text-indigo-400/80 font-mono mt-4 flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>현재 출석 완료 인원: {attendances.length}명</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lucky Draw Modal */}
      {isLuckyDrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in no-print">
          <div className="relative w-full max-w-lg bg-gray-950 border border-gray-800 rounded-3xl shadow-2xl p-6 md:p-8 overflow-hidden text-center text-white">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

            <div className="space-y-6">
              <div className="space-y-1">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
                  <Gift className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-2xl font-black tracking-tight mt-3">실시간 럭키드로우</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  당일 출석이 확인된 스터디원 {attendances.length}명 중에서 행운의 주인공 1명을 선정합니다!
                </p>
              </div>

              {/* Roulette Display Area */}
              <div className="relative py-12 px-6 rounded-2xl bg-gray-900/60 border border-gray-800 flex items-center justify-center min-h-36 overflow-hidden">
                {isDrawing ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="text-3xl font-black text-indigo-400 tracking-wide transition-all">
                      {attendances[drawIndex]?.member_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {attendances[drawIndex]?.department} ({attendances[drawIndex]?.employee_number})
                    </div>
                  </div>
                ) : winner ? (
                  <div className="space-y-3 animate-scale-in">
                    <span className="inline-flex gap-1 items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black text-emerald-400 tracking-wider uppercase mx-auto">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>축하합니다!</span>
                    </span>
                    <div className="text-4xl font-black text-gradient leading-none">
                      {winner.member_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {winner.department} • 사번 {winner.employee_number}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm font-medium">
                    '추첨 시작' 버튼을 누르면 랜덤 추첨을 시작합니다.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsLuckyDrawOpen(false)}
                  className="flex-1 py-3 bg-gray-900 border border-gray-800 text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleDrawWinner}
                  disabled={isDrawing || attendances.length === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-bold hover:from-indigo-600 hover:to-violet-700 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isDrawing ? '추첨 진행 중...' : '추첨 시작'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A4 Print Layout Only Content (Hidden on Web Screen, Visible on Print) */}
      <div className="hidden print:block print-container">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>성명</th>
              <th>사번</th>
              <th>부서</th>
              <th>출석 상태</th>
              <th>출석 완료 시각</th>
            </tr>
          </thead>
          <tbody>
            {attendances.map((a, idx) => (
              <tr key={a.id}>
                <td>{idx + 1}</td>
                <td>{a.member_name}</td>
                <td>{a.employee_number}</td>
                <td>{a.department}</td>
                <td>
                  <span className={a.status === '지각' ? 'text-amber-600 font-bold' : ''}>
                    {a.status}
                  </span>
                </td>
                <td>{new Date(a.attended_at).toLocaleTimeString()}</td>
              </tr>
            ))}
            {attendances.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center' }}>출석자가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
