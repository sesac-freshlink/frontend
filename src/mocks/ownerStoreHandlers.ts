import { http, HttpResponse } from 'msw'
import type { OwnerStore, OwnerStoreImageUploadUrl } from '@/owner/store/api'
import { findActiveStore, MOCK_IMAGE_EXTENSIONS, MOCK_S3 } from './adminHandlers'
import { mockSessionUser } from './authHandlers'

/**
 * 점주 내 점포 가짜 API (추가 명세 A15, OW-01~03). 가짜 로그인 점주의 storeId 로 관리자 가짜 점포를 처음 한 번 가져와
 * 점주 쪽 값(설명·사진)만 여기서 바꾼다. 사진 PUT 은 관리자 가짜 S3(MOCK_S3)를 그대로 쓴다
 */
let overrides = new Map<number, Pick<OwnerStore, 'description' | 'imageUrl'>>()

/** 테스트 전용: 점주가 바꾼 값을 지운다 */
export function resetOwnerStores(): void {
  overrides = new Map()
}

interface ErrorBody {
  code: string
  message: string
  traceId: string
}

function error(status: number, code: string, message: string) {
  return HttpResponse.json<ErrorBody>({ code, message, traceId: 'mock' }, { status })
}

/** 가짜 로그인 점주의 점포. 점주가 아니면 403, 점포가 없으면 404 응답 */
function ownerStore(): { store: OwnerStore } | { fail: ReturnType<typeof error> } {
  const user = mockSessionUser()
  if (!user || user.role !== 'OWNER') return { fail: error(403, 'FORBIDDEN', '권한이 없습니다') }
  const found = user.storeId ? findActiveStore(Number(user.storeId)) : undefined
  if (!found) return { fail: error(404, 'STORE_NOT_FOUND', '점포가 없습니다') }
  const base: OwnerStore = {
    storeId: found.storeId,
    name: found.name,
    address: found.address,
    region: found.region,
    latitude: found.latitude,
    longitude: found.longitude,
    description: found.description,
    imageUrl: found.imageUrl,
    status: found.status,
  }
  return { store: { ...base, ...overrides.get(found.storeId) } }
}

const ADMIN_ONLY_FIELDS = ['name', 'address', 'region', 'latitude', 'longitude']

export const ownerStoreHandlers = [
  http.get('/api/owner/store', () => {
    const found = ownerStore()
    return 'fail' in found ? found.fail : HttpResponse.json(found.store)
  }),
  http.patch('/api/owner/store', async ({ request }) => {
    const found = ownerStore()
    if ('fail' in found) return found.fail
    const { store } = found
    const req = (await request.json()) as Record<string, unknown>
    if (ADMIN_ONLY_FIELDS.some((f) => req[f] !== undefined && req[f] !== null)) {
      return error(
        400,
        'VALIDATION_ERROR',
        'ownerFieldsOnly: 점주는 설명·이미지만 바꿀 수 있습니다',
      )
    }
    const description = typeof req.description === 'string' ? req.description.trim() : undefined
    const imageKey = typeof req.imageKey === 'string' ? req.imageKey : undefined
    if (description === undefined && imageKey === undefined) {
      return error(400, 'VALIDATION_ERROR', 'anyField: 바꿀 필드가 하나도 없습니다')
    }
    if (description !== undefined && description.length > 500) {
      return error(400, 'VALIDATION_ERROR', 'description: 500자 이하여야 합니다')
    }
    if (imageKey !== undefined && !imageKey.startsWith(`images/stores/${store.storeId}/`)) {
      return error(400, 'STORE_IMAGE_KEY_INVALID', '이 점포에 발급한 이미지 키가 아닙니다')
    }
    const updated: OwnerStore = {
      ...store,
      ...(description !== undefined && { description }),
      // 가짜 S3 에는 실제 파일이 없어 미리 넣어 둔 그림으로 보여 준다 (관리자 가짜 API 와 같다)
      ...(imageKey !== undefined && { imageUrl: '/mock-store.svg' }),
    }
    overrides.set(store.storeId, { description: updated.description, imageUrl: updated.imageUrl })
    return HttpResponse.json(updated)
  }),
  http.post('/api/owner/store/image-upload-url', async ({ request }) => {
    const found = ownerStore()
    if ('fail' in found) return found.fail
    const { store } = found
    // 본문이 없거나 contentType 이 없으면 서버처럼 image/jpeg
    const req = (await request.json().catch(() => null)) as { contentType?: string } | null
    const contentType = req?.contentType || 'image/jpeg'
    const extension = MOCK_IMAGE_EXTENSIONS[contentType]
    if (!extension) {
      return error(400, 'STORE_IMAGE_TYPE_INVALID', '점포 이미지는 JPG나 PNG만 올릴 수 있습니다')
    }
    const imageKey = `images/stores/${store.storeId}/${crypto.randomUUID()}${extension}`
    const body: OwnerStoreImageUploadUrl = {
      uploadUrl: `${MOCK_S3}/${imageKey}?X-Amz-Expires=300`,
      imageKey,
      imageUrl: `/${imageKey}`,
      contentType,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    }
    return HttpResponse.json(body)
  }),
]
