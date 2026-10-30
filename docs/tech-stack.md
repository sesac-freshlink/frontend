# 프론트엔드 기술 스택

FreshLink 화면(점주 `/owner`, 고객 `/customer`, 관리자 `/admin`)에 쓰는 라이브러리와 고른 이유를 정리한다. 새 라이브러리를 넣을 때는 이 표에 한 줄 추가한다.

## 1. 기본

| 영역 | 라이브러리 | 이유 |
| --- | --- | --- |
| 빌드 | Vite | 개발 서버가 빠르고, `npm run build` 결과(HTML·JS·CSS)를 그대로 S3에 올리면 된다 |
| 언어 | TypeScript | 로그인 응답(`/api/auth/me`)의 `role`·`storeId`, API 응답 모양을 타입으로 맞춰 세 명이 화면을 나눠 붙일 때 실수를 줄인다 |
| UI | React 19 | 기획안 3-4 기술 스택 |
| 라우팅 | react-router v8 | `/owner`·`/customer`·`/admin`을 한 앱에서 나누고, 역할(OWNER/CUSTOMER/ADMIN) 가드를 레이아웃 단위로 건다 |
| 스타일 | Tailwind CSS v4 | 클래스만으로 포스기(가로)·핸드폰(세로) 반응형을 빠르게 맞추고, CSS 파일끼리 충돌하지 않는다 |
| 클래스 정리 | clsx + tailwind-merge | 조건부 클래스를 합칠 때 충돌 없이 합친다. `cn()` 헬퍼 하나로 쓴다 |
| 아이콘 | lucide-react | 점주 사이드 메뉴, 고객 하단 탭 아이콘 |

## 2. 데이터와 상태

| 영역 | 라이브러리 | 이유 |
| --- | --- | --- |
| HTTP | axios | 기본 경로 `/api`, CSRF 헤더 자동 첨부, 401이면 갱신 한 번을 interceptor 한 곳에서 처리한다 |
| 서버 상태 | TanStack Query | 조회 캐싱, 점주 재고 3초 폴링·고객 주문 상세 2초 폴링(`refetchInterval`), 결제·폐기 후 목록 갱신(`invalidateQueries`) |
| 전역 상태 | Zustand | 전역으로 둘 것은 로그인한 사용자 정보(역할, 점포)뿐이라 Redux는 과하다 |
| 로그인 | 없음 (axios로 gateway `/api/auth/*` 호출) | 가입·로그인·갱신은 gateway가 Cognito에 대신 요청하고, 토큰은 HttpOnly 쿠키에 둔다. 화면은 우리가 직접 만든다 |
| 날짜 | dayjs | 유통기한 "24시간 이내·경과" 계산과 표시 |
| 폼·검증 | react-hook-form + zod | 로그인·가입·주문 수량 입력 검증을 모든 화면에서 같은 방식으로 쓴다 |
| 알림 | sonner | "재고가 바뀌었어요", "신규 주문", API 오류 같은 토스트 |
| 결제 | @tosspayments/tosspayments-sdk | 토스 테스트 결제(U-21, U-22). 연동은 고객 주문 화면에서 한다 |

### 실시간 재고는 폴링으로 한다 (S-15)

MVP에서 점주 재고 화면은 **3초마다 `GET /api/owner/inventory`를 다시 조회**한다. 고객이 결제하면 3초 안에 점주 화면 재고가 바뀐다.


### 로그인은 gateway BFF로 한다

member-service가 JWT를 직접 발급하던 방식에서 Amazon Cognito로 바꿨고(2026-10-13 결정), 다시 **gateway BFF**로 바꿨다(2026-10-28 멘토링). 토큰을 브라우저 자바스크립트가 읽지 못하게 하려는 것이다. 화면은 Cognito에 직접 붙지 않고 gateway의 `/api/auth/*`만 부른다. gateway가 Cognito에 대신 요청하고 받은 토큰을 쿠키에 넣는다.

| 쿠키 | 값 | Path |
| --- | --- | --- |
| `fl_id` | ID 토큰 | `/api` |
| `fl_refresh` | 리프레시 토큰 | `/api/auth` |
| `fl_uid` | 갱신에 쓰는 사용자 이름 | `/api/auth` |

모든 쿠키는 HttpOnly·Secure·SameSite=Strict다. 화면과 API가 같은 CloudFront 주소라서 브라우저가 알아서 보낸다. 프론트 쪽 동작은 아래와 같다.

