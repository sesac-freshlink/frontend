import { useLocation } from 'react-router'

const KEY_PREFIX = 'freshlink.storeName.'

function read(storeId: number): string | undefined {
  try {
    return sessionStorage.getItem(KEY_PREFIX + storeId) ?? undefined
  } catch {
    return undefined
  }
}

function write(storeId: number, name: string) {
  try {
    sessionStorage.setItem(KEY_PREFIX + storeId, name)
  } catch {
    // 저장이 막힌 브라우저면 이번 화면에서만 쓴다
  }
}

/**
 * 점포 이름. 점포 검색(U-01)이 링크 state 로 넘겨 주고, 새로고침하면 state 가 사라지므로 sessionStorage 에 남겨 둔다.
 * member-service 에 점포 한 건 조회 API 가 없어 주소만으로는 이름을 알 수 없다
 */
export function useStoreName(storeId: number): string | undefined {
  const { state } = useLocation()
  const fromState =
    typeof state === 'object' && state !== null && 'storeName' in state
      ? state.storeName
      : undefined
  if (typeof fromState === 'string' && fromState.length > 0) {
    write(storeId, fromState)
    return fromState
  }
  return read(storeId)
}
