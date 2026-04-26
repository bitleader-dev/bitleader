// 빌드 타임 데이터 페칭: GitHub에서 저장소 목록 + README를 가져와
// 카드 렌더링용 RepoCardData 배열로 정규화
// 또한 상세 페이지용 RepoDetailData 조립 (README 전문 HTML + Releases + Download URL)

import { fetchPublicRepos, fetchReadme, fetchReleases, mapLimit } from './github';
import { extractFirstImage, extractSummary, renderMarkdown } from './readme';

// GitHub API 동시 inflight 상한 (secondary rate limit ~100/min 회피).
// 저장소 수가 N개로 늘어도 네트워크 호출은 이 값으로 제한되어 안정 빌드를 보장한다.
const API_CONCURRENCY = 8;
import overridesData from '../data/repo-overrides.json';
import type {
  RepoCardData,
  RepoDetailData,
  GitHubRepo,
  GitHubRelease,
  RepoOverridesMap,
  RecentReleaseItem,
} from './types';

// 홈페이지 자체 저장소 이름: 대시보드에서 본인을 표시하지 않도록 제외
const HOMEPAGE_REPO = 'bitleader';

const overrides = overridesData as RepoOverridesMap;

// 단일 저장소 → (README 없으면) null / (README 있으면) 카드 데이터
async function buildCardData(repo: GitHubRepo): Promise<RepoCardData | null> {
  const readme = await fetchReadme(repo.name);

  // README 없으면 카드 목록에서 제외
  if (!readme) return null;

  const imageUrl = extractFirstImage(readme, repo.name, repo.default_branch);
  const summary = extractSummary(readme);

  return {
    name: repo.name,
    description: repo.description,
    url: repo.html_url,
    language: repo.language,
    stars: repo.stargazers_count,
    topics: repo.topics ?? [],
    updatedAt: repo.updated_at,
    createdAt: repo.created_at,
    imageUrl,
    summary,
    archived: repo.archived,
    fork: repo.fork,
  };
}

// 대시보드 대상 저장소 목록 (홈페이지 자체 + README 없는 저장소 제외)
// 메인 페이지와 상세 페이지 양쪽에서 사용
async function fetchTargetRepos(): Promise<GitHubRepo[]> {
  const repos = await fetchPublicRepos();
  return repos.filter((r) => r.name !== HOMEPAGE_REPO);
}

// 카드 데이터 전체 조회 (메인 페이지용)
export async function getAllRepoCards(): Promise<RepoCardData[]> {
  const repos = await fetchTargetRepos();
  if (repos.length === 0) return [];

  const results = await mapLimit(repos, API_CONCURRENCY, buildCardData);
  return results.filter((c): c is RepoCardData => c !== null);
}

// 모든 저장소에서 사용되는 topic 목록 수집 (필터 드롭다운용)
export function collectTopics(cards: RepoCardData[]): string[] {
  const set = new Set<string>();
  for (const c of cards) {
    for (const t of c.topics) set.add(t);
  }
  return Array.from(set).sort();
}

// 카드들의 language 를 빈도 내림차순으로 수집 (필터 드롭다운용)
// null/빈 값은 제외. 동일 빈도면 알파벳 오름차순 (안정 정렬).
export function collectLanguages(cards: RepoCardData[]): string[] {
  const counts = new Map<string, number>();
  for (const c of cards) {
    if (!c.language) continue;
    counts.set(c.language, (counts.get(c.language) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([lang]) => lang);
}

// 전체 대상 저장소의 릴리스를 수집해 발행일 기준 최신 N개 반환 (메인 페이지 하이라이트용)
// - fetchReleases 는 Phase 2 메모이제이션으로 재호출 비용이 0
// - 저장소별로 발행 기준 최신 limit 개만 먼저 추려 메모리 peak 을 낮춘다
//   (100개 저장소 × 20 releases = 2000 items → 100 × limit items 로 축소)
export async function collectRecentReleases(limit = 3): Promise<RecentReleaseItem[]> {
  const repos = await fetchTargetRepos();
  const perRepoTop = await mapLimit(repos, API_CONCURRENCY, async (r) => {
    const rs = await fetchReleases(r.name);
    const filtered: RecentReleaseItem[] = [];
    for (const rel of rs) {
      if (rel.draft || !rel.published_at) continue;
      filtered.push({
        repoName: r.name,
        tag: rel.tag_name,
        title: rel.name?.trim() || rel.tag_name,
        publishedAt: rel.published_at,
        url: rel.html_url,
      });
    }
    filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return filtered.slice(0, limit);
  });
  const merged = perRepoTop.flat();
  merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return merged.slice(0, limit);
}

// 상세 페이지 라우트용: 대상 저장소의 메타데이터 목록 (getStaticPaths)
// README가 없어서 카드에서 제외된 저장소는 상세 페이지도 생성하지 않음
// updatedAt 은 sitemap lastmod 주입 등 외부에서 재사용
export interface DetailRouteEntry {
  name: string;
  defaultBranch: string;
  updatedAt: string;
}

export async function getDetailRouteList(): Promise<DetailRouteEntry[]> {
  const repos = await fetchTargetRepos();
  const checks = await mapLimit(repos, API_CONCURRENCY, async (r) => {
    const readme = await fetchReadme(r.name);
    return readme
      ? { name: r.name, defaultBranch: r.default_branch, updatedAt: r.updated_at }
      : null;
  });
  return checks.filter((r): r is DetailRouteEntry => r !== null);
}

// Download URL 결정 (하이브리드)
// 1) repo-overrides.json의 downloadUrl
// 2) Latest Release의 첫 번째 asset.browser_download_url
// 3) 없으면 null (버튼 미표시)
function resolveDownloadUrl(repoName: string, releases: GitHubRelease[]): string | null {
  // overrides 우선
  const override = overrides[repoName]?.downloadUrl;
  if (override) return override;

  // prerelease 포함, draft 제외 (API에서 이미 제외됨)
  const latest = releases[0];
  if (!latest || !latest.assets || latest.assets.length === 0) return null;

  return latest.assets[0].browser_download_url;
}

// 상세 페이지 데이터 조립 (특정 저장소 1건)
// [repo].astro 페이지와 og/[repo].png.ts OG 라우트 양쪽에서 동일 저장소를 조회하므로
// shiki+sanitize 비용이 두 번 들지 않도록 module-level Promise 캐시로 1회만 계산
const detailCache = new Map<string, Promise<RepoDetailData | null>>();

export function getRepoDetail(repoName: string): Promise<RepoDetailData | null> {
  let p = detailCache.get(repoName);
  if (!p) {
    p = computeRepoDetail(repoName);
    detailCache.set(repoName, p);
  }
  return p;
}

async function computeRepoDetail(repoName: string): Promise<RepoDetailData | null> {
  const repos = await fetchTargetRepos();
  const repo = repos.find((r) => r.name === repoName);
  if (!repo) return null;

  const [readme, releases] = await Promise.all([
    fetchReadme(repoName),
    fetchReleases(repoName),
  ]);

  if (!readme) return null;

  const readmeHtml = await renderMarkdown(readme, repoName, repo.default_branch);
  const downloadUrl = resolveDownloadUrl(repoName, releases);

  return {
    name: repo.name,
    description: repo.description,
    url: repo.html_url,
    defaultBranch: repo.default_branch,
    readmeHtml,
    readmeMarkdown: readme,
    releases,
    downloadUrl,
  };
}
