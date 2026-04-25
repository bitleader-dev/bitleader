// README Markdown 파싱 로직
// 1) 첫 번째 이미지 URL 추출 (상대 경로 → 절대 경로 변환)
// 2) 본문에서 180자 요약 추출 (코드/이미지/링크 문법 제거)
// 3) 전문 Markdown → 안전한 HTML 변환 (상세 페이지용)
//    - 코드 블록은 shiki(github-dark) 로 빌드 타임 syntax highlighting
//    - 결과 HTML 의 inline style(color/background-color) 만 sanitize 화이트리스트로 허용

import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { createHighlighter } from 'shiki';
import { OWNER } from './github';

// shiki 가 미리 로드할 언어 목록 (저장소 README 에 자주 등장하는 것 위주)
// alias(js↔javascript, ts↔typescript, sh↔shell↔bash 등) 는 shiki 가 자동 처리
const SUPPORTED_LANGS = [
  'bash',
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'json',
  'jsonc',
  'html',
  'xml',
  'css',
  'scss',
  'yaml',
  'markdown',
  'python',
  'rust',
  'go',
  'java',
  'cpp',
  'c',
  'csharp',
  'sql',
  'dockerfile',
  'ini',
  'toml',
] as const;

const SHIKI_THEME = 'github-dark';

// shiki + marked 인스턴스는 빌드 1회만 초기화하고 모든 저장소 README/릴리스 본문에서 재사용
let markedPromise: Promise<Marked> | null = null;
function getMarked(): Promise<Marked> {
  if (markedPromise) return markedPromise;
  markedPromise = (async () => {
    const highlighter = await createHighlighter({
      themes: [SHIKI_THEME],
      langs: [...SUPPORTED_LANGS],
    });
    const loaded = new Set(highlighter.getLoadedLanguages());

    const m = new Marked({ gfm: true, breaks: false, async: true });
    m.use({
      async: true,
      walkTokens: (token) => {
        if (token.type !== 'code') return;
        const requested = (token.lang || '').toLowerCase().trim();
        const lang = requested && loaded.has(requested) ? requested : 'text';
        try {
          const html = highlighter.codeToHtml(token.text, {
            lang,
            theme: SHIKI_THEME,
          });
          // marked 가 변환된 HTML 을 그대로 출력하도록 토큰 교체
          Object.assign(token as unknown as Record<string, unknown>, {
            type: 'html',
            text: html,
            raw: html,
            block: true,
          });
        } catch {
          // 변환 실패 시 원본 code 토큰 유지 → marked 가 기본 <pre><code> 로 출력
        }
      },
    });
    return m;
  })();
  return markedPromise;
}

// 첫 번째 이미지 추출: Markdown ![alt](url) 우선, 없으면 HTML <img src="...">
// 상대 경로는 raw.githubusercontent.com 절대 경로로 변환
export function extractFirstImage(
  markdown: string,
  repoName: string,
  defaultBranch: string
): string | null {
  if (!markdown) return null;

  // 1) Markdown 이미지 문법: ![alt](url "title")
  const mdMatch = markdown.match(/!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/);
  if (mdMatch && mdMatch[1]) {
    return normalizeImageUrl(mdMatch[1], repoName, defaultBranch);
  }

  // 2) HTML <img src="..."> 태그
  const htmlMatch = markdown.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (htmlMatch && htmlMatch[1]) {
    return normalizeImageUrl(htmlMatch[1], repoName, defaultBranch);
  }

  return null;
}

// URL 정규화
// - 상대 경로 → raw.githubusercontent.com 절대 경로
// - github.com/{owner}/{repo}/blob/{branch}/{path} → raw.githubusercontent.com (blob URL은 HTML 페이지라 <img>에서 표시 안 됨)
// - 그 외 절대 URL은 그대로
function normalizeImageUrl(rawUrl: string, repoName: string, defaultBranch: string): string {
  const trimmed = rawUrl.trim();

  // github.com blob URL → raw URL 변환
  // 예: https://github.com/user/repo/blob/main/img.png → https://raw.githubusercontent.com/user/repo/main/img.png
  const blobMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i
  );
  if (blobMatch) {
    const [, user, repo, branch, path] = blobMatch;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
  }

  // 절대 URL (http/https/data/protocol-relative) 은 그대로 반환
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 앵커/쿼리만 있는 경우 폴백
  if (trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return trimmed;
  }

  // 상대 경로 → 절대 raw URL
  // 앞의 ./ 또는 / 제거
  const cleanPath = trimmed.replace(/^\.?\/+/, '');
  return `https://raw.githubusercontent.com/${OWNER}/${repoName}/${defaultBranch}/${cleanPath}`;
}

