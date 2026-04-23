// 클라이언트 사이드 검색 / Topic 필터 / 정렬
// 카드의 data-* 속성을 읽어 DOM을 조작하는 방식 (SSG 정적 사이트)
// - 결과 카운트는 i18n 사전 사용 (현재 언어는 document.documentElement.dataset.lang)
// - 언어 변경 시 window 'langchange' 이벤트 수신하여 재계산

import { dictionaries, formatTpl, type LangCode } from '../i18n/dictionary';

function currentLang(): LangCode {
  const lang = document.documentElement.dataset.lang;
  return lang === 'en' ? 'en' : 'ko';
}

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

function initFilter() {
  const grid = document.getElementById('card-grid');
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const topicSelect = document.getElementById('topic-filter') as HTMLSelectElement | null;
  const sortSelect = document.getElementById('sort-order') as HTMLSelectElement | null;
  const resultCount = document.getElementById('result-count');

  if (!grid) return;

  const allCards = Array.from(grid.querySelectorAll<CardElement>('.repo-card'));

  // 현재 필터 상태 반영하여 카드 목록 업데이트
  const applyFilters = () => {
    const query = (searchInput?.value ?? '').trim().toLowerCase();
    const topic = topicSelect?.value ?? '';
    const sortKey = (sortSelect?.value ?? 'updated') as SortKey;

    // 필터링
    const filtered = allCards.filter((card) => {
      // 검색어: 이름 + description 범위
      if (query) {
        const nameHit = card.dataset.name.includes(query);
        const descHit = card.dataset.description.includes(query);
        if (!nameHit && !descHit) return false;
      }
      // Topic 필터
      if (topic) {
        const topics = card.dataset.topics.split(',').filter(Boolean);
        if (!topics.includes(topic)) return false;
      }
      return true;
    });

    // 정렬
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

    // DOM 재배치: 보이는 카드만 순서대로 다시 append, 나머지는 숨김
    for (const card of allCards) {
      card.style.display = 'none';
    }
    for (const card of filtered) {
      card.style.display = '';
      grid.appendChild(card);
    }

    // 결과 카운트 표시 (현재 언어의 사전 사용)
    if (resultCount) {
      const total = allCards.length;
      const dict = dictionaries[currentLang()];
      resultCount.textContent =
        filtered.length === total
          ? formatTpl(dict.count_all, { total })
          : formatTpl(dict.count_filtered, { shown: filtered.length, total });
    }
  };

  // 이벤트 바인딩
  searchInput?.addEventListener('input', applyFilters);
  topicSelect?.addEventListener('change', applyFilters);
  sortSelect?.addEventListener('change', applyFilters);
  // 언어 변경 시 카운트 문자열 재계산
  window.addEventListener('langchange', applyFilters);

  // 초기 실행
  applyFilters();
}

// DOM 준비 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFilter);
} else {
  initFilter();
}
