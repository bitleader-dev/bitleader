// 클라이언트 사이드 언어 전환 런타임
// - 초기 언어: localStorage 'lang' > navigator.language > 'ko'
// - DOM 의 data-i18n / data-i18n-attr / data-i18n-tpl / data-iso 를 스캔해 번역 적용
// - 언어 변경 이벤트(`langchange`)를 window 에 dispatch 하여 filter.ts 등 다른 스크립트가 재계산 가능

import { dictionaries, formatRelative, formatTpl, type LangCode } from '../i18n/dictionary';

const STORAGE_KEY = 'lang';

function getInitialLang(): LangCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ko' || stored === 'en') return stored;
  } catch {
    // localStorage 접근 불가 환경 대비
  }
  const nav = (navigator.language || 'ko').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'ko';
}

function applyLang(lang: LangCode) {
  const dict = dictionaries[lang];

  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  // data-i18n: textContent 교체
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as keyof typeof dict | null;
    if (key && dict[key]) el.textContent = dict[key];
  });

  // data-i18n-attr: "attr:key" 또는 "attr1:key1,attr2:key2"
  document.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    const raw = el.getAttribute('data-i18n-attr') || '';
    raw.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      const value = dict[key as keyof typeof dict];
      if (attr && value) el.setAttribute(attr, value);
    });
  });

  // data-iso: 상대 시간 포맷
  document.querySelectorAll<HTMLElement>('[data-iso]').forEach((el) => {
    const iso = el.getAttribute('data-iso');
    if (iso) el.textContent = formatRelative(iso, lang);
  });

  // data-i18n-tpl: 템플릿 + 치환 변수는 각 요소 data-* 에서 수집
  //   예) data-i18n-tpl="releases_more" data-remaining="5"
  document.querySelectorAll<HTMLElement>('[data-i18n-tpl]').forEach((el) => {
    const key = el.getAttribute('data-i18n-tpl') as keyof typeof dict | null;
    if (!key || !dict[key]) return;
    const vars: Record<string, string> = {};
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('data-') && attr.name !== 'data-i18n-tpl') {
        vars[attr.name.slice(5)] = attr.value;
      }
    });
    el.textContent = formatTpl(dict[key], vars);
  });

  // meta description 갱신 (SEO: 기본 한국어, 동적 전환 시 업데이트)
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', dict.meta_description);

  // 다른 스크립트(filter.ts 등) 재계산 트리거
  window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

function init() {
  const lang = getInitialLang();
  const select = document.getElementById('lang-switch') as HTMLSelectElement | null;
  if (select) {
    select.value = lang;
    select.addEventListener('change', () => {
      const next = select.value as LangCode;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // 저장 실패는 조용히 무시
      }
      applyLang(next);
    });
  }
  applyLang(lang);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
