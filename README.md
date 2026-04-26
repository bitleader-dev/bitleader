# Bitleader Dashboard

`bitleader-dev` GitHub 계정의 public 저장소를 카드 형태로 보여주는 대시보드 홈페이지.

각 카드는 저장소 이름, 설명, README 첫 이미지, 언어/Topic chip 을 표시하며, 클릭 시 해당 저장소의 **상세 페이지**로 이동합니다. 상세 페이지에서는 README 전문과 Releases 정보, 다운로드/GitHub 이동 버튼을 확인할 수 있습니다.

- **배포 URL**: https://bitleader-dev.github.io/bitleader/
- **디자인 테마**: Lumina Dark (Glassmorphism, 네온 시안 액센트)

---

## 핵심 기능

### 메인 페이지 (대시보드)
- **자동 저장소 수집**: 빌드 타임에 GitHub API로 public 저장소 목록 조회
- **README 파싱**: 각 저장소 README에서 첫 이미지 + 180자 요약 자동 추출
- **카드 이미지 폴백**: README에 이미지가 없거나 원격 이미지 로딩 실패 시 `public/Thumbnail.png` 기본 이미지 표시
- **카드 대시보드**: 12-column 반응형 그리드 (데스크톱 3열 / 태블릿 2열 / 모바일 1열)
- **카드 배지**: 저장소가 `archived` / `fork` 인 경우 카드 우상단에 배지 자동 표시
- **업데이트 날짜**: 각 카드 본문 맨 아래에 저장소의 마지막 업데이트 날짜를 표시 (클라이언트 로드 시 상대 시간으로 변환 — `오늘`, `1일 전`, `N일 전`, 30일 이상은 월/일 표기. 언어 전환 시 함께 갱신)
- **북마크**: 카드 좌상단 별(★) 버튼으로 즐겨찾기 토글 — 북마크된 저장소는 정렬 결과의 **최상단으로 고정**. 상태는 브라우저 `localStorage` 에 보관 (서버 저장 X)
- **최근 릴리스**: 히어로 바로 아래에 전체 저장소 중 **최근 발행된 릴리스 3건** 자동 하이라이트
- **검색**: 저장소 이름 + description + Topics 대상 실시간 검색
- **필터**: Topic **다중 선택 (AND 조합)** — 여러 topic 을 체크하면 **모두 포함한** 카드만 남음
- **언어 필터**: 단일 선택 — 카드의 `language` 가 일치하는 저장소만 표시. 옵션은 **빈도 내림차순**(많이 쓰인 언어가 위)
- **별 카운트 chip**: ★ 1개 이상인 저장소는 카드 chip 줄에 `★ N` 표기 (정렬 키와 시각적 일관성)
- **정렬**: 최근 업데이트순 / 스타순 / 이름순 / 생성일순 (4가지)
- **URL 공유**: 현재 검색/필터/정렬/페이지 상태가 URL 쿼리(`?q=&topic=&language=&sort=&page=`)에 자동 반영되어 **링크로 필터 결과 공유 가능**
- **페이지네이션**: 저장소 수가 12개를 초과하면 자동으로 페이지 네비게이션이 노출 (12개 이하는 한 번에 전체 표시)
- **자동 갱신**: GitHub Actions 스케줄로 **매일 UTC 00:00 (= KST 09:00)** 자동 재빌드 + 배포 (GitHub 부하에 따라 최대 10~30분 지연 가능). push / 수동 실행 / cron 조정도 지원 — "배포", "사이트 업데이트 주기" 섹션 참고
- **빈 결과 안내**: 검색·필터로 결과가 0건이면 "검색 결과가 없습니다" 안내 + **필터 초기화** 버튼이 노출되어 한 번에 검색어/Topic/정렬을 모두 기본값으로 되돌림
- **키보드 단축키**: `/` = 검색창 포커스, `Esc` = 검색 초기화, `b` = hover/포커스 카드의 북마크 토글 (입력 중에는 비활성)

