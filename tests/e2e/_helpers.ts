// E2E 공통 헬퍼 — 여러 spec 에서 반복되는 셋업을 단일화

import { expect, type Page } from '@playwright/test';

/** 메인 페이지로 이동 + 카드 그리드 첫 렌더 완료 대기 */
export async function gotoDashboard(page: Page) {
  await page.goto('/bitleader/');
  await expect(page.locator('.repo-card:visible').first()).toBeVisible();
}

/** 메인 → 첫 visible 카드의 href 추출 → 상세 페이지로 이동 */
export async function gotoFirstDetail(page: Page) {
  await gotoDashboard(page);
  const href = await page.locator('.repo-card:visible').first().getAttribute('href');
  if (!href || !/^\/bitleader\/[^/]+/.test(href)) {
    throw new Error(`unexpected card href: ${href}`);
  }
  await page.goto(href);
  return href;
}
