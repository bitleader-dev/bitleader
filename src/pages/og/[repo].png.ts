// 저장소별 OG 이미지 동적 라우트
// - 빌드 타임에 각 대상 저장소에 대해 /og/<repo>.png 정적 파일 생성
// - getStaticPaths 는 [repo].astro 와 동일한 대상 목록 사용 (getDetailRouteList)
// - 결과는 application/png 바이트 응답 (Astro 가 이를 dist/og/<repo>.png 로 저장)

import type { APIRoute, GetStaticPaths } from 'astro';
import { getDetailRouteList, getRepoDetail } from '../../lib/data';
import { renderOgImage } from '../../lib/og';

export const getStaticPaths: GetStaticPaths = async () => {
  const list = await getDetailRouteList();
  return list.map((item) => ({ params: { repo: item.name } }));
};

export const GET: APIRoute = async ({ params }) => {
  const repoName = params.repo;
  if (!repoName) {
    return new Response('repo param missing', { status: 400 });
  }

  const detail = await getRepoDetail(repoName);
  if (!detail) {
    return new Response('not found', { status: 404 });
  }

  const png = await renderOgImage({
    repoName: detail.name,
    description: detail.description,
  });

  // png 는 Uint8Array<ArrayBufferLike>. Response 의 BodyInit 는 ArrayBuffer-backed view 만 허용 →
  // 새 Uint8Array 로 복사해 ArrayBuffer-backed 인스턴스로 좁혀 TS 호환성 확보
  const pngBody = new Uint8Array(png);
  return new Response(pngBody, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
};
