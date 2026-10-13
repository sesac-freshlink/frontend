/// <reference types="vite/client" />
/// <reference types="msw/vite/client" />

interface ImportMetaEnv {
  /** Cognito 사용자 풀 ID. 비어 있으면 개발용 가짜 로그인을 쓴다 */
  readonly VITE_COGNITO_USER_POOL_ID?: string
  /** Cognito 앱 클라이언트 ID (client secret 없는 public client) */
  readonly VITE_COGNITO_CLIENT_ID?: string
  /** 'false' 면 MSW 가짜 API 를 끄고 proxy 로 실제 gateway 를 부른다 */
  readonly VITE_API_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
