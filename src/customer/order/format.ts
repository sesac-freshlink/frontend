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

/** 서버 시각(+09:00)을 "10/20 15:42" 로 */
export function formatDateTime(iso: string): string {
  return dayjs(iso).tz(KST).format('MM/DD HH:mm')
}
