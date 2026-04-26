// 저장소 상세 페이지 핵심 동선 E2E
// MOCK_REPOS=1 로 빌드된 30개 fixture 위에서 검증

import { test, expect } from '@playwright/test';
import { gotoFirstDetail } from './_helpers';

test.describe('저장소 상세 페이지', () => {
  test('카드 클릭 → 상세 페이지 이동 → README/Releases/액션 버튼 노출', async ({ page }) => {
    await gotoFirstDetail(page);

    await expect(page.locator('.prose-dark').first()).toBeVisible();
    await expect(page.locator('[data-i18n="releases_heading"]').first()).toBeVisible();
    await expect(page.locator('[data-i18n="btn_github_repo"]').first()).toBeVisible();
  });

  test('JSON-LD SoftwareSourceCode 가 head 에 주입된다', async ({ page }) => {
    await gotoFirstDetail(page);

    const ldText = await page.locator('script[type="application/ld+json"]').textContent();
    expect(ldText).toBeTruthy();
    const parsed = JSON.parse(ldText!);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('SoftwareSourceCode');
    expect(parsed.codeRepository).toMatch(/^https:\/\/github\.com\//);
  });

  test('Back to Top: 스크롤 다운 → 버튼 노출 → 클릭 → 상단 복귀', async ({ page }) => {
    await gotoFirstDetail(page);

    const backBtn = page.locator('#back-to-top');
    await expect(backBtn).toHaveClass(/opacity-0/);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(100);
    await expect(backBtn).not.toHaveClass(/opacity-0/);

    await backBtn.click();
    await page.waitForFunction(() => window.scrollY < 50);
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeLessThan(50);
  });
});
