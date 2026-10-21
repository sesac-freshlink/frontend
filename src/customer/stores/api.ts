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
