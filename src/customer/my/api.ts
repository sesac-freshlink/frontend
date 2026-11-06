import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProfileResponse } from '@/auth/api'
import type { RegionCode } from '@/auth/regions'
import { api } from '@/shared/api/client'

/** MB-04 요청 (추가 명세 A3). 바꿀 칸만 보낸다. 이메일은 바꿀 수 없다 */
export interface UpdateProfileRequest {
  name?: string
  nickname?: string
  region?: RegionCode
}

/** MB-04 고객 회원정보 수정. 성공하면 MB-03 내 정보 캐시를 다시 읽는다 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateProfileRequest) =>
      (await api.patch<ProfileResponse>('/members/me', body)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

/** MB-05 고객 회원탈퇴 (추가 명세 A6). 204. 진행 중 주문이 있으면 409 WITHDRAWAL_BLOCKED_ACTIVE_ORDER */
export function useWithdraw() {
  return useMutation({
    mutationFn: async () => {
      await api.delete('/members/me')
    },
  })
}
