/**
 * U-22 결제 남은 시간. 기기 시계가 틀려도 서버 시각(OR-02 serverTime) 기준으로 센다.
 * 실제 만료는 서버 스케줄러가 정하고, 화면은 보여 주기만 한다.
 */

/** 응답을 받은 순간의 "서버 시각 − 기기 시각" (ms). 기기 시계가 느리면 양수 */
export function clockOffsetMs(serverTime: string, receivedAtMs: number): number {
  return Date.parse(serverTime) - receivedAtMs
}

/** 결제 마감까지 남은 초. 기기 지금 시각에 차이를 더해 서버 지금 시각으로 본다. 지나면 0 */
export function remainingSeconds(expiresAt: string, nowMs: number, offsetMs: number): number {
  const left = Date.parse(expiresAt) - (nowMs + offsetMs)
  return left > 0 ? Math.ceil(left / 1000) : 0
}

/** 552 → "9분 12초 남음", 45 → "45초 남음" */
export function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes}분 ${rest}초 남음` : `${rest}초 남음`
}
