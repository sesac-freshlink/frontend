import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { shouldRetry } from './queryClient'

function axiosError(status: number) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
  return new AxiosError('fail', 'ERR_BAD_RESPONSE', config, null, {
    data: {},
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config,
  })
}

describe('shouldRetry', () => {
  it('401 은 다시 시도하지 않는다 (interceptor 가 이미 갱신·만료 처리)', () => {
    expect(shouldRetry(0, axiosError(401))).toBe(false)
  })

  it('그 외 오류는 한 번만 다시 시도한다', () => {
    expect(shouldRetry(0, axiosError(500))).toBe(true)
    expect(shouldRetry(1, axiosError(500))).toBe(false)
    expect(shouldRetry(0, new Error('x'))).toBe(true)
    expect(shouldRetry(1, new Error('x'))).toBe(false)
  })
})
