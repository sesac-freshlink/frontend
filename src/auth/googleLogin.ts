/** C-02 구글 로그인 시작 경로. gateway 가 Cognito 를 거쳐 구글로 보낸다 */
export const GOOGLE_LOGIN_PATH = '/api/auth/google'

/** 가짜 모드에서 [구글로 로그인]을 누르면 이 이메일로 가짜 구글 고객(프로필 없음)으로 들어간다 */
export const MOCK_GOOGLE_EMAIL = 'google@freshlink.test'

/** 전체 페이지 이동 (axios 아님). 테스트에서 vi.mock 으로 바꿔 끼운다 */
export function goToGoogleLogin(): void {
  window.location.assign(GOOGLE_LOGIN_PATH)
}
