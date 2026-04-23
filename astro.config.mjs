// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// GitHub Pages 배포 설정: https://bitleader-dev.github.io/bitleader/
export default defineConfig({
  site: 'https://bitleader-dev.github.io',
  base: '/bitleader',
  trailingSlash: 'ignore',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
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
