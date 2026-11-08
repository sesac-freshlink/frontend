import { getResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { OwnerStore, OwnerStoreImageUploadUrl } from '@/owner/store/api'
import { resetAdminStores } from './adminHandlers'
import { authHandlers, resetMockSession } from './authHandlers'
import { ownerStoreHandlers, resetOwnerStores } from './ownerStoreHandlers'

const handlers = [...authHandlers, ...ownerStoreHandlers]
const CSRF = { 'X-Requested-With': 'freshlink', 'Content-Type': 'application/json' }

async function call(path: string, init?: RequestInit) {
  const res = await getResponse(handlers, new Request(new URL(path, location.origin), init))
  if (!res) throw new Error(`핸들러 없음: ${path}`)
  return res
}

const login = (email: string) =>
  call('/api/auth/login', {
    method: 'POST',
    headers: CSRF,
    body: JSON.stringify({ email, password: 'x' }),
  })
const patch = (body: unknown) =>
  call('/api/owner/store', { method: 'PATCH', headers: CSRF, body: JSON.stringify(body) })

describe('점주 내 점포 가짜 API (A15, OW-01~03)', () => {
  beforeEach(() => {
    resetMockSession()
    resetAdminStores()
    resetOwnerStores()
  })

  it('점주는 자기 점포(storeId 1)를 받고, 고객은 403', async () => {
    await login('owner@test.com')
    const res = await call('/api/owner/store')
    expect(res.status).toBe(200)
    const store = (await res.json()) as OwnerStore
    expect(store.storeId).toBe(1)
    expect(store).not.toHaveProperty('ownerEmail')

    await login('kim@test.com')
    expect((await call('/api/owner/store')).status).toBe(403)
  })

  it('설명·사진만 바꾸고, 관리자 칸·빈 요청·다른 점포 키는 400', async () => {
    await login('owner@test.com')
    const ok = await patch({ description: ' 새 설명 ' })
    expect(((await ok.json()) as OwnerStore).description).toBe('새 설명')
    expect(((await (await call('/api/owner/store')).json()) as OwnerStore).description).toBe(
      '새 설명',
    )

    expect((await patch({ description: 'x', name: '바꾼이름' })).status).toBe(400)
    expect((await patch({})).status).toBe(400)
    const badKey = await patch({ imageKey: 'images/stores/2/a.jpg' })
    expect(badKey.status).toBe(400)
    expect(await badKey.json()).toMatchObject({ code: 'STORE_IMAGE_KEY_INVALID' })
  })

  it('업로드 주소는 내 점포 키, JPG·PNG 만', async () => {
    await login('owner@test.com')
    const res = await call('/api/owner/store/image-upload-url', {
      method: 'POST',
      headers: CSRF,
      body: JSON.stringify({ contentType: 'image/png' }),
    })
    const issued = (await res.json()) as OwnerStoreImageUploadUrl
    expect(issued.imageKey).toMatch(/^images\/stores\/1\/.+\.png$/)
    expect((await patch({ imageKey: issued.imageKey })).status).toBe(200)

    const gif = await call('/api/owner/store/image-upload-url', {
      method: 'POST',
      headers: CSRF,
      body: JSON.stringify({ contentType: 'image/gif' }),
    })
    expect(gif.status).toBe(400)
  })
})
