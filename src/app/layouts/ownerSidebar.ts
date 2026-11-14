import { useCallback, useState } from 'react'

/** 점주 왼쪽 메뉴를 접었는지 이 브라우저에 기억하는 열쇠 (11/14 경우 결정 E4) */
export const OWNER_SIDEBAR_KEY = 'freshlink.owner.sidebarCollapsed'

/** 저장된 값을 읽는다. 저장소를 못 쓰면(사생활 보호 창 등) 늘 펼친 상태로 본다 */
export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(OWNER_SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

/** 접은 상태를 저장한다. 저장소를 못 쓰면 이번 화면에서만 바뀐다 */
export function writeSidebarCollapsed(collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(OWNER_SIDEBAR_KEY, '1')
    else localStorage.removeItem(OWNER_SIDEBAR_KEY)
  } catch {
    // 저장하지 못해도 화면은 그대로 접히고 펴진다
  }
}

export interface UseOwnerSidebarReturn {
  collapsed: boolean
  toggle: () => void
}

/** 점주 왼쪽 메뉴 접기·펴기 (11/14 경우 결정 E1~E8) */
export function useOwnerSidebar(): UseOwnerSidebarReturn {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed)
  const toggle = useCallback(() => {
    const next = !collapsed
    writeSidebarCollapsed(next)
    setCollapsed(next)
  }, [collapsed])
  return { collapsed, toggle }
}
