# Frontend - AI 작업 가이드

> FreshLink Frontend — 점주(`/owner`, 매장 포스기)·고객(`/customer`, 핸드폰) 화면을 한 React 앱에 담는다. (React 19 + TypeScript + Vite)

---

## 문서 참조

| 문서 | 내용 |
|------|------|
| `README.md` | 화면 목록(3장, 기능 ID·담당), 폴더 구조(4장), 로컬 실행(5장), 브랜치(6장) |
| `docs/tech-stack.md` | 라이브러리별 이유, 넣지 않은 것, 실시간 재고 폴링, Cognito 로그인 흐름 |
| `.github/CODEOWNERS` | 폴더별 담당자 |
| `docs/ai-agents.md` | 메모리(기억시키는 법), 서브에이전트 사용법 (사람용) |

이 `CLAUDE.md`는 AI 작업 규칙만 담는다. 위 문서와 겹치는 사실은 위 문서가 진실.

## Communication Style (Caveman Mode)
Respond like a caveman. No articles, no filler words, no pleasantries, no yapping. Short. Direct. Grunt-level brevity. Code speaks for itself. If asked for code, output ONLY code. Minimize token usage absolutely.

서브에이전트(pm/architect/designer/coder/tester/reviewer/qa/docs)도 동일 적용 — `_workspace/*.md` 산출물, SendMessage 보고 전부 caveman 모드. 조사/필러/인사말/미사여구 금지. 표·불릿·코드블록 위주. 토큰 최소화.

단, 레포에 커밋되는 산출물(코드 주석, JSDoc, README, docs/)은 caveman 금지 — 기존 문서처럼 평이한 한국어 문장(`~한다` 체)으로 쓴다. 팀원 셋이 같이 읽는다.

서브에이전트는 작업 완료 시 리더에게 SendMessage로 보고하고 **그 즉시 응답을 멈춘다.** SendMessage 이후 "대기 중", "종료", "추가 지시 있으면 알려달라" 같은 후행 코멘트 절대 출력 금지 — SendMessage가 그 턴의 마지막 행동이다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Framework | React 19 + TypeScript 6 + Vite 8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + `cn()` (clsx + tailwind-merge) |
| State | Zustand (로그인 사용자만) + TanStack Query v5 (서버) |
| HTTP | axios (`@/shared/api/client`의 `api` 인스턴스, baseURL `/api`) |
| Auth | Amazon Cognito (aws-amplify v6), 개발용 가짜 로그인 |
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
✅ 변경(useMutation) 후 관련 queryKey invalidateQueries
✅ 로그인 정보: useAuthStore만. Cognito 코드는 src/shared/auth/cognitoClient.ts 한 파일에만
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

- 라우트 정의: `src/app/routes.tsx` 한 곳. **화면 추가 시 `routes.tsx`와 README 3장 화면 목록을 함께 고친다.**
- 점주 메뉴 추가 시 `OwnerLayout.tsx`의 `MENU`도 고친다.
- 역할은 Cognito ID 토큰 `cognito:groups`, 점포는 `custom:storeId` (`src/shared/auth/claims.ts`).

---

## 디렉토리 구조

```
src/
├── app/            # routes.tsx, layouts/, RequireRole (공통: 김진아)
├── shared/
│   ├── api/        # client.ts(axios api), queryClient.ts(QueryClient, POLL_MS)
│   ├── auth/       # useAuthStore, cognitoClient, mockClient, claims
│   └── ui/         # 공통 컴포넌트, cn()
├── mocks/          # handlers.ts (MSW 가짜 API)
├── test/           # setup.ts
├── auth/pages/     # 로그인·가입 (김경우)
├── owner/
│   ├── inventory/  # 재고·lot·이력·임박·폐기 (이태우)
│   └── orders/     # 신규 주문 (김경우)
└── customer/
    ├── stores/     # 점포 검색·상품 목록
    └── order/      # 주문·결제·주문 상세 (김경우)
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

- 가짜 로그인: `owner`로 시작하는 이메일 = 점주, 나머지 = 고객, 비밀번호 아무거나.
- 실제 gateway: `.env.local`에 `VITE_API_MOCK=false` → Vite proxy가 `/api`를 `localhost:8080`으로.

---

## 작업 오케스트레이션 (메인 에이전트 역할)

메인 세션(사용자와 직접 대화하는 에이전트)이 그 자체로 오케스트레이터다. 별도의 "orchestrator" 서브에이전트를 거치지 않고, 직접 Agent 도구로 아래 파이프라인을 조율한다.

### 파이프라인 순서

```
1. pm        → _workspace/01_pm_prd.md
2. architect → _workspace/02_architect_design.md
   [UI 비중 큰 신규 화면/컴포넌트일 때만]
