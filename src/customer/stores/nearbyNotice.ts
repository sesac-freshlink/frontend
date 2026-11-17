import type { RegionCode } from '@/auth/regions'
import type { StoreSummary } from './api'
import { nearestStores } from './homeRows'
import { distanceKm, type LatLng } from './nearby'

/** 지금 위치에서 픽업 점포가 이보다 멀면 "더 가까운 점포" 안내를 띄운다 (11/14 경우 결정 G2) */
export const FAR_PICKUP_KM = 10

/**
 * 시·도 17곳 대표 좌표(시·도청 근처). 지금 위치에서 가장 가까운 곳을 "지금 있는 시·도"로 본다 (11/14 경우 결정 G3).
 * shortcut: 시·도 경계 근처(예: 경기 남부와 충남 북부)에서는 옆 시·도로 잡힐 수 있다. 정확히 하려면
 * member ST-01 이 좌표를 받아 전국에서 가까운 점포를 주게 바꾼다(서버 일, 문서표 대안 B)
 */
export const REGION_CENTERS: Record<RegionCode, LatLng> = {
  SEOUL: { latitude: 37.5665, longitude: 126.978 },
  BUSAN: { latitude: 35.1796, longitude: 129.0756 },
  DAEGU: { latitude: 35.8714, longitude: 128.6014 },
  INCHEON: { latitude: 37.4563, longitude: 126.7052 },
  GWANGJU: { latitude: 35.1595, longitude: 126.8526 },
  DAEJEON: { latitude: 36.3504, longitude: 127.3845 },
  ULSAN: { latitude: 35.5384, longitude: 129.3114 },
  SEJONG: { latitude: 36.48, longitude: 127.289 },
  GYEONGGI: { latitude: 37.4138, longitude: 127.5183 },
  GANGWON: { latitude: 37.8228, longitude: 128.1555 },
  CHUNGBUK: { latitude: 36.8, longitude: 127.7 },
  CHUNGNAM: { latitude: 36.5184, longitude: 126.8 },
  JEONBUK: { latitude: 35.7175, longitude: 127.153 },
  JEONNAM: { latitude: 34.8679, longitude: 126.991 },
  GYEONGBUK: { latitude: 36.4919, longitude: 128.8889 },
  GYEONGNAM: { latitude: 35.4606, longitude: 128.2132 },
  JEJU: { latitude: 33.4996, longitude: 126.5312 },
}

/** 지금 위치에서 가장 가까운 시·도 대표 좌표의 시·도 */
export function regionOf(origin: LatLng): RegionCode {
  let best: RegionCode = 'SEOUL'
  let bestKm = Infinity
  for (const [code, center] of Object.entries(REGION_CENTERS) as [RegionCode, LatLng][]) {
    const km = distanceKm(origin, center)
    if (km < bestKm) {
      best = code
      bestKm = km
    }
  }
  return best
}

export interface CloserStore {
  /** 고른(또는 지금) 점포까지 km */
  farKm: number
  nearest: StoreSummary
  nearestKm: number
}

/**
 * 점포(target)가 지금 위치에서 FAR_PICKUP_KM 넘게 멀고, 지금 시·도 점포(stores) 중 더 가까운 곳이 있으면 그 점포.
 * 위치나 점포 좌표를 모르면 null(안내하지 않는다)
 */
export function closerStore(
  origin: LatLng | null,
  target: Pick<StoreSummary, 'storeId' | 'latitude' | 'longitude'> | undefined,
  stores: StoreSummary[] | undefined,
): CloserStore | null {
  if (!origin || !target || !stores) return null
  if (typeof target.latitude !== 'number' || typeof target.longitude !== 'number') return null
  const farKm = distanceKm(origin, { latitude: target.latitude, longitude: target.longitude })
  if (farKm <= FAR_PICKUP_KM) return null
  const [nearest] = nearestStores(
    stores.filter((s) => s.storeId !== target.storeId),
    origin,
    1,
  )
  if (!nearest || nearest.distanceKm >= farKm) return null
  return { farKm, nearest: nearest.store, nearestKm: nearest.distanceKm }
}

const DISMISS_KEY = 'freshlink.nearbyNotice.dismissed'

/** 이번 접속에서 [그대로 두기]를 눌렀는지 (11/14 경우 결정 G4: 앱을 다시 열 때까지 안 띄움) */
export function isNearbyNoticeDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissNearbyNotice() {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 닫힌다
  }
}

/** 받침이 있으면 true (이름 뒤 조사 은/는·이/가). 한글이 아니면 받침 없음으로 본다 */
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return false
  return (code - 0xac00) % 28 !== 0
}

/** "프레시 노원점" → "프레시 노원점은" */
export function withTopic(name: string): string {
  return `${name}${hasBatchim(name) ? '은' : '는'}`
}

/** "프레시 해운대점(800m)" + 이/가 — 조사는 이름 끝 글자를 따른다 */
export function withSubject(name: string, suffix = ''): string {
  return `${name}${suffix}${hasBatchim(name) ? '이' : '가'}`
}

/** "프레시 해운대점" → "프레시 해운대점으로" (받침 ㄹ·받침 없음은 "로") */
export function withTo(name: string): string {
  const code = name.charCodeAt(name.length - 1)
  const jong = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : 0
  return `${name}${jong === 0 || jong === 8 ? '로' : '으로'}`
}
