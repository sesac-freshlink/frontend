export type Role = 'OWNER' | 'CUSTOMER' | 'ADMIN'

export interface AuthUser {
  /** Cognito 사용자 ID (sub) */
  userId: string
  role: Role
  /** 점주만 있다 (custom:storeId). 문자열 */
  storeId?: string
  email?: string
}

/** C-01 가입 입력. 역할은 보내지 않는다 (가입 확인 Lambda 가 직접 가입은 항상 CUSTOMER 로 넣는다) */
export interface SignUpInput {
  email: string
  password: string
}

/** POST /api/auth/login 요청 (signup 도 같은 모양) */
export interface LoginRequest {
  email: string
  password: string
}

/** POST /api/auth/confirm 요청 */
export interface ConfirmRequest {
  email: string
  code: string
}

/** C-02 login·refresh·me 공통 응답 (gateway AuthUser 그대로). 토큰은 쿠키에만 있고 본문에는 없다 */
export interface AuthUserResponse {
  userId: string
  role: Role
  storeId: string | null
  email: string | null
}

/** 로그아웃 뒤 로그인 화면에 고정으로 띄울 안내 */
export type LoginNotice = 'EMAIL_SIGNUP_EXISTS'

/**
 * 화면·store 는 이 인터페이스만 쓴다 (테스트에서 바꿔 끼운다).
 * 토큰은 gateway 가 HttpOnly 쿠키로만 다루므로 화면에는 토큰을 꺼내는 함수가 없다.
 */
export interface AuthClient {
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(input: SignUpInput): Promise<void>
  /** 인증 코드 확인. 역할은 넘기지 않는다 — 가입 확인 Lambda 는 role 을 보지 않고 직접 가입은 항상 CUSTOMER */
  confirmSignUp(email: string, code: string): Promise<void>
  /** 실패해도 resolve 한다 (쿠키 삭제는 서버 몫, 화면은 사용자를 비운다) */
  signOut(): Promise<void>
  /** 새로 고침 뒤 복원: /auth/me → 401 이면 refresh 한 번. 실패는 전부 null, 토스트 없음 */
  restore(): Promise<AuthUser | null>
  /**
   * POST /auth/refresh. 동시에 불러도 요청은 하나만 보낸다 (single-flight).
   * 401 이면 세션 만료로 null. 그 밖의 실패(429·502·네트워크 오류)는 그 오류로 reject 한다
   */
  refresh(): Promise<AuthUser | null>
}
