import { http, HttpResponse, sse } from 'msw'
import type { AppNotification } from '@/shared/notifications/api'
import { mockSessionUser } from './authHandlers'

/**
 * notification-service 가짜 API (김진아): 화면 알림 목록·안 읽은 수·읽음, 재입고 알림 신청, 알림 SSE.
 * 점주는 유통기한 임박·경과, 고객은 재입고 알림을 받는다. SSE 는 연결하고 5초 뒤 가짜 알림을 하나 보낸다
 */
let nextId = 100
const notifications: (AppNotification & { role: 'OWNER' | 'CUSTOMER' })[] = [
  {
    id: 3,
    role: 'OWNER',
    kind: 'EXPIRY_IMMINENT',
    title: '유통기한 임박',
    body: '삼각김밥 참치마요 4개의 유통기한이 10월 31일 23:59에 끝나요',
    link: '/owner/expiring',
    read: false,
    createdAt: '2026-10-31T00:00:00+09:00',
  },
  {
    id: 2,
    role: 'OWNER',
    kind: 'EXPIRED',
    title: '유통기한 경과',
    body: '흰 우유 500ml 2개의 유통기한이 지났어요. 폐기해 주세요',
    link: '/owner/expiring',
    read: true,
    createdAt: '2026-10-30T00:00:00+09:00',
  },
  {
    id: 1,
    role: 'CUSTOMER',
    kind: 'RESTOCKED',
    title: '재입고 알림',
    body: '바나나우유 상품이 다시 들어왔어요',
    link: '/customer/stores/1/products/3',
    read: false,
    createdAt: '2026-10-30T15:00:00+09:00',
  },
]
/** "점포-상품" 묶음 */
const restock = new Set<string>()

function mine() {
  const role = mockSessionUser()?.role
  return notifications.filter((n) => n.role === role)
}

function strip({ role: _role, ...n }: AppNotification & { role: string }): AppNotification {
  return n
}

/** SSE 는 EventSource 가 없는 곳(테스트의 jsdom)에서 만들면 바로 오류라 브라우저에서만 넣는다 */
const streamHandlers =
  typeof EventSource === 'undefined'
    ? []
    : [
        sse<{ notification: string }>('/api/notifications/stream', ({ client }) => {
          const role = mockSessionUser()?.role
          if (role !== 'OWNER' && role !== 'CUSTOMER') return
          setTimeout(() => {
            const n: AppNotification & { role: 'OWNER' | 'CUSTOMER' } =
              role === 'OWNER'
                ? {
                    id: nextId++,
                    role,
                    kind: 'EXPIRY_IMMINENT',
                    title: '유통기한 임박',
                    body: '샌드위치 햄치즈 2개의 유통기한이 곧 끝나요',
                    link: '/owner/expiring',
                    read: false,
                    createdAt: new Date().toISOString(),
                  }
                : {
                    id: nextId++,
                    role,
                    kind: 'RESTOCKED',
                    title: '재입고 알림',
                    body: '바나나우유 상품이 다시 들어왔어요',
                    link: '/customer/stores/1/products/3',
                    read: false,
                    createdAt: new Date().toISOString(),
                  }
            notifications.unshift(n)
            client.send({ id: String(n.id), event: 'notification', data: JSON.stringify(strip(n)) })
          }, 5000)
        }),
      ]

export const notificationHandlers = [
  ...streamHandlers,
  http.get('/api/notifications', () => {
    const list = mine().map(strip)
    return HttpResponse.json({
      content: list,
      page: 0,
      size: 20,
      totalElements: list.length,
      totalPages: list.length === 0 ? 0 : 1,
    })
  }),
  http.get('/api/notifications/unread-count', () =>
    HttpResponse.json({ count: mine().filter((n) => !n.read).length }),
  ),
  http.patch('/api/notifications/read-all', () => {
    mine().forEach((n) => (n.read = true))
    return new HttpResponse(null, { status: 204 })
  }),
  http.patch('/api/notifications/:id/read', ({ params }) => {
    const n = mine().find((x) => x.id === Number(params.id))
    if (!n) {
      return HttpResponse.json(
        { code: 'NOTIFICATION_NOT_FOUND', message: '알림이 없습니다', traceId: '' },
        { status: 404 },
      )
    }
    n.read = true
    return new HttpResponse(null, { status: 204 })
  }),
  http.get('/api/notifications/restock/:productId', ({ params, request }) => {
    const storeId = Number(new URL(request.url).searchParams.get('storeId'))
    const productId = Number(params.productId)
    return HttpResponse.json({
      storeId,
      productId,
      subscribed: restock.has(`${storeId}-${productId}`),
    })
  }),
  http.post('/api/notifications/restock/:productId', ({ params, request }) => {
    const storeId = Number(new URL(request.url).searchParams.get('storeId'))
    const productId = Number(params.productId)
    restock.add(`${storeId}-${productId}`)
    return HttpResponse.json({ storeId, productId, subscribed: true })
  }),
  http.delete('/api/notifications/restock/:productId', ({ params, request }) => {
    const storeId = new URL(request.url).searchParams.get('storeId')
    restock.delete(`${storeId}-${params.productId}`)
    return new HttpResponse(null, { status: 204 })
  }),
]
