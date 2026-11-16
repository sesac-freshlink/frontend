import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { StoreImageUploadUrl } from '@/admin/stores/api'
import { api } from '@/shared/api/client'
import type { StoreImageType } from '@/shared/storeImage'

dayjs.extend(utc)
dayjs.extend(timezone)

/** 홈 메인 배너 관리 (추가 명세 A18, member-service AD-13~AD-17) */

/** 관리자 목록 한 줄. 시각은 +09:00, 기간은 비어 있으면 null(그쪽 제한 없음) */
export interface AdminBanner {
  bannerId: number
  title: string
  imageUrl: string
  noticeId: number | null
  /** 연결한 공지 제목 (화면 표시용, 공지가 없으면 null) */
  noticeTitle: string | null
  sortOrder: number
  visible: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BannerRequest {
  title: string
  imageUrl: string
  noticeId: number | null
  sortOrder: number
  visible: boolean
  startsAt: string | null
  endsAt: string | null
}

/**
 * AD-18 배너 그림 올리기 (11/16, 점포 이미지 올리기와 같은 방식): 형식(JPG·PNG)을 보내 업로드 주소를 받고(member)
 * 그 주소로 파일을 바로 PUT 한다(S3). 돌려받은 imageUrl(/images/banners/…)을 배너 imageUrl 로 저장한다.
 * S3 주소는 우리 API 가 아니라 api 인스턴스(baseURL·쿠키·CSRF 헤더)를 쓰지 않고 fetch 로 보낸다
 */
export function useUploadBannerImage() {
  return useMutation({
    mutationFn: async ({ file, contentType }: { file: File; contentType: StoreImageType }) => {
      const issued = (
        await api.post<StoreImageUploadUrl>('/admin/banners/image-upload-url', { contentType })
      ).data
      const res = await fetch(issued.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': issued.contentType },
        body: file,
      })
      if (!res.ok) throw new Error(`배너 그림 업로드 실패 ${res.status}`)
      return issued
    },
  })
}

/** 홈에 한 번에 보이는 최대 장수 (member BannerService.HOME_LIMIT, 11/11 결정 3) */
export const HOME_BANNER_LIMIT = 5

const adminBannersKey = ['admin', 'banners'] as const
/** 고객 홈 배너 (customer/banners/api.ts 와 같은 키). 관리자가 바꾸면 같이 새로 읽게 한다 */
const homeBannersKey = ['customer', 'banners'] as const

/** AD-13 모든 배너, 순서대로 */
export function useAdminBanners() {
  return useQuery({
    queryKey: adminBannersKey,
    queryFn: async () => (await api.get<AdminBanner[]>('/admin/banners')).data,
  })
}

function useInvalidateBanners() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminBannersKey })
    void queryClient.invalidateQueries({ queryKey: homeBannersKey })
  }
}

/** AD-14 등록(bannerId 없음) · AD-15 수정 */
export function useSaveBanner() {
  const invalidate = useInvalidateBanners()
  return useMutation({
    mutationFn: async ({ bannerId, body }: { bannerId: number | null; body: BannerRequest }) =>
      bannerId === null
        ? (await api.post<AdminBanner>('/admin/banners', body)).data
        : (await api.put<AdminBanner>(`/admin/banners/${bannerId}`, body)).data,
    onSettled: invalidate,
  })
}

/** AD-16 바로 지운다 */
export function useDeleteBanner() {
  const invalidate = useInvalidateBanners()
  return useMutation({
    mutationFn: async (bannerId: number) => {
      await api.delete(`/admin/banners/${bannerId}`)
    },
    onSettled: invalidate,
  })
}

/** AD-17 지금 있는 배너 전부를 원하는 순서로 보낸다 */
export function useReorderBanners() {
  const invalidate = useInvalidateBanners()
  return useMutation({
    mutationFn: async (bannerIds: number[]) =>
      (await api.put<AdminBanner[]>('/admin/banners/order', { bannerIds })).data,
    onSettled: invalidate,
  })
}

/** 관리자 목록의 홈 노출 상태 */
export type BannerHomeStatus = 'SHOWING' | 'OVER_LIMIT' | 'HIDDEN' | 'BEFORE' | 'ENDED'

export const BANNER_STATUS_LABEL: Record<BannerHomeStatus, string> = {
  SHOWING: '홈에 보여요',
  OVER_LIMIT: '6번째부터 홈에 안 보여요',
  HIDDEN: '꺼 둠',
  BEFORE: '노출 전',
  ENDED: '노출 끝',
}

/**
 * 배너마다 지금 홈에 보이는지 (서버 BN-01과 같은 규칙: 보이기 켜짐 + 기간 안, 목록 순서대로 앞의 5장).
 * 화면 안내용이고 실제로 보내는 것은 서버가 정한다
 */
export function bannerHomeStatus(banners: AdminBanner[], now: Date): Map<number, BannerHomeStatus> {
  const result = new Map<number, BannerHomeStatus>()
  let showing = 0
  for (const b of banners) {
    if (!b.visible) result.set(b.bannerId, 'HIDDEN')
    else if (b.startsAt && Date.parse(b.startsAt) > now.getTime()) result.set(b.bannerId, 'BEFORE')
    else if (b.endsAt && Date.parse(b.endsAt) <= now.getTime()) result.set(b.bannerId, 'ENDED')
    else {
      showing += 1
      result.set(b.bannerId, showing <= HOME_BANNER_LIMIT ? 'SHOWING' : 'OVER_LIMIT')
    }
  }
  return result
}

/** 기간 한 줄: "11.15 00:00 ~ 11.21 23:59", 비면 "바로"·"계속". 둘 다 비면 11/11 결정 말 그대로 "제한 없음" */
export function formatPeriod(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return '제한 없음'
  const f = (iso: string) => dayjs(iso).tz('Asia/Seoul').format('MM.DD HH:mm')
  return `${startsAt ? f(startsAt) : '바로'} ~ ${endsAt ? f(endsAt) : '계속'}`
}

/** 한 칸 위·아래로 옮긴 ID 순서. 끝이면 그대로 */
export function moveBanner(ids: number[], index: number, delta: -1 | 1): number[] {
  const to = index + delta
  if (to < 0 || to >= ids.length) return ids
  const next = [...ids]
  ;[next[index], next[to]] = [next[to] as number, next[index] as number]
  return next
}