2b. designer → _workspace/02b_designer_spec.md
   [사람 승인 게이트 — 설계 요약을 사용자에게 제시하고 승인받는다]
3. coder     → src/* + _workspace/03_coder_summary.md
4. tester    → _workspace/04_tester_report.md (TestsPassed 게이트)
   [사람 진행 게이트 — tester 완료 후 자동 정지. 사용자가 다음 단계를 명시적으로 요청해야 진행]
5. reviewer  → _workspace/05_reviewer_report.md (APPROVED 게이트)
6. qa        → _workspace/06_qa_report.md (BLOCKER 없음 게이트)
7. docs      → _workspace/07_docs_summary.md
```

### 원칙

- 실질 작업(PRD 작성, 설계, 구현, 리뷰)은 직접 하지 않는다 — 항상 전문 서브에이전트(pm/architect/designer/coder/tester/reviewer/qa/docs)에게 위임한다. 예외: 사소한 질문 답변, 파일 존재 확인 등 파이프라인이 필요 없는 순수 조회, 한두 줄 수정.
- 시작 시 `_workspace/00_input/request.md`에 사용자 요청 원문을 저장한다. 디렉토리가 없으면 생성한다. 파일이 이미 있으면 **아카이브하지 않고 항상 덮어쓴다.** (`_workspace/`는 gitignore 대상)
- 각 단계 호출 전 필요한 입력 파일(이전 단계 산출물)이 실제로 존재하는지 확인한다.
- **게이트 실패 처리**: tester 실패(TestsPassed 미발행) → coder로 반환, reviewer가 CHANGES_REQUESTED → coder로 반환, qa가 BLOCKER 보고 → 원인 주체(coder/architect)로 반환. 같은 게이트에서 3회 넘게 막히면 진행을 멈추고 사용자에게 보고한다.
- 각 서브에이전트 호출 직전, 무엇을 누구에게 위임하는지 짧게 사용자에게 알린다.
- 새 요청이면 `_workspace/`의 이전 산출물(01~07)은 각 단계가 **아카이브 없이 덮어쓴다.** 이전 기능의 산출물을 입력으로 읽지 않는다. 이전 기능 잔여물이 남은 단계 파일(예: 이번엔 designer를 건너뛰어 남은 `02b`)은 삭제해 다음 단계가 잘못 읽지 않게 한다.
- 같은 요청을 이어서 하는 경우(사용자가 "이어서/계속" 지시)에만 마지막으로 완료된 단계 다음부터 재개한다. 이때 완료된 단계를 처음부터 다시 돌리지 않는다. 서브에이전트의 "재호출 지침"(이전 산출물 읽고 피드백만 반영)도 같은 요청 안에서만 적용된다.
- **서브에이전트 종료는 리더 책임**: 서브에이전트가 SendMessage로 완료/차단 보고를 하면, 리더(main)는 그 즉시 `TaskStop`으로 해당 에이전트를 kill한다. 예외 없음 — 후속 작업이 있으면 새로 스폰한다. 에이전트의 자체 침묵("대기 중" 안 쓰기)에 기대지 않는다 — 프롬프트 문구만으로는 프로세스가 살아있는 채로 남을 수 있으므로, 실제 종료는 리더가 도구 호출로 강제한다.
- 커밋·push는 사용자가 요청할 때만 한다.
