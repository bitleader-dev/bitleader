// GitHub API 호출 로직
// 빌드 타임에 실행되며 .env의 GITHUB_TOKEN이 있으면 인증 요청, 없으면 비인증 폴백
//
// 빌드 1회 내 중복 호출 방지를 위한 모듈 스코프 메모이제이션:
// - 같은 빌드에서 getAllRepoCards / getStaticPaths / getRepoDetail 이 각각 같은 URL 을 호출해도
//   실제 네트워크 fetch 는 1번만 일어나도록 Promise 단위로 캐시한다
// - 저장소 수가 늘어나면 빌드 시간·Rate Limit 부담이 선형 증가하므로 필수 최적화

import type { GitHubRepo, GitHubReadme, GitHubRelease } from './types';

// bitleader-dev 계정 고정
const OWNER = 'bitleader-dev';
const API_BASE = 'https://api.github.com';

// MOCK_REPOS=1 로 빌드 시 로컬 fixture 로 대체 (astro.config.mjs 의 Vite define 으로 주입되는 상수)
// - 미설정 환경에서는 false 로 치환되어 Rollup DCE 가 아래 import 문을 번들에서 제거 → fixture 없어도 빌드 통과
declare const __BUILD_MOCK__: boolean;
const USE_MOCK = __BUILD_MOCK__;

type MockFixtures = {
  makeMockRepos: (count?: number) => GitHubRepo[];
  makeMockReadme: (repoName: string) => string;
  makeMockReleases: (repoName: string) => GitHubRelease[];
};

let mockFixturesPromise: Promise<MockFixtures | null> | null = null;
function loadMockFixtures(): Promise<MockFixtures | null> {
  // 프로덕션 빌드에서는 이 가드가 상시 true → Rollup 이 아래 전체 블록을 unreachable 로 판단해 제거
  if (!__BUILD_MOCK__) return Promise.resolve(null);
  if (mockFixturesPromise) return mockFixturesPromise;
  mockFixturesPromise = (async () => {
    try {
      const mod = (await import('../test-fixtures/mock-repos')) as MockFixtures;
      console.log('[github] MOCK_REPOS=1 감지 — fixture 저장소로 빌드합니다.');
      return mod;
    } catch (err) {
      console.warn(
        '[github] MOCK_REPOS=1 이지만 fixture 파일을 로드하지 못했습니다. 실제 GitHub API 로 폴백:',
        (err as Error).message,
      );
      return null;
    }
  })();
  return mockFixturesPromise;
}

// 네트워크/Rate Limit 실패 시 던지는 전용 에러 — 상위 빌드 가드에서 구분용
export class GitHubFetchError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'GitHubFetchError';
    this.status = status;
    this.url = url;
  }
}

// 404 를 "정상적인 없음"으로 취급할지 제어하는 옵션
interface FetchOptions {
  notFoundIsNull?: boolean; // true 면 404 시 null 반환 (기본값)
}

// 공통 fetch 헬퍼: 토큰 자동 주입 + 에러 처리
// 반환: 성공 시 { data, response }, 404 면 { data: null, response }
async function githubFetch<T>(
  url: string,
  opts: FetchOptions = {},
): Promise<{ data: T | null; response: Response }> {
  const { notFoundIsNull = true } = opts;
  const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bitleader-dev-homepage',
    // GitHub origin/CDN 측 응답 캐시로 인해 새 release 가 한 사이클 늦게 노출되는
    // 사례가 secrets.GITHUB_TOKEN 사용 시 관측되었음. 현재는 PAT 기반 인증으로
    // 캐시 키가 분리되어 영향이 최소화되지만, schedule 빌드의 안전망으로
    // no-cache 를 보내 원본 재검증을 권고한다.
    'Cache-Control': 'no-cache',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // cache: 'no-store' 는 Node fetch(undici) 의 HTTP 캐시 레이어를 건너뛰어
    // 헤더 측 no-cache 와 함께 빌드 간 stale 응답을 차단한다.
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.status === 404) {
      if (notFoundIsNull) return { data: null, response: res };
      throw new GitHubFetchError(`404 Not Found`, 404, url);
    }
    if (!res.ok) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const rateLimited = remaining === '0';
      console.error(`[github] ${res.status} ${res.statusText} for ${url}`);
      if (rateLimited) {
        console.error('[github] Rate limit exceeded. Set GITHUB_TOKEN in .env to increase limit.');
      }
      throw new GitHubFetchError(
        `${res.status} ${res.statusText}${rateLimited ? ' (rate limit)' : ''}`,
        res.status,
        url,
      );
    }
    const data = (await res.json()) as T;
    return { data, response: res };
  } catch (err) {
    if (err instanceof GitHubFetchError) throw err;
    console.error(`[github] fetch error for ${url}:`, err);
    throw new GitHubFetchError(`network error: ${(err as Error).message}`, 0, url);
  }
}

