/** 카카오맵 JavaScript SDK 중 점포 위치 표시에 쓰는 부분만 (지도 하나, 표시 하나) */
export interface KakaoLatLng {
  readonly _brand?: 'LatLng'
}

export interface KakaoMaps {
  load(callback: () => void): void
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => object
  Marker: new (options: { map: object; position: KakaoLatLng }) => object
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps }
  }
}

const SDK_ID = 'kakao-map-sdk'

/** 키가 있으면 문자열, 없으면 null. 빌드 변수 VITE_KAKAO_MAP_KEY (레포 변수에 진아님이 넣는다) */
export function kakaoMapKey(): string | null {
  const key = import.meta.env.VITE_KAKAO_MAP_KEY
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null
}

let loading: Promise<KakaoMaps> | null = null

/**
 * SDK 를 한 번만 불러온다(autoload=false 로 받고 maps.load 로 초기화). 실패하면 다음에 다시 시도할 수 있게 비운다.
 * 주소는 카카오 공식 SDK(dapi.kakao.com)이고 CSP 에 진아님이 넣었다(infra #60)
 */
export function loadKakaoMaps(key: string): Promise<KakaoMaps> {
  if (window.kakao?.maps) {
    const maps = window.kakao.maps
    return new Promise((resolve) => maps.load(() => resolve(maps)))
  }
  if (loading) return loading
  loading = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SDK_ID
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`
    script.onload = () => {
      const maps = window.kakao?.maps
      if (!maps) {
        reject(new Error('kakao maps 없음'))
        return
      }
      maps.load(() => resolve(maps))
    }
    script.onerror = () => reject(new Error('kakao maps 불러오기 실패'))
    document.head.appendChild(script)
  }).catch((e: unknown) => {
    loading = null
    document.getElementById(SDK_ID)?.remove()
    throw e
  })
  return loading
}
