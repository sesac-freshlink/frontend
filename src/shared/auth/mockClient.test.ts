import { beforeEach, describe, expect, it } from 'vitest'
import { createMockClient } from './mockClient'

describe('createMockClient', () => {
  beforeEach(() => localStorage.clear())

  it('admin 으로 시작하는 이메일은 점포 없는 관리자다', async () => {
    const client = createMockClient()
    const user = await client.signIn('admin@freshlink.test', 'x')
    expect(user).toEqual({ userId: 'mock-admin', role: 'ADMIN', email: 'admin@freshlink.test' })
    expect(user.storeId).toBeUndefined()
    expect(await client.restore()).toEqual(user)
    expect(await client.getToken()).toBe('mock-token')
  })

  it('owner 로 시작하는 이메일은 점포 1의 점주다', async () => {
    const user = await createMockClient().signIn('owner@freshlink.test', 'x')
    expect(user).toEqual({
      userId: 'mock-owner',
      role: 'OWNER',
      storeId: '1',
      email: 'owner@freshlink.test',
    })
  })

  it('나머지 이메일은 고객이다', async () => {
    const user = await createMockClient().signIn('kim@freshlink.test', 'x')
    expect(user).toEqual({ userId: 'mock-customer', role: 'CUSTOMER', email: 'kim@freshlink.test' })
  })

  it('로그아웃하면 복원할 사용자와 토큰이 없다', async () => {
    const client = createMockClient()
    await client.signIn('admin@freshlink.test', 'x')
    await client.signOut()
    expect(await client.restore()).toBeNull()
    expect(await client.getToken()).toBeNull()
  })
})
