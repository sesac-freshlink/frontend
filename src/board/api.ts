import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

/** 게시판 공지사항·FAQ (추가 명세 A17, member-service BD-01~03·AD-04~12) */

/** 글을 볼 사람: 모두 / 고객만 / 점주만 */
export type Audience = 'ALL' | 'CUSTOMER' | 'OWNER'

export const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: '모두',
  CUSTOMER: '고객',
  OWNER: '점주',
}

/** 공지 목록 한 줄 (본문 없음). 시각은 +09:00 */
export interface NoticeSummary {
  noticeId: number
  title: string
  audience: Audience
  pinned: boolean
  createdAt: string
}

export interface NoticeDetail extends NoticeSummary {
  content: string
  updatedAt: string
}

export interface FaqItem {
  faqId: number
  question: string
  answer: string
  audience: Audience
  sortOrder: number
}

/** 페이지 응답 (member-service API 명세 0장). 공지는 서버가 20개로 고정한다 */
export interface BoardPage<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface NoticeRequest {
  title: string
  content: string
  audience: Audience
  pinned: boolean
}

export interface FaqRequest {
  question: string
  answer: string
  audience: Audience
  sortOrder: number
}

const noticesKey = ['board', 'notices'] as const
const faqsKey = ['board', 'faqs'] as const
const adminNoticesKey = ['admin', 'notices'] as const
const adminFaqsKey = ['admin', 'faqs'] as const

/** BD-01 공지 목록 (고객·점주, 내 대상만, 고정 먼저 최신순) */
export function useNotices(page: number) {
  return useQuery({
    queryKey: [...noticesKey, page],
    queryFn: async () =>
      (await api.get<BoardPage<NoticeSummary>>('/members/notices', { params: { page } })).data,
    placeholderData: keepPreviousData,
  })
}

/** BD-02 공지 상세 */
export function useNotice(noticeId: number) {
  return useQuery({
    queryKey: [...noticesKey, 'detail', noticeId],
    queryFn: async () => (await api.get<NoticeDetail>(`/members/notices/${noticeId}`)).data,
    enabled: Number.isInteger(noticeId) && noticeId > 0,
  })
}

/** BD-03 FAQ 목록 */
export function useFaqs() {
  return useQuery({
    queryKey: faqsKey,
    queryFn: async () => (await api.get<FaqItem[]>('/members/faqs')).data,
  })
}

/** 관리자 공지 목록 (모든 대상) */
export function useAdminNotices(page: number) {
  return useQuery({
    queryKey: [...adminNoticesKey, page],
    queryFn: async () =>
      (await api.get<BoardPage<NoticeSummary>>('/admin/notices', { params: { page } })).data,
    placeholderData: keepPreviousData,
  })
}

/** 관리자 공지 하나 (수정 화면에 본문까지 채운다) */
export function useAdminNotice(noticeId: number | null) {
  return useQuery({
    queryKey: [...adminNoticesKey, 'detail', noticeId],
    queryFn: async () => (await api.get<NoticeDetail>(`/admin/notices/${noticeId}`)).data,
    enabled: noticeId !== null,
  })
}

/** 관리자 공지 쓰기(noticeId 없음) 또는 수정 */
export function useSaveNotice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ noticeId, body }: { noticeId: number | null; body: NoticeRequest }) =>
      noticeId === null
        ? (await api.post<NoticeDetail>('/admin/notices', body)).data
        : (await api.put<NoticeDetail>(`/admin/notices/${noticeId}`, body)).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminNoticesKey })
      void queryClient.invalidateQueries({ queryKey: noticesKey })
    },
  })
}

export function useDeleteNotice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (noticeId: number) => {
      await api.delete(`/admin/notices/${noticeId}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminNoticesKey })
      void queryClient.invalidateQueries({ queryKey: noticesKey })
    },
  })
}

/** 관리자 FAQ 목록 (모든 대상, 순서대로) */
export function useAdminFaqs() {
  return useQuery({
    queryKey: adminFaqsKey,
    queryFn: async () => (await api.get<FaqItem[]>('/admin/faqs')).data,
  })
}

export function useSaveFaq() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ faqId, body }: { faqId: number | null; body: FaqRequest }) =>
      faqId === null
        ? (await api.post<FaqItem>('/admin/faqs', body)).data
        : (await api.put<FaqItem>(`/admin/faqs/${faqId}`, body)).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminFaqsKey })
      void queryClient.invalidateQueries({ queryKey: faqsKey })
    },
  })
}

export function useDeleteFaq() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (faqId: number) => {
      await api.delete(`/admin/faqs/${faqId}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminFaqsKey })
      void queryClient.invalidateQueries({ queryKey: faqsKey })
    },
  })
}
