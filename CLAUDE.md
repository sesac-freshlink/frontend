# Frontend - AI 작업 가이드

> FreshLink Frontend — 점주(`/owner`, 매장 포스기)·고객(`/customer`, 핸드폰)·관리자(`/admin`) 화면을 한 React 앱에 담는다. (React 19 + TypeScript + Vite)

---

## 문서 참조

| 문서 | 내용 |
|------|------|
| `README.md` | 화면 목록(3장, 기능 ID·담당), 폴더 구조(4장), 로컬 실행(5장), 브랜치(6장) |
| `docs/tech-stack.md` | 라이브러리별 이유, 넣지 않은 것, 실시간 재고 폴링, BFF 로그인 흐름 |
| `.github/CODEOWNERS` | 폴더별 담당자 |
| `docs/ai-agents.md` | 메모리(기억시키는 법), Claude 작업 방식 (사람용) |
| `.github` 레포 `docs/기능이해/주문-결제-흐름과-재고-예약.md` | **고객 주문·결제 화면(U-21, U-22, U-31) 작업 전에 먼저 읽는다.** 주문 상태별 고객 화면 문구 |

이 `CLAUDE.md`는 AI 작업 규칙만 담는다. 위 문서와 겹치는 사실은 위 문서가 진실.

## Communication Style (Caveman Mode)
Respond like a caveman. No articles, no filler words, no pleasantries, no yapping. Short. Direct. Grunt-level brevity. Code speaks for itself. If asked for code, output ONLY code. Minimize token usage absolutely.

단, 레포에 커밋되는 산출물(코드 주석, JSDoc, README, docs/)은 caveman 금지 — 기존 문서처럼 평이한 한국어 문장(`~한다` 체)으로 쓴다. 팀원 셋이 같이 읽는다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Framework | React 19 + TypeScript 6 + Vite 8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + `cn()` (clsx + tailwind-merge) |
| State | Zustand (로그인 사용자만) + TanStack Query v5 (서버) |
| HTTP | axios (`@/shared/api/client`의 `api` 인스턴스, baseURL `/api`) |
| Auth | gateway BFF(`/api/auth/*`, 토큰은 HttpOnly 쿠키), 개발용 가짜 로그인(MSW) |
| Form | react-hook-form + zod |
| UI | lucide-react 아이콘, sonner 토스트, dayjs 날짜 |
| Routing | **react-router v8** (`react-router`에서 import. `react-router-dom` 아님) |
| 결제 | @tosspayments/tosspayments-sdk (U-21, U-22) |
| Dev/Test | MSW 3 (가짜 API), Vitest 5 + Testing Library, oxlint, Prettier |

---

## 핵심 규칙

```
✅ any 타입 금지 → 명시적 타입, 모르는 값은 unknown + 타입 가드
✅ 서버 상태: TanStack Query만 (useState는 UI 상태만, 서버 데이터 복사 금지)
✅ API 호출: 화면 폴더 api.ts의 Query 훅으로만. Page에서 api/axios/fetch 직접 호출 금지
✅ API 경로: 항상 상대 경로 '/api/...' (api 인스턴스가 baseURL 붙임). 절대 URL·localhost 하드코딩 금지
✅ 폴링 주기: POLL_MS(@/shared/api/queryClient)에서만. 숫자 하드코딩 금지
⛔ 고객 화면(src/customer/**)에 "예약" 문구 금지. 주문 상태 RESERVING은 "주문 확인 중" 로딩으로만 보여 준다 (재고 예약은 백엔드 내부 단계. "예약 수량"은 점주 재고 화면에서만 쓴다)
✅ 변경(useMutation) 후 관련 queryKey invalidateQueries
✅ 로그인 정보: useAuthStore만. 로그인 API 호출은 src/shared/auth/bffClient.ts 한 파일에만, 401 갱신은 src/shared/api/client.ts만. 화면은 토큰을 다루지 않는다
✅ 역할 차단: RequireRole(라우트 단위). 화면 안에서 role 분기로 막지 않는다 (진짜 권한 확인은 gateway)
✅ 조건부 클래스: cn() 사용. 템플릿 문자열·삼항 나열 금지
✅ import는 @/ 별칭 (같은 화면 폴더 안은 상대 경로 허용)
```

