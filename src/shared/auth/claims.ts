import type { AuthUser, Role } from './types'

const ROLES: Role[] = ['OWNER', 'CUSTOMER']

/**
 * Cognito ID 토큰 payload 에서 사용자 정보를 꺼낸다.
 * 역할은 Cognito 그룹(cognito:groups), 점포 ID 는 사용자 속성(custom:storeId).
 * 역할을 알 수 없으면 null.
 */
export function userFromClaims(claims: Record<string, unknown>): AuthUser | null {
  const groups = Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'] : []
  const role = ROLES.find((r) => groups.includes(r))
  const userId = typeof claims.sub === 'string' ? claims.sub : undefined
  if (!role || !userId) return null

  const storeId = claims['custom:storeId']
  const email = claims.email
  return {
    userId,
    role,
    storeId: typeof storeId === 'string' ? storeId : undefined,
    email: typeof email === 'string' ? email : undefined,
  }
}

export function homePathFor(role: Role): string {
  return role === 'OWNER' ? '/owner/inventory' : '/customer'
}
