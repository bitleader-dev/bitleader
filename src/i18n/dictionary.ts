// 번역 사전 모듈
// - 모든 컴포넌트/스크립트가 공용으로 사용

import ko from './ko.json';
import en from './en.json';

export type LangCode = 'ko' | 'en';

export const SUPPORTED_LANGS: readonly LangCode[] = ['ko', 'en'];

// localStorage 키: Layout.astro 의 inline 스크립트와 i18n.ts 가 공유
export const STORAGE_KEY = 'lang';

export const dictionaries = { ko, en } as const;

// html[lang] 에 저장된 현재 언어 코드 반환 (미지정·미지원 시 'ko')
export function getCurrentLang(): LangCode {
  const lang = document.documentElement.lang;
  return lang === 'en' ? 'en' : 'ko';
}

// 템플릿 치환: "저장소 {total}개" + { total: 3 } -> "저장소 3개"
export function formatTpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

// 상대 시간 포맷터 (언어별). now 를 넘기면 루프 안에서 Date.now() 재호출을 피할 수 있음.
export function formatRelative(iso: string, lang: LangCode, now: number = Date.now()): string {
  const dict = dictionaries[lang];
  const date = new Date(iso);
  const diffDays = Math.floor((now - date.getTime()) / 86400000);
  if (diffDays === 0) return dict.time_today;
  if (diffDays === 1) return dict.time_yesterday;
  if (diffDays < 30) return formatTpl(dict.time_days_ago, { days: diffDays });
  return date.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    month: lang === 'ko' ? 'long' : 'short',
    day: 'numeric',
  });
}
