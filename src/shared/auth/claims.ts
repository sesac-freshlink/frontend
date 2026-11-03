import type { Role } from './types'

/** 역할 목록. gateway 도 그룹이 여러 개면 앞쪽(ADMIN > OWNER > CUSTOMER)을 고른다 */
const ROLES: readonly Role[] = ['ADMIN', 'OWNER', 'CUSTOMER']

/** 응답 본문의 role 이 화면이 아는 역할인지 */
export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

/** 역할별 로그인 후 첫 화면 */
const HOME_PATH: Record<Role, string> = {
  OWNER: '/owner/inventory',
  CUSTOMER: '/customer',
  ADMIN: '/admin/stores',
}

export function homePathFor(role: Role): string {
  return HOME_PATH[role]
}
