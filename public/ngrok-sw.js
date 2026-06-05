/**
 * ngrok 무료 인터스티셜 바이패스 Service Worker
 * 
 * iOS Safari에서 ngrok 무료 플랜의 인터스티셜(경고) 페이지가
 * JavaScript 번들, CSS, 이미지 등의 정적 리소스 요청에도 개입하여
 * HTML을 반환하는 문제를 해결합니다.
 * 
 * 이 Service Worker는 모든 동일 출처(same-origin) 요청에
 * 'ngrok-skip-browser-warning' 헤더를 자동으로 추가합니다.
 */

// 설치 즉시 활성화 (대기 단계 건너뛰기)
self.addEventListener('install', () => {
  self.skipWaiting();
});

// 활성화 시 즉시 모든 클라이언트(탭)를 제어
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 모든 요청을 가로채서 ngrok 바이패스 헤더 추가
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 동일 출처 요청에만 헤더를 추가 (외부 CDN 등은 변경하지 않음)
  if (url.origin === self.location.origin) {
    const modifiedHeaders = new Headers(event.request.headers);
    modifiedHeaders.set('ngrok-skip-browser-warning', 'true');

    const modifiedRequest = new Request(event.request, {
      headers: modifiedHeaders,
    });

    event.respondWith(
      fetch(modifiedRequest).catch(() => {
        // 네트워크 오류 시 원본 요청으로 폴백
        return fetch(event.request);
      })
    );
  }
});
