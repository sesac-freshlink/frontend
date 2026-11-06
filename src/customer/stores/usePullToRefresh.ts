import { useEffect, useRef, useState } from 'react'

/** 이만큼(px) 당긴 뒤 놓으면 새로고침한다 */
export const PULL_THRESHOLD = 70
/** 손가락이 움직인 만큼보다 덜 내려오게 해서 당기는 느낌을 준다 */
const RESISTANCE = 0.5

export interface PullToRefreshReturn<T extends HTMLElement> {
  /** 당길 영역(목록을 감싼 요소)에 붙인다 */
  ref: React.RefObject<T | null>
  /** 지금 당긴 거리(px, 저항 반영). 표시용 */
  pull: number
  /** 놓으면 새로고침할 만큼 당겼는지 */
  ready: boolean
}

/**
 * 고객 화면(핸드폰) 당겨서 새로고침. 화면 맨 위에서 아래로 당겼다 놓으면 onRefresh 를 부른다.
 * 맨 위가 아닐 때(스크롤 중)나 옆으로 미는 동작은 무시한다. 터치가 없는 기기에서는 아무것도 하지 않는다
 * (그때는 화면의 새로고침 버튼을 쓴다)
 */
export function usePullToRefresh<T extends HTMLElement>(
  onRefresh: () => void,
): PullToRefreshReturn<T> {
  const ref = useRef<T>(null)
  const [pull, setPull] = useState(0)
  const latest = useRef(onRefresh)
  useEffect(() => {
    latest.current = onRefresh
  })

  useEffect(() => {
    const el = ref.current
    if (el === null) return
    let startY: number | null = null
    let startX = 0
    let distance = 0

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || e.touches.length !== 1) return
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
      distance = 0
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      const dx = Math.abs(e.touches[0].clientX - startX)
      if (dy <= 0 || dx > dy) {
        distance = 0
        setPull(0)
        return
      }
      distance = dy * RESISTANCE
      setPull(distance)
    }
    const onEnd = () => {
      if (startY !== null && distance >= PULL_THRESHOLD) latest.current()
      startY = null
      distance = 0
      setPull(0)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return { ref, pull, ready: pull >= PULL_THRESHOLD }
}
