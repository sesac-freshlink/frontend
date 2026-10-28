import { getResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AdminErrorBody, AdminStore, PageResponse } from '@/admin/stores/api'
import { adminHandlers, resetAdminStores } from './adminHandlers'

async function call(path: string, init?: RequestInit) {
  const res = await getResponse(adminHandlers, new Request(new URL(path, location.origin), init))
  if (!res) throw new Error(`핸들러 없음: ${path}`)
  return res
}

function json(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

async function list(page?: string) {
  const res = await call(
    page === undefined ? '/api/admin/stores' : `/api/admin/stores?page=${page}`,
  )
  return (await res.json()) as PageResponse<AdminStore>
}

const newStore = {
  name: '프레시 신사점',
  address: '서울 강남구 신사로 1',
  region: 'SEOUL',
  ownerEmail: 'new-owner@test.com',
  initialPassword: 'Abcd!234',
}

describe('관리자 점포 가짜 API (AD-01~03)', () => {
  beforeEach(() => resetAdminStores())

  describe('AD-02 목록', () => {
    it('0페이지는 20개, 전체 21개, 2페이지', async () => {
      const body = await list('0')
      expect(body.content).toHaveLength(20)
      expect(body).toMatchObject({ page: 0, size: 20, totalElements: 21, totalPages: 2 })
      expect(body.content[0].storeId).toBe(21)
    })

    it('1페이지는 1개', async () => {
      const body = await list('1')
      expect(body.content).toHaveLength(1)
      expect(body.page).toBe(1)
    })

    it('page 가 숫자가 아니면 0페이지', async () => {
      const body = await list('abc')
      expect(body.page).toBe(0)
      expect(body.content).toHaveLength(20)
    })

    it('첫 페이지에 PENDING(이메일 null)·INACTIVE 점포가 섞여 있다', async () => {
      const { content } = await list('0')
      const pending = content.find((s) => s.status === 'PENDING')
      expect(pending?.ownerEmail).toBeNull()
      expect(content.some((s) => s.status === 'INACTIVE')).toBe(true)
    })
  })

  describe('AD-01 등록', () => {
    it('성공하면 201, S22 코드, 다음 목록 맨 앞', async () => {
      const res = await call('/api/admin/stores', json('POST', newStore))
      expect(res.status).toBe(201)
      const created = (await res.json()) as AdminStore
      expect(created).toMatchObject({
        storeId: 22,
        storeCode: 'S22',
        name: '프레시 신사점',
        status: 'ACTIVE',
        ownerEmail: 'new-owner@test.com',
      })
      const { content, totalElements } = await list('0')
      expect(content[0].storeId).toBe(22)
      expect(totalElements).toBe(22)
    })

    it('점포명이 이미 있으면 409 STORE_NAME_DUPLICATED', async () => {
      const res = await call(
        '/api/admin/stores',
        json('POST', { ...newStore, name: ' 프레시 강남점 ' }),
      )
      expect(res.status).toBe(409)
      expect(((await res.json()) as AdminErrorBody).code).toBe('STORE_NAME_DUPLICATED')
    })

    it('점주 이메일이 이미 있으면 (대소문자 무시) 409 OWNER_EMAIL_DUPLICATED', async () => {
      const res = await call(
        '/api/admin/stores',
        json('POST', { ...newStore, ownerEmail: 'OWNER1@test.com' }),
      )
      expect(res.status).toBe(409)
      expect(((await res.json()) as AdminErrorBody).code).toBe('OWNER_EMAIL_DUPLICATED')
    })

    it("이름에 '실패'가 있으면 500 이고 PENDING 점포가 목록 맨 앞에 남는다", async () => {
      const res = await call('/api/admin/stores', json('POST', { ...newStore, name: '실패점' }))
      expect(res.status).toBe(500)
      expect(((await res.json()) as AdminErrorBody).code).toBe('STORE_REGISTRATION_FAILED')
      const { content } = await list('0')
      expect(content[0]).toMatchObject({ name: '실패점', status: 'PENDING', ownerEmail: null })
    })

    it('점포명 규칙 위반·필수 칸 누락은 400 VALIDATION_ERROR', async () => {
      const short = await call('/api/admin/stores', json('POST', { ...newStore, name: '가' }))
      expect(short.status).toBe(400)
      expect(((await short.json()) as AdminErrorBody).code).toBe('VALIDATION_ERROR')
      const noPassword = await call(
        '/api/admin/stores',
        json('POST', { ...newStore, initialPassword: '' }),
      )
      expect(noPassword.status).toBe(400)
    })

    it('보낸 초기 비밀번호는 등록 응답과 이후 목록 응답 어디에도 나오지 않는다', async () => {
      const created = await (await call('/api/admin/stores', json('POST', newStore))).text()
      await call(
        '/api/admin/stores',
        json('POST', { ...newStore, name: '실패점', ownerEmail: 'x@test.com' }),
      )
      const page0 = await (await call('/api/admin/stores?page=0')).text()
      const page1 = await (await call('/api/admin/stores?page=1')).text()
      for (const text of [created, page0, page1]) {
        expect(text).not.toContain('Abcd!234')
        expect(text).not.toContain('initialPassword')
      }
    })
  })

  describe('AD-03 수정', () => {
    it('성공하면 200 이고 보낸 칸만 바뀐다', async () => {
      const res = await call('/api/admin/stores/1', json('PATCH', { name: ' 프레시 신사점 ' }))
      expect(res.status).toBe(200)
      expect((await res.json()) as AdminStore).toMatchObject({
        storeId: 1,
        storeCode: 'S1',
        name: '프레시 신사점',
        address: '서울 강남구 테헤란로 1',
        region: 'SEOUL',
        status: 'ACTIVE',
        ownerEmail: 'owner1@test.com',
      })
      const { content } = await list('1')
      expect(content[0].name).toBe('프레시 신사점')
    })

    it('PENDING 점포는 409 STORE_NOT_EDITABLE', async () => {
      const res = await call('/api/admin/stores/20', json('PATCH', { name: '프레시 신사점' }))
      expect(res.status).toBe(409)
      expect(((await res.json()) as AdminErrorBody).code).toBe('STORE_NOT_EDITABLE')
    })

    it('없는 점포는 404 STORE_NOT_FOUND', async () => {
      const res = await call('/api/admin/stores/999', json('PATCH', { name: '프레시 신사점' }))
      expect(res.status).toBe(404)
      expect(((await res.json()) as AdminErrorBody).code).toBe('STORE_NOT_FOUND')
    })

    it('다른 점포와 이름이 같으면 409, 자기 이름이면 통과', async () => {
      const dup = await call('/api/admin/stores/1', json('PATCH', { name: '프레시 역삼점' }))
      expect(dup.status).toBe(409)
      expect(((await dup.json()) as AdminErrorBody).code).toBe('STORE_NAME_DUPLICATED')
      const self = await call('/api/admin/stores/1', json('PATCH', { name: '프레시 강남점' }))
      expect(self.status).toBe(200)
    })

    it('바꿀 칸이 없으면 400 VALIDATION_ERROR', async () => {
      const res = await call('/api/admin/stores/1', json('PATCH', {}))
      expect(res.status).toBe(400)
      expect(((await res.json()) as AdminErrorBody).code).toBe('VALIDATION_ERROR')
    })
  })
})
