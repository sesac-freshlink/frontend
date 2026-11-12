import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useQueries } from '@tanstack/react-query'
import type { RegionCode } from '@/auth/regions'
import { api } from '@/shared/api/client'
import { categoryPhotos, clearanceRow, firstPhotoByCategory } from './homeRows'

/** ST-01 응답 한 줄 */
export interface StoreSummary {
  storeId: number
  storeCode: string
  name: string
  address: string
  region: RegionCode
  /** 지도 좌표(11/10 member ST-01부터). 관리자가 안 넣었으면 null, 그 전 응답에는 칸이 없다 */
  latitude?: number | null
  longitude?: number | null
}

export interface StoreSearchParams {
  region: RegionCode
  /** 점포명·주소 일부. 빈 값이면 그 지역 전체 */
  keyword: string
}

/** 검색어 최대 길이 (member-service ST-01: 앞뒤 공백을 빼고 50자) */
export const STORE_KEYWORD_MAX = 50

/** U-01 점포 검색 (member-service ST-01, 로그인 없이도 된다). ACTIVE 점포만, 점포명순 */
export function useStores({ region, keyword }: StoreSearchParams) {
  const trimmed = keyword.trim()
  return useQuery({
    queryKey: ['customer', 'stores', region, trimmed],
    queryFn: async () =>
      (
        await api.get<StoreSummary[]>('/stores', {
          params: trimmed ? { region, keyword: trimmed } : { region },
        })
      ).data,
    // 검색 조건을 바꾸는 동안 이전 결과를 그대로 둬서 목록이 깜빡이지 않게 한다
    placeholderData: keepPreviousData,
  })
}

/**
 * 점포 상세 (member-service GET /stores/{storeId}, 로그인 없이도 된다). 운영 중인 점포만 온다.
 * 지도 좌표·설명·이미지는 관리자가 아직 넣지 않았으면 null 이다. imageUrl 은 같은 주소의 /images/... 경로다
 */
export interface StoreDetail extends StoreSummary {
  latitude: number | null
  longitude: number | null
  description: string | null
  imageUrl: string | null
}

/** 점포 상세. 들어올 때만 읽는다 */
export function useStoreDetail(storeId: number) {
  return useQuery({
    queryKey: ['customer', 'stores', storeId, 'detail'],
    queryFn: async () => (await api.get<StoreDetail>(`/stores/${storeId}`)).data,
  })
}

/** U-10 응답 한 줄. 고객용이라 "예약" 관련 필드는 없고 구매 가능 수량만 온다 */
export interface StoreProduct {
  productId: number
  name: string
  category: string
  price: number
  /** 상품 이미지 주소. 없으면 null (화면이 자리표시를 보여 준다) */
  imageUrl: string | null
  availableQuantity: number
  soldOut: boolean
  /** 점주가 고른 추천상품 */
  recommended: boolean
  /** 그 점포에 처음 입고된 지 7일 안인 신상품 */
  newArrival: boolean
  /** 점주가 정한 선착순 상품. 구매는 대기열을 거친다 */
  firstCome: boolean
  /** 먼저 받게 될 상품의 소비기한(+09:00). 소비기한 빠른 것부터 준다. 품절이면 null */
  nearestExpiry: string | null
  /**
   * 마감세일(소비기한 24시간 안, 30% 할인) 수량. 판매 시간(06~23시) 밖이거나 선착순 상품이면 0.
   * availableQuantity 는 마감세일을 뺀 기본 수량이다. inventory 가 마감세일을 배포하기 전에는 오지 않는다
   */
  clearanceQuantity?: number
  /** 마감세일 단가(원). clearanceQuantity 가 0이면 null */
  clearancePrice?: number | null
  /** 마감세일 상품의 소비기한(+09:00). clearanceQuantity 가 0이면 null */
  clearanceExpiry?: string | null
  /** 이 점포의 최근 7일 순판매 수량(판매 − 환불 복원, 0 아래면 0). 추천순과 같은 값(inventory #72). 배포 전 응답에는 없다 */
  soldRecently?: number
}