// 얇은 래퍼: 데이터만 필요할 때 사용
async function githubFetchData<T>(
  url: string,
  opts: FetchOptions = {},
): Promise<T | null> {
  return (await githubFetch<T>(url, opts)).data;
}

// GitHub Link 헤더에서 rel="next" URL 을 파싱한다.
// 예: `<https://api.github.com/.../repos?page=2>; rel="next", <...>; rel="last"`
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

// 배열을 동시성 limit 로 순회. Promise.all 의 무제한 동시 fetch 를 대체해
// GitHub secondary rate limit(약 100 동시/분) 을 피한다.
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array(Math.min(Math.max(1, limit), items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    });
  await Promise.all(workers);
  return results;
}

// ---------- 모듈 스코프 메모이제이션 (빌드 1회 내 공유) ----------
// Promise 자체를 저장해 동시 호출도 단일 inflight 로 처리된다
let reposPromise: Promise<GitHubRepo[]> | null = null;
const readmeCache = new Map<string, Promise<string | null>>();
const releasesCache = new Map<string, Promise<GitHubRelease[]>>();

// public 저장소 목록 전수 조회 (Link 헤더 기반 페이지네이션으로 100개 초과 지원)
// 정렬은 클라이언트에서 수행하므로 여기서는 updated 기준 기본값 사용
export function fetchPublicRepos(): Promise<GitHubRepo[]> {
  if (reposPromise) return reposPromise;
  const firstUrl = `${API_BASE}/users/${OWNER}/repos?type=public&per_page=100&sort=updated`;
  reposPromise = (async () => {
    if (USE_MOCK) {
      const fx = await loadMockFixtures();
      if (fx) return fx.makeMockRepos();
    }
    const acc: GitHubRepo[] = [];
    let nextUrl: string | null = firstUrl;
    // 저장소 수가 늘어도 자동으로 전수 수집되도록 Link rel="next" 를 따라 순차 fetch
    while (nextUrl) {
      const { data, response } = await githubFetch<GitHubRepo[]>(nextUrl);
      if (!data) break;
      acc.push(...data);
      nextUrl = parseNextLink(response.headers.get('Link'));
    }
    return acc;
  })();
  return reposPromise;
}

// README 조회 (base64 디코딩된 raw markdown 반환)
// 개별 저장소 README 페칭 실패는 해당 저장소만 카드에서 제외하도록 null 로 복구
// (전체 빌드가 하나의 일시 장애로 무너지는 것을 방지)
export function fetchReadme(repoName: string): Promise<string | null> {
  const cached = readmeCache.get(repoName);
  if (cached) return cached;

  const url = `${API_BASE}/repos/${OWNER}/${repoName}/readme`;
  const p = (async () => {
    if (USE_MOCK) {
      const fx = await loadMockFixtures();
      if (fx) return fx.makeMockReadme(repoName);
    }
    try {
      const data = await githubFetchData<GitHubReadme>(url);
      if (!data || data.encoding !== 'base64') return null;
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (err) {
      console.error(`[github] README fetch failed for ${repoName}, skipping:`, err);
      return null;
    }
  })();
  readmeCache.set(repoName, p);
  return p;
}

// 릴리스 목록 조회 (최신 순, 최대 20개)
// draft 릴리스는 API 상 인증 필요하므로 기본 제외됨
// 개별 저장소 릴리스 페칭 실패는 빈 배열로 복구 — 상세 페이지는 "등록된 릴리스가 없습니다" 로 유지됨
export function fetchReleases(repoName: string): Promise<GitHubRelease[]> {
  const cached = releasesCache.get(repoName);
  if (cached) return cached;

  const url = `${API_BASE}/repos/${OWNER}/${repoName}/releases?per_page=20`;
  const p = (async () => {
    if (USE_MOCK) {
      const fx = await loadMockFixtures();
      if (fx) return fx.makeMockReleases(repoName);
    }
    try {
      const data = await githubFetchData<GitHubRelease[]>(url);
      return data ?? [];
    } catch (err) {
      console.error(`[github] releases fetch failed for ${repoName}, using empty list:`, err);
      return [];
    }
  })();
  releasesCache.set(repoName, p);
  return p;
}

export { OWNER };
