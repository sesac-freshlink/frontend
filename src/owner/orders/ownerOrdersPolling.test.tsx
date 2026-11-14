import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { POLL_MS } from '@/shared/api/queryClient'
import { EMPTY_PERIOD } from '@/shared/api/period'
import { useOwnerOrders } from './api'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))

describe('점주 주문 목록 안전 주기 (11/14 경우 결정 R3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(api.get)
      .mockReset()
      .mockResolvedValue({ data: { content: [], totalElements: 0 } })
  })
  afterEach(() => vi.useRealTimers())

  it('화면이 보이는 동안 10초마다 다시 읽는다', async () => {
    expect(POLL_MS.ownerOrders).toBe(10_000)
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(
      () => useOwnerOrders({ tab: 'PICKUP_WAITING', page: 0, size: 20, period: EMPTY_PERIOD }),
      { wrapper },
    )
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(api.get).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(9_999))
    expect(api.get).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('창으로 돌아오면 다시 읽는다(창 포커스 다시 읽기를 끄지 않는다)', () => {
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(
      () => useOwnerOrders({ tab: 'PICKUP_WAITING', page: 0, size: 20, period: EMPTY_PERIOD }),
      { wrapper },
    )
    const query = queryClient.getQueryCache().find({ queryKey: ['owner', 'orders'] })
    expect(query?.observers[0]?.options.refetchOnWindowFocus).not.toBe(false)
  })
})
