import axios, { type AxiosInstance } from 'axios'

/** gateway CSRF 확인용 헤더. 없으면 POST·PUT·PATCH·DELETE 가 403 CSRF_HEADER_REQUIRED */
export const CSRF_HEADER = { 'X-Requested-With': 'freshlink' } as const

/**
 * baseURL '/api' + CSRF 헤더를 붙인 axios 인스턴스. interceptor 는 없다.
 * 운영에서는 CloudFront 가 /api/* 를 gateway 로, 개발에서는 Vite proxy 나 MSW 가 받는다.
 * 로그인 토큰은 브라우저가 HttpOnly 쿠키로 보내므로 Authorization 은 넣지 않는다.
 */
export function createApiInstance(): AxiosInstance {
  return axios.create({ baseURL: '/api', headers: { ...CSRF_HEADER } })
}

/** '/auth/...' 경로인지 (api 인스턴스 기준 상대 경로). 401 갱신 대상에서 뺄 때 쓴다 */
export function isAuthPath(url: string | undefined): boolean {
  if (!url) return false
  const path = url.startsWith('/api/') ? url.slice('/api'.length) : url
  return path === '/auth' || path.startsWith('/auth/') || path.startsWith('auth/')
}
