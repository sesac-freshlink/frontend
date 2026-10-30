import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

/** 알림 종류 (10/30 확정). 점주: 유통기한 임박·경과, 고객: 재입고 */
export type NotificationKind = 'EXPIRY_IMMINENT' | 'EXPIRED' | 'RESTOCKED'

/** notification-service 알림 한 건. 목록 API 와 SSE 이벤트 data 가 같은 모양 */
export interface AppNotification {
  id: number
  kind: NotificationKind
  title: string
  body: string
  /** 누르면 갈 화면 경로 (예: /owner/expiring) */
  link: string | null
  read: boolean
  createdAt: string
}

export interface NotificationPage {
  content: AppNotification[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** 실시간 알림 SSE 주소. EventSource 는 axios 를 쓰지 않아 /api 를 직접 붙인다 (같은 주소라 쿠키가 따라간다) */
export const NOTIFICATION_STREAM_PATH = '/api/notifications/stream'

/** 알림 목록에 한 번에 보여 줄 개수 */
export const NOTIFICATION_PAGE_SIZE = 20

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
}

/** 내 알림 목록 (최신순). 패널을 열었을 때만 읽는다 */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () =>
      (
        await api.get<NotificationPage>('/notifications', {
          params: { page: 0, size: NOTIFICATION_PAGE_SIZE },
        })
      ).data,
    enabled,
  })
}

/** 안 읽은 알림 수 (종 아이콘 숫자). 폴링하지 않는다. 새 알림은 SSE 가 알려 주면 다시 읽는다 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async () =>
      (await api.get<{ count: number }>('/notifications/unread-count')).data.count,
  })
}

export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/notifications/${id}/read`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
