import axios from 'axios'
import { apiErrorCode } from '@/auth/api'
import { REGIONS } from '@/auth/regions'
import type { StoreStatus } from './api'

/** A-02 점포 상태 표시 이름 */
export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  PENDING: '등록 중',
  ACTIVE: '운영 중',
  INACTIVE: '운영 중단',
}

/** A-02 점포 상태 배지 색 */
export const STORE_STATUS_BADGE: Record<StoreStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-500',
}

/** 시도 코드를 한글 이름으로 바꾼다. 모르는 값이면 코드를 그대로 보여 준다 */
export function regionName(code: string): string {
  return REGIONS.find((r) => r.code === code)?.name ?? code
}

/** A-01·A-02 화면 안내 문구 */
export const STORE_TEXT = {
  created: '점포를 등록했어요',
  updated: '점포 정보를 수정했어요',
  empty: '등록된 점포가 없어요',
  listError: '점포 목록을 불러오지 못했어요',
  createFailed: '점포를 등록하지 못했어요. 다시 시도해 주세요',
  updateFailed: '점포 정보를 수정하지 못했어요. 다시 시도해 주세요',
} as const

/** 오류 코드별 고정 문구 (member-service API 명세 5장) */
const ERROR_TEXT: Record<string, string> = {
  STORE_NAME_DUPLICATED: '이미 있는 점포명입니다',
  OWNER_EMAIL_DUPLICATED: '이미 등록된 이메일입니다',
  STORE_REGISTRATION_FAILED: '점포 등록에 실패했습니다. 다시 시도해 주세요',
  STORE_NOT_EDITABLE: '등록 중인 점포는 수정할 수 없습니다',
  STORE_NOT_FOUND: '점포가 없습니다',
  FORBIDDEN: '권한이 없습니다',
}

/** 오류 본문의 message 를 꺼낸다 (비어 있으면 undefined) */
function serverMessage(e: unknown): string | undefined {
  if (!axios.isAxiosError(e)) return undefined
  const data: unknown = e.response?.data
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string' &&
    data.message.length > 0
  ) {
    return data.message
  }
  return undefined
}

/** A-01·A-02 서버 오류를 화면 문구로 바꾼다. 입력 검증 오류만 서버 message 를 쓰고 나머지는 code 기준 고정 문구 */
export function storeErrorMessage(e: unknown, fallback: string): string {
  const code = apiErrorCode(e)
  if (code === undefined) return fallback
  if (code === 'VALIDATION_ERROR') return serverMessage(e) ?? fallback
  return ERROR_TEXT[code] ?? fallback
}
