import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RegionCode } from '@/auth/regions'
import { api } from '@/shared/api/client'

/** 점포 상태 (member-service API 명세 0장) */
export type StoreStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE'

/** AD-01 201 응답 = AD-02 한 줄 = AD-03 200 응답 */
export interface AdminStore {
  storeId: number
  storeCode: string
  name: string
  address: string
  region: RegionCode
  status: StoreStatus
  /** PENDING 이면 null 일 수 있다 */
  ownerEmail: string | null
  /** ISO-8601 +09:00 */
  createdAt: string
  /** 점포 상세 값. 아직 넣지 않았으면 null */
  latitude: number | null
  longitude: number | null
  description: string | null
  /** 같은 주소의 /images/stores/... 경로. 없으면 null */
  imageUrl: string | null
}

/** AD-01 요청. initialPassword 는 이 요청 본문에만 싣는다 */
export interface CreateAdminStoreRequest {
  name: string
  address: string
  region: RegionCode
  ownerEmail: string
  initialPassword: string
}

/** AD-03 요청. 보낸 필드만 바뀐다. imageKey 는 업로드 주소 발급에서 받은 키 */
export interface UpdateAdminStoreRequest {
  name?: string
  address?: string
  region?: RegionCode
  latitude?: number
  longitude?: number
  description?: string
  imageKey?: string
}

/** 점포 이미지 업로드 주소 (member-service POST /admin/stores/{storeId}/image-upload-url). 5분 유효 */
export interface StoreImageUploadUrl {
  /** S3 presigned PUT 주소 (외부 주소). 이 주소에만 브라우저가 바로 올린다 */
  uploadUrl: string
  imageKey: string
  imageUrl: string
  /** 서명에 들어간 형식. PUT 때 이 Content-Type 을 그대로 보내야 한다 */
  contentType: string
  expiresAt: string
}

/** 점포 이미지 형식 (서버가 키를 .jpg 로 정하고 Content-Type image/jpeg 로 서명한다) */
export const STORE_IMAGE_TYPE = 'image/jpeg'

/** 페이지 응답 형식 (member-service API 명세 0장) */
export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** 서비스 공통 오류 본문 (member-service API 명세 0장). MSW 응답 타입에 쓴다 */
export interface AdminErrorBody {
  code: string
  message: string
  traceId: string
}

/** AD-02 페이지 크기 (서버가 20으로 고정한다) */
export const ADMIN_STORE_PAGE_SIZE = 20

/** A-02 관리자 점포 목록 (member-service AD-02). 0부터, 20개, 등록일 최신순(서버 정렬) */
export function useAdminStores(page: number) {
  return useQuery({
    queryKey: ['admin', 'stores', page],
    queryFn: async () =>
      (await api.get<PageResponse<AdminStore>>('/admin/stores', { params: { page } })).data,
    placeholderData: keepPreviousData,
  })
}

/** A-01 점포·점주 등록 (member-service AD-01). 비밀번호가 담긴 요청 값이 캐시에 남지 않게 gcTime 0 */
export function useCreateAdminStore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateAdminStoreRequest) =>
      (await api.post<AdminStore>('/admin/stores', body)).data,
    gcTime: 0,
    // 실패(500)해도 서버에 PENDING 점포가 남을 수 있어 성공·실패 모두 목록을 다시 받는다
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin', 'stores'] }),
  })
}

/** A-02 점포 정보 수정 (member-service AD-03). 이름·주소·시도 중 바뀐 칸만 보낸다 */
export function useUpdateAdminStore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ storeId, body }: { storeId: number; body: UpdateAdminStoreRequest }) =>
      (await api.patch<AdminStore>(`/admin/stores/${storeId}`, body)).data,
    // 성공·409·404 모두 목록이 바뀌었을 수 있어 다시 받는다
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin', 'stores'] }),
  })
}

/**
 * 점포 이미지 올리기: 업로드 주소를 받고(member) 그 주소로 파일을 바로 PUT 한다(S3). 키를 돌려준다.
 * S3 주소는 우리 API 가 아니라 api 인스턴스(baseURL·쿠키·CSRF 헤더)를 쓰지 않고 fetch 로 보낸다.
 * 키는 점포 수정(AD-03)의 imageKey 로 저장해야 화면에 나온다
 */
export function useUploadStoreImage() {
  return useMutation({
    mutationFn: async ({ storeId, file }: { storeId: number; file: File }) => {
      const issued = (
        await api.post<StoreImageUploadUrl>(`/admin/stores/${storeId}/image-upload-url`)
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
