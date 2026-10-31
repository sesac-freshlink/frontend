/// <reference types="vite/client" />
/// <reference types="msw/vite/client" />

interface ImportMetaEnv {
  /** 'false' 면 MSW 가짜 API·가짜 로그인을 끄고 proxy 로 실제 gateway 를 부른다 */
  readonly VITE_API_MOCK?: string
  /** 카카오맵 JavaScript 키 (레포 변수 DEV_/PROD_KAKAO_MAP_KEY). 없으면 점포 상세의 지도 자리를 비운다 */
  readonly VITE_KAKAO_MAP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