### 상세 페이지 (저장소별)
- **URL 형식**: `/bitleader/{repo-name}`
- **헤더 영역**: README 카드 위에 저장소 이름(시안색) + About Description 한 줄 표시 (description 없으면 이름만)
- **2열 레이아웃**: 왼쪽 README 전문 + 오른쪽 Releases 카드 및 액션 버튼
- **README 렌더링**: Markdown → 안전한 HTML 변환 (sanitize-html로 XSS 방지)
- **README 본문 복사 버튼**: 카드 헤더 우측의 복사 아이콘 클릭 → README **마크다운 원문**(헤딩 `#`, 리스트 `-`, 링크 `[text](url)`, 코드블록 ```` ``` ```` 등 syntax 그대로 보존)을 클립보드에 복사. 다른 마크다운 에디터/문서에 그대로 붙여넣기 가능. 복사 직후 1.5초간 ✓ 체크 아이콘 + 시안색 강조로 시각적 피드백 (`navigator.clipboard.writeText`)
- **코드 syntax highlighting**: 빌드 타임에 `shiki`(github-dark 테마) 로 README/릴리스 본문 코드 블록을 토큰 색상화. 미지원 언어는 일반 텍스트로 안전 폴백, 디자인 톤(검정 배경 + 시안 좌측 보더) 유지
- **상대 경로 자동 해결**: README 내 이미지/링크는 GitHub raw/blob 절대 경로로 변환
- **릴리스 카드**: 최신 1개 상세(최신 배지 + **릴리스 본문 보기** 토글로 펼침/접힘 + 릴리스 노트 링크) + 과거 2개 간략 + "+ N개 릴리스 더 보기" 링크 (0개면 "등록된 릴리스가 없습니다")
- **릴리스 본문 Markdown 렌더링**: 최신 릴리스 본문은 `<details>` 안에 Markdown 렌더링(상기 shiki 적용). 본문 없는 릴리스는 토글 자체 미표시
- **다운로드 버튼**: 저장소별 다운로드 URL이 있을 때만 표시 (아래 "Download URL 관리" 참고)
- **GitHub 저장소 버튼**: 항상 표시, 해당 저장소 GitHub 페이지로 이동

### 카드 표시 제외 규칙
- 홈페이지 자체 저장소(`bitleader`)는 카드에서 제외
- README.md 파일이 없는 저장소는 카드에서 제외

### SEO / 공유 관련
- **sitemap.xml**: `@astrojs/sitemap` 이 빌드 타임에 자동 생성 (`/bitleader/sitemap-index.xml`). 각 URL 의 `<lastmod>` 는 저장소 URL 의 경우 해당 저장소 `updated_at`, 그 외(메인/RSS/404)는 빌드 시각으로 자동 채워져 크롤러 재방문 효율↑
- **JSON-LD 구조화 데이터**: 메인 페이지에는 `WebSite` + `Organization` 그래프, 저장소 상세 페이지에는 `SoftwareSourceCode` 를 head 에 `<script type="application/ld+json">` 로 주입. 검색 결과 리치 스니펫 노출 가능 (`src/layouts/Layout.astro` 의 `jsonLd` prop)
- **robots.txt**: 전체 크롤링 허용 + sitemap 위치 명시 (`public/robots.txt`)
- **RSS 피드**: 전체 저장소의 최신 릴리스 20건을 `/bitleader/rss.xml` 로 노출. `Layout.astro` head 에 `<link rel="alternate" type="application/rss+xml">` 를 주입하여 브라우저·RSS 리더가 자동 발견. 의존성 없이 순수 XML 문자열로 생성(`src/pages/rss.xml.ts`)
- **keywords 메타**: 전역 `<meta name="keywords">` 로 핵심 키워드(Bitleader/GitHub/대시보드/릴리스 등) 명시
- **테마 일관성 메타**: `<meta name="theme-color" content="#0A0A0A">` (Android Chrome 주소창/상태바) + `<meta name="color-scheme" content="dark">` (브라우저 chrome 의 스크롤바·기본 폼 컨트롤이 다크와 매칭)
- **canonical / Open Graph / X(구 Twitter) Card**: 각 페이지별로 절대 URL 주입 — **저장소 상세 페이지를 메신저·SNS 에 붙여넣어도 해당 저장소 페이지 미리보기가 정확히 표시됨**. X 는 리브랜딩 후에도 `twitter:*` 메타 규격을 그대로 사용하므로 기존 태그 이름 유지
- **저장소별 동적 OG 이미지**: `satori` + `@resvg/resvg-js` 로 빌드 타임에 저장소당 1장씩 1200×630 PNG 를 `/bitleader/og/<repo>.png` 로 생성. Lumina Dark 톤 + 저장소 이름(큰 폰트) + description + BIT LEADER 로고 구성. 상세 페이지 공유 시 이 이미지가 `og:image` 로 사용되어 SNS/메신저 미리보기에 저장소별로 구분된 카드가 노출됨.
  - 영문 폰트: Google Fonts 에서 빌드 타임에 Inter(400/700) TTF/WOFF 를 1회 fetch 후 메모리 캐싱
  - 한글 폰트: `@fontsource/noto-sans-kr` 번들의 korean 서브셋 WOFF 파일을 로컬에서 직접 로드 → 한글 description 도 Noto Sans KR 로 정상 렌더
- **404 페이지**: 존재하지 않는 경로(`/bitleader/없는이름`) 접근 시 Lumina Dark 톤의 커스텀 404 페이지 (`src/pages/404.astro`) 반환

### 접근성 (a11y)
- **스킵 링크**: 키보드 Tab 첫 포커스 시 좌상단에 "본문 바로가기" 버튼이 슬라이드-인되어 `<main id="main">` 랜드마크로 즉시 이동
- **focus-visible 포커스 링**: 모든 인터랙티브 요소(링크·버튼·입력·드롭다운)에 키보드 포커스 전용 시안 아웃라인. 마우스 클릭에는 노이즈 없음
- **aria-\* 보강**: 페이지네이션 prev/next `aria-label` + `#page-info` `aria-live="polite"`, Topic 필터 `aria-controls`/`aria-haspopup`/`aria-expanded`, 북마크 버튼 `aria-pressed`, 모든 aria-label 은 i18n 연동(언어 전환 시 자동 갱신)
- **모션 민감 사용자 대응**: `@media (prefers-reduced-motion: reduce)` 로 모든 트랜지션/애니메이션을 즉시 종료, smooth scroll 도 instant 로 분기 (페이지네이션 클릭, Back to Top). OS 의 "동작 줄이기" 설정을 자동 반영

---

## 기술 스택

| 분류 | 라이브러리/도구 | 용도 |
|---|---|---|
| 프레임워크 | Astro 5.x | 정적 사이트 생성 (SSG) |
| 스타일 | Tailwind CSS 3.x | 유틸리티 기반 CSS |
| Markdown | marked + sanitize-html | README/릴리스 본문 렌더링 + XSS 방지 |
| Syntax highlighting | shiki (github-dark) | 빌드 타임 코드 블록 토큰 색상화 |
| Sitemap | @astrojs/sitemap | 빌드 타임 sitemap.xml 자동 생성 |
| OG 이미지 | satori + satori-html + @resvg/resvg-js (devDep) | 저장소별 Open Graph PNG 빌드 타임 생성 |
| OG 한글 폰트 | @fontsource/noto-sans-kr (devDep) | OG 이미지에서 한글 description 렌더 |
| 언어 | TypeScript 5.x (strict) | 타입 안전성 |
| 배포 | GitHub Pages + GitHub Actions | 정적 호스팅 + CI/CD |
| 품질 감시 | treosh/lighthouse-ci-action (Actions 전용) | 배포 후 점수 측정 + **하한 강제** (perf 0.80 / a11y 0.95 / best-practices 0.95 / seo 0.95). 미달 시 워크플로우 실패 (`lighthouserc.json`) |
| 타입/콘텐츠 진단 | @astrojs/check (devDep) | `npm run check` 로 .astro/.ts 정적 진단 |
| PR 회귀 검증 | GitHub Actions (Actions 전용) | PR/main push 시 `astro check` → 30개 mock fixture 생성 → `MOCK_REPOS=1` 빌드 → Playwright E2E 순차 실행으로 타입/번들/UX 회귀 차단 (`.github/workflows/ci.yml`, `scripts/generate-mock-fixtures.js`) |
| E2E 테스트 | @playwright/test (devDep) | 검색·Topic·언어·북마크·언어전환·상세 페이지·Back to Top 핵심 동선 자동 검증 (`tests/e2e/`, `playwright.config.ts`, `npm run test:e2e`) |
| 의존성 자동 추적 | Dependabot (`.github/dependabot.yml`) | 매주 월요일 09:00 KST, npm + github-actions 의 patch/minor 묶음 PR 자동 생성 (commit prefix `chore(deps)` / `chore(actions)`) |
| 폰트 | Google Fonts (Inter, Noto Sans KR), Material Symbols Outlined | 본문(영문 Inter / 한글 Noto Sans KR) + 아이콘 |

---

## 디렉토리 구조

```
bitleader-dev-HomePage/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml              # GitHub Pages 자동 배포 워크플로우
│   │   ├── ci.yml                  # PR/main push 시 check → MOCK_REPOS=1 빌드 → Playwright E2E
│   │   └── lighthouse.yml          # 배포 후 Lighthouse 점수 측정 + 하한 강제 (lighthouserc.json)
│   └── dependabot.yml              # 매주 월요일 09:00 KST npm/github-actions 자동 의존성 업데이트
├── src/
│   ├── layouts/
│   │   └── Layout.astro            # 전역 레이아웃 (폰트, 메타, canonical/OG URL 동적)
│   ├── pages/
│   │   ├── index.astro             # 메인 대시보드 (+ 페이지네이션 컨테이너)
│   │   ├── [repo].astro            # 저장소 상세 페이지 (+ Back to Top 버튼)
│   │   ├── 404.astro               # 커스텀 404 페이지
│   │   ├── rss.xml.ts              # 전체 저장소 최신 릴리스 RSS 피드
│   │   └── og/[repo].png.ts        # 저장소별 동적 OG 이미지 (satori)
│   ├── components/
│   │   ├── Header.astro            # 상단 고정 내비 + 검색 바 (aria-label 적용)
│   │   ├── DashboardHero.astro     # 메인 상단 히어로 (한글 문구)
│   │   ├── RecentReleases.astro    # 최근 릴리스 3건 하이라이트
│   │   ├── FilterBar.astro         # Topic 다중 체크박스 드롭다운 + 정렬
│   │   ├── ProjectCard.astro       # 저장소 카드 (북마크 버튼 + archived/fork 배지)
│   │   └── detail/
│   │       ├── DetailHeader.astro  # 홈으로 버튼 + 로고
│   │       ├── ReadmePanel.astro   # README 전문 (sanitize된 HTML 주입)
│   │       ├── ReleasesCard.astro  # 릴리스 카드 (최신 + 과거 2개)
│   │       └── ActionButtons.astro # 다운로드 / GitHub 저장소 버튼
│   ├── lib/
│   │   ├── github.ts               # GitHub API 호출 (모듈 스코프 메모이제이션 + GitHubFetchError)
│   │   ├── readme.ts               # Markdown 파싱 (이미지/요약/HTML 렌더링)
│   │   ├── data.ts                 # 카드/상세/최근 릴리스 데이터 조립
│   │   ├── og.ts                   # 동적 OG 이미지 생성 (satori + @resvg/resvg-js)
│   │   └── types.ts                # TypeScript 타입 정의
│   ├── i18n/
│   │   ├── ko.json                 # 한국어 번역 사전
│   │   ├── en.json                 # 영어 번역 사전
│   │   └── dictionary.ts           # 공용 i18n 유틸 (formatTpl/formatRelative 등)
│   ├── data/
│   │   └── repo-overrides.json     # 저장소별 커스텀 메타 (Download URL 등)
│   ├── scripts/
│   │   ├── filter.ts               # 검색/Topic 다중/정렬/북마크/페이지네이션/URL 동기화
│   │   └── i18n.ts                 # 클라이언트 사이드 언어 전환 런타임
│   └── styles/
│       └── global.css              # Tailwind + glass-panel/prose-dark 유틸
├── public/
│   ├── Thumbnail.png               # 카드 이미지 폴백 (README 이미지 없을 때 표시)
│   ├── favicon.svg                 # SVG 파비콘 (시안 배경 + BL 모노그램)
│   └── robots.txt                  # 크롤러 정책 (sitemap 위치 명시)
├── scripts/
│   ├── ensure-mock-stub.js         # prebuild 훅: fixture 부재 환경(CI 등)에서 빈 stub 자동 생성
│   ├── generate-mock-fixtures.js   # CI 전용: 30개 결정적 mock fixture 생성 (사용자 fixture 있으면 건너뜀)
│   └── build-mock.js               # cross-platform: MOCK_REPOS=1 환경변수 주입 후 build (Playwright e2e 용)
├── tests/
│   └── e2e/
│       ├── dashboard.spec.ts       # 메인 핵심 동선 (검색/Topic/언어/북마크/언어전환/단축키)
│       └── detail.spec.ts          # 상세 페이지 동선 (README/Releases/JSON-LD/Back to Top)
├── .env.example                    # PAT 템플릿 (커밋 O)
├── .env                            # 로컬 전용 토큰 (커밋 X)
├── .gitignore
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── lighthouserc.json               # Lighthouse CI 점수 하한 어설션 (perf/a11y/best-practices/seo)
├── playwright.config.ts            # Playwright E2E 설정 (chromium 단일, preview 자동 webServer)
├── package.json
├── README.md                       # 본 파일 (공개)
├── notes.md                        # 수정 이력 (로컬 전용, .gitignore)
└── plan.md                         # 개발 계획 (로컬 전용, .gitignore)
```

---

## 실행 방법

### 1) 의존성 설치
```bash
npm install
```

### 2) GitHub Personal Access Token 발급 (로컬 개발 권장)

GitHub API 비인증 요청은 시간당 60회로 제한되어 개발 중 자주 초과됩니다. Fine-grained PAT 발급 후 `.env`에 저장하면 시간당 5,000회까지 허용됩니다.

**발급 절차:**
1. https://github.com/settings/tokens?type=beta 접속
2. "Generate new token" 클릭
3. 옵션:
   - **Token name**: `bitleader-dev-homepage-local`
   - **Expiration**: 90 days (권장)
   - **Repository access**: "Public Repositories (read-only)" 선택
4. "Generate token" → 발급된 토큰을 즉시 복사 (이후 재확인 불가)
5. 프로젝트 루트에 `.env` 파일 생성:

```bash
# .env.example을 복사
cp .env.example .env
# 또는 Windows:
copy .env.example .env
```

6. `.env` 파일 내용:
```
GITHUB_TOKEN=ghp_여기에_발급받은_토큰
```

> `.env`는 `.gitignore`에 포함되어 있어 커밋되지 않습니다. 만약 실수로 커밋했다면 즉시 해당 토큰을 GitHub에서 폐기하고 재발급하세요.

### 3) 개발 서버 실행
```bash
npm run dev
```
접속: http://localhost:4321/bitleader/

### 4) 프로덕션 빌드
```bash
npm run build
```
결과물: `dist/` 디렉토리

### 5) 빌드 결과 미리보기
```bash
npm run preview
```

### 6) 타입/콘텐츠 정적 진단
```bash
npm run check
```
> `.astro`/`.ts` 의 타입 오류·미사용 변수 등을 빌드와 별개로 검사합니다. CI(`ci.yml`) 의 첫 단계로도 동일 명령이 실행됩니다.

### 7) E2E 테스트 실행
```bash
# 처음 1회만: 브라우저 다운로드
npx playwright install chromium

# 30개 mock fixture 위에서 핵심 동선 검증 (검색/필터/북마크/언어전환/상세 페이지/Back to Top)
npm run test:e2e
```
> webServer 가 자동으로 `MOCK_REPOS=1 npm run build` 후 `astro preview` 를 띄웁니다(`scripts/build-mock.js` 가 cross-platform 환경변수 주입). 사전에 빌드를 끝낸 상태라면 `E2E_SKIP_BUILD=1 npx playwright test` 로 preview 만 띄울 수도 있습니다(CI 가 이 모드로 동작).

---

## 배포

### GitHub 저장소 최초 설정
1. `bitleader-dev/bitleader` 저장소를 GitHub에 생성
2. 로컬 코드를 `main` 브랜치로 push
3. 저장소 **Settings → Pages → Source** 를 **"GitHub Actions"** 로 변경

### 배포 트리거 (3가지)

| 트리거 | 실행 조건 | 반영 소요 |
|---|---|---|
| `push` | `bitleader-dev/bitleader` 저장소 **`main` 브랜치에 push** 할 때 | 2~5분 |
| `schedule` | 매일 **UTC 00:00 (= KST 09:00)** 자동 (`.github/workflows/deploy.yml` 의 `cron: '0 0 * * *'`) | 2~5분 (GitHub 부하 시 최대 30분 지연) |
| `workflow_dispatch` | GitHub Actions 탭에서 수동 실행 | 2~5분 |

### 수동으로 지금 즉시 재배포하기

GitHub 저장소 정보(Topics, Description, README, Releases 등)를 수정한 뒤 **다음 스케줄(KST 09:00)까지 기다리지 않고 바로 반영**하고 싶을 때 사용합니다.

1. `bitleader-dev/bitleader` 저장소 페이지 상단의 **Actions** 탭 클릭
2. 왼쪽 사이드바에서 **Deploy to GitHub Pages** 워크플로우 선택
3. 목록 우측 상단의 **Run workflow** 버튼 클릭
4. 드롭다운에서 Branch **`main`** 선택 확인 → **Run workflow** 초록 버튼 클릭
5. 1~2분 대기 → 실행 목록 최상단의 작업이 초록색 ✓ 로 바뀌면 사이트 반영 완료
6. 브라우저에서 https://bitleader-dev.github.io/bitleader/ 접속(Ctrl+F5로 캐시 무시 새로고침)하여 결과 확인

> 저장소가 **60일 이상 비활성** 상태면 GitHub가 schedule 트리거를 자동 중단합니다. 이 경우 본 수동 실행을 1회 실행하면 다시 활성화됩니다.

### GitHub Actions 내 인증
GitHub Actions는 워크플로우 실행 시 `GITHUB_TOKEN` 시크릿을 자동 주입합니다. 별도 PAT 설정이 필요 없으며 public 저장소 읽기 권한이 자동 포함됩니다.

---

## 사이트 업데이트 주기

GitHub 저장소의 정보(Description, Topics, README, Releases 등)를 수정한 뒤 **카드 및 상세 페이지에 언제 반영되는가**에 대한 안내입니다.

| 경로 | 반영 시점 | 소요 시간 |
|---|---|---|
| **자동 (스케줄)** | **매일 UTC 00:00 = KST 09:00** | 2~5분 (GitHub 부하 시 최대 30분 지연) |
| **자동 (push)** | `bitleader-dev/bitleader` 저장소 `main` 브랜치 push 시 | 2~5분 |
| **수동 (Run workflow)** | GitHub Actions 탭 → **Deploy to GitHub Pages** → Run workflow (위 "수동으로 지금 즉시 재배포하기" 참고) | 2~5분 |
| **로컬 확인** | `npm run build` → `npm run preview` (배포되진 않음, 로컬 미리보기만) | 즉시 |

### cron 주기 바꾸기

반영 주기를 변경하려면 `.github/workflows/deploy.yml` 의 `cron: '0 0 * * *'` 값을 수정하세요. UTC 기준이며 최소 5분 간격까지 허용됩니다.

| 원하는 주기 | cron | KST 기준 실행 시각 |
|---|---|---|
| 매일 1회 *(현재값)* | `0 0 * * *` | 매일 09:00 |
| 매일 2회 (오전/저녁) | `0 0,12 * * *` | 매일 09:00, 21:00 |
| 6시간마다 | `0 */6 * * *` | 09:00, 15:00, 21:00, 03:00 |
| 1시간마다 | `0 * * * *` | 매 정각 |
| 15분마다 | `*/15 * * * *` | :00 / :15 / :30 / :45 |
| 평일 09:00 KST | `0 0 * * 1-5` | 월~금 09:00 |

> cron 표현식 시각화/검증: https://crontab.guru

---

## 카드 등록 빠른 가이드

새 저장소를 이 대시보드의 카드로 **노출**시키려면 아래 조건만 만족하면 됩니다. 정보 입력은 모두 **GitHub 웹 UI**에서 진행하며, 별도 파일 편집은 **커스텀 다운로드 URL** 지정이 필요할 때만 합니다.

### 필수 조건 (하나라도 충족 안 하면 자동 제외)

- [x] 저장소 소유자가 **`bitleader-dev` 계정**
- [x] 저장소 공개 범위가 **Public**
- [x] 저장소 이름이 **`bitleader` 가 아닐 것** (홈페이지 자체 저장소는 카드에서 스스로 제외)
- [x] 저장소 루트에 **`README.md` 파일 존재** (없으면 카드 대상에서 제외)

### 선택 항목 (카드 외관 개선)

| 항목 | 설정 위치 | 결과 / 영향 |
|---|---|---|
| **Description** | 저장소 About 섹션 ⚙️ → **Description** | 카드 제목 아래 설명(2번째 라인) |
| **Topics** | 저장소 About 섹션 ⚙️ → **Topics** | 카드 chip(첫 번째) + Topic 필터 드롭다운 옵션 |
| **README 첫 이미지** | README.md 본문 내 첫 `![](url)` 또는 `<img>` | 카드 썸네일 (없으면 `public/Thumbnail.png` 폴백) |
| **Language (언어)** | 소스코드 파일 분포로 GitHub가 **자동 판정** (수동 설정 불가) | 카드 chip (첫 번째 슬롯) |
| **커스텀 Download URL** | 본 저장소의 `src/data/repo-overrides.json` 에 항목 추가 | 상세 페이지 "다운로드" 버튼 URL 교체 |

> Topic/Description/Language 등 **GitHub 저장소 쪽**에서 바꾼 내용은 홈페이지 저장소에 push할 필요 없이 재빌드만 일어나면 자동 반영됩니다.

### 반영까지의 전체 순서

1. 위 필수 조건 충족 + (원하는) 선택 항목 GitHub UI에서 설정
2. 아래 중 하나로 홈페이지 재빌드 유도:
   - **기다리기**: 다음 **KST 09:00** 스케줄에 자동 반영
   - **즉시 반영**: 위 "수동으로 지금 즉시 재배포하기" 5단계 수행
3. https://bitleader-dev.github.io/bitleader/ 에서 카드 등장 확인 (필요 시 Ctrl+F5)

### 각 항목 세부 규칙
- **Description 우선순위 / 180자 요약 자동 추출** — "카드 설명(Description) 관리" 섹션 참고
- **Topic 완전 일치/정렬 규칙** — "Topic 관리" 섹션 참고
- **Download URL 하이브리드 규칙 (overrides → Release asset → 미표시)** — "Download URL 관리" 섹션 참고

---

## Download URL 관리

상세 페이지의 **다운로드** 버튼에 표시되는 URL은 아래 우선순위로 결정됩니다:

### 우선순위
1. `src/data/repo-overrides.json` 의 해당 저장소 `downloadUrl` — 수동 지정 URL 최우선
2. 해당 저장소의 **최신(Latest) Release의 첫 번째 Asset** `browser_download_url` — 자동 탐지
3. 둘 다 없으면 **다운로드 버튼 미표시** (GitHub 저장소 버튼만 표시)

### `repo-overrides.json` 작성법

외부 다운로드 사이트 URL 등 GitHub Release가 아닌 커스텀 URL을 지정하려면 이 파일에 항목 추가:

```json
{
  "dokkaebiterminal": {
    "downloadUrl": "https://example.com/dokkaebi-installer.exe"
  },
  "ClipMemory-releases": {
    "downloadUrl": "https://clipmemory.example.com/download"
  }
}
```

- **key**: GitHub 저장소 이름 (대소문자 그대로)
- **downloadUrl**: 클릭 시 이동할 URL (절대 경로)

### 동작 예시

| 저장소 | overrides.json | Latest Release Asset | 결과 |
|---|---|---|---|
| A | `https://a.com/dl` | 있음 | **overrides URL 사용** |
| B | 없음 | `foo.exe` | **Release asset URL 사용** |
| C | 없음 | 없음 | **버튼 미표시** |

---

## Topic 관리

메인 페이지의 **Topic 필터** 드롭다운 옵션은 각 저장소에 설정된 **GitHub Topics** 를 빌드 타임에 자동 수집하여 생성합니다. 이 프로젝트 내부에는 별도의 Topic 설정 파일이 없으며, 모든 등록/수정은 GitHub 저장소 페이지에서 진행합니다.

### 저장소에 Topic 등록하기

각 저장소 GitHub 페이지에서:

1. 저장소 메인 화면 우측 **About 섹션**의 톱니(⚙️) 아이콘 클릭
   - 예: `https://github.com/bitleader-dev/DokkaebiTerminal`
2. **Topics** 입력란에 키워드 입력 후 Enter 로 추가 (예: `terminal`, `windows`, `ai-agent`, `rust`)
3. **Save changes** 클릭

> Topic 규칙: 소문자/숫자/하이픈(`-`)만 사용, 저장소당 최대 20개.

### 사이트 반영

Topic 등록/수정 후 사이트에 나타나려면 홈페이지 저장소의 재빌드가 필요합니다. 반영 주기·수동 실행 방법은 상단의 **"사이트 업데이트 주기"** 섹션 참고.

### 필터 동작 규칙

- 드롭다운에서 선택한 topic이 저장소의 `topics` 배열에 **포함**되어 있으면 해당 카드만 노출
- 완전 일치 기준 — GitHub에 등록한 문자열이 옵션으로 그대로 표시됨 (한글 매핑/변환 없음)
- **전체 Topic** 선택 시 필터 해제되어 전체 카드 표시
- 대상 저장소에 topic이 하나도 없으면 드롭다운에는 **전체 Topic** 옵션만 노출됨

---

## 카드 설명(Description) 관리

카드의 제목 아래 **두 번째 라인**에 표시되는 설명 문구는 각 저장소의 **GitHub Description** 필드에서 가져옵니다. 이 프로젝트 내부에는 별도의 설명 편집 파일이 없으며, 모든 등록/수정은 GitHub 저장소 페이지에서 진행합니다.

### 표시 우선순위

1. **GitHub 저장소 `description`** — 값이 있으면 최우선 사용
2. **README 앞부분 180자 요약** — description 이 비어 있으면 README 본문에서 자동 추출 (Markdown 문법은 제거 후 잘라냄)
3. **둘 다 없음** — 설명 영역 자체를 렌더링하지 않음 (제목/칩만 표시)

### 저장소 Description 등록하기

각 저장소 GitHub 페이지에서:

1. 저장소 메인 화면 우측 **About 섹션**의 톱니(⚙️) 아이콘 클릭
   - 예: `https://github.com/bitleader-dev/ClipMemory-releases`
2. **Description** 란에 한 줄 설명 입력 (예: `ClipFlow Releases`, `Dokkaebi 기반 AI 터미널`)
3. **Save changes** 클릭

> Description은 한 줄 기준 짧게 작성하세요. 카드는 `line-clamp-2`로 2줄까지만 보이고 그 이상은 말줄임 처리됩니다.

### 사이트 반영

Description 등록/수정 후 사이트에 나타나려면 홈페이지 저장소의 재빌드가 필요합니다. 반영 주기·수동 실행 방법은 상단의 **"사이트 업데이트 주기"** 섹션 참고.

### 상세 페이지에서는?

상세 페이지(`/bitleader/{repo-name}`)는 README 카드 위 헤더에 Description 한 줄을 표시하고, 본문에는 **README 전문**을 렌더링합니다. Description 수정 시 다음 빌드에 헤더 영역이 갱신되며, README 자체를 수정하면 본문이 갱신됩니다.

---

## 다국어 지원

UI 는 **한국어 / English** 두 언어를 지원합니다.

### 동작 방식
- 상단 헤더 우측의 🌐 아이콘 드롭다운에서 언어 선택
- 첫 방문 시 **브라우저 언어** 를 감지해 자동 선택 (`en-*` → 영어, 그 외 → 한국어)
- 선택 언어는 `localStorage` 의 `lang` 키에 저장되어 다음 방문에도 유지됨
- 전환은 클라이언트 사이드 DOM 치환 — 새로고침 없이 즉시 반영

### 번역 범위
| 번역됨 | 번역 안 됨 (GitHub 원본 유지) |
|---|---|
| 검색창 placeholder | 저장소 이름 |
| 필터·정렬 드롭다운 라벨·옵션 (언어 필터 포함) | 저장소 Description |
| 상단 헤더 "홈으로" 버튼 | README 본문 |
| 히어로 문구, Footer | Topics 값 |
| 액션 버튼 (다운로드 / GitHub 저장소) | Release 태그·본문 |
| 릴리스 카드 헤더·"최신" 배지·"릴리스 노트"·"등록된 릴리스가 없습니다"·"+ N개 릴리스 더 보기" | |
| 상대 시간 표기 (`오늘` / `N일 전` / 월·일) | |
| 결과 카운트 (`저장소 N개 / 전체 M개`) | |
| 빈 결과 안내 (`검색 결과가 없습니다` / `필터 초기화`) | |
| 릴리스 본문 토글 (`릴리스 본문 보기`) | |
| README 복사 버튼 aria-label | |
| `<meta name="description">` SEO 문구 | |

### 번역 키 추가 방법
1. `src/i18n/ko.json` 과 `src/i18n/en.json` 에 **동일한 키** 로 번역 문구 추가
2. 컴포넌트에 아래 중 하나로 속성 부여:
   - `data-i18n="key"` — `textContent` 교체 (가장 흔함)
   - `data-i18n-placeholder="key"` — `placeholder` 속성 교체
   - `data-i18n-arialabel="key"` — `aria-label` 속성 교체 (접근성)
   - `data-i18n-tpl="key" data-i18n-var-<name>="value"` — 템플릿 `{<name>}` 치환
   - `data-iso="2025-01-01T..."` — 상대 시간 포맷으로 `textContent` 교체
3. `src/scripts/i18n.ts` 가 자동 스캔하므로 별도 등록 불필요

### 주의
- SEO 는 **기본 한국어 기준**. 언어별 URL 분리(`/ko/`, `/en/`) 가 필요한 경우 별도 라우팅 재설계 필요
- 초기 HTML 은 빌드 타임의 한국어로 찍히며, 브라우저 언어가 영어인 사용자는 JS 로드 후 영어로 교체되면서 **약간의 플래시**가 발생할 수 있음
- README 전문 / Release 본문 등 **사용자 저작 텍스트** 는 번역하지 않습니다 (원본 보존)

---

## 아키텍처 / 플로우

### 빌드 타임 데이터 수집 흐름
```
[npm run build]
       ↓
src/pages/index.astro
       ↓ getAllRepoCards()
src/lib/data.ts
       ├── fetchPublicRepos()         → api.github.com/users/bitleader-dev/repos
       │   (홈페이지 저장소 'bitleader' 제외)
       └── buildCardData(각 저장소)
             ├── fetchReadme()         → api.github.com/repos/{repo}/readme
             │   (README 없으면 null → 카드 제외)
             ├── extractFirstImage()   → README 첫 번째 이미지 URL 추출
             │   (blob URL → raw URL 자동 변환)
             └── extractSummary()      → 180자 요약 추출
                  (Markdown 문법 제거 후 잘라냄)
       ↓
RepoCardData[] → HTML 정적 생성
```

### 클라이언트 필터링 흐름
각 카드의 `data-*` 속성 (`data-name`, `data-description`, `data-topics`, `data-stars`, `data-updated`, `data-created`) 을 읽어 DOM을 직접 조작합니다. 서버 재요청 없이 실시간 동작.

```
search input (이름 + description) ┐
topic-filter  (단일 topic 선택)   ├── applyFilters() → 카드 show/hide + 재정렬
sort-order    (4가지 정렬 키)     ┘
```

### 상세 페이지 생성 흐름
```
[npm run build]
       ↓
src/pages/[repo].astro (동적 라우트)
       ↓ getStaticPaths()
getDetailRouteList()  → 대상 저장소 목록 + default_branch
       ↓ 각 저장소마다
getRepoDetail(name)
       ├── fetchPublicRepos()       → repo 메타
       ├── fetchReadme()            → README 원문
       ├── fetchReleases()          → releases[0..19]
       ├── renderMarkdown()         → Markdown → HTML → sanitize → 상대경로 해결
       └── resolveDownloadUrl()     → overrides.json → Release asset → null
       ↓
RepoDetailData → /{repo-name}/index.html 정적 생성
```

---

## 라이선스

본 프로젝트는 **[MIT License](./LICENSE)** 하에 공개됩니다.

코드를 사용, 재배포, 수정하시는 경우 **반드시 아래 출처를 명시**해 주시기 바랍니다.

- **Copyright Holder**: BITLEADER CORP.
- **Source Repository**: https://github.com/bitleader-dev/bitleader
- **Homepage**: https://bitleader-dev.github.io/bitleader/

### 출처 표기 예시

```
Based on BIT LEADER Dashboard by BITLEADER CORP.
(https://github.com/bitleader-dev/bitleader) — MIT License
```

전체 라이선스 조항은 저장소 루트의 [`LICENSE`](./LICENSE) 파일을 참고하세요.

