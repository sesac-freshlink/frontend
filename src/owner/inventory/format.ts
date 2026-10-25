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

/** 유통기한(+09:00, 그날 23:59:59)을 "10/24" 로. 없으면 "-" */
export function formatExpiry(iso: string | null): string {
  if (iso === null) return '-'
  return dayjs(iso).tz(KST).format('MM/DD')
}

/** 시각을 한국 시간 "10/20 05:00" 으로 */
export function formatDateTime(iso: string): string {
  return dayjs(iso).tz(KST).format('MM/DD HH:mm')
}

/** 변동 수량은 부호를 항상 붙인다: 10 → "+10", -3 → "−3" */
export function formatSignedQuantity(quantity: number): string {
  if (quantity > 0) return `+${quantity}`
  if (quantity < 0) return `−${Math.abs(quantity)}`
  return '0'
}
