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
  deleteMeeting,
  updateSession,
  deleteSession,
  reorderSessions,
  updateMeeting,
  getMembers,
  addMember,
  addMembersBulk,
  deleteMember,
  updateAttendanceManual,
  toggleMeetingStatus,
  getMeetingAttendances,
  Meeting,
  Session,
  Attendance,
  Member,
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
  Trash2,
  Pencil,
  GripVertical,
  Copy,
} from 'lucide-react';
import confetti from 'canvas-confetti';

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

interface MeetingDashboardProps {
  meetingId: string;
}

export default function MeetingDashboard({ meetingId }: MeetingDashboardProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  
  // States for session creation/edit
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionStart, setSessionStart] = useState('19:00');
  const [sessionLate, setSessionLate] = useState('19:10');
  const [sessionEnd, setSessionEnd] = useState('21:00');
  
  // Loading & UI States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  
  // Lucky Draw State
  const [isLuckyDrawOpen, setIsLuckyDrawOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Print & Close Meeting States
  const [printType, setPrintType] = useState<'session' | 'all'>('session');
  const [allAttendances, setAllAttendances] = useState<Attendance[]>([]);
  const [isFetchingAllAttendances, setIsFetchingAllAttendances] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [winner, setWinner] = useState<Attendance | null>(null);
  const [drawSpeed, setDrawSpeed] = useState(100);
  const [drawIndex, setDrawIndex] = useState(0);

  // Realtime notification toast
  const [recentAttendee, setRecentAttendee] = useState<string | null>(null);

  // Drag and Drop States
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // States for meeting edit
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [editMeetingTitle, setEditMeetingTitle] = useState('');
  const [editMeetingDescription, setEditMeetingDescription] = useState('');
  const [editMeetingStart, setEditMeetingStart] = useState('');
  const [editMeetingLate, setEditMeetingLate] = useState('');
  const [editMeetingEnd, setEditMeetingEnd] = useState('');
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);

  // States for roster / members management
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberDept, setNewMemberDept] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [dashboardTab, setDashboardTab] = useState<'attendance' | 'roster'>('attendance');
  const [localMemos, setLocalMemos] = useState<Record<string, string>>({});

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

        const membersData = await getMembers(meetingId);
        setMembers(membersData);
        
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

    // 5초 간격으로 출석 데이터 자동 새로고침(Refresh) 실행
    const refreshInterval = setInterval(() => {
      loadAttendances();
    }, 5000);

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

          // 실시간으로 참석한 스터디원 알림 팝업 효과 ('출석' 및 '지각' 상태인 경우만)
          if (newAttendance.status === '출석' || newAttendance.status === '지각') {
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
        }
      )
      .subscribe();

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [selectedSession]);

  const handleStartAddSession = () => {
    setIsEditingSession(false);
    setIsAddingSession(!isAddingSession);
    setSessionTitle('');
    setSessionDate(new Date().toISOString().split('T')[0]);
    setSessionStart(meeting?.default_start_time?.substring(0, 5) || '19:00');
    setSessionLate(meeting?.default_late_time?.substring(0, 5) || '19:10');
    setSessionEnd(meeting?.default_end_time?.substring(0, 5) || '21:00');
  };

  const handleStartEditSession = () => {
    if (!selectedSession) return;
    setIsAddingSession(false);
    setIsEditingSession(!isEditingSession);
    setSessionTitle(selectedSession.title);
    setSessionDate(selectedSession.date);
    setSessionStart(selectedSession.start_time.substring(0, 5));
    setSessionLate(selectedSession.late_time.substring(0, 5));
    setSessionEnd(selectedSession.end_time.substring(0, 5));
  };

  // 회차 목록 정렬 헬퍼 (sort_order -> date -> start_time 순)
  const sortSessions = (list: Session[]) => {
    return [...list].sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
    });
  };

  const handleAddSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim() || !sessionDate || !sessionStart || !sessionLate || !sessionEnd) return;

    setIsSubmittingSession(true);
    try {
      const newSession = await createSession(
        meetingId,
        sessionTitle,
        sessionDate,
        sessionStart,
        sessionLate,
        sessionEnd
      );
      setSessions((prev) => sortSessions([...prev, newSession]));
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

  const handleEditSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !sessionTitle.trim() || !sessionDate || !sessionStart || !sessionLate || !sessionEnd) return;

    setIsSubmittingSession(true);
    try {
      const updated = await updateSession(
        selectedSession.id,
        sessionTitle,
        sessionDate,
        sessionStart,
        sessionLate,
        sessionEnd
      );
      
      const mappedUpdated: Session = {
        id: updated.id,
        meeting_id: updated.meeting_id,
        title: updated.title,
        date: updated.date,
        start_time: updated.start_time,
        late_time: updated.late_time,
        end_time: updated.end_time,
        created_at: updated.created_at,
        sort_order: updated.sort_order,
      };

      setSessions((prev) =>
        sortSessions(prev.map((s) => (s.id === mappedUpdated.id ? mappedUpdated : s)))
      );
      setSelectedSession(mappedUpdated);
      setIsEditingSession(false);
    } catch (err) {
      console.error('Failed to update session:', err);
      alert('세션 수정에 실패했습니다.');
    } finally {
      setIsSubmittingSession(false);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSessions = [...sessions];
    const draggedItem = newSessions[draggedIndex];
    newSessions.splice(draggedIndex, 1);
    newSessions.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setSessions(newSessions);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    try {
      const sessionIds = sessions.map((s) => s.id);
      await reorderSessions(meetingId, sessionIds);
      // 로컬 상태 동기화
      setSessions((prev) =>
        prev.map((s, index) => ({ ...s, sort_order: index }))
      );
    } catch (err) {
      console.error('Failed to save session order:', err);
      alert('순서 저장에 실패했습니다.');
      try {
        const sessionsData = await getSessions(meetingId);
        setSessions(sessionsData);
      } catch (loadErr) {
        console.error('Failed to reload sessions:', loadErr);
      }
    }
  };

  // Delete Session Handler
  const handleDeleteSession = async (session: Session) => {
    const confirmDelete = window.confirm(
      `"${session.title}" 회차를 정말 삭제하시겠습니까?\n삭제 시 해당 회차의 모든 출석 정보도 영구히 삭제되며 복구할 수 없습니다.`
    );
    if (!confirmDelete) return;

    try {
      await deleteSession(session.id);
      const updatedSessions = sessions.filter((s) => s.id !== session.id);
      setSessions(updatedSessions);
      
      if (selectedSession?.id === session.id) {
        if (updatedSessions.length > 0) {
          setSelectedSession(updatedSessions[updatedSessions.length - 1]);
        } else {
          setSelectedSession(null);
        }
      }
      alert('회차가 삭제되었습니다.');
    } catch (err) {
      console.error('Failed to delete session:', err);
      alert('회차 삭제에 실패했습니다.');
    }
  };

  // Copy Session Handler
  const handleCopySession = (session: Session) => {
    setIsEditingSession(false);
    setIsAddingSession(true);
    
    // 제목 prefill
    setSessionTitle(session.title);

    // 날짜 prefill (+7일 계산)
    const oldDate = new Date(session.date);
    if (!isNaN(oldDate.getTime())) {
      oldDate.setDate(oldDate.getDate() + 7);
      setSessionDate(oldDate.toISOString().split('T')[0]);
    } else {
      setSessionDate(session.date);
    }

    // 시간 포맷팅 (HH:MM:SS -> HH:MM)
    const formatTime = (timeStr: string) => {
      if (!timeStr) return '';
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
      }
      return timeStr;
    };

    setSessionStart(formatTime(session.start_time));
    setSessionLate(formatTime(session.late_time));
    setSessionEnd(formatTime(session.end_time));
  };

  // 럭키드로우 시작 로직
  const handleStartLuckyDraw = () => {
    const presentAttendances = attendances.filter((a) => a.status === '출석' || a.status === '지각');
    if (presentAttendances.length === 0) {
      alert('출석한 스터디원이 아직 없습니다!');
      return;
    }
    setIsLuckyDrawOpen(true);
    setWinner(null);
  };

  const handleDrawWinner = () => {
    const presentAttendances = attendances.filter((a) => a.status === '출석' || a.status === '지각');
    if (presentAttendances.length === 0 || isDrawing) return;

    setIsDrawing(true);
    setWinner(null);
    let speed = 80;
    let count = 0;
    const maxCounts = 35; // 룰렛 회전 수
    
    const cycle = () => {
      setDrawIndex((prevIndex) => (prevIndex + 1) % presentAttendances.length);
      count++;
      
      if (count < maxCounts) {
        // 뒤로 갈수록 속도를 늦추어 긴장감 조성
        if (count > maxCounts - 10) speed += 30;
        else if (count > maxCounts - 5) speed += 65;
        
        setTimeout(cycle, speed);
      } else {
        // 최종 당첨자 선정
        const finalWinner = presentAttendances[Math.floor(Math.random() * presentAttendances.length)];
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
    const roster = getFullRoster();
    if (roster.length === 0) return;
    
    const headers = ['성명', '부서', '출석상태', '출석일시', '메모'];
    const rows = roster.map((r) => [
      r.name,
      r.department,
      r.attendance ? r.attendance.status : '결석',
      r.attendance ? new Date(r.attendance.attended_at).toLocaleString() : '-',
      r.attendance?.memo || '',
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

  const printSessionView = () => {
    setPrintType('session');
    setIsPrintModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const printAllSessionsView = async () => {
    if (!meeting) return;
    setIsPrintModalOpen(false);
    setIsFetchingAllAttendances(true);
    try {
      const data = await getMeetingAttendances(meeting.id);
      setAllAttendances(data);
      setPrintType('all');
      setTimeout(() => {
        window.print();
      }, 150);
    } catch (error) {
      console.error('Failed to load all attendances for print:', error);
      alert('전체 출석 기록을 불러오는 데 실패했습니다.');
    } finally {
      setIsFetchingAllAttendances(false);
    }
  };

  const handleToggleMeetingStatus = async () => {
    if (!meeting) return;
    const nextStatus = !meeting.is_closed;
    const confirmMsg = nextStatus
      ? `정말로 '${meeting.title}' 스터디 모임을 종료하시겠습니까?\n종료 후에는 신규 회차 등록 및 출석체크가 제한됩니다.`
      : `정말로 '${meeting.title}' 스터디 모임을 다시 활성화하시겠습니까?`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const updated = await toggleMeetingStatus(meeting.id, nextStatus);
      setMeeting(updated);
      alert(nextStatus ? '모임이 정상적으로 종료되었습니다.' : '모임이 성공적으로 재활성화되었습니다.');
    } catch (err) {
      console.error('Failed to toggle meeting status:', err);
      alert('모임 상태를 변경하지 못했습니다.');
    }
  };

  const getOverallRoster = () => {
    const roster = members.map((m) => ({
      id: m.id,
      name: m.name,
      department: m.department,
    }));

    allAttendances.forEach((att) => {
      const exists = roster.some(
        (r) => r.name === att.member_name && r.department === att.department
      );
      if (!exists) {
        roster.push({
          id: `legacy-${att.id}`,
          name: att.member_name,
          department: att.department,
        });
      }
    });

    return roster.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  };

  const handleDeleteMeeting = async () => {
    if (!meeting) return;
    
    const confirmDelete = window.confirm(
      `정말로 '${meeting.title}' 모임을 삭제하시겠습니까?\n모임에 속한 모든 세션 및 출석 기록이 영구적으로 함께 삭제됩니다.`
    );
    
    if (!confirmDelete) return;
    
    try {
      await deleteMeeting(meeting.id);
      alert('모임이 성공적으로 삭제되었습니다.');
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      alert('모임 삭제에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  // 전체 명단 빌드: 사전 등록 멤버 + (혹시 존재할 수 있는) 그 외 출석자
  const getFullRoster = () => {
    const roster = members.map((m) => {
      const att = attendances.find(
        (a) => a.member_name === m.name && a.department === m.department
      );
      return {
        id: m.id,
        name: m.name,
        department: m.department,
        is_auto_added: m.is_auto_added,
        attendance: att || null,
      };
    });

    // 사전 등록 멤버에는 없지만, 출석 기록은 있는 경우 추가 (예외/레거시 대응)
    attendances.forEach((att) => {
      const exists = roster.some(
        (r) => r.name === att.member_name && r.department === att.department
      );
      if (!exists) {
        roster.push({
          id: `legacy-${att.id}`,
          name: att.member_name,
          department: att.department,
          is_auto_added: false,
          attendance: att,
        });
      }
    });

    return roster;
  };

  const getMemoValue = (name: string, dept: string, dbMemo: string) => {
    const key = `${name}-${dept}`;
    if (localMemos[key] !== undefined) {
      return localMemos[key];
    }
    return dbMemo || '';
  };

  const handleMemoChange = (name: string, dept: string, value: string) => {
    setLocalMemos((prev) => ({
      ...prev,
      [`${name}-${dept}`]: value,
    }));
  };

  const handleMemoSave = async (name: string, dept: string, status: string, value: string) => {
    if (!selectedSession) return;
    try {
      await updateAttendanceManual(selectedSession.id, name, dept, status as any, value);
      const attData = await getAttendances(selectedSession.id);
      setAttendances(attData);
    } catch (err) {
      console.error('Failed to save memo:', err);
      alert('메모 저장에 실패했습니다.');
    }
  };

  const handleStatusChange = async (name: string, dept: string, status: '출석' | '지각' | '결석', currentMemo: string) => {
    if (!selectedSession) return;
    try {
      await updateAttendanceManual(selectedSession.id, name, dept, status, currentMemo);
      const attData = await getAttendances(selectedSession.id);
      setAttendances(attData);
    } catch (err) {
      console.error('Failed to change status:', err);
      alert('출석 상태 변경에 실패했습니다.');
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberDept.trim()) return;

    setIsAddingMember(true);
    try {
      const added = await addMember(meetingId, newMemberName.trim(), newMemberDept.trim());
      setMembers((prev) => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      setNewMemberName('');
      setNewMemberDept('');
    } catch (err) {
      console.error('Failed to add member:', err);
      alert('스터디원 추가에 실패했습니다.');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleBulkMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;

    setIsAddingMember(true);
    try {
      const lines = bulkInput.split('\n');
      const listToInsert: { name: string; department: string }[] = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        let name = '';
        let department = '';

        // Try comma first, then tab
        if (trimmedLine.includes(',')) {
          const parts = trimmedLine.split(',');
          name = parts[0]?.trim() || '';
          department = parts.slice(1).join(',').trim();
        } else if (trimmedLine.includes('\t')) {
          const parts = trimmedLine.split('\t');
          name = parts[0]?.trim() || '';
          department = parts.slice(1).join('\t').trim();
        } else {
          // If no separator is found, treat the whole line as the name
          name = trimmedLine;
        }

        if (name) {
          listToInsert.push({ name, department });
        }
      }

      if (listToInsert.length === 0) {
        alert('올바른 이름 형식을 찾을 수 없습니다.');
        setIsAddingMember(false);
        return;
      }

      const addedList = await addMembersBulk(meetingId, listToInsert);
      setMembers((prev) => [...prev, ...addedList].sort((a, b) => a.name.localeCompare(b.name)));
      setBulkInput('');
      setIsBulkMode(false);
      alert(`성공적으로 ${addedList.length}명의 스터디원을 등록했습니다.`);
    } catch (err: any) {
      console.error('Failed to add members in bulk:', err);
      alert('일괄 등록에 실패했습니다: ' + (err.message || '오류 발생'));
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    const confirmDelete = window.confirm(
      `"${name}" 님을 정말 명단에서 삭제하시겠습니까?\n삭제 시 이 스터디원의 출석 연동이 불가능해집니다.`
    );
    if (!confirmDelete) return;

    try {
      await deleteMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Failed to delete member:', err);
      alert('스터디원 삭제에 실패했습니다.');
    }
  };

  const handleStartEditMeeting = () => {
    if (!meeting) return;
    setIsEditingMeeting(true);
    setEditMeetingTitle(meeting.title);
    setEditMeetingDescription(meeting.description || '');
    setEditMeetingStart(meeting.default_start_time?.substring(0, 5) || '19:00');
    setEditMeetingLate(meeting.default_late_time?.substring(0, 5) || '19:10');
    setEditMeetingEnd(meeting.default_end_time?.substring(0, 5) || '21:00');
  };

  const handleEditMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting || !editMeetingTitle.trim()) return;

    setIsSubmittingMeeting(true);
    try {
      const updated = await updateMeeting(
        meeting.id,
        editMeetingTitle,
        editMeetingDescription,
        editMeetingStart,
        editMeetingLate,
        editMeetingEnd
      );
      setMeeting(updated);
      setIsEditingMeeting(false);
    } catch (err) {
      console.error('Failed to update meeting:', err);
      alert('모임 정보 수정에 실패했습니다.');
    } finally {
      setIsSubmittingMeeting(false);
    }
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
        {printType === 'session' ? (
          <>
            <h1>{meeting.title} 출석부</h1>
            <p>일시: {selectedSession ? `${selectedSession.date} ${selectedSession.start_time.substring(0, 5)} ~ ${selectedSession.end_time.substring(0, 5)}` : '-'}</p>
            <p>세션주제: {selectedSession?.title}</p>
            <p>출석 인원: 총 {attendances.length}명 (지각: {attendances.filter(a => a.status === '지각').length}명)</p>
          </>
        ) : (
          <>
            <h1>{meeting.title} 전체 출석부</h1>
            <p>인쇄 기준일: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>전체 회차 수: 총 {sessions.length}회차</p>
            <p>등록 인원: 총 {members.length}명</p>
          </>
        )}
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
            onClick={() => setIsPrintModalOpen(true)}
            disabled={sessions.length === 0}
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
            disabled={attendances.length === 0 || meeting.is_closed}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>럭키드로우 추첨</span>
          </button>

          <button
            onClick={handleStartEditMeeting}
            disabled={meeting.is_closed}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>모임 수정</span>
          </button>

          {meeting.is_closed ? (
            <button
              onClick={handleToggleMeetingStatus}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl text-xs font-bold hover:bg-emerald-100/50 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>모임 활성화</span>
            </button>
          ) : (
            <button
              onClick={handleToggleMeetingStatus}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl text-xs font-bold hover:bg-amber-100/50 transition-colors cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>모임 종료</span>
            </button>
          )}

          <button
            onClick={handleDeleteMeeting}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold border border-red-200 dark:border-red-900/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>모임 삭제</span>
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        {isEditingMeeting ? (
          <form onSubmit={handleEditMeetingSubmit} className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">모임 이름</label>
              <input
                type="text"
                value={editMeetingTitle}
                onChange={(e) => setEditMeetingTitle(e.target.value)}
                className="w-full max-w-md px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="모임 이름을 입력해 주세요"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">설명</label>
              <textarea
                value={editMeetingDescription}
                onChange={(e) => setEditMeetingDescription(e.target.value)}
                className="w-full max-w-xl px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-16"
                placeholder="모임에 대한 간단한 설명을 등록해보세요"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 mb-1.5">기본 회차별 시간 설정 (5분 단위)</label>
              <div className="flex gap-3 bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-800/80 max-w-xl">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">기본 시작</label>
                  <input
                    type="time"
                    required
                    step="300"
                    value={editMeetingStart}
                    onChange={(e) => setEditMeetingStart(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">기본 지각</label>
                  <input
                    type="time"
                    required
                    step="300"
                    value={editMeetingLate}
                    onChange={(e) => setEditMeetingLate(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">기본 종료</label>
                  <input
                    type="time"
                    required
                    step="300"
                    value={editMeetingEnd}
                    onChange={(e) => setEditMeetingEnd(e.target.value)}
                    className="w-full px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingMeeting(false)}
                className="px-3.5 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmittingMeeting}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingMeeting ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {meeting.title}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-2xl leading-relaxed">
                {meeting.description || '스터디 모임에 대한 간단한 설명을 등록해보세요.'}
              </p>
            </div>
            {meeting.default_start_time && (
              <div className="flex gap-2.5 text-[10px] font-bold text-indigo-600/80 dark:text-indigo-400/80 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-950/30 px-2.5 py-1.5 rounded-lg w-fit">
                <span>기본 모임 시간: {meeting.default_start_time.substring(0, 5)} ~ {meeting.default_end_time?.substring(0, 5)}</span>
                <span>•</span>
                <span>지각 기준: {meeting.default_late_time?.substring(0, 5)}</span>
              </div>
            )}
          </div>
        )}

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
              {!meeting.is_closed && (
                <div className="flex items-center gap-1.5">
                  {selectedSession && (
                    <button
                      onClick={handleStartEditSession}
                      title="선택된 회차 정보 수정"
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isEditingSession
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-500'
                      }`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleStartAddSession}
                    title="새 회차 만들기"
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isAddingSession
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Session Add/Edit Form */}
            {(isAddingSession || isEditingSession) && (
              <form onSubmit={isAddingSession ? handleAddSessionSubmit : handleEditSessionSubmit} className="p-4 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3 animate-fade-in">
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400">
                  {isAddingSession ? '새 회차 만들기' : '회차 정보 수정'}
                </h4>
                
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

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">날짜</label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">시작 시간</label>
                    <input
                      type="time"
                      required
                      step="300"
                      value={sessionStart}
                      onChange={(e) => setSessionStart(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">지각 기준</label>
                    <input
                      type="time"
                      required
                      step="300"
                      value={sessionLate}
                      onChange={(e) => setSessionLate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">종료 시간</label>
                    <input
                      type="time"
                      required
                      step="300"
                      value={sessionEnd}
                      onChange={(e) => setSessionEnd(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSession(false);
                      setIsEditingSession(false);
                    }}
                    className="flex-1 py-1.5 text-[11px] border border-gray-200 dark:border-gray-800 rounded-lg font-semibold hover:bg-gray-100 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSession}
                    className="flex-1 py-1.5 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {isAddingSession ? '생성' : '수정 완료'}
                  </button>
                </div>
              </form>
            )}

            {/* Sessions List */}
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">등록된 회차가 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {sessions.map((session, index) => {
                  const isSelected = selectedSession?.id === session.id;
                  const isDragged = draggedIndex === index;
                  const finished = isSessionFinished(session);

                  return (
                    <div
                      key={session.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`group relative flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                          : finished
                            ? 'border-gray-100 dark:border-gray-800 bg-gray-50/20 dark:bg-gray-900/10 opacity-60 hover:opacity-90'
                            : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                      } ${isDragged ? 'opacity-40 border-dashed border-indigo-400 bg-indigo-50/10' : ''}`}
                    >
                      {/* Drag Handle */}
                      <div
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing p-0.5"
                        title="드래그하여 순서 변경"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* Clickable Detail Area */}
                      <div
                        onClick={() => setSelectedSession(session)}
                        className="flex-1 min-w-0 cursor-pointer select-none"
                      >
                        <div className={`text-xs font-bold truncate flex items-center ${
                          isSelected
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : finished
                              ? 'text-gray-400 dark:text-gray-500'
                              : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {session.title}
                          {finished && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200/50 dark:border-gray-700/50">
                              종료됨
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] flex items-center gap-1.5 mt-1 truncate ${
                          finished ? 'text-gray-400/70 dark:text-gray-500/70' : 'text-gray-400'
                        }`}>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" />
                            {session.date}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {session.start_time.substring(0, 5)} ~ {session.end_time.substring(0, 5)} (지각: {session.late_time.substring(0, 5)})
                          </span>
                        </div>
                      </div>

                      {/* Action buttons (Copy & Delete) */}
                      {!meeting.is_closed && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySession(session);
                            }}
                            title="회차 복사"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session);
                            }}
                            title="회차 삭제"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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

                {meeting.is_closed ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-2.5">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                    <h5 className="text-sm font-black text-rose-600 dark:text-rose-400">모임 종료됨</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      이 스터디 모임은 종료되었습니다.<br />새로운 출석체크가 불가능합니다.
                    </p>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {/* Attendance Table with Tab controls */}
              <div className="md:col-span-7 glass-panel p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col">
                {/* Tabs Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 pb-3 mb-4">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setDashboardTab('attendance')}
                      className={`text-xs font-black pb-2.5 -mb-3 transition-colors cursor-pointer border-b-2 ${
                        dashboardTab === 'attendance'
                          ? 'text-indigo-600 border-indigo-500 dark:text-indigo-400'
                          : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-200'
                      }`}
                    >
                      출석 현황 (전체 명단)
                    </button>
                    <button
                      onClick={() => setDashboardTab('roster')}
                      className={`text-xs font-black pb-2.5 -mb-3 transition-colors cursor-pointer border-b-2 ${
                        dashboardTab === 'roster'
                          ? 'text-indigo-600 border-indigo-500 dark:text-indigo-400'
                          : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-200'
                      }`}
                    >
                      스터디원 관리 ({members.length}명)
                    </button>
                  </div>
                  
                  {dashboardTab === 'attendance' && (
                    <div className="flex gap-1.5 text-[9px] text-gray-400 font-bold">
                      <span>출석: {attendances.filter(a => a.status === '출석').length}명</span>
                      <span>•</span>
                      <span>지각: {attendances.filter(a => a.status === '지각').length}명</span>
                      <span>•</span>
                      <span>결석: {getFullRoster().filter(r => !r.attendance || r.attendance.status === '결석').length}명</span>
                    </div>
                  )}
                </div>

                {dashboardTab === 'roster' ? (
                  <div className="flex-1 flex flex-col gap-4">
                    {meeting.is_closed ? (
                      <div className="p-6 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400 dark:text-gray-500 py-10">
                        종료된 모임은 스터디원 명단을 추가할 수 없습니다.
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/40 p-2 rounded-xl border border-gray-100 dark:border-gray-800/80">
                          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                            {isBulkMode ? '명단 일괄 추가' : '명단 개별 추가'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsBulkMode(!isBulkMode)}
                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                          >
                            {isBulkMode ? '개별 추가 모드로 전환' : '일괄 추가 모드로 전환'}
                          </button>
                        </div>

                        {!isBulkMode ? (
                          <form onSubmit={handleAddMemberSubmit} className="flex gap-2">
                            <input
                              type="text"
                              placeholder="이름"
                              required
                              value={newMemberName}
                              onChange={(e) => setNewMemberName(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <input
                              type="text"
                              placeholder="소속 부서"
                              required
                              value={newMemberDept}
                              onChange={(e) => setNewMemberDept(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              type="submit"
                              disabled={isAddingMember}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>추가</span>
                            </button>
                          </form>
                        ) : (
                          <form onSubmit={handleBulkMemberSubmit} className="flex flex-col gap-2">
                            <textarea
                              placeholder={`이름1, 소속1\n이름2, 소속2\n\n(한 줄에 한 명씩 입력, 이름과 소속은 쉼표(,)나 탭(Tab)으로 구분)`}
                              required
                              value={bulkInput}
                              onChange={(e) => setBulkInput(e.target.value)}
                              rows={4}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono resize-none"
                            />
                            <button
                              type="submit"
                              disabled={isAddingMember || !bulkInput.trim()}
                              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>일괄 추가 등록</span>
                            </button>
                          </form>
                        )}
                      </>
                    )}

                    {/* Members List */}
                    {members.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-gray-400">
                        <Users className="w-10 h-10 mb-2 text-gray-300 dark:text-gray-600" />
                        <p className="text-xs">등록된 스터디원이 없습니다.</p>
                        <p className="text-[10px] mt-0.5">상단의 폼을 이용해 사전 명단을 등록해 주세요.</p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto max-h-56 pr-1 space-y-1.5">
                        {members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-2.5 bg-white/40 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800/60 rounded-xl"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                                {m.name[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{m.name}</span>
                                  {m.is_auto_added && (
                                    <span className="text-[7px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 px-1 rounded font-bold shrink-0">현장 등록</span>
                                  )}
                                </div>
                                <span className="text-[9px] text-gray-400">{m.department}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m.id, m.name)}
                              className="p-1 rounded text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {getFullRoster().length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-2">
                        <Users className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                        <div>
                          <p className="text-xs font-bold text-gray-800 dark:text-gray-200">명단이 비어 있습니다</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">"스터디원 관리" 탭에서 사전에 스터디원을 등록해 주세요.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto max-h-[20rem] pr-1 space-y-2">
                        {getFullRoster().map((r) => {
                          const hasAttended = r.attendance !== null && r.attendance.status !== '결석';
                          const dbMemo = r.attendance?.memo || '';
                          const memoVal = getMemoValue(r.name, r.department, dbMemo);
                          const isLegacy = r.id.toString().startsWith('legacy-');

                          return (
                            <div
                              key={r.id}
                              className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${
                                hasAttended
                                  ? 'bg-white/40 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800/60'
                                  : 'bg-gray-50/20 dark:bg-gray-950/10 border-gray-200/50 dark:border-gray-900/40 opacity-75'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-white ${
                                    r.attendance?.status === '출석'
                                      ? 'bg-gradient-to-tr from-emerald-500 to-teal-500'
                                      : r.attendance?.status === '지각'
                                      ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                                      : 'bg-gray-400 dark:bg-gray-600'
                                  }`}>
                                    {r.name[0]}
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                      <span>{r.name}</span>
                                      {(r.is_auto_added || isLegacy) && (
                                        <span className="text-[8px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 px-1 rounded-md">현장 등록</span>
                                      )}
                                    </div>
                                    <div className="text-[9px] text-gray-400 mt-0.5">{r.department}</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  {/* Status Select */}
                                  <select
                                    value={r.attendance?.status || '결석'}
                                    disabled={meeting.is_closed}
                                    onChange={(e) => handleStatusChange(r.name, r.department, e.target.value as any, dbMemo)}
                                    className={`text-[9px] font-extrabold border rounded-lg px-2 py-1 bg-white dark:bg-gray-900 focus:outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed ${
                                      r.attendance?.status === '출석'
                                        ? 'border-emerald-200 text-emerald-700 bg-emerald-50/30'
                                        : r.attendance?.status === '지각'
                                        ? 'border-amber-200 text-amber-700 bg-amber-50/30'
                                        : 'border-gray-200 text-gray-500'
                                    }`}
                                  >
                                    <option value="출석">출석</option>
                                    <option value="지각">지각</option>
                                    <option value="결석">결석</option>
                                  </select>

                                  {/* Attended Time */}
                                  {hasAttended && (
                                    <span className="text-[9px] text-gray-400 font-mono">
                                      {new Date(r.attendance!.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Memo Area */}
                              <div className="flex items-center gap-1.5 bg-gray-50/60 dark:bg-gray-950/40 rounded-lg px-2.5 py-0.5 border border-gray-100/50 dark:border-gray-800/40">
                                <span className="text-[9px] font-bold text-gray-400 shrink-0">메모:</span>
                                <input
                                    type="text"
                                    placeholder={meeting.is_closed ? "종료된 모임은 메모를 입력할 수 없습니다" : "결석/지각 사유 등 메모를 입력 후 Enter..."}
                                    disabled={meeting.is_closed}
                                    value={memoVal}
                                    onChange={(e) => handleMemoChange(r.name, r.department, e.target.value)}
                                    onBlur={(e) => handleMemoSave(r.name, r.department, r.attendance?.status || '결석', e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    className="text-[10px] w-full bg-transparent border-none text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-700 focus:outline-none py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
        <div className="fixed inset-0 z-50 bg-gradient-to-tr from-indigo-50/95 via-white to-pink-50/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-slate-900 select-none animate-fade-in">
          <button
            onClick={() => setIsPresentationMode(false)}
            className="absolute top-6 right-6 p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors cursor-pointer shadow-sm"
          >
            <Minimize2 className="w-6 h-6" />
          </button>

          <div className="max-w-2xl w-full text-center space-y-8 animate-scale-in">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-100/70 border border-indigo-200/50 text-xs font-black text-indigo-600 uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                <span>출석 인증 바코드 스캔</span>
              </span>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-slate-900">
                {meeting.title}
              </h2>
              <p className="text-indigo-600 text-lg md:text-xl font-bold max-w-xl mx-auto line-clamp-1">
                {selectedSession.title}
              </p>
            </div>

            <div className="relative inline-block p-6 bg-white rounded-3xl shadow-[0_20px_50px_rgba(99,102,241,0.15)] border-4 border-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeDataUrl} alt="Presentation QR" className="w-72 h-72 md:w-96 md:h-96 mx-auto select-none pointer-events-none" />
            </div>

            <div className="space-y-2">
              <p className="text-slate-600 md:text-lg font-normal">
                스마트폰 카메라로 QR 코드를 스캔한 후, <span className="text-indigo-600 font-bold">성명/부서</span>를 입력해 주세요.
              </p>
              <div className="text-sm text-indigo-600/90 font-bold mt-4 flex items-center justify-center gap-1.5 bg-indigo-50/50 border border-indigo-100 px-4 py-2 rounded-full w-fit mx-auto shadow-sm">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>현재 출석 완료 인원: {attendances.length}명</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lucky Draw Modal */}
      {isLuckyDrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in no-print">
          <div className="relative w-full max-w-lg bg-white border-2 border-indigo-100/90 rounded-3xl shadow-2xl p-6 md:p-8 overflow-hidden text-center text-slate-900">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

            <div className="space-y-6">
              <div className="space-y-1.5">
                <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-inner">
                  <Gift className="w-7 h-7 animate-pulse" />
                </div>
                <h3 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 mt-3">실시간 럭키드로우</h3>
                <p className="text-sm font-bold text-slate-600 max-w-xs mx-auto">
                  당일 출석이 확인된 스터디원 {attendances.filter((a) => a.status === '출석' || a.status === '지각').length}명 중에서 행운의 주인공 1명을 선정합니다!
                </p>
              </div>

              {/* Roulette Display Area */}
              <div className="relative py-12 px-6 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center min-h-36 overflow-hidden">
                {isDrawing ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="text-3xl md:text-4xl font-black text-indigo-600 tracking-wide transition-all">
                      {attendances.filter((a) => a.status === '출석' || a.status === '지각')[drawIndex]?.member_name}
                    </div>
                    <div className="text-sm font-bold text-slate-500">
                      {attendances.filter((a) => a.status === '출석' || a.status === '지각')[drawIndex]?.department}
                    </div>
                  </div>
                ) : winner ? (
                  <div className="space-y-3 animate-scale-in">
                    <span className="inline-flex gap-1.5 items-center px-4 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-xs font-extrabold text-emerald-800 tracking-wider uppercase mx-auto">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>축하합니다!</span>
                    </span>
                    <div className="text-4xl md:text-5xl font-black text-gradient leading-none">
                      {winner.member_name}
                    </div>
                    <div className="text-sm font-black text-slate-700">
                      {winner.department}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-base font-semibold">
                    '추첨 시작' 버튼을 누르면 랜덤 추첨을 시작합니다.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsLuckyDrawOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 border-2 border-slate-200 text-slate-700 rounded-xl text-base font-black hover:bg-slate-200 transition-all cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleDrawWinner}
                  disabled={isDrawing || attendances.filter((a) => a.status === '출석' || a.status === '지각').length === 0}
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-base font-black shadow-lg shadow-indigo-600/10 hover-lift disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isDrawing ? '추첨 진행 중...' : '추첨 시작'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Selection Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in no-print">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-white">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white text-center">
              <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center mx-auto mb-3">
                <Printer className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">출석부 인쇄 방식 선택</h3>
              <p className="text-xs text-indigo-100 mt-1">원하시는 양식의 인쇄 방식을 선택해 주세요.</p>
            </div>

            <div className="p-6 space-y-4">
              <button
                type="button"
                onClick={printSessionView}
                disabled={!selectedSession}
                className="w-full text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 bg-gray-50/50 dark:bg-gray-900/20 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10 transition-all flex items-start gap-3 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">선택된 회차 출석부 인쇄</h4>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">
                    현재 선택된 세션({selectedSession?.title || '없음'})의 출석 상태와 사유 메모를 포함한 명단을 인쇄합니다.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={printAllSessionsView}
                disabled={isFetchingAllAttendances || sessions.length === 0}
                className="w-full text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 bg-gray-50/50 dark:bg-gray-900/20 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10 transition-all flex items-start gap-3 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                  {isFetchingAllAttendances ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Users className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {isFetchingAllAttendances ? '데이터 로딩 중...' : '모임 전체 출석부 인쇄'}
                  </h4>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">
                    모임의 모든 회차({sessions.length}회차)에 대한 스터디원별 출석 여부를 바둑판 형태의 격자 매트릭스로 통합하여 인쇄합니다.
                  </p>
                </div>
              </button>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold transition-all cursor-pointer text-center"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A4 Print Layout Only Content (Hidden on Web Screen, Visible on Print) */}
      {printType === 'session' ? (
        <div className="hidden print:block print-container">
          <table>
            <thead>
              <tr>
                <th>번호</th>
                <th>성명</th>
                <th>부서</th>
                <th>출석 상태</th>
                <th>출석 완료 시각</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {getFullRoster().map((r, idx) => {
                const hasAttended = r.attendance !== null && r.attendance.status !== '결석';
                return (
                  <tr key={r.id}>
                    <td>{idx + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.department}</td>
                    <td>
                      <span className={
                        r.attendance?.status === '지각' 
                          ? 'text-amber-600 font-bold' 
                          : !hasAttended 
                          ? 'text-red-500 font-bold' 
                          : ''
                      }>
                        {r.attendance ? r.attendance.status : '결석'}
                      </span>
                    </td>
                    <td>{r.attendance ? new Date(r.attendance.attended_at).toLocaleTimeString() : '-'}</td>
                    <td>{r.attendance?.memo || '-'}</td>
                  </tr>
                );
              })}
              {getFullRoster().length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center' }}>등록된 스터디원이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="hidden print:block print-container">
          <table>
            <thead>
              <tr>
                <th className="print-center">번호</th>
                <th>성명</th>
                <th>소속 부서</th>
                {sessions.map((s, idx) => (
                  <th key={s.id} className="print-center">{idx + 1}회차</th>
                ))}
                <th className="print-center">출석</th>
                <th className="print-center">지각</th>
                <th className="print-center">결석</th>
                <th className="print-center">출석률</th>
              </tr>
            </thead>
            <tbody>
              {getOverallRoster().map((member, idx) => {
                let attendCount = 0;
                let lateCount = 0;
                let absentCount = 0;

                const sessionStatusList = sessions.map((s) => {
                  const att = allAttendances.find(
                    (a) =>
                      a.session_id === s.id &&
                      a.member_name === member.name &&
                      a.department === member.department
                  );
                  if (att) {
                    if (att.status === '출석') {
                      attendCount++;
                      return 'O';
                    } else if (att.status === '지각') {
                      lateCount++;
                      return '△';
                    } else if (att.status === '결석') {
                      absentCount++;
                      return 'X';
                    }
                  }
                  absentCount++;
                  return 'X';
                });

                const totalSessions = sessions.length;
                const attendanceRate = totalSessions > 0 
                  ? Math.round(((attendCount + lateCount) / totalSessions) * 100) 
                  : 0;

                return (
                  <tr key={member.id}>
                    <td className="print-center">{idx + 1}</td>
                    <td>{member.name}</td>
                    <td>{member.department}</td>
                    {sessionStatusList.map((status, sIdx) => (
                      <td key={sIdx} className="print-center font-bold">
                        <span className={
                          status === 'O' 
                            ? 'text-indigo-600' 
                            : status === '△' 
                            ? 'text-amber-600' 
                            : 'text-red-500'
                        }>
                          {status}
                        </span>
                      </td>
                    ))}
                    <td className="print-center text-indigo-600 font-bold">{attendCount}</td>
                    <td className="print-center text-amber-500 font-bold">{lateCount}</td>
                    <td className="print-center text-red-500 font-bold">{absentCount}</td>
                    <td className="print-center font-black">{attendanceRate}%</td>
                  </tr>
                );
              })}
              {getOverallRoster().length === 0 && (
                <tr>
                  <td colSpan={sessions.length + 7} style={{ textAlign: 'center' }}>등록된 스터디원이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-4 text-xs text-gray-500 text-right">
            * 범례 - O: 출석, △: 지각, X: 결석/미출석 (출석률 = (출석 + 지각) / 전체 회차 수)
          </div>
        </div>
      )}
    </div>
  );
}
