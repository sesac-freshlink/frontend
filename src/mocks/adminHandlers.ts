import { http, HttpResponse } from 'msw'
import type {
  AdminErrorBody,
  AdminStore,
  CreateAdminStoreRequest,
  PageResponse,
  StoreImageUploadUrl,
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
  // 점포 검색 지도(11/11)에 핀이 여러 개 보이게 서울 점포 셋을 더 둔다
  4: { name: '프레시 선릉점', address: '서울 강남구 선릉로 4', region: 'SEOUL' },
  5: { name: '프레시 삼성점', address: '서울 강남구 삼성로 5', region: 'SEOUL' },
  6: { name: '프레시 논현점', address: '서울 강남구 논현로 6', region: 'SEOUL' },
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
    ...storeDetailSeed(id),
  }
}

/** 1번 점포는 점포 상세 값(좌표·설명·이미지)을, 2번 점포는 좌표만 채워 둔다. 고객 점포 상세(memberHandlers)가 같은 값을 읽는다 */
function storeDetailSeed(
  id: number,
): Pick<AdminStore, 'latitude' | 'longitude' | 'description' | 'imageUrl'> {
  return id === 1
    ? {
        latitude: 37.498095,
        longitude: 127.02761,
        description: '강남역 11번 출구에서 200m. 24시간 운영해요',
        imageUrl: '/mock-store.svg',
      }
    : id === 2
      ? // 홈 '내 주변 점포' 거리가 두 곳 이상 보이게 역삼점에도 좌표를 둔다
        { latitude: 37.500622, longitude: 127.036456, description: null, imageUrl: null }
      : (MAP_SEED[id] ?? { latitude: null, longitude: null, description: null, imageUrl: null })
}

/** 점포 검색 지도용 좌표(11/11). 강남역 둘레 */
const MAP_SEED: Record<
  number,
  Pick<AdminStore, 'latitude' | 'longitude' | 'description' | 'imageUrl'>
> = {
  // 해운대점: 더 가까운 점포 안내(11/14)를 가짜 API 로 볼 수 있게 좌표를 둔다
  3: { latitude: 35.1631, longitude: 129.1636, description: null, imageUrl: null },
  4: { latitude: 37.504503, longitude: 127.049008, description: null, imageUrl: null },
  5: { latitude: 37.508844, longitude: 127.06316, description: null, imageUrl: null },
  6: { latitude: 37.511093, longitude: 127.021415, description: null, imageUrl: null },
}

/** 고객 점포 상세(memberHandlers)용: 운영 중 점포 한 건. 관리자 수정이 바로 보이게 같은 가짜 DB를 읽는다 */
export function findActiveStore(storeId: number): AdminStore | undefined {
  return stores.find((s) => s.storeId === storeId && s.status === 'ACTIVE')
}

/** 가짜 S3 업로드 주소 (MSW가 PUT 을 받는다) */
export const MOCK_S3 = 'https://freshlink-mock-frontend.s3.ap-northeast-2.amazonaws.com'
/** 점포 이미지 형식 → 키 확장자 (member StoreImageUploads 와 같다) */
export const MOCK_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
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
      latitude: null,
      longitude: null,
      description: null,
      imageUrl: null,
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
    if (
      req.name === undefined &&
      req.address === undefined &&
      req.region === undefined &&
      req.latitude === undefined &&
      req.longitude === undefined &&
      req.description === undefined &&
      req.imageKey === undefined
    ) {
      return error(400, 'VALIDATION_ERROR', '바꿀 항목이 없습니다')
    }
    if (req.latitude !== undefined && (req.latitude < -90 || req.latitude > 90)) {
      return error(400, 'VALIDATION_ERROR', 'latitude: -90~90이어야 합니다')
    }
    if (req.longitude !== undefined && (req.longitude < -180 || req.longitude > 180)) {
      return error(400, 'VALIDATION_ERROR', 'longitude: -180~180이어야 합니다')
    }
    if (req.imageKey !== undefined && !req.imageKey.startsWith(`images/stores/${storeId}/`)) {
      return error(400, 'STORE_IMAGE_KEY_INVALID', '이 점포에 발급한 이미지 키가 아닙니다')
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
      ...(req.latitude !== undefined && { latitude: req.latitude }),
      ...(req.longitude !== undefined && { longitude: req.longitude }),
      ...(req.description !== undefined && { description: req.description.trim() }),
      // 가짜 S3 에는 실제 파일이 없어 미리 넣어 둔 그림으로 보여 준다
      ...(req.imageKey !== undefined && { imageUrl: '/mock-store.svg' }),
    }
    stores = stores.map((s) => (s.storeId === storeId ? updated : s))
    return HttpResponse.json(updated)
  }),
  http.post('/api/admin/stores/:storeId/image-upload-url', async ({ params, request }) => {
    const storeId = Number(params.storeId)
    // 본문이 없거나 contentType 이 없으면 서버처럼 image/jpeg
    const req = (await request.json().catch(() => null)) as { contentType?: string } | null
    const contentType = req?.contentType || 'image/jpeg'
    const extension = MOCK_IMAGE_EXTENSIONS[contentType]
    const found = stores.find((s) => s.storeId === storeId)
    if (!found) return error(404, 'STORE_NOT_FOUND', '점포가 없습니다')
    if (found.status === 'PENDING') {
      return error(409, 'STORE_NOT_EDITABLE', '등록 중인 점포는 수정할 수 없습니다')
    }
    if (!extension) {
      return error(400, 'STORE_IMAGE_TYPE_INVALID', '점포 이미지는 JPG나 PNG만 올릴 수 있습니다')
    }
    const imageKey = `images/stores/${storeId}/${crypto.randomUUID()}${extension}`
    const body: StoreImageUploadUrl = {
      uploadUrl: `${MOCK_S3}/${imageKey}?X-Amz-Expires=300`,
      imageKey,
      imageUrl: `/${imageKey}`,
      contentType,
      expiresAt: nowKst(),
    }
    return HttpResponse.json(body)
  }),
  // S3 처럼 서명한 형식(키 확장자)과 Content-Type 이 다르면 거절한다
  http.put(`${MOCK_S3}/images/stores/*`, ({ request }) => {
    const extension = MOCK_IMAGE_EXTENSIONS[request.headers.get('Content-Type') ?? '']
    return extension && new URL(request.url).pathname.endsWith(extension)
      ? new HttpResponse(null, { status: 200 })
      : new HttpResponse(null, { status: 403 })
  }),
]
