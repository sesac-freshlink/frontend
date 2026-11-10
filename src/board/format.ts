import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 게시글 날짜 "2026.11.06" (한국 시간) */
export function formatDate(iso: string): string {
  return dayjs(iso).tz('Asia/Seoul').format('YYYY.MM.DD')
}
