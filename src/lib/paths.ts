// 공용 URL/경로/이스케이프 헬퍼
// - Astro base path(`/bitleader`) 의 trailing slash 제거 값, 절대 URL 조합,
//   XML/HTML 텍스트 이스케이프를 한 곳에 모아 중복 인라인을 방지한다.
// - `import.meta.env.BASE_URL` 은 Vite 가 빌드 타임에 정적 치환하므로 런타임 비용 0.

export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');
export const DEFAULT_SITE_ORIGIN = 'https://bitleader-dev.github.io';

/** base path prefix 를 붙인 내부 경로 반환 (예: withBase('/og/foo.png') → '/bitleader/og/foo.png') */
export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Astro.site 기반 절대 URL 반환. site 가 없으면 DEFAULT_SITE_ORIGIN 으로 폴백. */
export function absoluteUrl(site: URL | undefined, path: string): string {
  const origin = site?.origin ?? DEFAULT_SITE_ORIGIN;
  return `${origin}${withBase(path)}`;
}

/** XML/HTML 공통 텍스트 이스케이프 — 5개 문자(&, <, >, ", ') 처리. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
