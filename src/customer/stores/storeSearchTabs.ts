import type { StoreSummary } from './api'
import type { FavoriteStore } from './favoriteStores'
import { distanceKm, type LatLng } from './nearby'

/** 점포 검색 탭 (11/11 경우 결정: 가까운순·최근 주문·단골) */
export type StoreSearchTab = 'near' | 'recent' | 'favorite'

/** 점포 검색 목록 한 줄. 거리는 내 위치와 점포 좌표를 둘 다 알 때만 있다 */
export interface StoreRow {
  storeId: number
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  distanceKm: number | null
}

function coords(store: StoreSummary): Pick<StoreRow, 'latitude' | 'longitude'> {
  return typeof store.latitude === 'number' && typeof store.longitude === 'number'
    ? { latitude: store.latitude, longitude: store.longitude }
    : { latitude: null, longitude: null }
}

function toRow(store: StoreSummary, origin: LatLng | null): StoreRow {
  const c = coords(store)
  return {
    storeId: store.storeId,
    name: store.name,
    address: store.address,
    ...c,
    distanceKm:
      origin && c.latitude !== null && c.longitude !== null
        ? distanceKm(origin, { latitude: c.latitude, longitude: c.longitude })
        : null,
  }
}

/**
 * 가까운순: 내 위치를 알면 거리순(좌표가 없는 점포는 뒤에 이름순), 모르면 서버 순서(점포명순) 그대로.
 * 같은 거리면 이름순으로 둔다
 */
export function nearRows(stores: StoreSummary[], origin: LatLng | null): StoreRow[] {
  const rows = stores.map((s) => toRow(s, origin))
  if (!origin) return rows
  return rows.toSorted((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return a.name.localeCompare(b.name, 'ko')
    if (a.distanceKm === null) return 1
    if (b.distanceKm === null) return -1
    return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'ko')
  })
}

/**
 * 최근 주문: 주문 내역(최근 주문이 앞)에 나온 점포 이름을 처음 나온 순서대로 한 번씩.
 * 주문 내역에는 점포 번호가 없어(OR-06 storeName 만) 지금 지역 점포 목록에서 이름으로 찾는다. 목록에 없는 점포는 뺀다
 */
export function recentRows(
  orderStoreNames: string[],
  stores: StoreSummary[],
  origin: LatLng | null,
): StoreRow[] {
  const byName = new Map(stores.map((s) => [s.name, s]))
  const seen = new Set<string>()
  const rows: StoreRow[] = []
  for (const name of orderStoreNames) {
    if (seen.has(name)) continue
    seen.add(name)
    const store = byName.get(name)
    if (store) rows.push(toRow(store, origin))
  }
  return rows
}

/**
 * 단골: 표시한 순서(최근이 앞). 지금 지역 목록에 있으면 그 값(좌표·거리)을 쓰고,
 * 다른 지역 점포는 남겨 둔 이름·주소만으로 보여 준다(지도 핀 없음)
 */
export function favoriteRows(
  favorites: FavoriteStore[],
  stores: StoreSummary[],
  origin: LatLng | null,
): StoreRow[] {
  const byId = new Map(stores.map((s) => [s.storeId, s]))
  return favorites.map((f) => {
    const store = byId.get(f.storeId)
    return store
      ? toRow(store, origin)
      : { ...f, latitude: null, longitude: null, distanceKm: null }
  })
}

/** 핀에 쓰는 짧은 이름. 모든 점포가 "프레시 "로 시작해 핀이 길어지므로 앞말을 뺀다 */
export function pinLabel(name: string): string {
  return name.replace(/^프레시\s+/, '')
}

/** 화면에서 이 거리(px) 안에 있으면 핀 이름표가 겹친다고 본다. 이름표 한 개 크기(가로 약 70·세로 약 36)에 맞췄다 */
export const PIN_OVERLAP_PX = { x: 72, y: 36 } as const

/**
 * 화면 위치가 겹치는 핀을 묶는다(앞에서부터, 묶음의 첫 핀 자리를 기준으로). 한 개짜리 묶음은 그냥 핀이다.
 * 고른 점포(keepAlone)는 묶지 않고 따로 둔다(점포 칸과 함께 보여야 해서)
 */
export function groupOverlapping<T extends { storeId: number }>(
  items: { item: T; x: number; y: number }[],
  keepAlone: number | null,
): T[][] {
  const groups: { x: number; y: number; members: T[] }[] = []
  for (const { item, x, y } of items) {
    if (item.storeId === keepAlone) {
      groups.push({ x, y, members: [item] })
      continue
    }
    const hit = groups.find(
      (g) =>
        g.members[0].storeId !== keepAlone &&
        Math.abs(g.x - x) < PIN_OVERLAP_PX.x &&
        Math.abs(g.y - y) < PIN_OVERLAP_PX.y,
    )
    if (hit) hit.members.push(item)
    else groups.push({ x, y, members: [item] })
  }
  return groups.map((g) => g.members)
}
