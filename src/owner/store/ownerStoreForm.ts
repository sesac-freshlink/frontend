import axios from 'axios'
import { apiErrorCode } from '@/shared/api/errors'
import { isStoreImageType } from '@/shared/storeImage'
import type { OwnerStore, UpdateOwnerStoreRequest } from './api'

/** 점주 화면에서만 검사하는 사진 크기 (서버는 검사하지 않는다, 추가 명세 A15) */
export const OWNER_STORE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const DESCRIPTION_MAX = 500

export const OWNER_STORE_TEXT = {
  saved: '점포 정보를 수정했어요',
  saveFailed: '점포 정보를 수정하지 못했어요. 다시 시도해 주세요',
  loadFailed: '내 점포 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요',
  imageType: 'JPG나 PNG 이미지만 올릴 수 있어요',
  imageTooBig: '5MB 이하 사진만 올릴 수 있어요',
  imageUploadFailed: '사진을 올리지 못했어요. 다시 시도해 주세요',
  descriptionTooLong: `${DESCRIPTION_MAX}자까지 쓸 수 있어요`,
  adminOnly: '관리자만 바꿀 수 있어요',
} as const

/** 오류 코드별 고정 문구 (member-service API 명세 5·6장) */
const ERROR_TEXT: Record<string, string> = {
  STORE_NOT_FOUND: '연결된 점포가 없습니다',
  STORE_NOT_EDITABLE: '등록 중인 점포는 수정할 수 없습니다',
  STORE_IMAGE_KEY_INVALID: '이 점포에 발급한 이미지 키가 아닙니다',
  STORE_IMAGE_TYPE_INVALID: '점포 이미지는 JPG나 PNG만 올릴 수 있습니다',
  FORBIDDEN: '권한이 없습니다',
}

/** 고른 사진 검사. 문제없으면 null, 아니면 화면 문구 */
export function imageFileError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!isStoreImageType(file.type)) return OWNER_STORE_TEXT.imageType
  if (file.size > OWNER_STORE_IMAGE_MAX_BYTES) return OWNER_STORE_TEXT.imageTooBig
  return null
}

/**
 * OW-02 로 보낼 바뀐 칸만 고른다. 설명은 앞뒤 공백을 지운 값으로 비교하고, 빈 값이면 ""(지움)를 보낸다.
 * 아무것도 안 바뀌었으면 빈 객체
 */
export function ownerStorePatch(
  store: Pick<OwnerStore, 'description'>,
  description: string,
  imageKey?: string,
): UpdateOwnerStoreRequest {
  const patch: UpdateOwnerStoreRequest = {}
  const next = description.trim()
  if (next !== (store.description ?? '')) patch.description = next
  if (imageKey !== undefined) patch.imageKey = imageKey
  return patch
}

/** 서버 오류를 화면 문구로. 입력 검증 오류만 서버 message 를 쓰고 나머지는 code 기준 고정 문구 */
export function ownerStoreErrorMessage(e: unknown, fallback: string): string {
  const code = apiErrorCode(e)
  if (code === undefined) return fallback
  if (code === 'VALIDATION_ERROR') return serverMessage(e) ?? fallback
  return ERROR_TEXT[code] ?? fallback
}

function serverMessage(e: unknown): string | undefined {
  if (!axios.isAxiosError(e)) return undefined
  const data: unknown = e.response?.data
  if (typeof data === 'object' && data !== null && 'message' in data) {
    return typeof data.message === 'string' && data.message.length > 0 ? data.message : undefined
  }
  return undefined
}
