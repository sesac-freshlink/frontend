import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 날짜는 브라우저 시간대와 상관없이 서버와 같은 한국 날짜로 센다 */
const KST = 'Asia/Seoul'

/** 유통기한이 이 일수 안에 끝날 때만 배지를 보여 준다(그보다 멀면 굳이 알리지 않는다) */
export const EXPIRY_BADGE_DAYS = 3

export interface ExpiryBadgeInfo {
  /** "오늘까지", "D-1" … */
  label: string
  /** 오늘 끝나면 urgent(빨강), 그 밖에는 soon(주황) */
  tone: 'urgent' | 'soon'
}

/**
 * U-10 유통기한 D-day 배지. 먼저 받게 될 상품의 유통기한(+09:00)이 한국 날짜로 오늘이면 "오늘까지",
 * 1~EXPIRY_BADGE_DAYS일 뒤면 "D-n". 품절(null)이거나 더 멀면 null. 이미 지난 기한은 서버가 팔지 않으므로 오지 않는다
 */
export function expiryBadge(
  nearestExpiry: string | null,
  now: Date = new Date(),
): ExpiryBadgeInfo | null {
  // 품절(null)이거나, 서버가 아직 이 값을 주지 않는 버전이면(필드 없음) 배지를 그리지 않는다
  if (!nearestExpiry) return null
  const days = dayjs(nearestExpiry)
    .tz(KST)
    .startOf('day')
    .diff(dayjs(now).tz(KST).startOf('day'), 'day')
  if (days < 0 || days > EXPIRY_BADGE_DAYS) return null
  if (days === 0) return { label: '오늘까지', tone: 'urgent' }
  return { label: `D-${days}`, tone: 'soon' }
}
