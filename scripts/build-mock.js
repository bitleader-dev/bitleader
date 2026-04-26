// MOCK_REPOS=1 로 astro build 를 cross-platform 에서 실행하는 작은 wrapper.
// - Windows / macOS / Linux 모두에서 동일하게 동작 (cross-env 의존성 없이)
// - Playwright webServer / 로컬 e2e 빌드용 (CI 는 actions step env 로 직접 주입)

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const env = { ...process.env, MOCK_REPOS: '1' };
const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32', // Windows 에서 npm.cmd 자동 해석
});

process.exit(result.status ?? 1);
