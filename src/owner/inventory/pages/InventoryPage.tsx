import { ChevronLeft, ChevronRight, LoaderCircle, StickyNote } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { cn } from '@/shared/ui/cn'
import {
  apiErrorMessage,
  useInventory,
  type InventoryItem,
  type InventoryQuery,
  type InventoryStatusFilter,
} from '../api'
import { LotDetailPanel } from '../components/LotDetailPanel'
import { MemoDialog } from '../components/MemoDialog'
import { MemoList } from '../components/MemoList'
import { formatStatuses, parseStatuses } from '../statusParam'
import { FirstComeSettings, RecommendSettings } from '../components/ProductExposureSettings'
import { SafetyStockSettings } from '../components/SafetyStockSettings'
import { FilterChip } from '../components/FilterChip'
import { TabButton } from '../components/TabButton'
import { SearchBox, SortHeader, StockStatus } from '../components/tableParts'
import { COL_WIDTH } from '../colWidth'
import { statusRank } from '../stockFilter'
import { useSortedRows } from '../useSortedRows'
import { formatDaysOfStock, SOON_OUT_DAYS } from '../format'
import { useInventoryChanges } from '../useInventoryChanges'

type Tab = 'stock' | 'safetyStock' | 'recommend' | 'firstCome' | 'memo'

interface MemoTarget {
  productId: number
  name: string
}

/** 한 페이지 상품 수 */
export const PAGE_SIZE = 20
/** 검색어를 다 친 뒤 서버에 묻기까지 기다리는 시간 */
export const SEARCH_DELAY_MS = 300

/** 재고 목록 거르기. 소비기한 임박·지남은 임박·폐기 화면에서 본다(11/12 결정) */
const STATUS_FILTERS: { value: InventoryStatusFilter; label: string }[] = [
  { value: 'SOLD_OUT', label: '품절' },
  { value: 'LOW_STOCK', label: '부족' },
]

/**
 * S-10·S-15 점주 재고 목록. 3초마다 다시 읽고(POLL_MS.ownerInventory) 숫자가 바뀐 행을 잠깐 강조한다.
 * 검색(상품명)·상태 필터·메모 필터·페이지는 서버가 한다(GET /owner/inventory?q&status&memo&page&size).
 * 행을 고르면 오른쪽에 S-11 소비기한별 수량 패널이 열린다 (포스기 가로 화면).
 * 구매 가능 수량이 안전재고보다 적은 상품은 "부족" 배지로 알리고(점포 전체 건수는 대시보드 "재입고 필요"), 안전재고는 옆 탭(S-40)에서 정한다.
 * 행마다 메모 버튼으로 상품 메모를 쓰고, 메모 탭에서 메모만 모아 본다.
 * 상태 필터는 주소의 status(예: ?status=LOW_STOCK)에 둔다. 새로고침해도 남고, 다른 화면이 필터를 건 채로 보낼 수 있다
 */
