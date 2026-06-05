'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMeetings, createMeeting, Meeting } from '@/lib/api';
import { Plus, BookOpen, Users, Calendar, ArrowRight, Sparkles, Loader2 } from 'lucide-react';

export default function MainDashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [defaultStartTime, setDefaultStartTime] = useState('19:00');
  const [defaultLateTime, setDefaultLateTime] = useState('19:10');
  const [defaultEndTime, setDefaultEndTime] = useState('21:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMeetings() {
      try {
        const data = await getMeetings();
        setMeetings(data);
      } catch (err) {
        console.error('Failed to load meetings:', err);
        setError('모임 정보를 가져오는 도중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
    loadMeetings();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      const newMeeting = await createMeeting(title, description, defaultStartTime, defaultLateTime, defaultEndTime);
      setMeetings([newMeeting, ...meetings]);
      setTitle('');
      setDescription('');
      setDefaultStartTime('19:00');
      setDefaultLateTime('19:10');
      setDefaultEndTime('21:00');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to create meeting:', err);
      setError('모임 생성에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 text-white shadow-2xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 top-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>사내 AI 스터디 & 모임 출석부</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            스마트폰 스캔 한 번으로<br />출석부터 리얼타임 관리까지
          </h1>
          <p className="text-indigo-100 md:text-lg max-w-lg font-light leading-relaxed">
            별도의 앱 다운로드 없이, 스크린에 뜬 QR 코드를 기본 카메라로 스캔하여 신속하게 출석할 수 있는 프리미엄 솔루션입니다.
          </p>
        </div>
      </div>

      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">진행 중인 스터디 & 모임</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">출석을 관리할 대상을 선택하거나 새로운 모임을 생성하세요.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-semibold shadow-md shadow-indigo-600/10 hover-lift text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>새 모임 만들기</span>
        </button>
      </div>

      {/* Main Grid Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">모임 목록을 가져오는 중입니다...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-center text-sm font-medium">
          {error}
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">활성화된 모임이 없습니다</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs mx-auto">새로운 AI 스터디나 정기 모임을 생성하여 출석 관리를 시작해보세요.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold text-sm cursor-pointer"
          >
            <span>모임 추가하기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/meeting/${meeting.id}`}
              className={`group relative flex flex-col p-6 rounded-2xl glass-panel hover-lift border border-gray-200 dark:border-gray-800 hover:border-indigo-500/30 dark:hover:border-indigo-400/20 ${
                meeting.is_closed ? 'opacity-70 hover:opacity-90' : ''
              }`}
            >
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${
                    meeting.is_closed 
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' 
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(meeting.created_at).toLocaleDateString()}
                    </span>
                    {meeting.is_closed && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100/50 dark:border-rose-950/30">
                        종료됨
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {meeting.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {meeting.description || '상세 설명이 등록되지 않은 모임입니다.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800/60 mt-6 pt-4 text-xs font-semibold text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-indigo-500/70" />
                  <span>출석 대시보드 바로가기</span>
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Meeting Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
              <h3 className="text-lg font-bold">새로운 스터디/모임 생성</h3>
              <p className="text-xs text-indigo-100 mt-1">출석을 정기적으로 기록할 스터디 대주제를 입력해 주세요.</p>
            </div>
            
            <form onSubmit={handleCreateMeeting} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">모임 주제 (필수)</label>
                <input
                  type="text"
                  required
                  placeholder="예: 사내 생성형 AI 스터디"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">설명 및 목표 (선택)</label>
                <textarea
                  placeholder="모임의 목적이나 상세 일정에 대한 간단한 가이드를 적어주세요."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-xl border border-gray-100 dark:border-gray-800/80 space-y-3">
                <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">회차 생성 시 적용할 기본 시간 설정 (5분 단위)</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">시작 시간</label>
                    <input
                      type="time"
                      required
                      step="300"
                      value={defaultStartTime}
                      onChange={(e) => setDefaultStartTime(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">지각 기준</label>
                    <input
                      type="time"
                      required
                      step="300"
                      value={defaultLateTime}
                      onChange={(e) => setDefaultLateTime(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">종료 시간</label>
                    <input
                      type="time"
                      required
                      step="300"
                      value={defaultEndTime}
                      onChange={(e) => setDefaultEndTime(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setError('');
                  }}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>생성 중...</span>
                    </span>
                  ) : (
                    <span>생성 완료</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
