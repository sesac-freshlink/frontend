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
