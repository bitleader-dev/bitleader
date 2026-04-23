// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// GitHub Pages 배포 설정: https://bitleader-dev.github.io/bitleader/
export default defineConfig({
  site: 'https://bitleader-dev.github.io',
  base: '/bitleader',
  trailingSlash: 'ignore',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