// README에서 요약 텍스트 추출 (기본 180자)
export function extractSummary(markdown: string, maxLen = 180): string {
  if (!markdown) return '';

  let text = markdown;

  // 코드 블록 제거 (``` ... ```)
  text = text.replace(/```[\s\S]*?```/g, '');
  // 인라인 코드 제거 (`...`)
  text = text.replace(/`[^`]*`/g, '');
  // HTML 주석 제거
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // HTML 태그 제거
  text = text.replace(/<[^>]+>/g, '');
  // 이미지 문법 제거 ![...](...)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // 링크 문법: [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // 참조 링크 정의 제거: [label]: url
  text = text.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '');
  // 헤딩/리스트/인용/구분선 마커 제거
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, '');
  // 강조 마커 제거 (**, __, *, _)
  text = text.replace(/(\*\*|__)(.+?)\1/g, '$2');
  text = text.replace(/(\*|_)(.+?)\1/g, '$2');
  // 여러 공백/줄바꿈 정리
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length <= maxLen) return text;

  // 자연스러운 경계(공백)에서 자르기
  const sliced = text.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(' ');
  const cutoff = lastSpace > maxLen * 0.6 ? lastSpace : maxLen;
  return `${text.slice(0, cutoff).trimEnd()}...`;
}

// sanitize 후 코드블록 inline style 만 통과시키는 패턴 (XSS 방어 유지)
// shiki 가 출력하는 색상은 #RRGGBB 형식이라 hex 만 허용해도 충분
const STYLE_VALUE_PATTERNS = [/^#(?:[0-9a-fA-F]{3,8})$/, /^rgba?\(/];

// Markdown 전문 → 안전한 HTML 변환 (async)
// - shiki 가 코드블록을 highlight 한 HTML 로 토큰 치환
// - sanitize-html 로 XSS 제거 (style 은 color/background-color 만 통과)
// - 이미지/링크 상대 경로를 raw/blob 절대 경로로 변환
export async function renderMarkdown(
  markdown: string,
  repoName: string,
  defaultBranch: string
): Promise<string> {
  if (!markdown) return '';

  const m = await getMarked();
  const rawHtml = (await m.parse(markdown)) as string;

  // 허용 태그/속성 한정 (XSS 방지)
  const cleaned = sanitizeHtml(rawHtml, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'del', 's', 'code', 'pre', 'kbd',
      'blockquote',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img',
      'span', 'div',
      'details', 'summary',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      // shiki 가 출력하는 inline style/tabindex 허용
      code: ['class', 'style'],
      pre: ['class', 'style', 'tabindex'],
      span: ['class', 'style'],
      div: ['class'],
      th: ['align'],
      td: ['align'],
    },
    // shiki 가 inline 으로 칠하는 토큰 색상만 통과시킴
    allowedStyles: {
      '*': {
        color: STYLE_VALUE_PATTERNS,
        'background-color': STYLE_VALUE_PATTERNS,
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    transformTags: {
      // 외부 링크는 새 탭으로 안전하게 열기
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  });

  // 이미지/링크 상대 경로 → 절대 경로 변환
  return resolveRelativeUrls(cleaned, repoName, defaultBranch);
}

// sanitize 후 HTML에서 상대 경로 src/href를 raw 또는 blob 절대 URL로 변환
function resolveRelativeUrls(
  html: string,
  repoName: string,
  defaultBranch: string
): string {
  const rawBase = `https://raw.githubusercontent.com/${OWNER}/${repoName}/${defaultBranch}`;
  const blobBase = `https://github.com/${OWNER}/${repoName}/blob/${defaultBranch}`;

  let result = html;

  // <img src="..."> 처리
  result = result.replace(/<img\b([^>]*?)\bsrc=(["'])([^"']+)\2/gi, (_match, pre, q, src) => {
    const resolved = resolveImageSrc(src, rawBase);
    return `<img${pre} src=${q}${resolved}${q}`;
  });

  // <a href="..."> 처리
  result = result.replace(/<a\b([^>]*?)\bhref=(["'])([^"']+)\2/gi, (_match, pre, q, href) => {
    const resolved = resolveLinkHref(href, blobBase);
    return `<a${pre} href=${q}${resolved}${q}`;
  });

  return result;
}

// 이미지 src: 상대 경로 → raw URL, github.com/blob/ → raw URL 변환
function resolveImageSrc(src: string, rawBase: string): string {
  const trimmed = src.trim();

  // github.com/{owner}/{repo}/blob/{branch}/{path} → raw로 변환
  const blobMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i
  );
  if (blobMatch) {
    const [, user, repo, branch, path] = blobMatch;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
  }

  // 절대 URL / data URI 은 그대로
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 앵커/쿼리만
  if (trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return trimmed;
  }

  // 상대 경로 → raw 절대 경로
  const cleanPath = trimmed.replace(/^\.?\/+/, '');
  return `${rawBase}/${cleanPath}`;
}

// 링크 href: 상대 경로 → blob URL (사람이 보는 페이지)
function resolveLinkHref(href: string, blobBase: string): string {
  const trimmed = href.trim();

  // 절대 URL / 앵커 / 메일 등은 그대로
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('#') || trimmed.startsWith('?')) return trimmed;
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;

  // 상대 경로 → blob URL (파일 탐색기로 이동)
  const cleanPath = trimmed.replace(/^\.?\/+/, '');
  return `${blobBase}/${cleanPath}`;
}