export function InventoryPage() {
  const [searchText, setSearchText] = useState('')
  const q = useDebounced(searchText, SEARCH_DELAY_MS)
  const [searchParams, setSearchParams] = useSearchParams()
  const statuses = parseStatuses(searchParams.get('status'))
  const [memoOnly, setMemoOnly] = useState(false)
  const [page, setPage] = useState(0)
  const query: InventoryQuery = { q, statuses, memoOnly, page, size: PAGE_SIZE }

  const [tab, setTab] = useState<Tab>('stock')
  // 재고 목록 탭을 볼 때만 3초마다 다시 읽는다(다른 탭은 각자 자기 목록을 부른다, 11/15 호출 줄이기)
  const inventory = useInventory(query, { poll: tab === 'stock' })
  const { changedIds } = useInventoryChanges(inventory.data?.items)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [memoTarget, setMemoTarget] = useState<MemoTarget | null>(null)

  const selected = inventory.data?.items.find((item) => item.productId === selectedId)

  const openTab = (next: Tab) => {
    setTab(next)
    setSelectedId(null)
  }
  // 조건이 바뀌면 첫 페이지부터 본다
  const toggleStatus = (value: InventoryStatusFilter) => {
    const next = statuses.includes(value)
      ? statuses.filter((s) => s !== value)
      : [...statuses, value]
    setSearchParams(
      (now) => {
        const params = new URLSearchParams(now)
        const formatted = formatStatuses(next)
        if (formatted === null) params.delete('status')
        else params.set('status', formatted)
        return params
      },
      { replace: true },
    )
    setPage(0)
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">매장 재고</h1>

      <div
        role="tablist"
        aria-label="재고·안전재고·추천·선착순·메모"
        className="flex gap-1 border-b border-slate-200"
      >
        <TabButton label="재고 목록" selected={tab === 'stock'} onSelect={() => setTab('stock')} />
        <TabButton
          label="안전재고 설정"
          selected={tab === 'safetyStock'}
          onSelect={() => openTab('safetyStock')}
        />
        <TabButton
          label="추천"
          selected={tab === 'recommend'}
          onSelect={() => openTab('recommend')}
        />
        <TabButton
          label="선착순"
          selected={tab === 'firstCome'}
          onSelect={() => openTab('firstCome')}
        />
        <TabButton label="메모" selected={tab === 'memo'} onSelect={() => openTab('memo')} />
      </div>

      {tab === 'safetyStock' && <SafetyStockSettings />}
      {tab === 'recommend' && <RecommendSettings />}
      {tab === 'firstCome' && <FirstComeSettings />}
      {tab === 'memo' && <MemoList />}
      {tab === 'stock' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SearchBox
              value={searchText}
              onChange={(value) => {
                setSearchText(value)
                setPage(0)
              }}
            />
            <div role="group" aria-label="거르기" className="flex flex-wrap gap-1.5">
              <FilterChip
                label="전체"
                pressed={statuses.length === 0 && !memoOnly}
                onToggle={() => {
                  setSearchParams(
                    (now) => {
                      const params = new URLSearchParams(now)
                      params.delete('status')
                      return params
                    },
                    { replace: true },
                  )
                  setMemoOnly(false)
                  setPage(0)
                }}
              />
              {STATUS_FILTERS.map(({ value, label }) => (
                <FilterChip
                  key={value}
                  label={label}
                  pressed={statuses.includes(value)}
                  onToggle={() => toggleStatus(value)}
                />
              ))}
              <FilterChip
                label="메모 있음"
                pressed={memoOnly}
                onToggle={() => {
                  setMemoOnly((now) => !now)
                  setPage(0)
                }}
              />
            </div>
          </div>
          <div>
            <div className="min-w-0 space-y-3">
              <InventoryTable
                inventory={inventory}
                query={query}
                changedIds={changedIds}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMemo={setMemoTarget}
              />
              {inventory.data && inventory.data.totalElements > 0 && (
                <Pagination
                  page={inventory.data.page}
                  totalPages={inventory.data.totalPages}
                  totalElements={inventory.data.totalElements}
                  onPage={setPage}
                />
              )}
            </div>
          </div>
          {/* 소비기한별 수량은 표 옆 칸이 아니라 모달로 연다(11/15 경우). 표 너비가 그대로라 칸이 밀리지 않는다 */}
          {selectedId !== null && (
            <LotDetailModal
              key={selectedId}
              productId={selectedId}
              productName={selected?.name}
              onClose={() => setSelectedId(null)}
            />
          )}
        </>
      )}
      {memoTarget && (
        <MemoDialog
          productId={memoTarget.productId}
          productName={memoTarget.name}
          onClose={() => setMemoTarget(null)}
        />
      )}
    </section>
  )
}

/** 값이 delayMs 동안 바뀌지 않으면 그 값을 돌려준다. 검색어를 칠 때마다 서버에 묻지 않게 한다 */
function useDebounced(value: string, delayMs: number): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

interface PaginationProps {
  /** 0부터 */
  page: number
  totalPages: number
  totalElements: number
  onPage: (page: number) => void
}

