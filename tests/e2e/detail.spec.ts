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

  test('카드 제목과 상세 페이지 title 이 동일 (displayName 폴백 일관성)', async ({ page }) => {
    // 카드(h4) 와 상세 페이지(<title>) 는 동일한 displayName ?? name 폴백을 거친다.
    // 한쪽만 깨지면 즉시 갈라지므로 식별자/표시명 분리 회귀를 잡는 가드.
    await page.goto('/bitleader/');
    const card = page.locator('.repo-card:visible').first();
    await expect(card).toBeVisible();
    const cardTitle = (await card.locator('h4').textContent())?.trim();
    const href = await card.getAttribute('href');
    expect(cardTitle).toBeTruthy();
    expect(href).toMatch(/^\/bitleader\/[^/]+/);
    await page.goto(href!);
    await expect(page).toHaveTitle(`${cardTitle} — BIT LEADER`);
  });

  test('저장소 루트 help.md 우선 표시 — 헤더 라벨 help.md + 본문 HELP 마커', async ({ page }) => {
    // MOCK fixture 의 HELP_REPOS(sample-editor 등)는 help.md 를 가져 README 대신 우선 표시된다.
    await page.goto('/bitleader/sample-editor');
    await expect(page.locator('.prose-dark').first()).toBeVisible();
    // 패널 헤더 라벨이 실제 표시 문서 파일명(help.md) — font-label-md 는 헤더 파일명 span 전용
    await expect(page.locator('.font-label-md', { hasText: 'help.md' })).toBeVisible();
    // 본문이 help.md 소스(HELP 마커)이고 README 가 아님
    await expect(page.locator('.prose-dark').first()).toContainText('HELP: sample-editor');
  });

  test('help.md 없는 저장소 — 헤더 라벨 README.md 폴백', async ({ page }) => {
    // HELP_REPOS 에 없는 저장소는 help.md 가 없어 기존대로 README 를 표시한다.
    await page.goto('/bitleader/sample-clipboard');
    await expect(page.locator('.prose-dark').first()).toBeVisible();
    await expect(page.locator('.font-label-md', { hasText: 'README.md' })).toBeVisible();
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
