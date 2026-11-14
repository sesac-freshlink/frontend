import { COL_WIDTH } from '../colWidth'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import type { Sort } from '../useSortedRows'
import { cn } from '@/shared/ui/cn'
import type { InventoryItem } from '../api'

/**
 * 매장 재고 탭들이 같이 쓰는 표 부품(재고 목록 탭에서 옮김, 11/15 추천·선착순 탭도 같은 틀).
 * 검색 칸, 칸 제목 정렬, 재고 상태 배지
 */

interface SortHeaderProps<K extends string> {
  sortKey: K
  label: string
  numeric?: boolean
  sort: Sort<K> | null
  onSort: (key: K) => void
}

/** 누르면 정렬하는 칸 제목 */
export function SortHeader<K extends string>({
  sortKey,
  label,
  numeric,
  sort,
  onSort,
}: SortHeaderProps<K>) {
  const active = sort?.key === sortKey
  const Arrow = sort?.dir === 'desc' ? ArrowDown : ArrowUp
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn('px-3 py-1 font-medium first:pl-4', numeric && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md py-2 hover:text-slate-900',
          active && 'text-slate-900',
        )}
      >
        {label}
        {/* 정렬 전에도 누를 수 있는 칸임을 보이게 흐린 위아래 화살표를 둔다 */}
        {active ? (
          <Arrow className="size-3.5" aria-hidden />
        ) : (
          <ArrowUpDown className="size-3.5 text-slate-400" aria-hidden />
        )}
      </button>
    </th>
  )
}

/** 상품명 검색 칸 */
export function SearchBox({
  value,
  onChange,
  label = '상품명 검색',
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  return (
    <label className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="w-60 rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm focus:border-emerald-600 focus:outline-none"
      />
    </label>
  )
}

/** 재고 상태는 판매중·품절·부족 셋만(11/13 경우님: "정상" → "판매중"). 소비기한 임박·지남은 임박·폐기 화면에서 본다 */
export function StockStatus({ item }: { item: InventoryItem }) {
  if (item.availableQuantity === 0) {
    return (
      <span className="rounded-md bg-rose-700 px-2 py-0.5 text-xs font-semibold text-white">
        품절
      </span>
    )
  }
  if (item.lowStock) {
    return (
      <span
        title={`안전재고 ${item.safetyStock}개보다 적어요`}
        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
      >
        부족
      </span>
    )
  }
  return <span className="text-xs text-slate-500">판매중</span>
}

/** 추천·선착순 공용 다섯 칸(카테고리·브랜드·상품명·판매 가능·재고 상태)의 <col>. 판매 가능은 재고 목록과 같은 숫자(11/15 경우 1안) */
export function CommonCols() {
  return (
    <>
      <col className={COL_WIDTH.category} />
      <col className={COL_WIDTH.brand} />
      <col />
      <col className={COL_WIDTH.availableQuantity} />
      <col className={COL_WIDTH.status} />
    </>
  )
}
