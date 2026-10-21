import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '@/shared/api/client'
import { useAuthStore } from '@/shared/auth'
import type { RegionCode } from './regions'

/** MB-01 응답 */
export interface NicknameAvailability {
  nickname: string
  available: boolean
}

/** MB-02 요청 */
export interface RegisterProfileRequest {
  name: string
  nickname: string
  region: RegionCode
}

/** MB-02 응답 */
export interface ProfileResponse {
  memberId: string
  role: 'CUSTOMER'
  name: string
  nickname: string
  region: RegionCode
  createdAt: string
}

/** MB-03 응답 (고객). 역할에 없는 칸은 오지 않는다 */
export interface CustomerMe {
  memberId: string
  role: 'CUSTOMER'
  name: string
  nickname: string
  region: RegionCode
}

/** MB-03 응답 (점주). 표시 이름은 점포명 */
export interface OwnerMe {
  memberId: string
  role: 'OWNER'
  email: string
  storeId?: number
  storeCode?: string
  storeName?: string
  region?: RegionCode
}

export type MyProfile = CustomerMe | OwnerMe

/** 서비스 공통 오류 본문 {code, message, traceId} 에서 code 를 꺼낸다 */
export function apiErrorCode(e: unknown): string | undefined {
  if (!axios.isAxiosError(e)) return undefined
  const data: unknown = e.response?.data
  if (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    typeof data.code === 'string'
  ) {
    return data.code
  }
  return undefined
}

/** 사용자마다 따로 캐시한다 (로그아웃 뒤 다른 계정으로 들어와도 섞이지 않게) */
export const myProfileKey = (userId: string | undefined) => ['auth', 'me', userId ?? 'anonymous']

/** MB-03 내 정보. 프로필이 없으면(404 MEMBER_PROFILE_NOT_FOUND) null */
export async function fetchMyProfile(): Promise<MyProfile | null> {
  try {
    return (await api.get<MyProfile>('/members/me')).data
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null
    throw e
  }
}

/** MB-03 내 정보 조회. 로그인한 사용자만 부른다 */
export function useMyProfile() {
  const userId = useAuthStore((s) => s.user?.userId)
  return useQuery({
    queryKey: myProfileKey(userId),
    queryFn: fetchMyProfile,
    enabled: userId !== undefined,
  })
}

/** 로그인 직후 프로필이 있는지 바로 확인할 때 쓴다 (MB-03) */
export function useLoadMyProfile() {
  const queryClient = useQueryClient()
  return (userId: string) =>
    queryClient.fetchQuery({
      queryKey: myProfileKey(userId),
      queryFn: fetchMyProfile,
      staleTime: 0,
    })
}

/** MB-01 닉네임 중복 확인 (가입 전 미리 확인. 최종 검사는 MB-02 저장 때) */
export function useCheckNickname() {
  return useMutation({
    mutationFn: async (nickname: string) =>
      (
        await api.get<NicknameAvailability>('/members/nickname-availability', {
          params: { nickname },
        })
      ).data,
  })
}

/** MB-02 고객 프로필 등록. 같은 sub 로 다시 보내면 200 으로 기존 프로필을 받는다 */
export function useRegisterProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: RegisterProfileRequest) =>
      (await api.post<ProfileResponse>('/members/me', body)).data,
    onSuccess: () => {
      // 프로필이 생겼으니 MB-03 캐시를 버린다 (어느 사용자든 'auth','me' 아래 전부)
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
