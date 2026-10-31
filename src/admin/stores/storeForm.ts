import { z } from 'zod'
import { isRegionCode, REGION_CODES } from '@/auth/regions'
import type { AdminStore, UpdateAdminStoreRequest } from './api'

// 점주 계정은 Cognito 에 만들어지므로 가입 화면(signupSchema.ts)과 같은 비밀번호 규칙을 쓴다
/** Cognito 비밀번호 정책이 특수문자로 인정하는 문자 (공백 포함) */
const SPECIAL = /[$^*.[\]{}()?"!@#%&/\\,><':;|_~`=+\- ]/
/** 비밀번호에 넣을 수 있는 문자: 영문·숫자·위 특수문자 */
const PASSWORD_CHARS = /^[A-Za-z0-9$^*.[\]{}()?"!@#%&/\\,><':;|_~`=+\- ]+$/

/** A-01 등록·A-02 수정 공통 입력 규칙 (member-service AD-01·AD-03) */
export const storeEditSchema = z.object({
  name: z.string().trim().min(2, '2~30자로 입력하세요').max(30, '2~30자로 입력하세요'),
  address: z.string().trim().min(1, '주소를 입력하세요'),
  region: z.enum(REGION_CODES, { error: '시도를 고르세요' }),
})

/** 좌표 칸: 비우면 바꾸지 않고, 쓰면 범위 안의 소수 6자리 이하 숫자 (member-service AD-03) */
function coordinate(min: number, max: number) {
  return z
    .string()
    .trim()
    .refine(
      (v) =>
        v === '' || (/^-?\d{1,3}(\.\d{1,6})?$/.test(v) && Number(v) >= min && Number(v) <= max),
      {
        message: `${min}~${max} 사이 숫자(소수 6자리까지)로 입력하세요`,
      },
    )
}

/** A-02 수정 입력: 기본 칸 + 점포 상세(좌표·설명). 이미지는 따로 올린다 */
export const storeDetailEditSchema = storeEditSchema.extend({
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  description: z.string().trim().max(500, '500자 이하로 입력하세요'),
})

/** A-01 점포·점주 등록 입력 (member-service AD-01) */
export const storeRegisterSchema = storeEditSchema.extend({
  ownerEmail: z.email('이메일 형식이 아닙니다'),
  initialPassword: z
    .string()
    .min(8, '8자 이상 입력하세요')
    .regex(PASSWORD_CHARS, '영문·숫자·특수문자만 쓸 수 있어요')
    .regex(/[a-z]/, '소문자를 넣어 주세요')
    .regex(/[A-Z]/, '대문자를 넣어 주세요')
    .regex(/\d/, '숫자를 넣어 주세요')
    .regex(SPECIAL, '특수문자를 넣어 주세요'),
})

export type StoreEditForm = z.input<typeof storeDetailEditSchema>
export type StoreEditValues = z.output<typeof storeDetailEditSchema>
export type StoreRegisterForm = z.input<typeof storeRegisterSchema>
export type StoreRegisterValues = z.output<typeof storeRegisterSchema>

/** 수정 모달의 처음 값. 비어 있는 점포 상세 값은 빈 칸으로 둔다 */
export function storeEditDefaults(store: AdminStore): StoreEditForm {
  return {
    name: store.name,
    address: store.address,
    region: store.region,
    latitude: store.latitude === null ? '' : String(store.latitude),
    longitude: store.longitude === null ? '' : String(store.longitude),
    description: store.description ?? '',
  }
}

/**
 * A-02 수정 요청 본문을 만든다. AD-03 은 보낸 필드만 바꾸므로 처음 값과 다른 칸만 담는다.
 * 이름·주소·설명은 앞뒤 공백을 뺀 뒤 비교하고, 시도가 시도 코드가 아니면 넣지 않는다 (입력 중 값에도 쓴다).
 * 좌표는 빈 칸이거나 숫자가 아니면 넣지 않는다(서버는 보낸 값만 바꾸므로 지우기는 없다).
 * imageKey 는 이번에 새로 올린 이미지가 있을 때만 넣는다
 */
export function buildStorePatch(
  original: Pick<
    AdminStore,
    'name' | 'address' | 'region' | 'latitude' | 'longitude' | 'description'
  >,
  input: {
    name: string
    address: string
    region: string
    latitude?: string
    longitude?: string
    description?: string
  },
  imageKey?: string,
): UpdateAdminStoreRequest {
  const patch: UpdateAdminStoreRequest = {}
  const name = input.name.trim()
  const address = input.address.trim()
  if (name !== original.name.trim()) patch.name = name
  if (address !== original.address.trim()) patch.address = address
  if (isRegionCode(input.region) && input.region !== original.region) patch.region = input.region
  const latitude = toCoordinate(input.latitude)
  if (latitude !== undefined && latitude !== original.latitude) patch.latitude = latitude
  const longitude = toCoordinate(input.longitude)
  if (longitude !== undefined && longitude !== original.longitude) patch.longitude = longitude
  const description = input.description?.trim()
  if (
    description !== undefined &&
    description !== '' &&
    description !== (original.description ?? '')
  ) {
    patch.description = description
  }
  if (imageKey !== undefined) patch.imageKey = imageKey
  return patch
}

function toCoordinate(raw: string | undefined): number | undefined {
  const v = raw?.trim()
  if (v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