---

## 디자인 규칙

디자인 토큰 파일·UI 키트 없음. Tailwind 기본 팔레트를 기존 화면과 같게 쓴다.

```
⚠️ 스타일 작업 전 → src/app/layouts/OwnerLayout.tsx, CustomerLayout.tsx 먼저 읽고 톤 맞출 것
⚠️ 색: 브랜드 emerald(강조·활성), 중립 slate(본문 900/보조 500/흐림 400/테두리 200/배경 50), 오류 red-600
⚠️ 임의값(text-[#..], w-[37px]) 금지 → Tailwind 스케일 사용
⚠️ 점주 화면 = 포스기 가로(사이드 메뉴), 고객 화면 = 핸드폰 세로. 각자 레이아웃 안에서만 설계
⚠️ 새 공통 컴포넌트 → src/shared/ui/ 에서 기존 것 먼저 확인. 두 화면 이상에서 쓰일 때만 shared/ui로 올린다
⚠️ 아이콘 = lucide-react, 토스트 = sonner. 새 UI 라이브러리 추가 금지 (필요하면 사용자 확인 + docs/tech-stack.md 표에 한 줄)
```

---

## 역할 기반 라우팅

| 경로 | 역할 | 레이아웃 | 설명 |
|------|------|----------|------|
| `/login`, `/signup` | 공개 | 없음 | 로그인·가입 (C-01, C-02) |
| `/owner/*` | OWNER | `OwnerLayout` | 점주. 포스기. `user.storeId` 있음 |
| `/customer/*` | CUSTOMER | `CustomerLayout` | 고객. 핸드폰 |
| `/admin/*` | ADMIN | `AdminLayout` | 관리자. 점포 목록·수정, 점포·점주 등록 (A-01, A-02) |

- 라우트 정의: `src/app/routes.tsx` 한 곳. **화면 추가 시 `routes.tsx`와 README 3장 화면 목록을 함께 고친다.**
- 점주 메뉴 추가 시 `OwnerLayout.tsx`의 `MENU`, 관리자 메뉴 추가 시 `AdminLayout.tsx`의 `MENU`도 고친다.
- 역할·점포는 `/api/auth/me` 응답(gateway가 토큰의 `cognito:groups`·`custom:storeId`에서 꺼낸다).

---

## 디렉토리 구조

```
src/
├── app/            # routes.tsx, layouts/, RequireRole (공통: 김진아)
├── shared/
│   ├── api/        # client.ts(axios api), queryClient.ts(QueryClient, POLL_MS)
│   ├── auth/       # useAuthStore, bffClient, claims
│   └── ui/         # 공통 컴포넌트, cn()
├── mocks/          # handlers.ts (MSW 가짜 API)
├── test/           # setup.ts
├── auth/pages/     # 로그인·가입 (김경우)
├── owner/
│   ├── inventory/  # 재고·lot·이력·임박·폐기 (이태우)
│   └── orders/     # 신규 주문 (김경우)
├── customer/
│   ├── stores/     # 점포 검색·상품 목록
│   └── order/      # 주문·결제·주문 상세 (김경우)
└── admin/
    └── stores/     # 관리자 점포 목록·수정·점포 등록 (김경우)
```

화면 폴더(`{area}/{feature}/`) 안은 `api.ts`(타입 + Query 훅) + `pages/`(화면)로 나눈다.

---

## 작업 순서

```
Types → Query 훅(api.ts) → MSW 핸들러 → Page → 라우트·README
```

---

## 새 기능(Feature) 개발 아키텍처 원칙

> **적용 범위: 새로 지시받은 기능에만 적용. 기존 코드는 건드리지 않는다.**

### 레이어별 책임

