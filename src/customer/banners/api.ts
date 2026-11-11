import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

/**
 * 홈 메인 배너 한 장 (member-service BN-01 GET /api/members/banners, 추가 명세 A18).
 * title 은 그림 위에 쓰지 않고 대체 텍스트로만 쓴다. noticeId 가 있으면 누를 때 그 공지로 간다
 */
export interface HomeBanner {
  bannerId: number
  title: string
  imageUrl: string
  noticeId: number | null
}

/**
 * 홈 메인 배너 목록 (로그인한 고객만, 보이기 + 기간 안, 순서대로 최대 5장).
 * 서버에 아직 배포되지 않았으면 404 가 오고 홈은 배너 칸을 숨긴다. 실패한 API 를 여러 번 부르지 않게 다시 시도하지 않는다
 */
export function useHomeBanners() {
  return useQuery({
    queryKey: ['customer', 'banners'],
    queryFn: async () => (await api.get<HomeBanner[]>('/members/banners')).data,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
