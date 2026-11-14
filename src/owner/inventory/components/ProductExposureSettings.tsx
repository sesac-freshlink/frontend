import { LoaderCircle, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import {
  apiErrorMessage,
  useFirstComeSettings,
  useRecommendations,
  useSetFirstCome,
  useSetRecommendation,
  useSetRecommendations,
  type FirstComeSetting,
  type RecommendationItem,
} from '../api'
import { useStockByProduct } from '@/owner/sales/api'
import type { InventoryItem, InventoryStatusFilter } from '../api'
import { FilterChip } from './FilterChip'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CommonCols, SearchBox, SortHeader, StockStatus } from './tableParts'
import { matchesStock, matchesText, statusRank } from '../stockFilter'
import { useSortedRows } from '../useSortedRows'
import { MAX_FIRST_COME_LIMIT, MIN_FIRST_COME_LIMIT, parseFirstComeLimit } from '../firstCome'

/**
 * 매장 재고 "추천"·"선착순" 탭(11/14 경우 결정: 한 표에 섞여 있던 두 설정을 탭으로 나눈다).
 * 둘 다 그 점포 재고 목록에 있는(입고된 적 있는) 상품만 보여 주고 행마다 따로 저장한다.
 * 11/15 재고 목록 탭과 같은 틀: 상품명 검색, 거르기 칩(설정 켜짐·꺼짐 + 품절·부족), 칸 제목 정렬,
 * 칸 카테고리·브랜드·상품명·판매 가능·상태. 재고(브랜드·판매 가능·상태)는 재고 목록 한 쪽(최대 100개)을
 * 상품 번호로 짝짓는다(useStockByProduct, 매출 상세와 같은 부품). 서버가 목록을 전부 주므로 화면에서 거르고 정렬한다
 */

function Loading() {
  return (
    <div className="flex justify-center py-16 text-slate-500">
      <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
    </div>
  )
}

function LoadError({ error, label }: { error: unknown; label: string }) {
  return (
    <p className="py-16 text-center text-sm text-red-600">
      {apiErrorMessage(error, `${label} 설정을 불러오지 못했어요.`)}
    </p>
  )
}

function NoProducts({ label }: { label: string }) {
  return (
    <p className="py-16 text-center text-sm text-slate-500">
      재고 목록에 상품이 없어요. 입고되면 여기서 {label}을 정할 수 있어요.
    </p>
  )
}

type OnFilter = 'all' | 'on' | 'off'

interface Filters {
  q: string
  on: OnFilter
  statuses: InventoryStatusFilter[]
}

const NO_FILTERS: Filters = { q: '', on: 'all', statuses: [] }

const STOCK_FILTERS: { value: InventoryStatusFilter; label: string }[] = [
  { value: 'SOLD_OUT', label: '품절' },
  { value: 'LOW_STOCK', label: '부족' },
]

/** 상품 설정 한 줄과 그 상품의 지금 재고(재고 목록에 없으면 없음) */
interface Joined<T> {
  setting: T
  stock: InventoryItem | undefined
}

type CommonKey = 'category' | 'brand' | 'name' | 'availableQuantity' | 'status'

const COMMON_COLUMNS: { key: CommonKey; label: string; numeric?: boolean }[] = [
  { key: 'category', label: '카테고리' },
  { key: 'brand', label: '브랜드' },
  { key: 'name', label: '상품명' },
  { key: 'availableQuantity', label: '판매 가능', numeric: true },
  { key: 'status', label: '재고 상태' },
]

function commonValue(
  row: Joined<{ name: string; category: string }>,
  key: CommonKey,
): string | number {
  switch (key) {
    case 'category':
      return row.setting.category
    case 'name':
      return row.setting.name
    case 'brand':
      return row.stock?.brand ?? ''
    case 'availableQuantity':
      // 재고를 모르면 맨 뒤(오름차순)
      return row.stock?.availableQuantity ?? -1
    case 'status':
      // 재고를 모르면 맨 뒤
      return row.stock ? statusRank(row.stock) : 3
  }
}

