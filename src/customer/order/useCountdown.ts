import { useEffect, useState } from 'react'
import { clockOffsetMs, remainingSeconds } from './countdown'

/** 남은 시간 표시를 다시 그리는 주기. 서버를 다시 읽는 주기(POLL_MS)와는 따로다 */
export const COUNTDOWN_TICK_MS = 1_000

/**
 * U-22 결제 마감까지 남은 초. expiresAt 이 없으면 null.
 * receivedAtMs 는 그 응답을 받은 기기 시각(TanStack Query dataUpdatedAt)이라,
 * 폴링으로 새 serverTime 이 올 때마다 기기 시계와의 차이가 다시 계산된다
 */
export function useCountdown(
  expiresAt: string | null,
  serverTime: string,
  receivedAtMs: number,
): number | null {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), COUNTDOWN_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  if (expiresAt === null) return null
  const offsetMs = clockOffsetMs(serverTime, receivedAtMs)
  // 새 응답 직후 아직 타이머가 돌기 전이면 받은 시각을 지금으로 본다
  return remainingSeconds(expiresAt, Math.max(nowMs, receivedAtMs), offsetMs)
}
