import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ngrok 터널링 도메인에서의 dev 서버 접근을 허용 (iOS Safari 등 외부 기기 지원)
  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.ngrok-free.dev',
    '*.trycloudflare.com',
  ],
};

export default nextConfig;