| 레이어 | 위치 | 책임 |
|--------|------|------|
| Types | `src/{area}/{feature}/api.ts` 상단 | 요청/응답 DTO interface. 백엔드 응답 모양 그대로 |
| Query 훅 | 같은 `api.ts` | `useQuery`/`useMutation` + `api.get/post`. queryKey, `refetchInterval`, invalidate |
| Mock | `src/mocks/handlers.ts` | 같은 경로·같은 응답 모양의 MSW 핸들러. 타입은 `api.ts`에서 import |
| 화면 로직 훅 | `src/{area}/{feature}/use{Feature}{Context}.ts` | 폼(react-hook-form+zod), 파생 계산(유통기한 등). **필요할 때만** 분리 |
| Page | `src/{area}/{feature}/pages/{Name}Page.tsx` | UI만 (thin). 훅 결과를 그리고 isPending/isError/빈 목록 처리 |
| Route | `src/app/routes.tsx` | 역할 아래 children에 등록 |

### 규칙

```
✅ 상위 레이어는 하위 레이어만 의존 (Page → 훅 → api.ts → shared/api)
✅ queryKey 형식: [area, feature, ...params] (예: ['owner', 'inventory'])
✅ Query 훅 이름: use{Resource} / use{Action}{Resource} (예: useInventory, useDiscardLot)
✅ 화면 로직 훅은 반환 타입 interface {HookName}Return 명시 export
✅ Page 상태 3종 필수: 로딩, 오류, 빈 목록
✅ 기능 ID(S-10, U-21 등)를 JSDoc 한 줄에 남긴다 (기존 api.ts처럼)
✅ 순수 계산(유통기한 판정, 금액 합계)은 함수로 분리해 테스트 가능하게
✅ API 스펙 미확정이면 MSW로 먼저 만들고 PRD/설계에 "미확정"으로 표기 — 추측을 확정처럼 쓰지 않는다
```

### 모범 예시

```
src/owner/inventory/api.ts       ← 타입 + useInventory (3초 폴링, POLL_MS)
src/mocks/handlers.ts            ← GET /api/owner/inventory 가짜 응답
src/app/RequireRole.test.tsx     ← 라우터 + useAuthStore.setState 테스트 패턴
src/shared/auth/claims.test.ts   ← 순수 함수 테스트 패턴
```

---

## 담당·브랜치

- 폴더 담당은 `.github/CODEOWNERS`. 다른 담당자 폴더를 고쳐야 하면 작업 전 사용자에게 알린다.
- 브랜치: `main`(배포) ← `dev`(통합, 기본) ← `feat/<기능ID>-<설명>` (예: `feat/S-10-inventory-page`)
- 커밋 메시지: `feat:`/`fix:`/`docs:` + 한국어 요약 (git log 참고)

---

## 실행·검증

```bash
npm install
npm run dev            # http://localhost:5173 (기본 MSW 가짜 API + 가짜 로그인)
npx tsc -b             # 타입 검사 (프로젝트 references 구성이라 -b)
npm run lint           # oxlint
npm test               # vitest run
npm run format:check   # prettier
npm run build          # tsc -b && vite build
```

- 가짜 로그인: `admin`으로 시작하는 이메일 = 관리자, `owner`로 시작하는 이메일 = 점주, 나머지 = 고객, 비밀번호 아무거나.
- 실제 gateway: `.env.local`에 `VITE_API_MOCK=false` → Vite proxy가 `/api`를 `localhost:8080`으로.
- 진짜 로그인(이메일·구글, 쿠키) 확인은 dev 배포 주소에서 한다. PC에 gateway를 띄우는 개발 환경은 쓰지 않는다.

---

## 작업 방식

Claude 하나(메인 세션)가 `.claude/skills/freshlink-pipeline/SKILL.md` 순서대로 직접 한다: 크기 정하기 → 이해 → 계획 → 구현 → 검증 → 자체 리뷰 → 커밋·PR. 프론트 검증 명령과 리뷰 점검표는 같은 폴더 `frontend.md`.

- 작은 일(문구, 스타일 한두 줄)은 계획·리뷰를 건너뛰고 바로 고친 뒤 `npx tsc -b`·`npm run lint`만 돌린다.
- 화면 하나·기능 하나는 계획(5~10줄)을 보여 주고 ok를 받은 뒤 구현한다. 구현 순서는 위 "작업 순서"(Types → api.ts → MSW → Page → 라우트·README).
- 서브에이전트에게 일을 넘기지 않는다(예외는 스킬에 적힌 경우만). `_workspace/` 파일을 만들지 않는다.
- 커밋·push는 사용자가 요청할 때만 한다.
