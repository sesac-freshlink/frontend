import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SALES_STREAM_PATH, useSalesStream } from './api'

/** 테스트용 EventSource. 만든 것을 모아 두고 sales 이벤트를 직접 보낸다 */
class FakeEventSource {
  static created: FakeEventSource[] = []
  readonly listeners = new Map<string, Set<() => void>>()
  readonly url: string
  readonly init: EventSourceInit | undefined
  closed = false

  constructor(url: string, init?: EventSourceInit) {
    this.url = url
    this.init = init
    FakeEventSource.created.push(this)
  }

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(listener)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  close() {
    this.closed = true
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener())
  }
}

function setup() {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useSalesStream(), { wrapper })
  return { invalidate, hook }
}

describe('useSalesStream (실시간 매출 SSE)', () => {
  beforeEach(() => {
    FakeEventSource.created = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('매출 SSE 주소로 쿠키를 붙여 연결한다', () => {
    setup()

    expect(FakeEventSource.created).toHaveLength(1)
    expect(FakeEventSource.created[0].url).toBe(SALES_STREAM_PATH)
    expect(FakeEventSource.created[0].init).toEqual({ withCredentials: true })
  })

  it('연결 직후 첫 이벤트는 넘기고, 그다음 결제 완료 이벤트마다 매출 조회를 다시 읽는다', () => {
    const { invalidate } = setup()
    const source = FakeEventSource.created[0]

    source.emit('sales')
    expect(invalidate).not.toHaveBeenCalled()

    source.emit('sales')
    source.emit('sales')
    expect(invalidate).toHaveBeenCalledTimes(2)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['owner', 'sales'] })
  })

  it('화면을 떠나면 연결을 닫고 더는 받지 않는다', () => {
    const { invalidate, hook } = setup()
    const source = FakeEventSource.created[0]

    hook.unmount()
    source.emit('sales')
    source.emit('sales')

    expect(source.closed).toBe(true)
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('EventSource 가 없는 환경이면 연결하지 않는다', () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('EventSource', undefined)

    expect(() => setup()).not.toThrow()
    expect(FakeEventSource.created).toHaveLength(0)
  })
})
