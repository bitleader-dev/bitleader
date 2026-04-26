// GitHub API 응답 및 카드 데이터 타입 정의

// GitHub REST API /users/{user}/repos 응답 중 사용하는 필드만
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  topics: string[];
  updated_at: string;
  created_at: string;
  archived: boolean;
  fork: boolean;
  open_issues_count: number; // 오픈 이슈/PR 합산 (GitHub API 원본 필드)
}

// GitHub REST API /repos/{owner}/{repo}/readme 응답
export interface GitHubReadme {
  content: string; // base64 인코딩
  encoding: string; // 보통 'base64'
  path: string;
  name: string;
}

// 카드 렌더링에 사용하는 정규화된 데이터
export interface RepoCardData {
  name: string;
  displayName: string | null; // overrides.displayName 으로 카드/상세 노출용 표시명 교체 (없으면 name 사용)
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  topics: string[];
  updatedAt: string;
  createdAt: string;
  imageUrl: string | null; // README 첫 이미지 (없으면 null)
  summary: string; // README 180자 요약
  archived: boolean; // GitHub 저장소 archived 플래그
  fork: boolean; // 다른 저장소의 fork 여부
  openIssues: number; // 오픈 이슈/PR 개수 (카드 우측 표시)
}

// GitHub Release Asset (릴리스에 첨부된 바이너리 파일)
export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

// GitHub REST API /repos/{owner}/{repo}/releases 응답 요소
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  created_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: ReleaseAsset[];
}

// 상세 페이지 렌더링에 사용하는 정규화된 데이터
export interface RepoDetailData {
  name: string;
  displayName: string | null; // overrides.displayName 으로 노출용 표시명 교체 (없으면 name 사용)
  description: string | null;
  url: string; // GitHub 저장소 URL
  defaultBranch: string;
  readmeHtml: string; // sanitize된 README HTML
  readmeMarkdown: string; // 클립보드 복사용 raw markdown 원문 (변환 전)
  releases: GitHubRelease[];
  downloadUrl: string | null; // overrides 또는 Release asset, 없으면 null
}

// 저장소별 커스텀 오버라이드 (repo-overrides.json)
export interface RepoOverride {
  downloadUrl?: string;
  displayName?: string; // 카드/상세 페이지 노출 시 사용할 표시명 (URL 경로/식별자에는 영향 없음)
}

export type RepoOverridesMap = Record<string, RepoOverride>;

// 최근 릴리스 피드에 사용하는 정규화 아이템 (빌드 타임 수집)
export interface RecentReleaseItem {
  repoName: string;
  tag: string;
  title: string;
  publishedAt: string; // ISO 문자열
  url: string; // GitHub release html_url
}
