/** 픽업 QR 순수 계산 (추가 명세 A16) */

/** 만료 이만큼 전에 새 QR을 만든다 */
export const PICKUP_QR_RENEW_BEFORE_MS = 30_000

/** QR 안에 넣는 점주 화면 주소. 점주 핸드폰 기본 카메라가 이 주소를 연다 */
export function pickupScanUrl(origin: string, token: string): string {
  return `${origin}/owner/pickup-scan?t=${encodeURIComponent(token)}`
}

/** 만료까지 남은 초 (0 아래로 내려가지 않는다) */
export function secondsLeft(expiresAt: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - nowMs) / 1000))
}

/** 새 QR을 만들 때까지 기다릴 ms (만료 30초 전, 이미 지났으면 0) */
export function renewDelayMs(expiresAt: string, nowMs: number): number {
  return Math.max(0, Date.parse(expiresAt) - PICKUP_QR_RENEW_BEFORE_MS - nowMs)
}

/** 남은 시간 "4:59" */
export function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
