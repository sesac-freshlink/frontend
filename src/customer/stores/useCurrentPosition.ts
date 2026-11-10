import { useEffect, useState } from 'react'
import type { LatLng } from './nearby'

export type PositionState =
  | { status: 'pending' }
  | { status: 'ok'; position: LatLng }
  /** 권한 거부·지원 안 함·시간 초과. 화면은 같은 지역 점포로 대신 보여 준다 */
  | { status: 'unavailable' }

/** 브라우저 위치를 한 번 묻는다. enabled 가 false 면 묻지 않는다(권한 창이 필요할 때만 뜨게) */
export function useCurrentPosition(enabled: boolean): PositionState {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const [state, setState] = useState<PositionState>(
    supported ? { status: 'pending' } : { status: 'unavailable' },
  )

  useEffect(() => {
    if (!enabled || !supported) return
    let alive = true
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (alive)
          setState({
            status: 'ok',
            position: { latitude: p.coords.latitude, longitude: p.coords.longitude },
          })
      },
      () => {
        if (alive) setState({ status: 'unavailable' })
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
    return () => {
      alive = false
    }
  }, [enabled, supported])

  return state
}
