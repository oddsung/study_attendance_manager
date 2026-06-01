'use strict';

import AttendForm from '@/app/components/AttendForm';

export const metadata = {
  title: '스터디 출석 체크 완료하기',
  description: '스마트폰으로 성명, 사번, 부서를 입력하여 스터디 출석을 실시간으로 제출합니다.',
};

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function AttendPage({ params }: PageProps) {
  const { sessionId } = await params;

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 py-8 md:py-16 flex flex-col justify-center min-h-[85vh]">
      <AttendForm sessionId={sessionId} />
    </main>
  );
}