/** U-10 상품 상세. inventory-service StoreProductDetailResponse 와 같은 모양(목록 한 줄과 필드가 같다) */
export type StoreProductDetail = StoreProduct

/** U-10 상품 상세 (로그인 없이도 된다). 들어올 때만 읽는다. 살 수 있는지는 주문 때 서버가 최종 판정한다 */
export function useStoreProduct(storeId: number, productId: number) {
  return useQuery({
    queryKey: ['customer', 'stores', storeId, 'product', productId],
    queryFn: async () =>
      (await api.get<StoreProductDetail>(`/stores/${storeId}/products/${productId}`)).data,
  })
}

/** 상품 검색어 최대 길이 (inventory-service U-10: 앞뒤 공백을 빼고 50자) */
export const PRODUCT_KEYWORD_MAX = 50

/** U-10 목록 정렬. NAME = 상품명 순(기본), POPULAR = 추천순(최근 7일 순판매 많은 순) */
export type StoreProductSort = 'NAME' | 'POPULAR'

/** U-10 목록 조건. 모두 선택이다 */
export interface StoreProductFilter {
  /** 상품명 검색어. 검색을 누를 때만 바뀐다 */
  keyword?: string
  /** 이 카테고리만. 빈 값이면 전체 */
  category?: string
  sort?: StoreProductSort
  /** 점주 추천상품만 */
  recommendedOnly?: boolean
  /** 신상품만 */
  newOnly?: boolean
  /** 지금 마감세일로 살 수 있는 상품만(inventory #71 clearance=true, 06~23시·선착순 제외) */
  clearanceOnly?: boolean
  /** 선착순 상품만(inventory #71 firstCome=true) */
  firstComeOnly?: boolean
}

/** 서버로 보낼 쿼리. 기본값인 조건은 넣지 않는다 */
export function storeProductParams(filter: StoreProductFilter): Record<string, string | boolean> {
  const params: Record<string, string | boolean> = {}
  const q = (filter.keyword ?? '').trim()
  if (q) params.q = q
  if (filter.category) params.category = filter.category
  if (filter.sort && filter.sort !== 'NAME') params.sort = filter.sort
  if (filter.recommendedOnly) params.recommended = true
  if (filter.newOnly) params.newOnly = true
  if (filter.clearanceOnly) params.clearance = true
  if (filter.firstComeOnly) params.firstCome = true
  return params
}

/** U-10 무한 스크롤 한 묶음 크기 */
export const PRODUCT_PAGE_SIZE = 20

/**
 * U-10 상품 목록을 묶음(PRODUCT_PAGE_SIZE개)씩 불러온다. 서버가 거르고 정렬한 결과를 page·size로 잘라 준다.
 * 받은 개수가 묶음 크기보다 적으면 마지막 묶음이라 더 부르지 않는다. 조건이 바뀌면 처음 묶음부터 다시 읽는다
 */
export function useStoreProductPages(storeId: number, filter: StoreProductFilter = {}) {
  const params = storeProductParams(filter)
  return useInfiniteQuery({
    queryKey: ['customer', 'stores', storeId, 'products', 'pages', params],
    queryFn: async ({ pageParam }) =>
      (
        await api.get<StoreProduct[]>(`/stores/${storeId}/products`, {
          params: { ...params, page: pageParam, size: PRODUCT_PAGE_SIZE },
        })
      ).data,
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PRODUCT_PAGE_SIZE ? undefined : all.length),
    // 조건을 바꾸는 동안 이전 결과를 그대로 둬서 목록이 깜빡이지 않게 한다
    placeholderData: keepPreviousData,
  })
}

/**
 * U-10 점포 상품 목록 (inventory-service, 로그인 없이도 된다). 기본은 상품 전부, 상품명순.
 * 검색어(q)·카테고리·추천상품만·신상품만·추천순 정렬은 서버가 처리한다.
 * 폴링하지 않고 화면에 들어올 때·조건을 바꿀 때·새로고침 때만 읽는다. 살 수 있는지는 주문 때 서버가 최종 판정한다
 */
