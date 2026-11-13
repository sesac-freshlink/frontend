import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/shared/auth'
import { PICKUP_STREAM_LABEL, PICKUP_STREAM_PATH, usePickupScanStream } from './api'
import { PickupStreamDot } from './components/PickupStreamDot'

/** 테스트용 EventSource: 만든 것을 모아 두고, 열기·오류·이벤트를 손으로 일으킨다 */
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
  removeEventListener(type: string, fn: (e: MessageEvent<string>) => void) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((f) => f !== fn),
    )
  }
  close() {
    this.readyState = FakeEventSource.CLOSED
  }
  /** 서버가 연결을 받음 */
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
  emit(type: string, data: string) {
    for (const fn of this.listeners.get(type) ?? []) fn(new MessageEvent(type, { data }))
  }
}

const latest = () => FakeEventSource.all[FakeEventSource.all.length - 1]

function Probe({
  onScan,
  onConnectionChange,
}: {
  onScan: (t: string) => void
  onConnectionChange: (c: boolean) => void
}) {
  usePickupScanStream(onScan, onConnectionChange)
  return null
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('QR 알림 통로 다시 붙기 (A16, 11/13 트러블슈팅)', () => {
  const refreshSession = vi.fn<() => Promise<boolean>>()
  const onScan = vi.fn<(t: string) => void>()
  const onConnectionChange = vi.fn<(c: boolean) => void>()

  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.all = []
    vi.stubGlobal('EventSource', FakeEventSource)
    refreshSession.mockReset().mockResolvedValue(true)
    onScan.mockReset()
    onConnectionChange.mockReset()
    useAuthStore.setState({ refreshSession })
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const mount = () => render(<Probe onScan={onScan} onConnectionChange={onConnectionChange} />)

  it('로그인 쿠키를 붙여 한 번 열고, 표가 오면 넘긴다. 열리면 연결됨을 알린다', () => {
    mount()
    expect(FakeEventSource.all).toHaveLength(1)
    expect(latest().url).toBe(PICKUP_STREAM_PATH)
    expect(latest().init).toEqual({ withCredentials: true })
    act(() => latest().open())
    expect(onConnectionChange).toHaveBeenLastCalledWith(true)
    act(() => latest().emit('pickup-scan', '{"token":"abc"}'))
    expect(onScan).toHaveBeenCalledWith('abc')
  })

  it('브라우저가 스스로 다시 붙는 중(CONNECTING)이면 새로 열지 않고, 3초 안에 붙으면 불도 그대로다', async () => {
    mount()
    act(() => latest().open())
    act(() => latest().failConnecting())
    await act(() => vi.advanceTimersByTimeAsync(2_000))
    act(() => latest().open())
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(onConnectionChange).not.toHaveBeenCalledWith(false)
    expect(refreshSession).not.toHaveBeenCalled()
    expect(FakeEventSource.all).toHaveLength(1)
  })

  it('3초 안에 다시 붙지 못하면 그때 끊김으로 알린다', async () => {
    mount()
    act(() => latest().open())
    act(() => latest().failConnecting())
    await act(() => vi.advanceTimersByTimeAsync(2_999))
    expect(onConnectionChange).toHaveBeenLastCalledWith(true)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(onConnectionChange).toHaveBeenLastCalledWith(false)
    expect(FakeEventSource.all).toHaveLength(1)
  })

  it('부르는 쪽이 함수를 새로 만들어 넘겨도 통로를 다시 열지 않고 최신 함수로 알린다', () => {
    const view = mount()
    const nextScan = vi.fn<(t: string) => void>()
    view.rerender(<Probe onScan={nextScan} onConnectionChange={onConnectionChange} />)
    expect(FakeEventSource.all).toHaveLength(1)
    act(() => latest().emit('pickup-scan', '{"token":"xyz"}'))
    expect(nextScan).toHaveBeenCalledWith('xyz')
    expect(onScan).not.toHaveBeenCalled()
  })

  it('서버가 닫으면(CLOSED) 3초 뒤 로그인을 갱신하고 새로 연다', async () => {
    mount()
    act(() => latest().failClosed())
    expect(onConnectionChange).toHaveBeenLastCalledWith(false)
    await act(() => vi.advanceTimersByTimeAsync(2_999))
    expect(refreshSession).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.all).toHaveLength(2)
    act(() => latest().open())
    expect(onConnectionChange).toHaveBeenLastCalledWith(true)
  })

  it('계속 실패하면 3초 → 10초 → 30초 → 30초로 늘리고, 열리면 처음 간격으로 돌아간다', async () => {
    mount()
    for (const wait of [3_000, 10_000, 30_000, 30_000]) {
      const before = FakeEventSource.all.length
      act(() => latest().failClosed())
      await act(() => vi.advanceTimersByTimeAsync(wait - 1))
      expect(FakeEventSource.all).toHaveLength(before)
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(FakeEventSource.all).toHaveLength(before + 1)
    }
    act(() => latest().open())
    const before = FakeEventSource.all.length
    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(FakeEventSource.all).toHaveLength(before + 1)
  })

  it('로그인이 끝났으면(갱신 false) 다시 열지 않는다', async () => {
    refreshSession.mockResolvedValue(false)
    mount()
    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.all).toHaveLength(1)
    await act(() => vi.advanceTimersByTimeAsync(120_000))
    expect(FakeEventSource.all).toHaveLength(1)
  })

  it('갱신 서버 오류면 로그인이 살아 있을 수 있어 그대로 다시 열어 본다', async () => {
    refreshSession.mockRejectedValue(new Error('network'))
    mount()
    act(() => latest().failClosed())
    await act(() => vi.advanceTimersByTimeAsync(3_000))
    expect(FakeEventSource.all).toHaveLength(2)
  })

  it('화면이 다시 보이면 닫힌 통로만 기다리지 않고 바로 다시 연다', async () => {
    mount()
    act(() => latest().open())
    setVisibility('hidden')
    setVisibility('visible')
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(refreshSession).not.toHaveBeenCalled() // 열려 있으면 그대로 둔다
    expect(FakeEventSource.all).toHaveLength(1)

    act(() => latest().failClosed())
    setVisibility('hidden')
    setVisibility('visible')
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.all).toHaveLength(2)
    // 기다리던 3초 타이머는 취소돼 한 번 더 열지 않는다
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(FakeEventSource.all).toHaveLength(2)
  })

  it('화면이 닫히면 통로를 닫고 기다리던 다시 열기도 취소한다', async () => {
    const view = mount()
    act(() => latest().failClosed())
    view.unmount()
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(refreshSession).not.toHaveBeenCalled()
    expect(FakeEventSource.all).toHaveLength(1)
    expect(latest().readyState).toBe(FakeEventSource.CLOSED)
  })
})

describe('점포명 옆 QR 연결 불', () => {
  it('연결되면 초록, 화면 읽기·마우스 올림 글은 "QR 받을 준비됨"', () => {
    render(<PickupStreamDot connected />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('title', PICKUP_STREAM_LABEL.connected)
    expect(status).toHaveTextContent('QR 받을 준비됨')
    expect(status.querySelector('[aria-hidden]')).toHaveClass('bg-emerald-600')
  })

  it('끊기면 회색, 글은 "QR 연결 끊김, 다시 연결 중"', () => {
    render(<PickupStreamDot connected={false} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('title', PICKUP_STREAM_LABEL.disconnected)
    expect(status).toHaveTextContent('QR 연결 끊김, 다시 연결 중')
    expect(status.querySelector('[aria-hidden]')).toHaveClass('bg-slate-500')
  })
})
