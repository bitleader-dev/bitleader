// 클라이언트 사이드 검색 / Topic 필터(다중, AND) / 정렬 / 북마크 / 페이지네이션
// 카드의 data-* 속성을 읽어 DOM을 조작하는 방식 (SSG 정적 사이트)
// - applyFilters: 입력·필터·정렬 변경 시 전체 필터링 + 정렬 + DOM 재배치 + 카운트
// - updateCount : 언어 전환 시 카운트 문자열만 재계산 (정렬·DOM 재배치 회피)
// - updateTopicLabel : 언어 전환 시 Topic 버튼 라벨만 재계산 (선택 수 유지)
// - 북마크: localStorage 기반, 북마크된 카드는 정렬 결과의 최상단으로 고정
// - 페이지네이션: 필터 결과가 PAGINATION_THRESHOLD 초과일 때만 UI 노출
// - URL 쿼리 동기화: ?q=&topic=a,b,c&sort=&page= 형태 — 여러 topic 은 쉼표 조인

import { dictionaries, formatTpl, getCurrentLang } from '../i18n/dictionary';

const BOOKMARK_KEY = 'bookmarked-repos';
const PAGE_SIZE = 12;
const PAGINATION_THRESHOLD = 12; // 이 수 이하면 페이지네이션 UI 자체를 숨김
const SEARCH_DEBOUNCE_MS = 150; // 저장소 많아도 타이핑 중 reflow 폭주 방지
const TOAST_DURATION_MS = 2500; // 토스트 노출 시간 (사라짐 전환 포함)

interface CardElement extends HTMLElement {
  dataset: DOMStringMap & {
    name: string;
    description: string;
    topics: string;
    stars: string;
    updated: string;
    created: string;
  };
}

type SortKey = 'updated' | 'stars' | 'name' | 'created';
const DEFAULT_SORT: SortKey = 'updated';
const VALID_SORTS: readonly SortKey[] = ['updated', 'stars', 'name', 'created'];

// 북마크 저장소 관리 (localStorage)
function loadBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}
function saveBookmarks(s: Set<string>): void {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(Array.from(s)));
  } catch {
    // 저장 실패(용량/프라이버시 모드)는 조용히 무시
  }
}

