export type Role = 'OWNER' | 'CUSTOMER'

export interface AuthUser {
  /** Cognito 사용자 ID (sub) */
  userId: string
  role: Role
  /** 점주만 있다 (custom:storeId) */
  storeId?: string
  email?: string
}

export interface SignUpInput {
  email: string
  password: string
  name: string
  role: Role
}

/**
 * 로그인 방식(Cognito, 개발용 가짜)을 바꿔 끼울 수 있게 화면은 이 인터페이스만 쓴다.
 */
export interface AuthClient {
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(input: SignUpInput): Promise<void>
  signOut(): Promise<void>
  /** 새로고침 후 저장된 세션이 있으면 사용자 정보를 돌려준다 */
  restore(): Promise<AuthUser | null>
  /** API 요청 Authorization 헤더에 넣을 토큰. 만료가 가까우면 갱신해서 준다 */
  getToken(): Promise<string | null>
}
