import dayjs from 'dayjs'

/** 금액 표시: 3400 → "3,400원" */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 서버 시각(+09:00)을 "15:42" 로 */
export function formatHHmm(iso: string): string {
  return dayjs(iso).format('HH:mm')
}

/** 서버 시각(+09:00)을 "10/20 15:42" 로 */
export function formatDateTime(iso: string): string {
  return dayjs(iso).format('MM/DD HH:mm')
}
