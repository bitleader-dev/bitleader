// 클라이언트 사이드 언어 전환 런타임
// - 초기 언어: localStorage STORAGE_KEY > navigator.language > 'ko'
// - 지원 속성:
//   - data-i18n="key"                : textContent 교체
//   - data-i18n-placeholder="key"    : placeholder 속성 교체
//   - data-i18n-arialabel="key"      : aria-label 속성 교체
//   - data-iso="2025-01-01T..."      : 상대 시간 포맷으로 textContent 교체
//   - data-i18n-tpl="key"            : 템플릿, 변수는 data-i18n-var-<name> 로 수집
// - 언어 변경 이벤트(`langchange`)를 window 에 dispatch 하여 filter.ts 등이 재계산 가능

import {
  STORAGE_KEY,
  dictionaries,
  formatRelative,
  formatTpl,
  type LangCode,
} from '../i18n/dictionary';

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

// data-i18n-var-<name> 속성만 수집 (dataset 키는 i18nVar<Name> 로 변환됨)
const VAR_PREFIX = 'i18nVar';
function collectVars(el: HTMLElement): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key in el.dataset) {
    if (key.startsWith(VAR_PREFIX) && key.length > VAR_PREFIX.length) {
      const rest = key.slice(VAR_PREFIX.length);
      const name = rest.charAt(0).toLowerCase() + rest.slice(1);
      vars[name] = el.dataset[key] ?? '';
    }
  }
  return vars;
}

function applyLang(lang: LangCode) {
  const dict = dictionaries[lang];
  const now = Date.now();

  document.documentElement.lang = lang;

  // 단일 스캔: 관련 속성 중 하나라도 가진 요소를 한 번에 모아 분기 처리
  const selector =
    '[data-i18n],[data-i18n-placeholder],[data-i18n-arialabel],[data-iso],[data-i18n-tpl]';
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const textKey = el.dataset.i18n as keyof typeof dict | undefined;
    if (textKey && dict[textKey]) el.textContent = dict[textKey];

    const phKey = el.dataset.i18nPlaceholder as keyof typeof dict | undefined;
    if (phKey && dict[phKey]) el.setAttribute('placeholder', dict[phKey]);

    const arKey = el.dataset.i18nArialabel as keyof typeof dict | undefined;
    if (arKey && dict[arKey]) el.setAttribute('aria-label', dict[arKey]);

    const iso = el.dataset.iso;
    if (iso) el.textContent = formatRelative(iso, lang, now);

    const tplKey = el.dataset.i18nTpl as keyof typeof dict | undefined;
    if (tplKey && dict[tplKey]) {
      el.textContent = formatTpl(dict[tplKey], collectVars(el));
    }
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
