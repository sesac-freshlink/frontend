import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { z } from 'zod'
import { type AdminBanner, BANNER_IMAGES, type BannerRequest } from './banners'

dayjs.extend(utc)
dayjs.extend(timezone)

const KST = 'Asia/Seoul'
const imageUrls = BANNER_IMAGES.map((i) => i.url) as [string, ...string[]]

/** 기간 입력 칸 값("2026-11-15T00:00", 한국 시간). 비면 그쪽 제한 없음 */
const localDateTime = z
  .string()
  .trim()
  .refine((v) => v === '' || dayjs.tz(v, KST).isValid(), '날짜와 시각을 확인하세요')

/** 관리자 배너 입력 규칙 (member-service BannerRequest 와 같다, 추가 명세 A18) */
export const bannerSchema = z
  .object({
    title: z.string().trim().min(1, '제목을 입력하세요').max(50, '50자까지 쓸 수 있어요'),
    imageUrl: z.enum(imageUrls, { error: '그림을 고르세요' }),
    /** 연결할 공지 ID. 빈 문자열이면 연결 없음 */
    noticeId: z.string().regex(/^(\d+)?$/, '공지를 다시 고르세요'),
    visible: z.boolean(),
    startsAt: localDateTime,
    endsAt: localDateTime,
  })
  .refine(
    (v) => !v.startsAt || !v.endsAt || dayjs.tz(v.startsAt, KST).isBefore(dayjs.tz(v.endsAt, KST)),
    { message: '노출 시작은 끝보다 빨라야 해요', path: ['endsAt'] },
  )
export type BannerForm = z.input<typeof bannerSchema>

/** +09:00 시각 → 입력 칸 값 */
function toLocal(iso: string | null): string {
  return iso ? dayjs(iso).tz(KST).format('YYYY-MM-DDTHH:mm') : ''
}

/** 입력 칸 값 → +09:00 시각, 비면 null */
export function toOffset(local: string): string | null {
  return local ? dayjs.tz(local, KST).format('YYYY-MM-DDTHH:mm:ssZ') : null
}

export function bannerDefaults(b?: AdminBanner): BannerForm {
  return b
    ? {
        title: b.title,
        imageUrl: b.imageUrl,
        noticeId: b.noticeId === null ? '' : String(b.noticeId),
        visible: b.visible,
        startsAt: toLocal(b.startsAt),
        endsAt: toLocal(b.endsAt),
      }
    : {
        title: '',
        imageUrl: BANNER_IMAGES[0].url,
        noticeId: '',
        visible: true,
        startsAt: '',
        endsAt: '',
      }
}

/** 순서는 폼에서 수정하지 않는다: 새 배너는 맨 뒤(sortOrder), 수정할 때는 지금 순서를 그대로 보낸다 */
export function toBannerRequest(
  v: z.output<typeof bannerSchema>,
  sortOrder: number,
): BannerRequest {
  return {
    title: v.title,
    imageUrl: v.imageUrl,
    noticeId: v.noticeId === '' ? null : Number(v.noticeId),
    sortOrder: Math.min(9999, Math.max(0, sortOrder)),
    visible: v.visible,
    startsAt: toOffset(v.startsAt),
    endsAt: toOffset(v.endsAt),
  }
}