/** 검색·칩에 맞는 줄만 남기고 재고를 붙인다 */
function joinAndFilter<T extends { productId: number; name: string }>(
  settings: T[],
  stockById: Map<number, InventoryItem>,
  filters: Filters,
  isOn: (setting: T) => boolean,
): Joined<T>[] {
  return settings
    .map((setting) => ({ setting, stock: stockById.get(setting.productId) }))
    .filter(
      ({ setting, stock }) =>
        matchesText(setting.name, filters.q) &&
        (filters.on === 'all' || isOn(setting) === (filters.on === 'on')) &&
        matchesStock(stock, filters.statuses),
    )
}

/** 검색 칸 + 거르기 칩. 칩은 재고 목록 탭과 같은 부품이고, [전체]는 칩을 모두 푼다 */
function FilterBar({
  filters,
  onChange,
  onLabel,
  offLabel,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  onLabel: string
  offLabel: string
}) {
  const toggleOn = (value: 'on' | 'off') =>
    onChange({ ...filters, on: filters.on === value ? 'all' : value })
  const toggleStock = (value: InventoryStatusFilter) =>
    onChange({
      ...filters,
      statuses: filters.statuses.includes(value)
        ? filters.statuses.filter((s) => s !== value)
        : [...filters.statuses, value],
    })
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchBox value={filters.q} onChange={(q) => onChange({ ...filters, q })} />
      <div role="group" aria-label="거르기" className="flex flex-wrap gap-1.5">
        <FilterChip
          label="전체"
          pressed={filters.on === 'all' && filters.statuses.length === 0}
          onToggle={() => onChange({ ...filters, on: 'all', statuses: [] })}
        />
        <FilterChip label={onLabel} pressed={filters.on === 'on'} onToggle={() => toggleOn('on')} />
        <FilterChip
          label={offLabel}
          pressed={filters.on === 'off'}
          onToggle={() => toggleOn('off')}
        />
        {STOCK_FILTERS.map(({ value, label }) => (
          <FilterChip
            key={value}
            label={label}
            pressed={filters.statuses.includes(value)}
            onToggle={() => toggleStock(value)}
          />
        ))}
      </div>
    </div>
  )
}

/** 카테고리·브랜드·상품명·판매 가능·상태 칸 내용(재고 목록 표와 같은 모양) */
function CommonCells({ row }: { row: Joined<{ name: string; category: string }> }) {
  const { setting, stock } = row
  return (
    <>
      <td className="px-3 py-3 whitespace-nowrap text-slate-600 first:pl-4">{setting.category}</td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-600">{stock?.brand ?? '-'}</td>
      <td className="px-3 py-3 font-medium break-keep">{setting.name}</td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums">
        {stock ? stock.availableQuantity : <span className="font-normal text-slate-500">-</span>}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        {stock ? <StockStatus item={stock} /> : <span className="text-slate-500">-</span>}
      </td>
    </>
  )
}

function NoMatch({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">
        조건에 맞는 상품이 없어요.
      </td>
    </tr>
  )
}

/**
 * 점주 추천상품(고객 목록 '추천상품'과 배지). 여러 상품을 골라 한 번에 켜고 끌 수도 있다.
 * 선택·전체 선택은 보이는(거른) 상품 안에서만 한다
 */
