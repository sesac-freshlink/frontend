import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'
import type { AppNotification } from './api'
import { NotificationBell } from './NotificationBell'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), patch: vi.fn() } }))
vi.mock('sonner', () => ({ toast: vi.fn() }))
const get = vi.mocked(api.get)
const patch = vi.mocked(api.patch)

/** 테스트용 EventSource. 만든 연결을 모아 두고 서버 이벤트·오류를 흉내 낸다 */
class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static all: FakeEventSource[] = []
  readyState = FakeEventSource.CONNECTING
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners = new Map<string, ((e: MessageEvent<string>) => void)[]>()
  readonly url: string
  readonly init?: EventSourceInit
  constructor(url: string, init?: EventSourceInit) {
    this.url = url
    this.init = init
    FakeEventSource.all.push(this)
  }
  addEventListener(type: string, fn: (e: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn])
  }
  close() {
    this.readyState = FakeEventSource.CLOSED
  }
  emit(type: string, data: unknown) {
    const e = new MessageEvent(type, { data: JSON.stringify(data) })
    this.listeners.get(type)?.forEach((fn) => fn(e))
  }
  /** 서버가 401 같은 오류 응답으로 닫았다 */
  failClosed() {
    this.readyState = FakeEventSource.CLOSED
    this.onerror?.()
  }
}

const expiry: AppNotification = {
  id: 7,
  kind: 'EXPIRY_IMMINENT',
  title: '유통기한 임박',
  body: '우유 2개의 유통기한이 10월 31일 23:59에 끝나요',
  link: '/owner/expiring',
  read: false,
  createdAt: '2026-10-31T00:00:00+09:00',
}

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/owner/inventory', element: <NotificationBell align="start" /> },
      { path: '/owner/expiring', element: <p>임박·폐기 화면</p> },
    ],
    { initialEntries: ['/owner/inventory'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

function serve(unread: number, list: AppNotification[] = [expiry]) {
  get.mockImplementation((url: string) =>
    Promise.resolve(
      url === '/notifications/unread-count'
        ? { data: { count: unread } }
        : { data: { content: list, page: 0, size: 20, totalElements: list.length, totalPages: 1 } },
    ),
  )
}

describe('알림 종', () => {
  beforeEach(() => {
    get.mockReset()
    patch.mockReset()
    vi.mocked(toast).mockReset()
    FakeEventSource.all = []
    vi.stubGlobal('EventSource', FakeEventSource)
    useAuthStore.setState({
      user: { userId: 'owner-1', role: 'OWNER', storeId: '1' },
      restoring: false,
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('안 읽은 개수를 보이고, 누르면 목록을 열고, 알림을 누르면 읽음으로 바꾸고 그 화면으로 간다', async () => {
    serve(3)
    patch.mockResolvedValue({ data: null })
    const router = renderBell()

    const bell = await screen.findByRole('button', { name: '알림 3개 안 읽음' })
    expect(bell).toHaveTextContent('3')
    await userEvent.click(bell)

    const item = await screen.findByRole('button', { name: /우유 2개의 유통기한/ })
    expect(get).toHaveBeenCalledWith('/notifications', { params: { page: 0, size: 20 } })
    await userEvent.click(item)

    expect(patch).toHaveBeenCalledWith('/notifications/7/read')
    expect(await screen.findByText('임박·폐기 화면')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/owner/expiring')
  })

  it('알림이 없으면 빈 안내를 보이고 모두 읽음을 막는다', async () => {
    serve(0, [])
    renderBell()

    await userEvent.click(await screen.findByRole('button', { name: '알림' }))
    expect(await screen.findByText('새 알림이 없어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '모두 읽음' })).toBeDisabled()
  })

  it('로그인하면 SSE 를 하나 열고, 새 알림이 오면 토스트를 한 번만 띄우고 개수를 다시 읽는다', async () => {
    serve(0)
    renderBell()
    await screen.findByRole('button', { name: '알림' })

    expect(FakeEventSource.all).toHaveLength(1)
    const source = FakeEventSource.all[0]
    expect(source.url).toBe('/api/notifications/stream')
    expect(source.init).toEqual({ withCredentials: true })

    serve(1)
    act(() => source.emit('notification', expiry))
    act(() => source.emit('notification', expiry))

    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(
      '유통기한 임박',
      expect.objectContaining({
        description: expiry.body,
        action: expect.objectContaining({ label: '보기' }),
      }),
    )
    expect(await screen.findByRole('button', { name: '알림 1개 안 읽음' })).toBeInTheDocument()
  })

  it('서버가 닫으면(401) 로그인을 갱신하고 마지막 알림 번호를 붙여 다시 연다', async () => {
    serve(0)
    const refresh = vi.fn().mockResolvedValue(true)
    useAuthStore.setState({ refreshSession: refresh })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderBell()
    await screen.findByRole('button', { name: '알림' })

    const first = FakeEventSource.all[0]
    act(() => first.emit('notification', expiry))
    act(() => first.failClosed())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(refresh).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(FakeEventSource.all).toHaveLength(2))
    expect(FakeEventSource.all[1].url).toBe('/api/notifications/stream?lastEventId=7')
  })

  it('로그인하지 않았으면 SSE 를 열지 않는다', async () => {
    useAuthStore.setState({ user: null })
    serve(0)
    renderBell()
    await screen.findByRole('button', { name: '알림' })
    expect(FakeEventSource.all).toHaveLength(0)
  })
})
