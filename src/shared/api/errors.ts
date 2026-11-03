import axios from 'axios'

/** 서비스·gateway 공통 오류 본문 {code, message, traceId} 에서 code 를 꺼낸다 */
export function apiErrorCode(e: unknown): string | undefined {
  if (!axios.isAxiosError(e)) return undefined
  const data: unknown = e.response?.data
  if (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    typeof data.code === 'string'
  ) {
    return data.code
  }
  return undefined
}
