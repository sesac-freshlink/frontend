import type { StoreProduct, StoreSummary } from './api'
import { clearanceOf } from './clearance'
import { distanceKm, type LatLng } from './nearby'

/**
 * 고객 홈(U-01) 상품 줄·카테고리·주변 점포를 만드는 순수 계산.
 *
 * 마감세일만 거르는 서버 조건이 아직 없다(11/11, inventory U-10 조건은 검색어·카테고리·정렬·추천·신상품뿐).
 * 그래서 마감세일은 상품 전부를 받아 여기 isClearanceProduct·clearanceRow 로 거른다.
 * 홈 줄(api.ts useClearanceProducts)과 상품 목록 화면의 [마감세일] 칩이 모두 이 함수를 쓴다.
 * inventory 에 마감세일 조건(예: clearanceOnly)이 생기면 api.ts 의 useClearanceProducts 조건과 이 파일만 바꾼다
 */

/** 홈 상품 줄 하나에 보여 주는 최대 개수(11/10 경우 결정). 나머지는 [전체 보기]로 */
export const HOME_ROW_LIMIT = 10

/** 홈 '내 주변 점포'에 보여 주는 점포 수 */
export const HOME_NEARBY_COUNT = 3

/** 마감세일 남은 시간을 다시 계산하는 간격(1분). 서버를 다시 부르지 않고 화면 글자만 바꾼다 */
export const CLOCK_TICK_MS = 60_000

/** 홈 카테고리 8칸 중 앞 7칸(inventory 카테고리 이름 그대로). 마지막 칸은 전체 분류 화면 */
export const HOME_CATEGORIES = [
  '도시락',
  '김밥',
  '샌드위치',
  '샐러드',
  '유제품',
  '빵',
  '신선식품',
] as const

export type HomeCategory = (typeof HOME_CATEGORIES)[number]

/** 마감세일로 살 수 있는 상품인지. 선착순·수량 0·서버가 아직 안 준 값은 아니다 */
export function isClearanceProduct(product: StoreProduct): boolean {
  return clearanceOf(product) !== null
}

function expiryTime(product: StoreProduct): number {
  if (!product.clearanceExpiry) return Infinity
  const t = new Date(product.clearanceExpiry).getTime()
  return Number.isNaN(t) ? Infinity : t
}

/** 홈 '오늘 마감세일' 줄: 마감세일 상품만, 마감이 빠른 순(같으면 상품명순), 최대 HOME_ROW_LIMIT 개 */
export function clearanceRow(products: StoreProduct[]): StoreProduct[] {
  return products
    .filter(isClearanceProduct)
    .sort((a, b) => expiryTime(a) - expiryTime(b) || a.name.localeCompare(b.name, 'ko'))
    .slice(0, HOME_ROW_LIMIT)
}

/** 홈 상품 줄 개수 맞추기(서버가 거른 추천·신상품 목록). 품절은 뒤로 보낸다 */
export function homeRow(products: StoreProduct[]): StoreProduct[] {
  return [...products]
    .sort((a, b) => Number(a.soldOut) - Number(b.soldOut))
    .slice(0, HOME_ROW_LIMIT)
}

/** 카테고리 칸 사진: 그 분류에서 사진이 있는 첫 상품의 imageUrl. 없으면 null(화면이 선 아이콘을 그린다) */
export function categoryPhotos(products: StoreProduct[]): Record<HomeCategory, string | null> {
  const photos = Object.fromEntries(HOME_CATEGORIES.map((c) => [c, null])) as Record<
    HomeCategory,
    string | null
  >
  for (const p of products) {
    if (p.imageUrl === null) continue
    if ((HOME_CATEGORIES as readonly string[]).includes(p.category)) {
      const key = p.category as HomeCategory
      if (photos[key] === null) photos[key] = p.imageUrl
    }
  }
  return photos
}

export interface NearbyHomeStore {
  store: StoreSummary
  distanceKm: number
}

/** 내 위치에서 가까운 점포. 좌표가 없는 점포(null·칸 없음)는 거리를 몰라 뺀다 */
export function nearestStores(
  stores: StoreSummary[],
  origin: LatLng,
  count: number = HOME_NEARBY_COUNT,
): NearbyHomeStore[] {
  return stores
    .flatMap((store) =>
      typeof store.latitude === 'number' && typeof store.longitude === 'number'
        ? [
            {
              store,
              distanceKm: distanceKm(origin, {
                latitude: store.latitude,
                longitude: store.longitude,
              }),
            },
          ]
        : [],
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count)
}

/** 한 점포까지 거리(km). 위치나 점포 좌표를 모르면 null */
export function storeDistance(store: StoreSummary | undefined, origin: LatLng | null) {
  if (!store || !origin) return null
  if (typeof store.latitude !== 'number' || typeof store.longitude !== 'number') return null
  return distanceKm(origin, { latitude: store.latitude, longitude: store.longitude })
}

/** 마감세일 남은 시간 문구. 1시간 넘으면 "3시간 12분 남음", 안이면 "12분 남음", 지났거나 1분 안이면 "곧 마감" */
export function remainingText(expiry: string | null | undefined, now: number): string | null {
  if (!expiry) return null
  const end = new Date(expiry).getTime()
  if (Number.isNaN(end)) return null
  const minutes = Math.floor((end - now) / 60_000)
  if (minutes < 1) return '곧 마감'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분 남음`
  return m === 0 ? `${h}시간 남음` : `${h}시간 ${m}분 남음`
}
