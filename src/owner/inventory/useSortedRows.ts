import { useMemo, useState } from 'react'

export interface Sort<K extends string> {
  key: K
  dir: 'asc' | 'desc'
}

/**
 * 칸 제목을 누르면 그 칸으로 정렬한다(한 번 더 누르면 반대). 정렬하지 않으면 받은 순서 그대로.
 * valueOf 는 모듈 바깥 함수로 넘긴다(렌더마다 새 함수면 정렬을 매번 다시 한다)
 */
export function useSortedRows<T, K extends string>(
  rows: T[],
  valueOf: (row: T, key: K) => string | number,
) {
  const [sort, setSort] = useState<Sort<K> | null>(null)
  const sorted = useMemo(() => {
    if (sort === null) return rows
    const sign = sort.dir === 'asc' ? 1 : -1
    return rows.toSorted((a, b) => {
      const x = valueOf(a, sort.key)
      const y = valueOf(b, sort.key)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign
      return String(x).localeCompare(String(y), 'ko') * sign
    })
  }, [rows, sort, valueOf])
  const toggle = (key: K) =>
    setSort((now) =>
      now?.key === key ? { key, dir: now.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  return { sorted, sort, toggle }
}
