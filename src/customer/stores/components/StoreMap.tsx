import { MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { kakaoMapKey, loadKakaoMaps } from '../kakaoMap'

interface StoreMapProps {
  latitude: number | null
  longitude: number | null
  name: string
}

/** 지도 확대 단계 (카카오맵 1~14, 작을수록 가깝다). 점포 주변 골목이 보이는 정도 */
const MAP_LEVEL = 3

/**
 * 점포 위치 지도 (카카오맵). 키(VITE_KAKAO_MAP_KEY)나 좌표가 없거나 불러오지 못하면 지도 대신 안내만 보여 준다.
 * 주소 글자는 위 정보 칸에 따로 있어 지도가 없어도 찾아갈 수 있다
 */
export function StoreMap({ latitude, longitude, name }: StoreMapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const key = kakaoMapKey()
  const ready = key !== null && latitude !== null && longitude !== null

  useEffect(() => {
    if (!ready || key === null || latitude === null || longitude === null) return
    let cancelled = false
    loadKakaoMaps(key)
      .then((maps) => {
        const container = ref.current
        if (cancelled || !container) return
        const center = new maps.LatLng(latitude, longitude)
        const map = new maps.Map(container, { center, level: MAP_LEVEL })
        new maps.Marker({ map, position: center })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [ready, key, latitude, longitude])

  if (!ready || failed) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 rounded-lg bg-slate-50 text-sm text-slate-400">
        <MapPin className="size-5" aria-hidden="true" />
        {failed ? '지도를 불러오지 못했어요' : '지도가 아직 없어요'}
      </div>
    )
  }
  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${name} 위치 지도`}
      className="h-48 rounded-lg bg-slate-50"
    />
  )
}