export function useStoreProducts(
  storeId: number,
  filter: StoreProductFilter = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
  const params = storeProductParams(filter)
  const url = `/stores/${storeId}/products`
  return useQuery({
    queryKey: ['customer', 'stores', storeId, 'products', params],
    enabled,
    queryFn: async () =>
      (Object.keys(params).length > 0
        ? await api.get<StoreProduct[]>(url, { params })
        : await api.get<StoreProduct[]>(url)
      ).data,
    // 검색어를 바꾸는 동안 이전 결과를 그대로 둬서 목록이 깜빡이지 않게 한다
    placeholderData: keepPreviousData,
  })
}

/** 점포 상품 전부(조건 없음) 읽기. useStoreProducts(storeId) 와 같은 queryKey 라 홈 줄끼리 한 번만 부른다 */
function allProductsQuery(storeId: number) {
  return {
    queryKey: ['customer', 'stores', storeId, 'products', {}],
    queryFn: async () => (await api.get<StoreProduct[]>(`/stores/${storeId}/products`)).data,
  }
}

/**
 * 홈 '마감세일' 줄. inventory 서버 조건(clearance=true, #71)으로 지금 마감세일로 살 수 있는 상품만 받고,
 * homeRows.clearanceRow 로 마감 빠른 순으로 줄 세운다(서버가 조건을 모르는 옛 배포에서도 걸러지게 거르기는 남긴다)
 */
export function useClearanceProducts(storeId: number) {
  return useQuery({
    queryKey: ['customer', 'stores', storeId, 'products', { clearance: true }],
    queryFn: async () =>
      (
        await api.get<StoreProduct[]>(`/stores/${storeId}/products`, {
          params: { clearance: true },
        })
      ).data,
    select: clearanceRow,
  })
}

/** 홈 카테고리 칸 사진(분류별 첫 상품 사진). 마감세일 줄과 같은 상품 전부 목록을 쓴다 */
export function useCategoryPhotos(storeId: number) {
  return useQuery({ ...allProductsQuery(storeId), select: categoryPhotos })
}

/** 점포 상품 목록 분류 줄 사진(분류별 첫 상품 사진, 12개 분류 전부). 홈 줄과 같은 상품 전부 목록을 쓴다 */
export function useStoreCategoryPhotos(storeId: number) {
  return useQuery({ ...allProductsQuery(storeId), select: firstPhotoByCategory })
}

/** 홈 베스트 상품 개수(1~5위, 11/11 경우 시안) */
export const BEST_PRODUCT_COUNT = 5

/**
 * 홈 베스트 상품 읽기(11/11). 고객용 판매 순위 API 가 따로 없어, U-10 목록의 추천순(sort=POPULAR = 최근 7일 순판매 많은 순,
 * inventory StoreProductBadges POPULAR_WINDOW) 앞 5개를 쓴다. 판매 순위 API 가 새로 생기면 이 함수 하나만 바꾼다
 */
export async function fetchBestProducts(storeId: number, category = ''): Promise<StoreProduct[]> {
  const params: Record<string, string | number> = {
    sort: 'POPULAR',
    page: 0,
    size: BEST_PRODUCT_COUNT,
  }
  if (category) params.category = category
  return (await api.get<StoreProduct[]>(`/stores/${storeId}/products`, { params })).data
}

/**
 * 홈 베스트 상품(분류별, 11/12). 판매 기록이 없어도 추천순 앞 5개를 그대로 보여 준다(11/12 경우 결정, #94 방식).
 * 실패하면 다시 묻지 않고(화면은 칸을 숨긴다) 들어올 때·당겨서 새로고침 때·분류를 바꿀 때만 읽는다 */
export function useBestProducts(storeId: number, category = '') {
  return useQuery({
    queryKey: ['customer', 'stores', storeId, 'products', 'best', category],
    queryFn: () => fetchBestProducts(storeId, category),
    retry: false,
    placeholderData: keepPreviousData,
  })
}

/** U-10 카테고리 칩. 상품 전체의 카테고리(가나다순). 들어올 때 한 번 읽는다 */
export function useStoreCategories(storeId: number) {
  return useQuery({
    queryKey: ['customer', 'stores', storeId, 'categories'],
    queryFn: async () => (await api.get<string[]>(`/stores/${storeId}/products/categories`)).data,
  })
}

