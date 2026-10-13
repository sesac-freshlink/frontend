# 프론트엔드 기술 스택

FreshLink 화면(점주 `/owner`, 고객 `/customer`)에 쓰는 라이브러리와 고른 이유를 정리한다. 새 라이브러리를 넣을 때는 이 표에 한 줄 추가한다.

## 1. 기본

| 영역 | 라이브러리 | 이유 |
| --- | --- | --- |
| 빌드 | Vite | 개발 서버가 빠르고, `npm run build` 결과(HTML·JS·CSS)를 그대로 S3에 올리면 된다 |
| 언어 | TypeScript | JWT의 `role`·`storeId`, API 응답 모양을 타입으로 맞춰 세 명이 화면을 나눠 붙일 때 실수를 줄인다 |
| UI | React 19 | 기획안 3-4 기술 스택 |
| 라우팅 | react-router v8 | `/owner`·`/customer`를 한 앱에서 나누고, 역할(OWNER/CUSTOMER) 가드를 레이아웃 단위로 건다 |
| 스타일 | Tailwind CSS v4 | 클래스만으로 포스기(가로)·핸드폰(세로) 반응형을 빠르게 맞추고, CSS 파일끼리 충돌하지 않는다 |
| 클래스 정리 | clsx + tailwind-merge | 조건부 클래스를 합칠 때 충돌 없이 합친다. `cn()` 헬퍼 하나로 쓴다 |
| 아이콘 | lucide-react | 점주 사이드 메뉴, 고객 하단 탭 아이콘 |

## 2. 데이터와 상태

| 영역 | 라이브러리 | 이유 |
| --- | --- | --- |
| HTTP | axios | 기본 경로 `/api`, `Authorization: Bearer` 자동 첨부, 401이면 로그아웃을 interceptor 한 곳에서 처리한다 |
| 서버 상태 | TanStack Query | 조회 캐싱, 점주 재고 3초 폴링·고객 주문 상세 2초 폴링(`refetchInterval`), 결제·폐기 후 목록 갱신(`invalidateQueries`) |
| 전역 상태 | Zustand | 전역으로 둘 것은 로그인한 사용자 정보(역할, 점포)뿐이라 Redux는 과하다 |
| 로그인 | aws-amplify (`aws-amplify/auth`) | Amazon Cognito 사용자 풀에 가입·로그인하고, 토큰 저장(localStorage)과 만료 전 자동 갱신까지 해 준다. 화면은 우리가 직접 만든다(Hosted UI 안 씀) |
| 날짜 | dayjs | 유통기한 "24시간 이내·경과" 계산과 표시 |
| 폼·검증 | react-hook-form + zod | 로그인·가입·주문 수량 입력 검증을 모든 화면에서 같은 방식으로 쓴다 |
| 알림 | sonner | "재고가 바뀌었어요", "신규 주문", API 오류 같은 토스트 |
| 결제 | @tosspayments/tosspayments-sdk | 토스 테스트 결제(U-21, U-22). 연동은 고객 주문 화면에서 한다 |

### 실시간 재고는 폴링으로 한다 (S-15)

MVP에서 점주 재고 화면은 **3초마다 `GET /api/owner/inventory`를 다시 조회**한다. 고객이 결제하면 3초 안에 점주 화면 재고가 바뀐다.

SSE를 쓰지 않는 이유: inventory-service 파드가 2개라서, 점주 브라우저가 파드 A에 연결되어 있는데 결제 쪽지를 파드 B가 처리하면 A는 재고가 바뀐 걸 모른다. 이걸 풀려면 Redis pub/sub가 필요한데 2순위 기능이다. SSE는 2순위에서 Redis와 함께 붙인다.

### 로그인은 Cognito로 한다

member-service가 JWT를 직접 발급하던 방식에서 **Amazon Cognito**로 바꿨다(2026-10-13 결정). 프론트 쪽 동작은 아래와 같다.

