// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// 사이트 base — sitemap lastmod URL 파싱과 defineConfig.base 의 단일 source of truth
const SITE_BASE = '/bitleader';
const BASE_SEGMENT = SITE_BASE.replace(/^\/+|\/+$/g, '');
const BUILD_TIMESTAMP = new Date().toISOString();

// astro.config.mjs 에서 `lib/data.ts` import 는 vite define(__BUILD_MOCK__) 미적용 상태로
// 평가되어 ReferenceError 위험 → GitHub API 를 직접 1회만 호출해 의존성을 격리한다.
// (저장소 N≤100 한정, 페이지네이션 미지원 — 100 초과 시점에 도입)
const repoUpdatedMap = new Map();
async function loadRepoUpdatedMap() {
  if (process.env.MOCK_REPOS === '1') {
    try {
      const fx = await import('./src/test-fixtures/mock-repos.ts');
      const repos = fx.makeMockRepos?.() ?? [];
      for (const r of repos) repoUpdatedMap.set(r.name, r.updated_at);
      return;
    } catch {
      // fixture 미존재 시 빌드 시각으로 폴백 (CI 의 빈 stub 환경 회귀 안전)
      return;
    }
  }
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(
      'https://api.github.com/users/bitleader-dev/repos?type=public&per_page=100&sort=updated',
      { headers },
    );
    if (!res.ok) return;
    const data = await res.json();
    for (const r of data) repoUpdatedMap.set(r.name, r.updated_at);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[sitemap] lastmod 데이터 로드 실패 — 모든 URL 이 빌드 시각으로 설정됩니다:', msg);
  }
}
await loadRepoUpdatedMap();

/** @param {string} url */
function lastmodFor(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const idx = parts.indexOf(BASE_SEGMENT);
    const name = idx >= 0 && parts.length > idx + 1 ? parts[idx + 1] : '';
    if (name && repoUpdatedMap.has(name)) {
      return repoUpdatedMap.get(name);
    }
  } catch {
    /* 폴백 */
  }
  return BUILD_TIMESTAMP;
}

// GitHub Pages 배포 설정: https://bitleader-dev.github.io/bitleader/
export default defineConfig({
  site: 'https://bitleader-dev.github.io',
  base: SITE_BASE,
  trailingSlash: 'ignore',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      serialize(item) {
        return { ...item, lastmod: lastmodFor(item.url) };
      },
    }),
  ],
  vite: {
    // 빌드 타임 상수 주입:
    // - MOCK_REPOS=1 환경에서 빌드하면 __BUILD_MOCK__ = true → fixture import 가 번들에 포함
    // - 미설정(프로덕션/Actions) 환경에선 false → github.ts 의 `if (!__BUILD_MOCK__) return null;`
    //   가드가 상시 true 로 치환되어 Rollup DCE 가 mock import 문 자체를 번들에서 제거.
    //   → fixture 파일이 없는 환경(gitignored)에서도 빌드 성공.
    define: {
      __BUILD_MOCK__: JSON.stringify(process.env.MOCK_REPOS === '1'),
    },
  },
});