function initFilter() {
  const grid = document.getElementById('card-grid');
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const sortSelect = document.getElementById('sort-order') as HTMLSelectElement | null;
  const resultCount = document.getElementById('result-count');

  // Topic 다중 필터 요소 (FilterBar.astro 의 커스텀 드롭다운)
  const topicFilterRoot = document.getElementById('topic-filter');
  const topicToggle = document.getElementById('topic-filter-toggle') as HTMLButtonElement | null;
  const topicPanel = document.getElementById('topic-filter-panel');
  const topicLabel = document.getElementById('topic-filter-label');
  const topicClear = document.getElementById('topic-filter-clear');
  const topicCheckboxes = Array.from(
    document.querySelectorAll<HTMLInputElement>('.topic-checkbox'),
  );

  // 페이지네이션 요소 (index.astro 의 #pagination)
  const pagination = document.getElementById('pagination');
  const pagePrev = document.getElementById('page-prev') as HTMLButtonElement | null;
  const pageNext = document.getElementById('page-next') as HTMLButtonElement | null;
  const pageInfo = document.getElementById('page-info');

  // 검색/필터 결과 0건 empty state (index.astro 의 #empty-state, #reset-filters)
  const emptyState = document.getElementById('empty-state');
  const resetButton = document.getElementById('reset-filters') as HTMLButtonElement | null;

  if (!grid) return;

  const allCards = Array.from(grid.querySelectorAll<CardElement>('.repo-card'));
  let currentPage = 1;
  // 북마크 토글 후 "카드가 어느 페이지로 이동했는지" 판정 + 카운트/페이지 정보 파생 소스
  let lastFilteredOrder: CardElement[] = [];
  const bookmarks = loadBookmarks();

  // 페이지네이션이 활성화된 결과에서의 총 페이지 수 (threshold 이하면 1)
  const getTotalPages = () => {
    const total = lastFilteredOrder.length;
    if (total <= PAGINATION_THRESHOLD) return 1;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  };

  // 전역 토스트 (Layout.astro 에 1개 존재). 동시 표시 방지를 위해 타이머 1개 공유.
  const toastEl = document.getElementById('global-toast');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const showToast = (message: string) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    // 이전 타이머 취소 (연속 토스트 시 깜빡임 방지)
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.classList.remove('opacity-0', 'translate-y-2');
    toastTimer = setTimeout(() => {
      toastEl.classList.add('opacity-0', 'translate-y-2');
    }, TOAST_DURATION_MS);
  };

  // 필터링된 배열에서 특정 저장소 이름(lowercase) 의 페이지 번호 산출. 없으면 null.
  const getCardPageByName = (name: string): number | null => {
    const idx = lastFilteredOrder.findIndex((c) => c.dataset.name === name);
    if (idx < 0) return null;
    return Math.floor(idx / PAGE_SIZE) + 1;
  };

  // 현재 선택된 topic 목록
  const getSelectedTopics = (): string[] =>
    topicCheckboxes.filter((c) => c.checked).map((c) => c.value);

  // Topic 버튼 라벨 갱신 (선택 수 반영)
  const updateTopicLabel = () => {
    if (!topicLabel) return;
    const selected = getSelectedTopics();
    const dict = dictionaries[getCurrentLang()];
    topicLabel.textContent =
      selected.length === 0
        ? dict.topic_multi_placeholder
        : formatTpl(dict.topic_multi_summary, { count: selected.length });
  };

  // URL 쿼리 → UI 상태 복원 (초기 1회)
  const restoreFromQuery = () => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const topicParam = params.get('topic');
    const sort = params.get('sort');
    const page = params.get('page');
    if (q !== null && searchInput) searchInput.value = q;
    if (topicParam !== null) {
      const wanted = new Set(topicParam.split(',').map((s) => s.trim()).filter(Boolean));
      for (const cb of topicCheckboxes) {
        cb.checked = wanted.has(cb.value);
      }
    }
    if (sort !== null && sortSelect && (VALID_SORTS as readonly string[]).includes(sort)) {
      sortSelect.value = sort;
    }
    if (page !== null) {
      const n = Number(page);
      if (Number.isFinite(n) && n >= 1) currentPage = Math.floor(n);
    }
  };

  // UI 상태 → URL 쿼리 반영 (기본값은 생략해 URL 을 짧게 유지)
  const syncQuery = () => {
    const params = new URLSearchParams();
    const q = (searchInput?.value ?? '').trim();
    const selected = getSelectedTopics();
    const sort = sortSelect?.value ?? DEFAULT_SORT;
    if (q) params.set('q', q);
    if (selected.length > 0) params.set('topic', selected.join(','));
    if (sort && sort !== DEFAULT_SORT) params.set('sort', sort);
    if (currentPage > 1) params.set('page', String(currentPage));
    const qs = params.toString();
    const next = qs ? `${location.pathname}?${qs}${location.hash}` : `${location.pathname}${location.hash}`;
    history.replaceState(null, '', next);
  };

  const updateCount = () => {
    if (!resultCount) return;
    const total = allCards.length;
    const shown = lastFilteredOrder.length;
    const dict = dictionaries[getCurrentLang()];
    resultCount.textContent =
      shown === total
        ? formatTpl(dict.count_all, { total })
        : formatTpl(dict.count_filtered, { shown, total });
  };

  const applyFilters = () => {
    const query = (searchInput?.value ?? '').trim().toLowerCase();
    const selectedTopics = getSelectedTopics();
    const sortKey = (sortSelect?.value ?? DEFAULT_SORT) as SortKey;

    const filtered = allCards.filter((card) => {
      // 검색어: 이름 + description + topics 범위
      if (query) {
        const nameHit = card.dataset.name.includes(query);
        const descHit = card.dataset.description.includes(query);
        const topicsHit = card.dataset.topics.toLowerCase().includes(query);
        if (!nameHit && !descHit && !topicsHit) return false;
      }
      // Topic 다중 AND: 선택된 모든 topic 을 카드가 포함해야 함
      if (selectedTopics.length > 0) {
        const cardTopics = card.dataset.topics.split(',').filter(Boolean);
        for (const t of selectedTopics) {
          if (!cardTopics.includes(t)) return false;
        }
      }
      return true;
    });

    // 1차 정렬: 선택된 sortKey 기준
    filtered.sort((a, b) => {
      switch (sortKey) {
        case 'stars':
          return Number(b.dataset.stars) - Number(a.dataset.stars);
        case 'name':
          return a.dataset.name.localeCompare(b.dataset.name);
        case 'created':
          return new Date(b.dataset.created).getTime() - new Date(a.dataset.created).getTime();
        case 'updated':
        default:
          return new Date(b.dataset.updated).getTime() - new Date(a.dataset.updated).getTime();
      }
    });

    // 2차 정렬: 북마크된 카드를 최상단으로 (기존 순서 내에서 stable 유지)
    if (bookmarks.size > 0) {
      const bookmarked: CardElement[] = [];
      const rest: CardElement[] = [];
      for (const c of filtered) {
        if (bookmarks.has(c.dataset.name)) bookmarked.push(c);
        else rest.push(c);
      }
      filtered.length = 0;
      filtered.push(...bookmarked, ...rest);
    }

    // 북마크 토글 후 이동 페이지 판정을 위해 정렬 결과 보존
    lastFilteredOrder = filtered;

    // 페이지네이션 계산: 결과 수가 threshold 초과일 때만 UI 노출
    const total = filtered.length;
    const paginated = total > PAGINATION_THRESHOLD;
    const totalPages = getTotalPages();
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const pageStart = paginated ? (currentPage - 1) * PAGE_SIZE : 0;
    const pageEnd = paginated ? pageStart + PAGE_SIZE : total;
    const visible = filtered.slice(pageStart, pageEnd);

    // DOM 재배치: 보이는 카드만 순서대로 다시 append, 나머지는 숨김
    // DocumentFragment 로 배치화해 저장소 수가 늘어도 reflow 를 1회로 유지
    for (const card of allCards) {
      card.style.display = 'none';
    }
    const frag = document.createDocumentFragment();
    for (const card of visible) {
      card.style.display = '';
      frag.appendChild(card);
    }
    grid.appendChild(frag);

    // 페이지네이션 UI 반영
    if (pagination) {
      if (paginated) {
        pagination.classList.remove('hidden');
        if (pagePrev) pagePrev.disabled = currentPage <= 1;
        if (pageNext) pageNext.disabled = currentPage >= totalPages;
      } else {
        pagination.classList.add('hidden');
      }
    }

    // empty state: 검색/필터 결과 0건이면 grid 숨기고 안내 + 초기화 버튼 노출
    const isEmpty = total === 0;
    if (emptyState) emptyState.classList.toggle('hidden', !isEmpty);
    grid.classList.toggle('hidden', isEmpty);

    updateCount();
    updateTopicLabel();
    updatePageInfo();
    syncQuery();
  };

  const updatePageInfo = () => {
    if (!pageInfo) return;
    const dict = dictionaries[getCurrentLang()];
    pageInfo.textContent = formatTpl(dict.pagination_info, {
      page: currentPage,
      total: getTotalPages(),
    });
  };

  // 북마크 상태를 버튼 UI 에 반영 + 클릭 핸들러 바인딩
  // 시각 상태(색/배경/글리프 fill) 는 global.css 의 `.bookmark-btn[aria-pressed="true"]` 가 전담
  const initBookmarkButtons = () => {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.bookmark-btn');

    const syncState = (btn: HTMLButtonElement, pressed: boolean) => {
      // i18n 키를 로컬 리터럴로 유지하여 타입 추론 + DOM 왕복 제거
      const key = pressed ? 'bookmark_remove' : 'bookmark_add';
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      btn.dataset.i18nArialabel = key;
      btn.setAttribute('aria-label', dictionaries[getCurrentLang()][key]);
    };

    for (const btn of buttons) {
      const name = btn.dataset.repoName ?? '';
      syncState(btn, bookmarks.has(name));

      btn.addEventListener('click', (e) => {
        // 카드 전체가 링크이므로 이벤트 전파 차단 — 상세 페이지로 이동하지 않도록
        e.preventDefault();
        e.stopPropagation();
        const nowPressed = !bookmarks.has(name);
        if (nowPressed) bookmarks.add(name);
        else bookmarks.delete(name);
        saveBookmarks(bookmarks);
        syncState(btn, nowPressed);
        applyFilters();

        // 재정렬 후 해당 카드가 다른 페이지로 밀려났는지 확인해 토스트
        // data-name 은 ProjectCard 에서 소문자로 저장되므로 비교도 소문자 기준
        const targetPage = getCardPageByName(name.toLowerCase());
        if (targetPage !== null && targetPage !== currentPage) {
          const dict = dictionaries[getCurrentLang()];
          showToast(formatTpl(dict.toast_card_moved, { page: targetPage }));
        }
      });
    }
  };

  // Topic 드롭다운 열기/닫기
  const closeTopicPanel = () => {
    topicPanel?.classList.add('hidden');
    topicToggle?.setAttribute('aria-expanded', 'false');
  };
  const toggleTopicPanel = () => {
    if (!topicPanel) return;
    const isOpen = !topicPanel.classList.contains('hidden');
    if (isOpen) {
      closeTopicPanel();
    } else {
      topicPanel.classList.remove('hidden');
      topicToggle?.setAttribute('aria-expanded', 'true');
    }
  };

  topicToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTopicPanel();
  });
  // 외부 클릭 시 패널 닫기
  document.addEventListener('click', (e) => {
    if (!topicFilterRoot) return;
    if (!topicFilterRoot.contains(e.target as Node)) closeTopicPanel();
  });
  // 패널 내부 클릭은 전파 차단 (바깥 클릭으로 닫히지 않도록)
  topicPanel?.addEventListener('click', (e) => e.stopPropagation());

  // 체크박스 변경 → 1페이지로 리셋 후 필터 재적용
  for (const cb of topicCheckboxes) {
    cb.addEventListener('change', () => {
      currentPage = 1;
      applyFilters();
    });
  }
  // 초기화 버튼 → 모든 체크 해제 + 1페이지로 리셋 + 재적용
  topicClear?.addEventListener('click', () => {
    for (const cb of topicCheckboxes) cb.checked = false;
    currentPage = 1;
    applyFilters();
  });

  // 이벤트 바인딩
  // 검색/Topic/정렬 변경 시 1페이지로 리셋 (기존 페이지가 필터 결과 페이지 수를 초과할 수 있음)
  const resetToFirstPage = () => {
    currentPage = 1;
    applyFilters();
  };
  // 검색 입력은 debounce — 저장소 수가 늘어도 타이핑 중 매 keystroke 마다 전수 reflow 방지
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  searchInput?.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(resetToFirstPage, SEARCH_DEBOUNCE_MS);
  });
  sortSelect?.addEventListener('change', resetToFirstPage);

  const scrollBehavior = (): ScrollBehavior =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  // 페이지네이션 버튼
  pagePrev?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      applyFilters();
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    }
  });
  pageNext?.addEventListener('click', () => {
    if (currentPage < getTotalPages()) {
      currentPage += 1;
      applyFilters();
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    }
  });

  // 북마크 버튼
  initBookmarkButtons();

  // 필터 초기화 버튼: 검색어/Topic/정렬 모두 기본값으로 되돌리고 1페이지로
  resetButton?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    for (const cb of topicCheckboxes) cb.checked = false;
    if (sortSelect) sortSelect.value = DEFAULT_SORT;
    currentPage = 1;
    applyFilters();
  });

  // 언어 변경 시 카운트 + Topic 라벨 + 페이지 정보만 재계산 (DOM 재배치 비용 회피)
  window.addEventListener('langchange', () => {
    updateCount();
    updateTopicLabel();
    updatePageInfo();
  });

  // 키보드 단축키:
  // - '/'  : 검색 input 포커스
  // - 'Esc': 검색 input 비우고 blur (검색 input 포커스일 때만)
  // - 'b'  : 키보드 포커스 또는 마우스 hover 카드의 북마크 토글
  // 입력 중(input/textarea/select/contentEditable) 또는 modifier 키(Ctrl/Meta/Alt)와 함께면 무시
  const isTypingTarget = (el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

  document.addEventListener('keydown', (e) => {
    // Esc 는 검색 input 포커스 상태일 때 우선 처리 (입력 비우기 + blur)
    if (e.key === 'Escape' && searchInput && document.activeElement === searchInput) {
      if (searchInput.value !== '') {
        searchInput.value = '';
        currentPage = 1;
        applyFilters();
      }
      searchInput.blur();
      return;
    }

    // 그 외 단축키는 입력 중이면 무시 + modifier 무시
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    if (e.key === '/') {
      e.preventDefault();
      searchInput?.focus();
      searchInput?.select();
      return;
    }

    if (e.key === 'b' || e.key === 'B') {
      // 우선순위: 키보드 포커스 카드 > 마우스 hover 카드
      const active = document.activeElement;
      const focused =
        active instanceof HTMLElement ? active.closest('.repo-card') : null;
      const hovered = focused ?? document.querySelector('.repo-card:hover');
      if (!hovered) return;
      const btn = hovered.querySelector<HTMLButtonElement>('.bookmark-btn');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    }
  });

  // 초기 실행: 쿼리 복원 → 필터 적용
  restoreFromQuery();
  applyFilters();
}

// DOM 준비 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFilter);
} else {
  initFilter();
}
