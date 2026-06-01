'use strict';

import MainDashboard from './components/MainDashboard';

export const metadata = {
  title: '스마트 QR 출석부 - 사내 AI 스터디 & 모임 관리',
  description: '앱 설치 없는 QR 스캔 기반의 간편하고 실시간 연동되는 출석 관리 시스템',
};

export default function Home() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:py-12">
      <MainDashboard />
    </main>
  );
}
