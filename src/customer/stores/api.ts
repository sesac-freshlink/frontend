import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
}

/** U-10 상품 상세. inventory-service StoreProductDetailResponse 와 같은 모양 */
export interface StoreProductDetail extends StoreProduct {
  /** 먼저 받게 될 상품의 유통기한(+09:00). 유통기한 빠른 것부터 준다. 품절이면 null */
  nearestExpiry: string | null
}

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

/**
 * U-10 점포 상품 목록 (inventory-service, 로그인 없이도 된다). 기본은 상품 전부, 상품명순.
 * 검색어(q)·카테고리·추천상품만·신상품만·추천순 정렬은 서버가 처리한다.
 * 폴링하지 않고 화면에 들어올 때·조건을 바꿀 때·새로고침 때만 읽는다. 살 수 있는지는 주문 때 서버가 최종 판정한다
 */
export function useStoreProducts(storeId: number, filter: StoreProductFilter = {}) {
  const params = storeProductParams(filter)
  const url = `/stores/${storeId}/products`
  return useQuery({
    queryKey: ['customer', 'stores', storeId, 'products', params],
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
