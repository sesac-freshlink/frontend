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

/**
 * 이 기기가 위치 권한을 이미 허용했는지(묻는 창을 띄우지 않고 확인만). 점포 정할 때 확인 창은
 * 허용한 기기에서만 위치를 쓴다(11/14 경우 결정: 위치 권한이 없으면 안내하지 않음)
 */
export function useGeolocationGranted(): boolean {
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    let alive = true
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (alive && status.state === 'granted') setGranted(true)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  return granted
}