1. 로그인 화면에서 `signIn(이메일, 비밀번호)`를 부르면 Amplify가 Cognito와 통신해 토큰을 받고 localStorage에 둔다.
2. ID 토큰의 `cognito:groups`(OWNER/CUSTOMER)로 역할을, `custom:storeId`로 점포를 꺼낸다(`src/shared/auth/claims.ts`).
3. axios가 API를 부를 때마다 `fetchAuthSession()`으로 토큰을 받아 `Authorization: Bearer`에 넣는다. 만료가 가까우면 Amplify가 알아서 갱신한다.
4. Gateway는 Cognito 공개키(JWKS)로 토큰을 검증한다. 프론트는 서명을 검증하지 않는다.

- 화면은 `src/shared/auth`의 `useAuthStore`만 쓴다. Cognito 코드는 `cognitoClient.ts` 한 파일에만 있다.
- `.env.local`에 `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`가 없으면 **개발용 가짜 로그인**을 쓴다(`owner`로 시작하는 이메일은 점주, 나머지는 고객).
- 지금은 ID 토큰을 보낸다. 점포 ID(`custom:storeId`)는 ID 토큰에만 들어 있기 때문이다. Gateway가 액세스 토큰으로 검증하기로 정하면 `cognitoClient.ts`의 `getToken`만 바꾼다.
- 가입 때 고른 역할은 클라이언트가 그룹에 직접 넣을 수 없어서 `clientMetadata.role`로 넘긴다. 그룹에 넣는 일은 백엔드(가입 후 Lambda 또는 member-service)가 한다.

## 3. 개발·테스트

| 영역 | 라이브러리 | 이유 |
| --- | --- | --- |
| 가짜 API | MSW | 백엔드가 아직 없어도 `/api` 응답을 가짜로 돌려줘서 화면을 먼저 만든다. 개발 서버에서만 켜고 빌드에는 들어가지 않는다 |
| 쿼리 확인 | TanStack Query Devtools | 개발 중 캐시·폴링 상태 확인. 빌드에서는 빠진다 |
| 테스트 | Vitest + Testing Library | Vite 설정을 그대로 쓴다. 역할 가드, JWT 만료, 재고 계산 같은 핵심 로직을 테스트한다 |
| 린트 | oxlint | Vite 템플릿 기본값. ESLint와 같은 규칙(React hooks 등)을 훨씬 빠르게 검사한다 |
| 코드 정렬 | Prettier (+ Tailwind 플러그인) | 저장할 때 자동 정렬로 세 사람 코드 스타일을 맞추고, Tailwind 클래스 순서도 정렬한다 |

## 4. 넣지 않은 것

| 라이브러리 | 이유 |
| --- | --- |
| Redux | 전역 상태가 로그인 정보뿐이라 Zustand로 충분하다 |
| jwt-decode | Amplify가 토큰 payload를 바로 준다 |
| SSE 클라이언트 | MVP는 폴링. 2순위에서 SSE로 바꿀 때 추가한다 |
| UI 컴포넌트 키트(shadcn 등) | 화면이 나온 뒤 필요하면 추가한다 |
| 차트·날짜 선택기 | 기획에 쓰는 화면이 없다 |

## 5. 폴더 규칙

README 4장 구조를 따른다.

- `src/app`: 라우터(`routes.tsx`), 공통 레이아웃(점주 사이드 메뉴, 고객 하단 탭), 역할 가드(`RequireRole`)
- `src/shared/api`: axios 인스턴스, Query 클라이언트, 폴링 주기(`POLL_MS`)
- `src/shared/auth`: 로그인 Zustand 스토어, Cognito·개발용 로그인, 토큰 클레임 해석
- `src/shared/ui`: 공통 컴포넌트, `cn()`
- `src/mocks`: MSW 가짜 API 핸들러
- import는 `@/` 별칭으로 쓴다(예: `@/shared/api/client`)
- 화면 폴더(`owner/inventory` 등) 안은 `pages/`(화면)와 `api.ts`(그 화면의 Query 훅)로 나눈다
