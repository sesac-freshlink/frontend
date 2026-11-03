import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/shared/auth'
import { createApiInstance, isAuthPath } from './http'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 401 갱신 뒤 다시 보낸 요청이면 true */
    authRetried?: boolean
  }
}

export const SESSION_EXPIRED_MESSAGE = '다시 로그인해 주세요'

/**
 * 화면이 쓰는 API 인스턴스. 모든 요청에 CSRF 헤더(X-Requested-With)를 붙인다.
 * 401 이면 refresh 를 한 번 하고(동시 401 은 갱신 하나를 같이 기다린다) 원래 요청을 한 번 다시 보낸다.
 */
export const api = createApiInstance()

/** 세션 만료: 사용자를 비우면 역할 가드(RequireRole)가 로그인 화면으로 보낸다. 토스트는 한 번만 */
function expire() {
  if (useAuthStore.getState().expireSession()) {
    toast.error(SESSION_EXPIRED_MESSAGE, { id: 'session-expired' })
  }
}

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) {
    return Promise.reject(error)
  }
  const config = error.config
  // 로그인·갱신 같은 /auth/* 는 갱신하지 않는다
  if (isAuthPath(config.url)) return Promise.reject(error)
  // 이미 로그아웃(만료 처리)됐으면 남은 요청·재시도·폴링이 갱신·토스트를 되풀이하지 않는다
  if (useAuthStore.getState().user === null) return Promise.reject(error)
  // 갱신 뒤 다시 보낸 요청도 401 이면 더 갱신하지 않는다
  if (config.authRetried) {
    expire()
    return Promise.reject(error)
  }
  let refreshed: boolean
  try {
    refreshed = await useAuthStore.getState().refreshSession()
  } catch {
    // 갱신이 401 이 아닌 이유(429·502·네트워크 오류)로 실패: 세션이 살아 있을 수 있어 로그아웃하지 않고 원래 오류로 실패한다
    return Promise.reject(error)
  }
  if (!refreshed) {
    expire()
    return Promise.reject(error)
  }
  return api.request({ ...config, authRetried: true })
})
