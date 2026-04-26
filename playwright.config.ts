// Playwright 5차 패키지 — 핵심 동선 E2E 테스트 설정
// - chromium 단일 브라우저, headless
// - baseURL: astro preview 가 띄우는 4321 (base path /bitleader/)
// - webServer: 테스트 시작 전 자동으로 preview 서버 실행 + 종료까지 처리
// - MOCK_REPOS=1 환경에서 빌드된 dist 를 preview — 30개 fixture 데이터로 회귀 검증

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // dev 서버 1개만 띄우므로 병렬 X
  forbidOnly: !!process.env.CI, // CI 에서는 .only 남아있으면 실패
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321/bitleader/',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // E2E_SKIP_BUILD=1 일 때는 preview 만 (CI 가 별도 step 에서 build 후 사용)
    command: process.env.E2E_SKIP_BUILD === '1'
      ? 'npm run preview'
      : 'node scripts/build-mock.js && npm run preview',
    url: 'http://localhost:4321/bitleader/',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // 로컬 반복 실행 시 4321 포트 점유(자식 프로세스 stranded) 방지
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
