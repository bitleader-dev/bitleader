// 전체 저장소 릴리스 RSS 피드
// - 의존성 추가 없이 순수 XML 문자열 생성 (@astrojs/rss 미사용)
// - 빌드 타임에 /rss.xml 정적 파일 생성
// - collectRecentReleases(20) 결과를 RSS 2.0 item 으로 변환

import type { APIRoute } from 'astro';
import { collectRecentReleases } from '../lib/data';
import { absoluteUrl, escapeXml } from '../lib/paths';

export const GET: APIRoute = async ({ site }) => {
  // RSS 는 저장소별 다건 포함해 최신 20건을 채운다 (perRepoLimit=20 = 저장소당 무제한 수준)
  const items = await collectRecentReleases(20, 20);
  const selfUrl = absoluteUrl(site, '/rss.xml');
  const homeUrl = absoluteUrl(site, '/');
  const now = new Date().toUTCString();

  const xmlItems = items
    .map((item) => {
      const repoUrl = absoluteUrl(site, `/${item.repoName}/`);
      const pubDate = new Date(item.publishedAt).toUTCString();
      return (
        `<item>` +
        `<title>${escapeXml(item.repoName)} ${escapeXml(item.tag)}</title>` +
        `<link>${escapeXml(item.url)}</link>` +
        `<guid isPermaLink="false">${escapeXml(item.url)}</guid>` +
        `<pubDate>${pubDate}</pubDate>` +
        `<description>${escapeXml(item.title)}</description>` +
        `<source url="${escapeXml(repoUrl)}">${escapeXml(item.repoName)}</source>` +
        `</item>`
      );
    })
    .join('');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">` +
    `<channel>` +
    `<title>BIT LEADER — Releases</title>` +
    `<link>${homeUrl}</link>` +
    `<atom:link href="${selfUrl}" rel="self" type="application/rss+xml" />` +
    `<description>BIT LEADER 엔지니어링 팀이 공개한 저장소들의 최신 릴리스 피드</description>` +
    `<language>ko</language>` +
    `<lastBuildDate>${now}</lastBuildDate>` +
    xmlItems +
    `</channel>` +
    `</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