function Pagination({ page, totalPages, totalElements, onPage }: PaginationProps) {
  return (
    <nav aria-label="페이지" className="flex items-center justify-between text-sm text-slate-500">
      <p className="tabular-nums">총 {totalElements}개</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 0}
          aria-label="이전 페이지"
          className="rounded-md border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="tabular-nums">
          {page + 1} / {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page + 1 >= totalPages}
          aria-label="다음 페이지"
          className="rounded-md border border-slate-200 bg-white p-1.5 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}

interface TableProps {
  inventory: ReturnType<typeof useInventory>
  query: InventoryQuery
  changedIds: ReadonlySet<number>
  selectedId: number | null
  onSelect: (productId: number) => void
  onMemo: (target: MemoTarget) => void
}

function InventoryTable({
  inventory,
  query,
  changedIds,
  selectedId,
  onSelect,
  onMemo,
}: TableProps) {
  if (inventory.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (inventory.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(inventory.error, '재고를 불러오지 못했어요.')}
      </p>
    )
  }
  const rows = inventory.data.items
  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">{emptyMessage(query)}</p>
  }

  return (
    <SortableTable
      rows={rows}
      changedIds={changedIds}
      selectedId={selectedId}
      onSelect={onSelect}
      onMemo={onMemo}
    />
  )
}

type SortKey =
  | 'category'
  | 'brand'
  | 'name'
  | 'totalQuantity'
  | 'reservedQuantity'
  | 'clearanceQuantity'
  | 'availableQuantity'
  | 'status'
  | 'daysOfStock'

function sortValue(item: InventoryItem, key: SortKey): string | number {
  switch (key) {
    case 'status':
      return statusRank(item)
    case 'brand':
      return item.brand ?? ''
    case 'clearanceQuantity':
      return item.clearanceQuantity ?? -1
    case 'daysOfStock':
      // 판매가 없어 예상이 없으면 맨 뒤
      return item.daysOfStock ?? Number.MAX_SAFE_INTEGER
    default:
      return item[key]
  }
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'category', label: '카테고리' },
  { key: 'brand', label: '브랜드' },
  { key: 'name', label: '상품명' },
  { key: 'totalQuantity', label: '총 수량', numeric: true },
  { key: 'reservedQuantity', label: '예약 수량', numeric: true },
  { key: 'clearanceQuantity', label: '마감세일 수량', numeric: true },
  { key: 'availableQuantity', label: '판매 가능', numeric: true },
  { key: 'status', label: '재고 상태' },
  { key: 'daysOfStock', label: '소진 예상', numeric: true },
]

interface SortableTableProps {
  rows: InventoryItem[]
  changedIds: ReadonlySet<number>
  selectedId: number | null
  onSelect: (productId: number) => void
  onMemo: (target: MemoTarget) => void
}

/**
 * 칸 제목을 누르면 그 칸으로 정렬한다(한 번 더 누르면 반대). 정렬하지 않으면 서버가 준 순서 그대로.
 * 지금은 이 페이지 안에서만 정렬한다. 전체 정렬은 서버 sort 가 생기면 옮긴다
 */
