// prebuild 훅 — Rollup 이 src/lib/github.ts 의 mock fixture import 를 resolve 할 수 있도록
// fixture 파일이 없을 때만 (Actions 러너 등) 빈 stub 을 생성.
//
// 로컬에서 MOCK_REPOS=1 로 테스트할 때는 이미 진짜 fixture 파일이 gitignored 로 존재하므로
// 이 스크립트는 파일을 건드리지 않는다. (existsSync 체크)
//
// 빌드 타임 Vite define 으로 주입된 __BUILD_MOCK__ 가 false 이면 Rollup DCE 가 이 stub 을
// import 하는 코드를 unreachable 로 판단해 제거하므로 번들에는 포함되지 않는다.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const filePath = 'src/test-fixtures/mock-repos.ts';

if (existsSync(filePath)) {
  // 실제 fixture 가 있는 환경 (로컬 테스트) — 그대로 둔다
  process.exit(0);
}

mkdirSync(dirname(filePath), { recursive: true });
writeFileSync(
  filePath,
  `// Auto-generated stub (by scripts/ensure-mock-stub.js).
// 실제 fixture 는 .gitignore. astro check 의 ts(2307)/ts(2352) 회피를 위해
// MockFixtures 인터페이스와 동일한 type signature 를 부여한다.
// MOCK_REPOS!=1 일 때 vite define DCE 로 번들에서 제거됨.

import type { GitHubRepo, GitHubRelease } from '../lib/types';

export const makeMockRepos = (): GitHubRepo[] => [];
export const makeMockReadme = (_repoName: string): string | null => null;
export const makeMockReleases = (_repoName: string): GitHubRelease[] => [];
`,
);

console.log('[prebuild] mock fixture stub 생성: ' + filePath);
