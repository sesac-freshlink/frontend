import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 화면 시각은 브라우저 시간대와 상관없이 서버와 같은 한국 시간으로 보여 준다 */
const KST = 'Asia/Seoul'

/** 금액 표시: 3400 → "3,400원" */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 서버 시각(+09:00)을 "15:42" 로 */
export function formatHHmm(iso: string): string {
  return dayjs(iso).tz(KST).format('HH:mm')
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 픽업 기한(그날 23:59:59 +09:00)을 날짜만 "10월 22일(목)" 로. 시각은 늘 그날 끝이라 뺀다 */
export function formatPickupDate(iso: string): string {
  const d = dayjs(iso).tz(KST)
  return `${d.month() + 1}월 ${d.date()}일(${WEEKDAYS[d.day()]})`
}

/** 점주 표용 짧은 픽업 기한 "10/22(목)" */
export function formatShortPickupDate(iso: string): string {
  const d = dayjs(iso).tz(KST)
  return `${d.format('MM/DD')}(${WEEKDAYS[d.day()]})`
}

/** 서버 시각(+09:00)을 "10/20 15:42" 로 */
export function formatDateTime(iso: string): string {
  return dayjs(iso).tz(KST).format('MM/DD HH:mm')
}
