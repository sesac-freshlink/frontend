import { useAuthStore } from '@/shared/auth'

/**
 * 고객이 이 기기에 남기는 점포 설정(내 픽업 점포·단골 점포·단골 알림 표시)을 계정마다 따로 둔다(11/11 경우 결정).
 * 저장 이름 뒤에 로그인 사용자 번호(토큰 sub = userId)를 붙인다. 같은 폰에서 다른 계정으로 로그인해도 앞사람 값이 보이지 않는다.
 * - 로그인 전(사용자 정보 없음)에는 읽으면 없음, 쓰기는 하지 않는다(화면에서만 잠깐 쓴다)
 * - 계정 번호 없이 남은 옛 값(11/11 이전)은 처음 읽는 계정으로 한 번 옮기고 옛 값은 지운다
 * - 로그아웃 때는 남기고, 탈퇴에 성공하면 그 계정 값을 지운다(clearAccountStorePrefs)
 */
export const STORE_PREF_KEYS = [
  'freshlink.pickupStore',
  'freshlink.favoriteStores',
  'freshlink.favoriteHintShown',
] as const

export type StorePrefKey = (typeof STORE_PREF_KEYS)[number]

function currentUserId(): string | null {
  return useAuthStore.getState().user?.userId ?? null
}

/** 계정별 저장 이름. 로그인 전이면 null */
export function accountKey(base: StorePrefKey, userId: string | null = currentUserId()) {
  return userId ? `${base}.${userId}` : null
}

/** 옛 이름(계정 번호 없음)에 값이 있으면 이 계정으로 옮긴다. 이 계정에 이미 값이 있으면 옛 값만 지운다 */
function migrateLegacy(base: StorePrefKey, key: string) {
  const old = localStorage.getItem(base)
  if (old === null) return
  if (localStorage.getItem(key) === null) localStorage.setItem(key, old)
  localStorage.removeItem(base)
}

/** 지금 로그인한 계정의 값. 없거나 로그인 전이거나 저장소를 못 쓰면 null */
export function readAccountItem(base: StorePrefKey): string | null {
  const key = accountKey(base)
  if (key === null) return null
  try {
    migrateLegacy(base, key)
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 지금 로그인한 계정에 쓴다. 로그인 전이거나 저장소를 못 쓰면 아무것도 하지 않는다 */
export function writeAccountItem(base: StorePrefKey, value: string) {
  const key = accountKey(base)
  if (key === null) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // 저장이 막힌 브라우저면 이번 화면에서만 쓴다
  }
}

/** 탈퇴에 성공한 계정의 점포 설정을 모두 지운다 */
export function clearAccountStorePrefs(userId: string) {
  try {
    for (const base of STORE_PREF_KEYS) localStorage.removeItem(`${base}.${userId}`)
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다
  }
}
