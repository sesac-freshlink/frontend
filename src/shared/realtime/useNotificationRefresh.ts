import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '@/shared/api/client'
import {
  NOTIFICATION_PAGE_SIZE,
  notificationKeys,
  type AppNotification,
  type NotificationPage,
} from '@/shared/notifications/api'

/**
 * 알림 종류별로 다시 읽을 화면 데이터 (11/14 경우 결정 R2).
 * NEW_ORDER·PICKUP_READY 는 notification-service 에 있지만 알림 공통 타입(NotificationKind)에는 아직 없어
 * 여기서 문자열로 적는다 (R5). RESTOCKED 는 상품 화면이 이미 3초마다 읽어 따로 하지 않는다
 */
export const REFRESH_BY_KIND: Readonly<Record<string, readonly QueryKey[]>> = {
  /** 고객 픽업 신청 → 점주 결제·픽업 목록, 대시보드 픽업 준비할 주문·픽업 대기 */
  NEW_ORDER: [['owner', 'orders']],
  /** 점주 준비 완료 → 고객 주문 상세·주문 내역·픽업 QR 화면 목록 */
  PICKUP_READY: [
    ['customer', 'order'],
    ['customer', 'orders'],
  ],
  /** 소비기한 임박·경과 → 점주 임박·폐기, 대시보드 소비기한 지남 */
  EXPIRY_IMMINENT: [['owner', 'expiring']],
  EXPIRED: [['owner', 'expiring']],
}

/** 새 알림들의 종류에 맞는 화면 데이터를 다시 읽는다. 같은 키는 한 번만 */
export function refreshForKinds(queryClient: QueryClient, kinds: Iterable<string>) {
  const keys = new Map<string, QueryKey>()
  for (const kind of kinds) {
    for (const key of REFRESH_BY_KIND[kind] ?? []) keys.set(JSON.stringify(key), key)
  }
  for (const queryKey of keys.values()) void queryClient.invalidateQueries({ queryKey })
}

const isListKey = (key: QueryKey) => key[0] === notificationKeys.all[0] && key[1] === 'list'
const isUnreadKey = (key: QueryKey) => key[0] === notificationKeys.all[0] && key[1] === 'unread'

function isNotificationPage(data: unknown): data is NotificationPage {
  return (
    typeof data === 'object' && data !== null && Array.isArray((data as NotificationPage).content)
  )
}

/**
 * 실시간 알림이 오면 그 종류에 맞는 화면을 바로 다시 읽는다 (11/14 경우 결정 R1·R6, 점주·고객 틀에서 한 번 부른다).
 * 알림 공통 파일(useNotificationStream·notifications/api)은 고치지 않고, 그 파일이 알림마다 다시 읽는
 * 알림 목록·안 읽은 수 데이터를 지켜본다.
 * - 알림 목록에 처음 보는 안 읽은 알림이 있으면 그 종류로 다시 읽는다.
 * - 알림 창이 닫혀 있어 목록을 읽지 않을 때는, 안 읽은 수가 늘면 목록을 한 번 읽어 종류를 확인한다.
 * - 처음 읽은 목록의 안 읽은 알림도 한 번 다시 읽기 대상이 된다(화면 데이터를 한 번 더 읽을 뿐이라 괜찮다)
 */
export function useNotificationRefresh() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const seen = new Set<number>()
    let unread: number | undefined

    const onList = (page: NotificationPage) => {
      const kinds: AppNotification['kind'][] = []
      for (const n of page.content) {
        if (seen.has(n.id)) continue
        seen.add(n.id)
        if (!n.read) kinds.push(n.kind)
      }
      refreshForKinds(queryClient, kinds)
    }

    const readList = () =>
      queryClient.fetchQuery({
        queryKey: notificationKeys.list(),
        queryFn: async () =>
          (
            await api.get<NotificationPage>('/notifications', {
              params: { page: 0, size: NOTIFICATION_PAGE_SIZE },
            })
          ).data,
      })

    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return
      const { queryKey, state } = event.query
      if (isListKey(queryKey)) {
        if (isNotificationPage(state.data)) onList(state.data)
        return
      }
      if (!isUnreadKey(queryKey) || typeof state.data !== 'number') return
      const before = unread
      unread = state.data
      // 알림 창이 열려 있으면 목록도 같이 다시 읽히므로(onList) 따로 읽지 않는다
      const listOpen =
        (queryClient
          .getQueryCache()
          .find({ queryKey: notificationKeys.list() })
          ?.getObserversCount() ?? 0) > 0
      if (before !== undefined && state.data > before && !listOpen)
        void readList().catch(() => undefined)
    })
  }, [queryClient])
}
