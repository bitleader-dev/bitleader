// 번역 사전 모듈
// - 모든 컴포넌트/스크립트가 공용으로 사용
// - 지원 언어: ko, en

import ko from './ko.json';
import en from './en.json';

export type LangCode = 'ko' | 'en';

export const dictionaries = { ko, en } as const;

export type TranslationKey = keyof typeof ko;

// 템플릿 치환: "저장소 {total}개" + { total: 3 } -> "저장소 3개"
export function formatTpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

// 상대 시간 포맷터 (언어별)
export function formatRelative(iso: string, lang: LangCode): string {
  const dict = dictionaries[lang];
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return dict.time_today;
  if (diffDays === 1) return dict.time_yesterday;
  if (diffDays < 30) return formatTpl(dict.time_days_ago, { days: diffDays });
  return date.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    month: lang === 'ko' ? 'long' : 'short',
    day: 'numeric',
  });
}
