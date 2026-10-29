/// <reference types="vite/client" />
/// <reference types="msw/vite/client" />

interface ImportMetaEnv {
  /** 'false' 면 MSW 가짜 API·가짜 로그인을 끄고 proxy 로 실제 gateway 를 부른다 */
  readonly VITE_API_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
