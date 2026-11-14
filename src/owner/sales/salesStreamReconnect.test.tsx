import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/shared/auth'
import { SALES_STREAM_PATH, useSalesStream } from './api'

/** 테스트용 EventSource: 열기·오류·이벤트를 손으로 일으킨다 */
class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static all: FakeEventSource[] = []
  readyState = FakeEventSource.CONNECTING
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners = new Map<string, (() => void)[]>()
  readonly url: string
  constructor(url: string) {
    this.url = url
    FakeEventSource.all.push(this)
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn])
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((f) => f !== fn),
    )
  }
  close() {
    this.readyState = FakeEventSource.CLOSED
  }
  open() {
    this.readyState = FakeEventSource.OPEN
    this.onopen?.()
  }
  /** 서버가 오류 응답(401 등)으로 닫음 → 브라우저는 다시 붙지 않는다 */
  failClosed() {
    this.readyState = FakeEventSource.CLOSED
    this.onerror?.()
  }
  /** 네트워크로 잠깐 끊김 → 브라우저가 스스로 다시 붙는 중 */
  failConnecting() {
    this.readyState = FakeEventSource.CONNECTING
    this.onerror?.()
  }
  emit(type: string) {
    for (const fn of this.listeners.get(type) ?? []) fn()
  }
}

const latest = () => FakeEventSource.all[FakeEventSource.all.length - 1]

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('매출 통로 다시 붙기 (11/14 경우 결정 R4, 픽업 QR 통로와 같은 방식)', () => {
  const refreshSession = vi.fn<() => Promise<boolean>>()

  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.all = []
    vi.stubGlobal('EventSource', FakeEventSource)
    refreshSession.mockReset().mockResolvedValue(true)
    useAuthStore.setState({ refreshSession })
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function mount() {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const hook = renderHook(() => useSalesStream(), { wrapper })
    return { invalidate, hook }
  }

  it('브라우저가 스스로 다시 붙는 중(CONNECTING)이면 새로 열지 않는다', async () => {
    mount()
    act(() => latest().failConnecting())
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(FakeEventSource.all).toHaveLength(1)
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('서버 응답으로 닫히면 3초 → 10초 → 30초 기다렸다 로그인을 갱신하고 새로 연다', async () => {
    mount()
    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(2_999))
    expect(FakeEventSource.all).toHaveLength(1)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.all).toHaveLength(2)
    expect(latest().url).toBe(SALES_STREAM_PATH)

    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(9_999))
    expect(FakeEventSource.all).toHaveLength(2)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(FakeEventSource.all).toHaveLength(3)

    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(FakeEventSource.all).toHaveLength(4)
  })

  it('열리면 기다리는 시간을 처음(3초)으로 되돌린다', async () => {
    mount()
    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    act(() => latest().open())
    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(FakeEventSource.all).toHaveLength(3)
  })

  it('새로 연 뒤 첫 이벤트는 끊긴 동안 놓친 결제가 있을 수 있어 넘기지 않고 다시 읽는다', async () => {
    const { invalidate } = mount()
    act(() => latest().emit('sales'))
    expect(invalidate).not.toHaveBeenCalled()
    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    act(() => latest().emit('sales'))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['owner', 'sales'] })
  })

  it('로그인 갱신이 안 되면(로그인이 끝남) 다시 열지 않는다', async () => {
    refreshSession.mockResolvedValue(false)
    mount()
    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(120_000))
    expect(FakeEventSource.all).toHaveLength(1)
  })

  it('화면이 다시 보이면 닫혀 있을 때만 기다리지 않고 바로 연다', async () => {
    mount()
    act(() => setVisibility('visible'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(FakeEventSource.all).toHaveLength(1)

    act(() => latest().failClosed())
    act(() => setVisibility('visible'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(FakeEventSource.all).toHaveLength(2)
    // 기다리던 타이머는 지워져 또 열지 않는다
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(FakeEventSource.all).toHaveLength(2)
  })

  it('화면을 떠나면 기다리던 다시 열기도 하지 않는다', async () => {
    const { hook } = mount()
    act(() => latest().failClosed())
    hook.unmount()
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(FakeEventSource.all).toHaveLength(1)
    expect(refreshSession).not.toHaveBeenCalled()
  })
})
