import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 화면 시각은 브라우저 시간대와 상관없이 서버와 같은 한국 시간으로 보여 준다 */
const KST = 'Asia/Seoul'

/** 금액 표시: 1700 → "1,700원" */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 소비기한(+09:00, 그날 23:59:59)을 "10/24" 로. 없으면 "-" */
export function formatExpiry(iso: string | null): string {
  if (iso === null) return '-'
  return dayjs(iso).tz(KST).format('MM/DD')
}

/** 시각을 한국 시간 "10/20 05:00" 으로 */
export function formatDateTime(iso: string): string {
  return dayjs(iso).tz(KST).format('MM/DD HH:mm')
}

/** 비율(0~1)을 백분율로: 0.4 → "40%", 0.3333 → "33.3%". 없으면 "-" */
export function formatRate(rate: number | null): string {
  if (rate === null) return '-'
  return `${Number((rate * 100).toFixed(1))}%`
}

/** 오늘(한국 날짜)까지 days 일. S-42 통계 조회 기간 { from, to } "YYYY-MM-DD" */
export function statsPeriod(days: number, now: Date = new Date()): { from: string; to: string } {
  const today = dayjs(now).tz(KST)
  return {
    from: today.subtract(days - 1, 'day').format('YYYY-MM-DD'),
    to: today.format('YYYY-MM-DD'),
  }
}

/** 재고 소진 예상이 이 일수 이하면 화면이 강조한다(곧 떨어진다) */
export const SOON_OUT_DAYS = 2

/**
 * 재고 소진 예상(최근 7일 하루 평균 순판매 기준) 표시: 품절이면 "-", 최근 판매가 없으면 "판매 없음",
 * 하루도 못 버티면 "오늘 소진", 그 밖에는 "약 N일"
 */
export function formatDaysOfStock(daysOfStock: number | null, availableQuantity: number): string {
  if (availableQuantity === 0) return '-'
  // 서버가 아직 이 값을 주지 않는 버전이면(필드 없음) 판매 없음과 같게 본다
  if (typeof daysOfStock !== 'number') return '판매 없음'
  if (daysOfStock === 0) return '오늘 소진'
  return `약 ${daysOfStock}일`
}

/** 변동 수량은 부호를 항상 붙인다: 10 → "+10", -3 → "−3" */
export function formatSignedQuantity(quantity: number): string {
  if (quantity > 0) return `+${quantity}`
  if (quantity < 0) return `−${Math.abs(quantity)}`
  return '0'
}
