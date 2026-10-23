import { http, HttpResponse } from 'msw'
import type {
  AdminErrorBody,
  AdminStore,
  CreateAdminStoreRequest,
  PageResponse,
  UpdateAdminStoreRequest,
} from '@/admin/stores/api'
import { ADMIN_STORE_PAGE_SIZE } from '@/admin/stores/api'
import { isRegionCode, REGION_CODES } from '@/auth/regions'

/** member-service 가짜 API (김경우): AD-01~03 관리자 점포 등록·목록·수정 */

/** 1~3번은 고객 점포 검색(memberHandlers)의 가짜 점포와 같게 둔다 */
const FIRST_STORES: Record<number, Pick<AdminStore, 'name' | 'address' | 'region'>> = {
  1: { name: '프레시 강남점', address: '서울 강남구 테헤란로 1', region: 'SEOUL' },
  2: { name: '프레시 역삼점', address: '서울 강남구 역삼로 2', region: 'SEOUL' },
  3: { name: '프레시 해운대점', address: '부산 해운대구 해운대로 3', region: 'BUSAN' },
}

function seedStore(id: number): AdminStore {
  const base = FIRST_STORES[id] ?? {
    name: `프레시 ${id}호점`,
    address: `테스트시 ${id}번길`,
    region: REGION_CODES[(id - 1) % REGION_CODES.length],
  }
  const status = id === 20 ? 'PENDING' : id === 7 || id === 12 ? 'INACTIVE' : 'ACTIVE'
  return {
    storeId: id,
    storeCode: `S${id}`,
    ...base,
    status,
    ownerEmail: status === 'PENDING' ? null : `owner${id}@test.com`,
    createdAt: `2026-10-${String(id).padStart(2, '0')}T10:00:00+09:00`,
  }
}

function seedStores(): AdminStore[] {
  return Array.from({ length: 21 }, (_, i) => seedStore(21 - i))
}

// 최신 등록이 맨 앞 (등록일 내림차순)
let stores: AdminStore[] = seedStores()
let nextId = 22

/** 테스트 전용: 가짜 DB를 처음 상태로 되돌린다 */
export function resetAdminStores(): void {
  stores = seedStores()
  nextId = 22
}

/** 실행 환경 시간대와 무관하게 한국 시각(+09:00) 문자열을 만든다 */
function nowKst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().replace(/\.\d{3}Z$/, '+09:00')
}

function error(status: number, code: string, message: string) {
  return HttpResponse.json<AdminErrorBody>({ code, message, traceId: 'mock' }, { status })
}

function isValidName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 30
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export const adminHandlers = [
  http.get('/api/admin/stores', ({ request }) => {
    const raw = Number(new URL(request.url).searchParams.get('page') ?? '0')
    const page = Number.isInteger(raw) && raw >= 0 ? raw : 0
    const start = page * ADMIN_STORE_PAGE_SIZE
    const body: PageResponse<AdminStore> = {
      content: stores.slice(start, start + ADMIN_STORE_PAGE_SIZE),
      page,
      size: ADMIN_STORE_PAGE_SIZE,
      totalElements: stores.length,
      totalPages: Math.ceil(stores.length / ADMIN_STORE_PAGE_SIZE),
    }
    return HttpResponse.json(body)
  }),
  http.post('/api/admin/stores', async ({ request }) => {
    const req = (await request.json()) as Partial<CreateAdminStoreRequest>
    // 초기 비밀번호는 있는지만 본다. 저장·출력·응답에 넣지 않는다
    const hasPassword = typeof req.initialPassword === 'string' && req.initialPassword.length > 0
    if (!isValidName(req.name)) return error(400, 'VALIDATION_ERROR', '점포명은 2~30자입니다')
    if (
      !isNonBlank(req.address) ||
      !isRegionCode(req.region) ||
      !isNonBlank(req.ownerEmail) ||
      !hasPassword
    ) {
      return error(400, 'VALIDATION_ERROR', '필수 항목을 입력해 주세요')
    }
    const name = req.name.trim()
    const ownerEmail = req.ownerEmail
    if (stores.some((s) => s.name === name)) {
      return error(409, 'STORE_NAME_DUPLICATED', '이미 있는 점포명입니다')
    }
    if (stores.some((s) => s.ownerEmail?.toLowerCase() === ownerEmail.toLowerCase())) {
      return error(409, 'OWNER_EMAIL_DUPLICATED', '이미 등록된 이메일입니다')
    }
    const id = nextId++
    const created: AdminStore = {
      storeId: id,
      storeCode: `S${id}`,
      name,
      address: req.address.trim(),
      region: req.region,
      status: 'ACTIVE',
      ownerEmail,
      createdAt: nowKst(),
    }
    // 이름에 '실패'가 들어가면 점주 계정 생성 실패를 흉내 낸다 (PENDING 점포가 남는다)
    if (name.includes('실패')) {
      stores = [{ ...created, status: 'PENDING', ownerEmail: null }, ...stores]
      return error(500, 'STORE_REGISTRATION_FAILED', '점포 등록에 실패했습니다. 다시 시도해 주세요')
    }
    stores = [created, ...stores]
    return HttpResponse.json(created, { status: 201 })
  }),
  http.patch('/api/admin/stores/:storeId', async ({ params, request }) => {
    const storeId = Number(params.storeId)
    const found = stores.find((s) => s.storeId === storeId)
    if (!found) return error(404, 'STORE_NOT_FOUND', '점포가 없습니다')
    if (found.status === 'PENDING') {
      return error(409, 'STORE_NOT_EDITABLE', '등록 중인 점포는 수정할 수 없습니다')
    }
    const req = (await request.json()) as Partial<UpdateAdminStoreRequest>
    if (req.name === undefined && req.address === undefined && req.region === undefined) {
      return error(400, 'VALIDATION_ERROR', '바꿀 항목이 없습니다')
    }
    if (req.name !== undefined && !isValidName(req.name)) {
      return error(400, 'VALIDATION_ERROR', '점포명은 2~30자입니다')
    }
    if (req.address !== undefined && !isNonBlank(req.address)) {
      return error(400, 'VALIDATION_ERROR', '주소를 입력해 주세요')
    }
    if (req.region !== undefined && !isRegionCode(req.region)) {
      return error(400, 'VALIDATION_ERROR', '시도 코드가 올바르지 않습니다')
    }
    const name = req.name?.trim()
    if (name !== undefined && stores.some((s) => s.storeId !== storeId && s.name === name)) {
      return error(409, 'STORE_NAME_DUPLICATED', '이미 있는 점포명입니다')
    }
    const updated: AdminStore = {
      ...found,
      ...(name !== undefined && { name }),
      ...(req.address !== undefined && { address: req.address.trim() }),
      ...(req.region !== undefined && { region: req.region }),
    }
    stores = stores.map((s) => (s.storeId === storeId ? updated : s))
    return HttpResponse.json(updated)
  }),
]
