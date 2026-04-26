// 메인 대시보드 핵심 동선 E2E
// MOCK_REPOS=1 로 빌드된 30개 fixture 위에서 검증 — 검색/Topic/언어/북마크/언어전환/단축키
// preview 서버(/bitleader/) baseURL 기준

import { test, expect } from '@playwright/test';

test.describe('대시보드 핵심 동선', () => {
  test.beforeEach(async ({ page }) => {
    // 깨끗한 localStorage 로 시작 (북마크/언어 잔존 방지)
    await page.goto('/bitleader/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
  });

  test('초기 로드 시 카드 그리드와 결과 카운트가 노출된다', async ({ page }) => {
    await expect(page.locator('#card-grid')).toBeVisible();
    // 30개 fixture 의 1페이지 — PAGE_SIZE=12 라 12개만 보임
    const visibleCards = page.locator('.repo-card:visible');
    await expect(visibleCards.first()).toBeVisible();
    const count = await visibleCards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(12);

    // 결과 카운트가 채워져 있는지
    const countText = await page.locator('#result-count').textContent();
    expect((countText ?? '').trim().length).toBeGreaterThan(0);
  });

  test('검색: "/" 단축키로 검색 input 포커스 → 키워드 입력 → 결과 변화 + URL 동기화', async ({ page }) => {
    // 카드 그리드가 첫 렌더 완료될 때까지 대기 (filter.ts 가 applyFilters 호출 완료)
    await expect(page.locator('.repo-card:visible').first()).toBeVisible();

    await page.keyboard.press('/');
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeFocused();

    await searchInput.fill('terminal');
    // debounce(150ms) + DOM 재배치 대기
    await page.waitForTimeout(400);

    // URL 쿼리 동기화 — 가장 신뢰성 있는 신호 (applyFilters 완료 보장)
    await expect(page).toHaveURL(/[?&]q=terminal/);

    // 결과는 fixture 의 sample-terminal* 시리즈만 남음 (4개 ~ 12개 사이)
    const afterCount = await page.locator('.repo-card:visible').count();
    expect(afterCount).toBeGreaterThan(0);
    expect(afterCount).toBeLessThan(20);
  });

  test('Topic 다중 필터: 드롭다운 열고 체크 → 카드 필터링 → 초기화', async ({ page }) => {
    const toggle = page.locator('#topic-filter-toggle');
    await toggle.click();

    const panel = page.locator('#topic-filter-panel');
    await expect(panel).toBeVisible();

    // 첫 topic 선택
    const firstCheckbox = panel.locator('.topic-checkbox').first();
    await firstCheckbox.check();

    // 라벨이 "1개 선택됨"/"1 selected" 로 변하는지
    const label = await page.locator('#topic-filter-label').textContent();
    expect((label ?? '').trim().length).toBeGreaterThan(0);

    // 초기화 버튼
    await page.locator('#topic-filter-clear').click();
    await expect(firstCheckbox).not.toBeChecked();
  });

  test('언어 필터: 옵션 선택 시 data-language 가 일치하는 카드만 표시', async ({ page }) => {
    const languageSelect = page.locator('#language-filter');
    // 첫 비-empty 옵션을 선택
    const options = await languageSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(1);
    const targetLang = await options[1].getAttribute('value');
    expect(targetLang).toBeTruthy();

    await languageSelect.selectOption(targetLang!);

    // 보이는 카드 모두 해당 언어인지 확인
    const visibleCards = page.locator('.repo-card:visible');
    const total = await visibleCards.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      const lang = await visibleCards.nth(i).getAttribute('data-language');
      expect(lang).toBe(targetLang);
    }

    // URL 쿼리 동기화
    await expect(page).toHaveURL(new RegExp(`[?&]language=${encodeURIComponent(targetLang!)}`));
  });

  test('빈 결과 → 필터 초기화 버튼 → 복귀', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    await searchInput.fill('this-keyword-should-not-match-zzz-9999');
    await page.waitForTimeout(250);

    await expect(page.locator('#empty-state')).toBeVisible();
    await expect(page.locator('#card-grid')).toBeHidden();

    await page.locator('#reset-filters').click();
    await expect(page.locator('#empty-state')).toBeHidden();
    await expect(page.locator('#card-grid')).toBeVisible();
    await expect(searchInput).toHaveValue('');
  });

  test('북마크 토글 + 새로고침 후 유지(localStorage)', async ({ page }) => {
    // 첫 렌더 완료 대기 (visible 한 첫 카드)
    await expect(page.locator('.repo-card:visible').first()).toBeVisible();

    // 첫 보이는 카드의 북마크 버튼 (페이지네이션 첫 페이지에 있어야 함)
    const bookmarkBtn = page.locator('.repo-card:visible .bookmark-btn').first();
    await bookmarkBtn.scrollIntoViewIfNeeded();
    const repoName = await bookmarkBtn.getAttribute('data-repo-name');
    expect(repoName).toBeTruthy();

    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'false');
    await bookmarkBtn.click();
    await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true');

    // 새로고침 후에도 같은 카드의 bookmark 가 유지 (정렬 결과 최상단으로 이동)
    await page.reload();
    const restoredBtn = page.locator(`.bookmark-btn[data-repo-name="${repoName}"]`);
    await expect(restoredBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('언어 전환: ko → en 시 검색 placeholder 가 영어로 바뀐다', async ({ page }) => {
    // 초기 언어는 ko (테스트 환경 navigator.language 가 ko-KR 가 아니어도 첫 방문 시 ko 폴백)
    // localStorage 가 비어있으므로 inline script 가 navigator.language 기반으로 결정
    // 안정성을 위해 강제로 ko 상태에서 시작
    await page.evaluate(() => {
      localStorage.setItem('lang', 'ko');
    });
    await page.reload();

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toHaveAttribute('placeholder', '저장소 검색...');

    // 언어 스위치(<select>) 에서 English 선택
    await page.locator('#lang-switch').selectOption('en');

    // placeholder 가 영어로 변경 (i18n.ts 가 langchange 이벤트로 갱신)
    await expect(searchInput).toHaveAttribute('placeholder', 'Search repositories...');
  });
});
