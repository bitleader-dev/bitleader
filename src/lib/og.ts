// OG(Open Graph) 이미지 빌드 타임 생성 유틸
// - satori 로 HTML 템플릿 → SVG 변환
// - @resvg/resvg-js 로 SVG → PNG 변환
// - Inter(라틴) 는 Google Fonts 에서 구형 UA 로 1회 fetch 후 메모리 캐시
// - Noto Sans KR(한글) 은 @fontsource/noto-sans-kr 번들의 korean 서브셋 WOFF 파일을 직접 로드
//   → CJK 글리프도 정상 렌더되므로 한글 description 그대로 노출 가능
//
// 저장소 상세 페이지 각각에 대해 /og/<repo>.png 정적 파일을 빌드 타임에 생성한다.

import satori from 'satori';
import { html as parseHtml } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { escapeXml } from './paths';

const require = createRequire(import.meta.url);

// 구형 Safari User-Agent — Google Fonts 가 이 UA 에는 TTF 포맷을 응답함
// (modern UA 를 쓰면 woff2 를 반환하는데 satori 는 woff2 를 지원하지 않음)
const LEGACY_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12) AppleWebKit/603.2.4 (KHTML, like Gecko) Version/10.1.1 Safari/603.2.4';

// 폰트 캐시 키: `${family}|${weight}`
const fontCache = new Map<string, Promise<ArrayBuffer>>();

// Google Fonts CSS 응답은 서브셋(cyrillic, greek, latin-ext, latin, korean …)별로 여러 @font-face 블록을 포함.
// 그 중 원하는 서브셋 블록 하나를 뽑아 TTF/WOFF URL 만 추출한다.
// satori 는 TTF/OTF/WOFF 를 지원하므로 포맷 두 가지 모두 허용.
function extractFontUrl(css: string, preferredSubset: string): string | null {
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g)];
  // 1) 선호 서브셋 매칭, 2) 없으면 첫 블록
  const target = blocks.find((m) => m[1] === preferredSubset) ?? blocks[0];
  if (!target) return null;
  const urlMatch = target[2].match(/src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|woff)['"]?\)/);
  return urlMatch?.[1] ?? null;
}

interface FontSpec {
  family: string; // Google Fonts family (URL encoded 이 필요한 공백 포함 가능)
  weight: 400 | 700;
  subset: string; // 'latin' | 'korean' 등
}

// Google Fonts 에서 폰트 바이너리 fetch + 메모리 캐싱
function loadGoogleFont({ family, weight, subset }: FontSpec): Promise<ArrayBuffer> {
  const cacheKey = `${family}|${weight}|${subset}`;
  const cached = fontCache.get(cacheKey);
  if (cached) return cached;
  const p = (async () => {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': LEGACY_UA } });
    if (!cssRes.ok) throw new Error(`${family} ${weight} css fetch failed: ${cssRes.status}`);
    const css = await cssRes.text();
    const url = extractFontUrl(css, subset);
    if (!url) {
      throw new Error(`${family} ${weight} font url not found. CSS head: ${css.slice(0, 300)}`);
    }
    const fontRes = await fetch(url);
    if (!fontRes.ok) throw new Error(`${family} ${weight} font fetch failed: ${fontRes.status}`);
    return fontRes.arrayBuffer();
  })();
  fontCache.set(cacheKey, p);
  return p;
}

// @fontsource/noto-sans-kr 번들의 korean 서브셋 WOFF 파일을 직접 읽는다.
// (satori 는 TTF/OTF/WOFF 지원, 로컬 파일 기반이라 빌드 재현성·속도가 좋음)
function loadNotoSansKR(weight: 400 | 700): Promise<ArrayBuffer> {
  const cacheKey = `Noto Sans KR|${weight}|korean`;
  const cached = fontCache.get(cacheKey);
  if (cached) return cached;
  const p = (async () => {
    const pkgPath = require.resolve(
      `@fontsource/noto-sans-kr/files/noto-sans-kr-korean-${weight}-normal.woff`,
    );
    const buf = await readFile(pkgPath);
    // Uint8Array → ArrayBuffer (satori 는 두 타입 모두 허용하지만 일관성을 위해 변환)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  })();
  fontCache.set(cacheKey, p);
  return p;
}

export interface OgImageParams {
  repoName: string;
  description: string | null;
}

// 저장소별 OG 이미지 PNG 바이트 생성 (1200x630)
// Inter(영문) + Noto Sans KR(한글) 을 satori fallback 체인으로 등록 → CJK description 도 정상 렌더
export async function renderOgImage({ repoName, description }: OgImageParams): Promise<Uint8Array> {
  const [inter400, inter700, notoKr400, notoKr700] = await Promise.all([
    loadGoogleFont({ family: 'Inter', weight: 400, subset: 'latin' }),
    loadGoogleFont({ family: 'Inter', weight: 700, subset: 'latin' }),
    loadNotoSansKR(400),
    loadNotoSansKR(700),
  ]);

  const safeName = escapeXml(repoName);
  const safeDesc = description ? escapeXml(description.trim()) : '';

  // satori 는 div 의 공백도 별도 자식으로 인식하므로 템플릿을 한 줄로 압축
  const descBlock = safeDesc
    ? `<div style="display:flex;color:#a1a1aa;font-size:34px;margin-top:28px;line-height:1.35;max-width:900px;font-weight:400;">${safeDesc}</div>`
    : '';
  const markup = parseHtml(
    `<div style="display:flex;flex-direction:column;width:100%;height:100%;background:#0A0A0A;padding:80px 88px;font-family:Inter,'Noto Sans KR';position:relative;">` +
      `<div style="display:flex;align-items:center;gap:12px;color:#00F0FF;font-size:36px;font-weight:700;letter-spacing:-0.03em;">BIT LEADER</div>` +
      `<div style="display:flex;position:absolute;right:-120px;bottom:-160px;width:500px;height:500px;border-radius:9999px;background:radial-gradient(closest-side, rgba(0,240,255,0.35), rgba(0,240,255,0));"></div>` +
      `<div style="display:flex;flex-direction:column;flex:1;justify-content:center;margin-top:40px;">` +
        `<div style="display:flex;color:white;font-size:92px;font-weight:700;line-height:1.05;letter-spacing:-0.03em;">${safeName}</div>` +
        descBlock +
      `</div>` +
      `<div style="display:flex;color:#52525b;font-size:24px;font-weight:700;letter-spacing:0.02em;">bitleader-dev.github.io/bitleader</div>` +
    `</div>`
  );

  const svg = await satori(markup, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: inter400, weight: 400, style: 'normal' },
      { name: 'Inter', data: inter700, weight: 700, style: 'normal' },
      // 한글 글리프 fallback — font-family 체인에서 Inter 다음으로 사용됨
      { name: 'Noto Sans KR', data: notoKr400, weight: 400, style: 'normal' },
      { name: 'Noto Sans KR', data: notoKr700, weight: 700, style: 'normal' },
    ],
  });

  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
    .render()
    .asPng();

  return png;
}
