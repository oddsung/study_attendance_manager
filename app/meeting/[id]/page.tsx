'use strict';

import MeetingDashboard from '@/app/components/MeetingDashboard';

export const metadata = {
  title: '스터디 세션 관리 및 실시간 출석부',
  description: '스터디 세션별 동적 QR 코드 생성 및 리얼타임 출석 체크 모니터링 대시보드',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetingPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12">
      <MeetingDashboard meetingId={id} />
    </main>
  );
}
