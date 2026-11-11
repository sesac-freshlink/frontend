import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

/**
 * 홈 메인 배너 한 장.
 * 미확정(member 배너 V6 전): 기능 정의 문서 기준 GET /api/members/banners 의 응답 모양으로 둔다.
 * noticeId 가 있으면 누를 때 그 공지로 간다
 */
export interface HomeBanner {
  bannerId: number
  title: string
  imageUrl: string
  noticeId: number | null
}

/**
 * 홈 메인 배너 목록. 미확정(member 배너 V6 전) — 서버에 아직 없으면 404 가 오고 홈은 배너 칸을 숨긴다.
 * 없는 API 를 여러 번 부르지 않게 다시 시도하지 않는다
 */
export function useHomeBanners() {
  return useQuery({
    queryKey: ['customer', 'banners'],
    queryFn: async () => (await api.get<HomeBanner[]>('/members/banners')).data,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