function SortableTable({ rows, changedIds, selectedId, onSelect, onMemo }: SortableTableProps) {
  const { sorted, sort, toggle } = useSortedRows(rows, sortValue)

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-240 table-fixed text-sm">
        {/* 카테고리·브랜드·판매 가능·상태는 추천·선착순 탭과 같은 너비(COL_WIDTH) */}
        <colgroup>
          <col className={COL_WIDTH.category} />
          <col className={COL_WIDTH.brand} />
          <col />
          <col className="w-24" />
          <col className="w-28" />
          <col className="w-36" />
          <col className={COL_WIDTH.availableQuantity} />
          <col className={COL_WIDTH.status} />
          <col className="w-28" />
          <col className="w-18" />
        </colgroup>
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            {COLUMNS.map(({ key, label, numeric }) => (
              <SortHeader
                key={key}
                sortKey={key}
                label={label}
                numeric={numeric}
                sort={sort}
                onSort={toggle}
              />
            ))}
            <th scope="col" className="px-4 py-3 text-center font-medium">
              메모
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-900">
          {sorted.map((item) => (
            <InventoryRow
              key={item.productId}
              item={item}
              changed={changedIds.has(item.productId)}
              selected={item.productId === selectedId}
              onSelect={() => onSelect(item.productId)}
              onMemo={() => onMemo({ productId: item.productId, name: item.name })}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface RowProps {
  item: InventoryItem
  changed: boolean
  selected: boolean
  onSelect: () => void
  onMemo: () => void
}

function InventoryRow({ item, changed, selected, onSelect, onMemo }: RowProps) {
  const soonOut =
    item.availableQuantity > 0 && item.daysOfStock !== null && item.daysOfStock <= SOON_OUT_DAYS
  return (
    <tr
      onClick={onSelect}
      aria-selected={selected}
      data-changed={changed || undefined}
      className={cn(
        'cursor-pointer transition-colors duration-500 hover:bg-slate-50',
        selected && 'bg-emerald-50 hover:bg-emerald-50',
        changed && 'bg-amber-100 hover:bg-amber-100',
      )}
    >
      <td className="py-3 pr-3 pl-4 whitespace-nowrap text-slate-600">{item.category}</td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-600">{item.brand ?? '-'}</td>
      <td className="px-3 py-3 font-medium break-keep">
        {/* 행 클릭과 같은 일. 키보드로도 소비기한별 상세를 열 수 있게 상품명을 버튼으로 둔다 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          aria-expanded={selected}
          className="rounded-sm text-left hover:underline"
        >
          {item.name}
        </button>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{item.totalQuantity}</td>
      <td className="px-3 py-3 text-right tabular-nums">{item.reservedQuantity}</td>
      <td className="px-3 py-3 text-right tabular-nums">
        {item.clearanceQuantity ?? <span className="text-slate-500">-</span>}
      </td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums">{item.availableQuantity}</td>
      <td className="px-3 py-3 whitespace-nowrap">
        <StockStatus item={item} />
      </td>
      <td
        title={item.dailySales > 0 ? `최근 7일 하루 평균 ${item.dailySales}개 판매` : undefined}
        className={cn(
          'px-3 py-3 text-right whitespace-nowrap text-slate-600 tabular-nums',
          soonOut && 'font-semibold text-rose-700',
        )}
      >
        {formatDaysOfStock(item.daysOfStock, item.availableQuantity)}
      </td>
      <td className="px-4 py-2 text-center">
        <button
          type="button"
          // 행을 누르면 lot 패널이 열리므로 메모 버튼 클릭이 행까지 가지 않게 막는다
          onClick={(e) => {
            e.stopPropagation()
            onMemo()
          }}
          aria-label={`${item.name} 메모 ${item.hasMemo ? '보기' : '쓰기'}`}
          title={item.hasMemo ? '메모 보기' : '메모 쓰기'}
          className={cn(
            'rounded-md p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500',
            item.hasMemo && 'text-amber-500 hover:text-amber-600',
          )}
        >
          <StickyNote className="size-4" aria-hidden />
        </button>
      </td>
    </tr>
  )
}

/** 빈 목록 문구. 조건이 없으면 입고 전 안내, 조건 하나면 그 조건에 맞춘 문구 */
function emptyMessage(query: InventoryQuery): string {
  const hasSearch = query.q.trim().length > 0
  if (!hasSearch && query.statuses.length === 0 && !query.memoOnly) {
    return query.page > 0
      ? '이 페이지에 상품이 없어요. 앞 페이지로 가 보세요.'
      : '아직 입고된 상품이 없어요. 입고되면 여기에 바로 보여요.'
  }
  const onlyLowStock = query.statuses.length === 1 && query.statuses[0] === 'LOW_STOCK'
  if (!hasSearch && !query.memoOnly && onlyLowStock) return '안전재고보다 적은 상품이 없어요.'
  if (!hasSearch && query.memoOnly && query.statuses.length === 0)
    return '메모가 있는 상품이 없어요.'
  return '조건에 맞는 상품이 없어요.'
}

/**
 * 소비기한별 수량 패널을 화면 위에 띄운다(공용 ConfirmDialog 와 같은 <dialog> showModal 방식).
 * 모달 밖으로 초점이 나가지 않고, 닫히면 연 줄(상품 버튼)로 초점을 돌려준다.
 * Esc 는 브라우저 기본 닫기를 막고 패널이 처리한다(조정 창이 떠 있으면 조정 창만 닫힘)
 */
function LotDetailModal(props: { productId: number; productName?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = dialog.current
    el?.showModal()
    return () => {
      if (el?.open) el.close()
      opener?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-label="소비기한별 수량"
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-full max-w-md bg-transparent p-0 backdrop:bg-slate-900/40"
    >
      <LotDetailPanel {...props} />
    </dialog>
  )
}
