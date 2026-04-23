// GitHub API 호출 로직
// 빌드 타임에 실행되며 .env의 GITHUB_TOKEN이 있으면 인증 요청, 없으면 비인증 폴백

import type { GitHubRepo, GitHubReadme, GitHubRelease } from './types';

// bitleader-dev 계정 고정
const OWNER = 'bitleader-dev';
const API_BASE = 'https://api.github.com';

// 공통 fetch 헬퍼: 토큰 자동 주입 + 에러 처리
async function githubFetch<T>(url: string): Promise<T | null> {
  const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bitleader-dev-homepage',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { headers });
    // 404는 정상적인 "없음" 응답으로 간주 (README 미존재 등)
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      console.error(`[github] ${res.status} ${res.statusText} for ${url}`);
      // Rate Limit 감지 시 경고
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        console.error('[github] Rate limit exceeded. Set GITHUB_TOKEN in .env to increase limit.');
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[github] fetch error for ${url}:`, err);
    return null;
  }
}

// public 저장소 목록 조회 (최대 100개)
// 정렬은 클라이언트에서 수행하므로 여기서는 기본값 사용
export async function fetchPublicRepos(): Promise<GitHubRepo[]> {
  const url = `${API_BASE}/users/${OWNER}/repos?type=public&per_page=100&sort=updated`;
  const data = await githubFetch<GitHubRepo[]>(url);
  if (!data) return [];
  return data;
}

// README 조회 (base64 디코딩된 raw markdown 반환)
export async function fetchReadme(repoName: string): Promise<string | null> {
  const url = `${API_BASE}/repos/${OWNER}/${repoName}/readme`;
  const data = await githubFetch<GitHubReadme>(url);
  if (!data || data.encoding !== 'base64') return null;

  // base64 → UTF-8 문자열 변환 (Node 환경)
  try {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (err) {
    console.error(`[github] README decode failed for ${repoName}:`, err);
    return null;
  }
}

// 릴리스 목록 조회 (최신 순, 최대 20개)
// draft 릴리스는 API 상 인증 필요하므로 기본 제외됨
export async function fetchReleases(repoName: string): Promise<GitHubRelease[]> {
  const url = `${API_BASE}/repos/${OWNER}/${repoName}/releases?per_page=20`;
  const data = await githubFetch<GitHubRelease[]>(url);
  if (!data) return [];
  // prerelease는 포함, draft는 API에서 이미 걸러짐
  return data;
}

export { OWNER };