/** 주변 점포 재고 한 줄. inventory-service StoreStockResponse 와 같은 모양 */
export interface StoreStock {
  storeId: number
  /** 그 점포에서 지금 살 수 있는 수량(1 이상) */
  availableQuantity: number
  /** 먼저 받게 될 상품의 소비기한(+09:00) */
  nearestExpiry: string
}

/** 주변 점포 재고: 이 상품을 지금 살 수 있는 점포와 수량(공개). 품절 상세에서만 읽는다 */
export function useProductStores(productId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['customer', 'products', productId, 'stores'],
    queryFn: async () => (await api.get<StoreStock[]>(`/products/${productId}/stores`)).data,
    enabled,
  })
}

/** 주변 점포 재고에 쓰는 점포 정보: 이름·지역·좌표. 점포 목록 한 줄이나 점포 상세에서 얻는다 */
export type StorePlace = Pick<StoreDetail, 'storeId' | 'name' | 'region' | 'latitude' | 'longitude'>

/** 점포 목록 한 줄이나 상세에 좌표 칸이 있는지. 좌표가 들어오기 전(member #34 전) 목록이면 상세를 읽는다 */
function isStorePlace(value: unknown): value is StorePlace {
  return (
    typeof value === 'object' &&
    value !== null &&
    'storeId' in value &&
    'latitude' in value &&
    'longitude' in value
  )
}

export interface UseStorePlacesReturn {
  /** 읽은 점포만 담는다 */
  places: ReadonlyMap<number, StorePlace>
  /** 목록·상세를 아직 읽는 중. 끝나기 전에 "재고 없음"을 보이지 않게 쓴다 */
  isPending: boolean
}

/**
 * 주변 점포 재고(U-10)용으로 여러 점포의 이름·지역·좌표를 읽는다.
 * 지금 점포의 상세로 지역을 알고, 그 지역 점포 목록(ST-01, 11/10부터 좌표가 있다)을 한 번 읽는다.
 * 목록에 없는 점포(다른 지역)나 좌표 칸이 없는 목록이면 그 점포만 상세를 읽는다.
 * 상세는 useStoreDetail 과, 목록은 점포 검색(useStores)의 빈 검색어와 같은 queryKey 라 이미 읽은 것은 다시 묻지 않는다
 */
export function useStorePlaces(currentStoreId: number, storeIds: number[]): UseStorePlacesReturn {
  const current = useStoreDetail(currentStoreId)
  const region = isStorePlace(current.data) ? current.data.region : undefined
  const regionStores = useQuery({
    queryKey: ['customer', 'stores', region, ''],
    queryFn: async () => (await api.get<StoreSummary[]>('/stores', { params: { region } })).data,
    enabled: region !== undefined,
    staleTime: 5 * 60 * 1000,
  })

  const listed = new Map<number, StorePlace>()
  if (Array.isArray(regionStores.data)) {
    for (const row of regionStores.data as unknown[]) {
      if (isStorePlace(row)) listed.set(row.storeId, row)
    }
  }
  // 목록을 다 읽기 전에는 상세를 묻지 않는다. 목록을 못 읽으면(지역을 모름·오류) 상세로 읽는다
  const waiting = region === undefined ? current.isPending : regionStores.isPending
  const detailIds = waiting ? [] : storeIds.filter((id) => id !== currentStoreId && !listed.has(id))
  const details = useQueries({
    queries: detailIds.map((storeId) => ({
      queryKey: ['customer', 'stores', storeId, 'detail'],
      queryFn: async () => (await api.get<StoreDetail>(`/stores/${storeId}`)).data,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const places = new Map<number, StorePlace>(listed)
  if (isStorePlace(current.data)) places.set(currentStoreId, current.data)
  details.forEach((r, i) => {
    if (isStorePlace(r.data)) places.set(detailIds[i], r.data)
  })
  return { places, isPending: waiting || details.some((r) => r.isPending) }
}
