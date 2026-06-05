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
    <div className="min-h-screen w-full bg-gradient-to-tr from-indigo-100/60 via-slate-50 to-pink-100/60 text-slate-900 flex flex-col justify-center items-center py-6 px-4">
      <main className="w-full max-w-lg mx-auto flex flex-col justify-center">
        <AttendForm sessionId={sessionId} />
      </main>
    </div>
  );
}