1. 로그인 화면에서 `POST /api/auth/login`을 부르면 gateway가 쿠키를 굽고 사용자 정보(`userId`·`role`·`storeId`·`email`)를 돌려준다. 새로 고침하면 `GET /api/auth/me`로 다시 받는다.
2. axios는 모든 요청에 CSRF 헤더 `X-Requested-With: freshlink`를 붙인다. gateway는 POST·PUT·PATCH·DELETE에 이 헤더가 없으면 403으로 막는다. `Authorization` 헤더는 넣지 않는다.
3. API가 401이면 `src/shared/api/client.ts`의 interceptor가 `POST /api/auth/refresh`로 갱신을 한 번 하고 원래 요청을 한 번 다시 보낸다. 동시에 여러 요청이 401이어도 갱신 요청은 하나만 보낸다.
4. 갱신이 401이거나 갱신 뒤 다시 보낸 요청도 401일 때만 세션 만료로 보고 "다시 로그인해 주세요"를 띄운다. 갱신이 429·502·네트워크 오류로 실패하면 로그아웃하지 않는다.
5. 구글 로그인은 `/api/auth/google`로 페이지를 옮긴다. 실패하면 gateway가 `/login?error=google`로 돌려보낸다.
6. 로그아웃은 `POST /api/auth/logout`으로 쿠키를 지운 뒤 `/api/auth/logout/sso`로 이동한다. gateway가 Cognito 로그아웃을 거쳐 `/login`으로 돌려보내므로 다음 구글 로그인에서 계정 선택이 다시 나온다.

- 화면은 `src/shared/auth`의 `useAuthStore`만 쓴다. 로그인 API 호출은 `bffClient.ts` 한 파일에만 있다.
- 가입은 이메일·비밀번호(`/api/auth/signup`)와 인증 코드(`/api/auth/confirm`)만 보낸다. 그룹에 넣는 일은 가입 확인 Lambda가 한다.
- `VITE_API_MOCK`을 끄지 않으면(기본) 개발 서버에서 MSW가 `/api/auth/*`를 받아 **개발용 가짜 로그인**을 쓴다(`admin`으로 시작하는 이메일은 관리자, `owner`로 시작하는 이메일은 점주, 나머지는 고객). 가짜 모드에서는 로그아웃해도 `/api/auth/logout/sso`로 이동하지 않는다.

## 3. 개발·테스트

| 영역 | 라이브러리 | 이유 |
| --- | --- | --- |
| 가짜 API | MSW | 백엔드가 아직 없어도 `/api` 응답을 가짜로 돌려줘서 화면을 먼저 만든다. 개발 서버에서만 켜고 빌드에는 들어가지 않는다 |
| 쿼리 확인 | TanStack Query Devtools | 개발 중 캐시·폴링 상태 확인. 빌드에서는 빠진다 |
| 테스트 | Vitest + Testing Library | Vite 설정을 그대로 쓴다. 역할 가드, 401 갱신·세션 만료, 재고 계산 같은 핵심 로직을 테스트한다 |
| 린트 | oxlint | Vite 템플릿 기본값. ESLint와 같은 규칙(React hooks 등)을 훨씬 빠르게 검사한다 |
| 코드 정렬 | Prettier (+ Tailwind 플러그인) | 저장할 때 자동 정렬로 세 사람 코드 스타일을 맞추고, Tailwind 클래스 순서도 정렬한다 |

## 4. 넣지 않은 것

| 라이브러리 | 이유 |
| --- | --- |
| Redux | 전역 상태가 로그인 정보뿐이라 Zustand로 충분하다 |
| jwt-decode | 화면은 토큰을 읽지 않는다(HttpOnly 쿠키) |
| UI 컴포넌트 키트(shadcn 등) | 화면이 나온 뒤 필요하면 추가한다 |
| 차트·날짜 선택기 | 기획에 쓰는 화면이 없다 |

## 5. 폴더 규칙

README 4장 구조를 따른다.

- `src/app`: 라우터(`routes.tsx`), 공통 레이아웃(점주 사이드 메뉴, 고객 하단 탭), 역할 가드(`RequireRole`)
- `src/shared/api`: axios 인스턴스, Query 클라이언트, 폴링 주기(`POLL_MS`)
- `src/shared/auth`: 로그인 Zustand 스토어, BFF 클라이언트, 역할 확인
- `src/shared/ui`: 공통 컴포넌트, `cn()`
- `src/mocks`: MSW 가짜 API 핸들러
- import는 `@/` 별칭으로 쓴다(예: `@/shared/api/client`)
- 화면 폴더(`owner/inventory` 등) 안은 `pages/`(화면)와 `api.ts`(그 화면의 Query 훅)로 나눈다
