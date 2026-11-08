import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RegionCode } from '@/auth/regions'
import { api } from '@/shared/api/client'
import type { StoreImageType } from '@/shared/storeImage'

/** 점포 상태 (member-service API 명세 0장) */
export type OwnerStoreStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE'

/** OW-01·02 응답 (member-service API 명세 5장). 값이 아직 없으면 null */
export interface OwnerStore {
  storeId: number
  name: string
  address: string
  region: RegionCode
  latitude: number | null
  longitude: number | null
  description: string | null
  /** 같은 주소의 /images/stores/... 경로. 없으면 null */
  imageUrl: string | null
  status: OwnerStoreStatus
}

/** OW-02 요청. 점주는 설명·이미지 키만 보낸다(보낸 칸만 바뀐다) */
export interface UpdateOwnerStoreRequest {
  description?: string
  imageKey?: string
}

/** OW-03 응답. 5분 유효 */
export interface OwnerStoreImageUploadUrl {
  /** S3 presigned PUT 주소 (외부 주소). 이 주소에만 브라우저가 바로 올린다 */
  uploadUrl: string
  imageKey: string
  imageUrl: string
  /** 서명에 들어간 형식. PUT 때 이 Content-Type 을 그대로 보내야 한다 */
  contentType: string
  expiresAt: string
}

const OWNER_STORE_KEY = ['owner', 'store'] as const

/** OW-01 내 점포 (member-service GET /owner/store, 추가 명세 A15) */
export function useOwnerStore() {
  return useQuery({
    queryKey: OWNER_STORE_KEY,
    queryFn: async () => (await api.get<OwnerStore>('/owner/store')).data,
  })
}

/** OW-02 내 점포 수정 (설명·이미지만) */
export function useUpdateOwnerStore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateOwnerStoreRequest) =>
      (await api.patch<OwnerStore>('/owner/store', body)).data,
    // 다시 읽기가 실패해도 화면이 저장 전 값으로 돌아가지 않게 응답을 먼저 넣는다
    onSuccess: (saved) => queryClient.setQueryData(OWNER_STORE_KEY, saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: OWNER_STORE_KEY }),
  })
}

/**
 * OW-03 → S3 PUT: 업로드 주소를 받고(member) 그 주소로 파일을 바로 올린다. 키를 돌려준다.
 * S3 주소는 우리 API 가 아니라 api 인스턴스(baseURL·쿠키·CSRF 헤더)를 쓰지 않고 fetch 로 보낸다 (관리자와 같다)
 */
export function useUploadOwnerStoreImage() {
  return useMutation({
    mutationFn: async ({ file, contentType }: { file: File; contentType: StoreImageType }) => {
      const issued = (
        await api.post<OwnerStoreImageUploadUrl>('/owner/store/image-upload-url', { contentType })
      ).data
      const res = await fetch(issued.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': issued.contentType },
        body: file,
      })
      if (!res.ok) throw new Error(`이미지 업로드 실패 ${res.status}`)
      return issued
    },
  })
}
