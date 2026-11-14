import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { notificationKeys, type AppNotification } from '@/shared/notifications/api'
import { refreshForKinds, useNotificationRefresh } from './useNotificationRefresh'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))

const note = (id: number, kind: string, read = false) =>
  ({
    id,
    kind,
    title: '알림',
    body: '',
    link: null,
    read,
    createdAt: '2026-11-14T10:00:00',
  }) as unknown as AppNotification
const page = (...content: AppNotification[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: 1,
})

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  renderHook(() => useNotificationRefresh(), { wrapper })
  const keys = () => invalidate.mock.calls.map(([f]) => f?.queryKey)
  return { queryClient, invalidate, keys }
}

describe('알림 종류별 화면 다시 읽기 (11/14 경우 결정 R1·R2)', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('픽업 신청(NEW_ORDER)은 점주 주문 목록, 준비 완료(PICKUP_READY)는 고객 주문 상세·내역, 소비기한은 임박 목록을 다시 읽는다', () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    refreshForKinds(queryClient, ['NEW_ORDER'])
    refreshForKinds(queryClient, ['PICKUP_READY'])
    refreshForKinds(queryClient, ['EXPIRY_IMMINENT', 'EXPIRED'])
    expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['owner', 'orders'],
      ['customer', 'order'],
      ['customer', 'orders'],
      ['owner', 'expiring'],
    ])
  })

  it('재입고(RESTOCKED)와 모르는 종류는 아무것도 다시 읽지 않는다', () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    refreshForKinds(queryClient, ['RESTOCKED', 'SOMETHING_ELSE'])
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('알림 목록에 처음 보는 안 읽은 알림이 들어오면 그 종류로 한 번만 다시 읽는다', () => {
    const { queryClient, keys } = setup()
    act(() => queryClient.setQueryData(notificationKeys.list(), page(note(1, 'NEW_ORDER'))))
    expect(keys()).toEqual([['owner', 'orders']])

    // 같은 알림이 다시 읽혀도 또 읽지 않는다. 이미 읽은 알림은 넘긴다
    act(() =>
      queryClient.setQueryData(
        notificationKeys.list(),
        page(note(2, 'EXPIRED', true), note(1, 'NEW_ORDER')),
      ),
    )
    expect(keys()).toEqual([['owner', 'orders']])
  })

  it('알림 창이 닫혀 있을 때 안 읽은 수가 늘면 목록을 한 번 읽어 종류를 확인한다', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: page(note(7, 'PICKUP_READY')) })
    const { queryClient, keys } = setup()
    act(() => queryClient.setQueryData(notificationKeys.unread(), 0))
    expect(api.get).not.toHaveBeenCalled()

    act(() => queryClient.setQueryData(notificationKeys.unread(), 1))
    await waitFor(() =>
      expect(keys()).toEqual([
        ['customer', 'order'],
        ['customer', 'orders'],
      ]),
    )
    expect(api.get).toHaveBeenCalledWith('/notifications', { params: { page: 0, size: 20 } })
  })

  it('안 읽은 수가 줄면(읽음 처리) 목록을 읽지 않는다', () => {
    const { queryClient, invalidate } = setup()
    act(() => queryClient.setQueryData(notificationKeys.unread(), 3))
    act(() => queryClient.setQueryData(notificationKeys.unread(), 0))
    expect(api.get).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })
})