export function RecommendSettings() {
  const recommendations = useRecommendations()
  const setRecommendations = useSetRecommendations()
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  // 0개 고른 채 선택 버튼을 누르면 흐리게 막지 않고 모달로 알린다(11/15 경우)
  const [notice, setNotice] = useState(false)
  const stockById = useStockByProduct()
  const rows = useMemo(
    () => joinAndFilter(recommendations.data ?? [], stockById, filters, (item) => item.recommended),
    [recommendations.data, stockById, filters],
  )
  const { sorted, sort, toggle: sortBy } = useSortedRows(rows, commonValue)

  if (recommendations.isPending) return <Loading />
  if (recommendations.isError) return <LoadError error={recommendations.error} label="추천" />
  if (recommendations.data.length === 0) return <NoProducts label="추천" />

  // 목록에 없는 상품은 선택에서 뺀다
  const selectedIds = rows
    .filter((row) => selected.has(row.setting.productId))
    .map((row) => row.setting.productId)
  const allSelected = rows.length > 0 && selectedIds.length === rows.length

  const toggle = (productId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.setting.productId)))

  const applySelected = (recommended: boolean) => {
    if (selectedIds.length === 0) {
      setNotice(true)
      return
    }
    setRecommendations.mutate(
      { productIds: selectedIds, recommended },
      {
        onSuccess: (changed) => {
          toast.success(
            recommended
              ? `${changed.length}개 상품을 추천했어요`
              : `${changed.length}개 상품 추천을 뺐어요`,
          )
          setSelected(new Set())
        },
        onError: (e) => toast.error(apiErrorMessage(e, '추천을 저장하지 못했어요.')),
      },
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        재고 목록에 있는 상품만 보여요. 추천으로 정한 상품은 고객 목록에 '추천'으로 보여요.
      </p>
      <FilterBar filters={filters} onChange={setFilters} onLabel="추천 중" offLabel="추천 안 함" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500 tabular-nums">{selectedIds.length}개 선택</span>
        <button
          type="button"
          onClick={() => applySelected(true)}
          disabled={setRecommendations.isPending}
          className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-600"
        >
          선택 추천 켜기
        </button>
        <button
          type="button"
          onClick={() => applySelected(false)}
          disabled={setRecommendations.isPending}
          className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          선택 추천 끄기
        </button>
        {notice && (
          <ConfirmDialog
            title="상품을 먼저 골라 주세요"
            description="표 왼쪽 칸에서 상품을 고른 뒤 다시 눌러 주세요."
            tone="primary"
            onClose={() => setNotice(false)}
          />
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-240 table-fixed text-sm">
          <colgroup>
            <col className="w-12" />
            <CommonCols />
            <col className="w-32" />
          </colgroup>
          <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 accent-emerald-600"
                />
              </th>
              {COMMON_COLUMNS.map(({ key, label, numeric }) => (
                <SortHeader
                  key={key}
                  sortKey={key}
                  label={label}
                  numeric={numeric}
                  sort={sort}
                  onSort={sortBy}
                />
              ))}
              <th scope="col" className="px-4 py-3 text-center font-medium">
                추천
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {sorted.length === 0 && <NoMatch colSpan={7} />}
            {sorted.map((row) => (
              <RecommendRow
                key={row.setting.productId}
                row={row}
                checked={selected.has(row.setting.productId)}
                onToggle={() => toggle(row.setting.productId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RecommendRow({
  row,
  checked,
  onToggle,
}: {
  row: Joined<RecommendationItem>
  checked: boolean
  onToggle: () => void
}) {
  const item = row.setting
  const setRecommendation = useSetRecommendation()

  const toggleRecommended = () => {
    const next = !item.recommended
    setRecommendation.mutate(
      { productId: item.productId, recommended: next },
      {
        onSuccess: () =>
          toast.success(next ? `${item.name}을 추천했어요` : `${item.name} 추천을 뺐어요`),
        onError: (e) => toast.error(apiErrorMessage(e, '추천을 저장하지 못했어요.')),
      },
    )
  }

  return (
    <tr className={cn(checked && 'bg-emerald-50')}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          aria-label={`${item.name} 선택`}
          checked={checked}
          onChange={onToggle}
          className="size-4 accent-emerald-600"
        />
      </td>
      <CommonCells row={row} />
      <td className="px-4 py-1 text-center">
        <button
          type="button"
          onClick={toggleRecommended}
          disabled={setRecommendation.isPending}
          aria-label={`${item.name} 추천 ${item.recommended ? '끄기' : '켜기'}`}
          className={toggleClass(item.recommended)}
        >
          {item.recommended ? '끄기' : '켜기'}
        </button>
      </td>
    </tr>
  )
}

type FirstComeKey = CommonKey | 'remaining'

function firstComeValue(row: Joined<FirstComeSetting>, key: FirstComeKey): string | number {
  switch (key) {
    case 'remaining':
      return row.setting.remaining ?? -1
    default:
      return commonValue(row, key)
  }
}

/**
 * 선착순 판매 한도. 선착순 상품은 고객이 대기열을 거쳐 사고(경우님 대기열), 한도를 넘는 주문은 재고가 있어도 거절된다.
 * 선착순 설정 목록이 그 점포 상품 전체(이름·카테고리 포함)를 준다. 재고 칸은 재고 목록에서 짝짓는다
 */
export function FirstComeSettings() {
  const firstCome = useFirstComeSettings()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const stockById = useStockByProduct()
  const rows = useMemo(
    () => joinAndFilter(firstCome.data ?? [], stockById, filters, (s) => s.firstCome),
    [firstCome.data, stockById, filters],
  )
  const { sorted, sort, toggle: sortBy } = useSortedRows(rows, firstComeValue)

  if (firstCome.isPending) return <Loading />
  if (firstCome.isError) return <LoadError error={firstCome.error} label="선착순" />
  if (firstCome.data.length === 0) return <NoProducts label="선착순" />

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        재고 목록에 있는 상품만 보여요. 선착순은 한도({MIN_FIRST_COME_LIMIT}~{MAX_FIRST_COME_LIMIT}
        개)까지만 팔고, 고객은 줄을 서서 차례대로 사요.
      </p>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onLabel="선착순 중"
        offLabel="선착순 안 함"
      />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-240 table-fixed text-sm">
          <colgroup>
            <CommonCols />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-32" />
          </colgroup>
          <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
            <tr>
              {COMMON_COLUMNS.map(({ key, label, numeric }) => (
                <SortHeader
                  key={key}
                  sortKey={key}
                  label={label}
                  numeric={numeric}
                  sort={sort}
                  onSort={sortBy}
                />
              ))}
              <SortHeader
                sortKey="remaining"
                label="선착순 남은 수량"
                numeric
                sort={sort}
                onSort={sortBy}
              />
              {/* 입력·버튼 칸은 정렬하지 않는다 */}
              <th scope="col" className="px-3 py-3 text-center font-medium">
                한도
              </th>
              <th scope="col" className="px-4 py-3 text-center font-medium">
                선착순
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {sorted.length === 0 && <NoMatch colSpan={8} />}
            {sorted.map((row) => (
              // 저장 뒤 서버 한도가 바뀌면 행을 새로 그려 입력칸을 서버 값으로 되돌린다
              <FirstComeRow key={`${row.setting.productId}:${row.setting.limit ?? ''}`} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 켜진 줄에서 −/+ 를 연달아 누를 때 마지막 값만 보내려고 기다리는 시간 */
export const LIMIT_SAVE_DELAY_MS = 600

function FirstComeRow({ row }: { row: Joined<FirstComeSetting> }) {
  const setting = row.setting
  const setFirstCome = useSetFirstCome()
  const enabled = setting.firstCome === true
  const [draft, setDraft] = useState(enabled && setting.limit !== null ? String(setting.limit) : '')
  // 한도가 비었거나 1~999 밖인데 켜기·저장하면 줄 안이 아니라 모달로 알린다(11/15 경우)
  const [notice, setNotice] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 기다리던 −/+ 저장을 버린다. 끄기·직접 저장 뒤에 늦게 와서 다시 켜는 것을 막는다
  const cancelPending = () => clearTimeout(timer.current ?? undefined)
  useEffect(() => cancelPending, [])

  /** 켜기·한도 저장. 같은 한도면 보내지 않는다 */
  const save = (text: string) => {
    const limit = parseFirstComeLimit(text)
    if (limit === null) {
      setNotice(true)
      return
    }
    if (enabled && limit === setting.limit) return
    setFirstCome.mutate(
      { productId: setting.productId, limit },
      {
        onSuccess: () => toast.success(`${setting.name} 선착순 한도를 ${limit}개로 정했어요`),
        onError: (e) => toast.error(apiErrorMessage(e, '선착순을 저장하지 못했어요.')),
      },
    )
  }

  /** −/+ : 1~999 밖으로는 멈춘다. 켜진 줄은 잠깐 기다렸다 마지막 값만 저장, 꺼진 줄은 [켜기] 때 쓴다 */
  const step = (delta: number) => {
    const now = parseFirstComeLimit(draft)
    const next = Math.min(
      MAX_FIRST_COME_LIMIT,
      Math.max(MIN_FIRST_COME_LIMIT, (now ?? MIN_FIRST_COME_LIMIT - (delta > 0 ? 1 : 0)) + delta),
    )
    const text = String(next)
    setDraft(text)
    if (!enabled) return
    cancelPending()
    timer.current = setTimeout(() => save(text), LIMIT_SAVE_DELAY_MS)
  }

  /** 직접 입력: 켜진 줄은 칸을 벗어나거나 Enter 면 저장 */
  const commitTyped = () => {
    if (!enabled) return
    cancelPending()
    save(draft)
  }

  const turnOff = () => {
    cancelPending()
    setFirstCome.mutate(
      { productId: setting.productId, limit: null },
      {
        onSuccess: () => toast.success(`${setting.name} 선착순을 껐어요`),
        onError: (e) => toast.error(apiErrorMessage(e, '선착순을 끄지 못했어요.')),
      },
    )
  }

  // 1·999 끝에 닿으면 그쪽 버튼을 흐리게 막는다(11/15 경우)
  const current = parseFirstComeLimit(draft)
  const stepClass =
    'flex size-11 shrink-0 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40'

  return (
    <tr>
      <CommonCells row={row} />
      <td className="px-3 py-3 text-right tabular-nums">
        {enabled && setting.remaining !== null ? (
          setting.remaining
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </td>
      <td className="px-3 py-1">
        {/* [−] 숫자 [+] (11/15 경우). 숫자는 직접 넣을 수도 있다 */}
        <div className="mx-auto flex w-full items-center overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-emerald-600">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={setFirstCome.isPending || current === MIN_FIRST_COME_LIMIT}
            aria-label={`${setting.name} 한도 줄이기`}
            className={stepClass}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTyped()
            }}
            aria-label={`${setting.name} 선착순 한도`}
            className="min-h-11 w-full min-w-0 text-center tabular-nums focus:outline-none"
          />
          <button
            type="button"
            onClick={() => step(1)}
            disabled={setFirstCome.isPending || current === MAX_FIRST_COME_LIMIT}
            aria-label={`${setting.name} 한도 늘리기`}
            className={stepClass}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </td>
      <td className="px-4 py-1 text-center">
        <button
          type="button"
          onClick={enabled ? turnOff : () => save(draft)}
          disabled={setFirstCome.isPending}
          aria-label={`${setting.name} 선착순 ${enabled ? '끄기' : '켜기'}`}
          className={toggleClass(enabled)}
        >
          {enabled ? '끄기' : '켜기'}
        </button>
        {notice && (
          <ConfirmDialog
            title={`한도를 ${MIN_FIRST_COME_LIMIT}~${MAX_FIRST_COME_LIMIT}로 넣어 주세요`}
            description="선착순은 한도 개수까지만 팔아요."
            tone="primary"
            onClose={() => setNotice(false)}
          />
        )}
      </td>
    </tr>
  )
}

/** 줄마다 하나인 [켜기]/[끄기]. 너비를 고정해 모든 줄의 자리를 같게 둔다(11/15 경우) */
function toggleClass(on: boolean): string {
  return cn(
    'min-h-11 w-20 rounded-lg text-sm whitespace-nowrap disabled:opacity-40',
    on
      ? 'border border-slate-300 text-slate-600 hover:bg-slate-100'
      : 'bg-emerald-700 font-medium text-white hover:bg-emerald-800',
  )
}
