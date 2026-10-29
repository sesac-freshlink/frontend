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
}

/** 상품 검색어 최대 길이 (inventory-service U-10: 앞뒤 공백을 빼고 50자) */
export const PRODUCT_KEYWORD_MAX = 50

/**
 * U-10 점포 상품 목록 (inventory-service, 로그인 없이도 된다). 상품 전부, 상품명순.
 * keyword 가 있으면 상품명에 들어간 것만 서버가 거른다(q). 검색을 누를 때만 keyword 가 바뀐다.
 * 폴링하지 않고 화면에 들어올 때·검색할 때·새로고침 때만 읽는다. 살 수 있는지는 주문 때 서버가 최종 판정한다
 */
export function useStoreProducts(storeId: number, keyword = '') {
  const trimmed = keyword.trim()
  const url = `/stores/${storeId}/products`
  return useQuery({
    queryKey: ['customer', 'stores', storeId, 'products', trimmed],
    queryFn: async () =>
      (trimmed
        ? await api.get<StoreProduct[]>(url, { params: { q: trimmed } })
        : await api.get<StoreProduct[]>(url)
      ).data,
    // 검색어를 바꾸는 동안 이전 결과를 그대로 둬서 목록이 깜빡이지 않게 한다
    placeholderData: keepPreviousData,
  })
}
