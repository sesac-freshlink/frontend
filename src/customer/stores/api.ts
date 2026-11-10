import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useQueries } from '@tanstack/react-query'
import type { RegionCode } from '@/auth/regions'
import { api } from '@/shared/api/client'

/** ST-01 응답 한 줄 */
export interface StoreSummary {
  storeId: number
  storeCode: string
  name: string
  address: string
  region: RegionCode
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
  /** 먼저 받게 될 상품의 유통기한(+09:00). 유통기한 빠른 것부터 준다. 품절이면 null */
  nearestExpiry: string | null
  /**
   * 마감세일(유통기한 24시간 안, 30% 할인) 수량. 판매 시간(06~23시) 밖이거나 선착순 상품이면 0.
   * availableQuantity 는 마감세일을 뺀 기본 수량이다. inventory 가 마감세일을 배포하기 전에는 오지 않는다
   */
  clearanceQuantity?: number
  /** 마감세일 단가(원). clearanceQuantity 가 0이면 null */
  clearancePrice?: number | null
  /** 마감세일 상품의 유통기한(+09:00). clearanceQuantity 가 0이면 null */
  clearanceExpiry?: string | null
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
  /** 먼저 받게 될 상품의 유통기한(+09:00) */
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

/**
 * 여러 점포의 상세(이름·지역·좌표)를 한 번에 읽는다. useStoreDetail 과 같은 queryKey 라 이미 읽은 점포는 다시 묻지 않는다.
 * 점포 목록 API 에 좌표가 생기면 그걸 쓰도록 바꾼다. 읽은 점포만 Map 으로 돌려준다
 */
export function useStoreDetails(storeIds: number[]): ReadonlyMap<number, StoreDetail> {
  const results = useQueries({
    queries: storeIds.map((storeId) => ({
      queryKey: ['customer', 'stores', storeId, 'detail'],
      queryFn: async () => (await api.get<StoreDetail>(`/stores/${storeId}`)).data,
      staleTime: 5 * 60 * 1000,
    })),
  })
  const map = new Map<number, StoreDetail>()
  results.forEach((r, i) => {
    if (r.data && typeof r.data === 'object' && 'storeId' in r.data) map.set(storeIds[i], r.data)
  })
  return map
}
