import { LoaderCircle, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import {
  apiErrorMessage,
  useClearanceSettings,
  useUpdateClearanceSetting,
  type ClearanceSettingItem,
} from '../api'
import {
  clearanceSortValue,
  DEFAULT_CLEARANCE_DISCOUNT,
  filterClearanceSettings,
  hourLabel,
  MAX_CLEARANCE_DISCOUNT,
  MIN_CLEARANCE_DISCOUNT,
  NO_CLEARANCE_FILTERS,
  parseDiscountPercent,
  SALE_END_HOURS,
  SALE_START_HOURS,
  stepDiscount,
  validSaleHours,
  type ClearanceFilters,
  type ClearanceSortKey,
} from '../clearanceSetting'
import { useSortedRows } from '../useSortedRows'
import { FilterChip } from './FilterChip'
import { SearchBox, SortHeader } from './tableParts'

const COLUMNS: { key: ClearanceSortKey; label: string }[] = [
  { key: 'category', label: '카테고리' },
  { key: 'customized', label: '구분' },
  { key: 'enabled', label: '적용' },
  { key: 'discount', label: '할인율' },
  { key: 'hours', label: '판매 시간' },
]

/**
 * 분류별 마감세일 설정(11/17): 적용 여부, 할인율(10~90%, −/+ 는 10%씩), 판매 시간. 분류마다 따로 저장한다.
 * 카테고리 검색, [적용 중]·[할인율 바꿈] 거르기, 칸 제목 정렬은 선착순 탭과 같은 부품이다.
 * 마감세일은 소비기한이 24시간 안에 끝나는 상품이고, 적용하지 않은 분류는 그 상품도 정가로 판다
 */
export function ClearanceSettings() {
  const settings = useClearanceSettings()
  const [filters, setFilters] = useState<ClearanceFilters>(NO_CLEARANCE_FILTERS)
  const rows = useMemo(
    () => filterClearanceSettings(settings.data ?? [], filters),
    [settings.data, filters],
  )
  const { sorted, sort, toggle: sortBy } = useSortedRows(rows, clearanceSortValue)

  if (settings.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (settings.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(settings.error, '마감세일 설정을 불러오지 못했어요.')}
      </p>
    )
  }
  if (settings.data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">등록된 분류가 없어요.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        소비기한이 24시간 안에 끝나는 상품을 마감세일로 팔아요. 정하지 않은 분류는 적용,{' '}
        {DEFAULT_CLEARANCE_DISCOUNT}%, 06~23시로 봐요. 적용하지 않으면 그 상품도 정가로 팔아요.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={filters.q}
          onChange={(q) => setFilters({ ...filters, q })}
          label="카테고리 검색"
        />
        <div role="group" aria-label="거르기" className="flex flex-wrap gap-1.5">
          <FilterChip
            label="전체"
            pressed={!filters.enabledOnly && !filters.changedOnly}
            onToggle={() => setFilters({ ...filters, enabledOnly: false, changedOnly: false })}
          />
          <FilterChip
            label="적용 중"
            pressed={filters.enabledOnly}
            onToggle={() => setFilters({ ...filters, enabledOnly: !filters.enabledOnly })}
          />
          <FilterChip
            label="할인율 바꿈"
            pressed={filters.changedOnly}
            onToggle={() => setFilters({ ...filters, changedOnly: !filters.changedOnly })}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
            <tr>
              {COLUMNS.map(({ key, label }) => (
                <SortHeader key={key} sortKey={key} label={label} sort={sort} onSort={sortBy} />
              ))}
              {/* 저장 버튼 칸은 정렬하지 않는다 */}
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  조건에 맞는 분류가 없어요.
                </td>
              </tr>
            )}
            {sorted.map((item) => (
              // 저장 뒤 서버 값이 바뀌면 행을 새로 그려 입력칸을 서버 값으로 되돌린다
              <ClearanceSettingRow key={rowKey(item)} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function rowKey(item: ClearanceSettingItem): string {
  return [
    item.category,
    item.enabled,
    item.discountPercent,
    item.saleStartHour,
    item.saleEndHour,
  ].join(':')
}

function ClearanceSettingRow({ item }: { item: ClearanceSettingItem }) {
  const update = useUpdateClearanceSetting()
  const [enabled, setEnabled] = useState(item.enabled)
  const [discountText, setDiscountText] = useState(String(item.discountPercent))
  const [start, setStart] = useState(item.saleStartHour)
  const [end, setEnd] = useState(item.saleEndHour)

  const discount = parseDiscountPercent(discountText)
  const hoursOk = validSaleHours(start, end)
  const valid = discount !== null && hoursOk
  const changed =
    enabled !== item.enabled ||
    discount !== item.discountPercent ||
    start !== item.saleStartHour ||
    end !== item.saleEndHour

  const step = (direction: 1 | -1) => setDiscountText(String(stepDiscount(discount, direction)))

  const save = () => {
    if (discount === null || !valid || !changed) return
    update.mutate(
      {
        category: item.category,
        enabled,
        discountPercent: discount,
        saleStartHour: start,
        saleEndHour: end,
      },
      {
        onSuccess: () =>
          toast.success(
            enabled
              ? `${item.category} 마감세일을 ${discount}%, ${hourLabel(start)}~${hourLabel(end)}로 정했어요`
              : `${item.category}은(는) 마감세일 없이 정가로 팔아요`,
          ),
        onError: (e) => toast.error(apiErrorMessage(e, '마감세일 설정을 저장하지 못했어요.')),
      },
    )
  }

  const selectClass =
    'rounded-md border border-slate-200 px-2 py-1 tabular-nums focus:border-emerald-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400'
  const stepClass =
    'flex size-9 shrink-0 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40'

  return (
    <tr>
      <td className="px-4 py-3 font-medium whitespace-nowrap">{item.category}</td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            item.customized ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
          )}
        >
          {item.customized ? '직접 정함' : '기본값'}
        </span>
      </td>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          aria-label={`${item.category} 마감세일 적용`}
          className="size-4 accent-emerald-700"
        />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {/* [−] 숫자 % [+] (선착순 한도 칸과 같은 모양). 숫자는 직접 넣을 수도 있다 */}
        <div
          className={cn(
            'flex w-36 items-center overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-emerald-600',
            !enabled && 'bg-slate-50',
            discount === null && 'border-red-600 focus-within:border-red-600',
          )}
        >
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!enabled || discount === MIN_CLEARANCE_DISCOUNT}
            aria-label={`${item.category} 할인율 10% 내리기`}
            className={stepClass}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={discountText}
            disabled={!enabled}
            onChange={(e) => setDiscountText(e.target.value)}
            aria-label={`${item.category} 할인율`}
            aria-invalid={discount === null || undefined}
            className="min-h-9 w-full min-w-0 bg-transparent text-right tabular-nums focus:outline-none disabled:text-slate-400"
          />
          <span className={cn('pr-1 pl-0.5 text-slate-500', !enabled && 'text-slate-400')}>%</span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!enabled || discount === MAX_CLEARANCE_DISCOUNT}
            aria-label={`${item.category} 할인율 10% 올리기`}
            className={stepClass}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        {discount === null && (
          <p className="mt-1 text-xs text-red-600">
            {MIN_CLEARANCE_DISCOUNT}~{MAX_CLEARANCE_DISCOUNT} 사이 정수로 넣어 주세요.
          </p>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="flex items-center gap-1">
          <select
            value={start}
            disabled={!enabled}
            onChange={(e) => setStart(Number(e.target.value))}
            aria-label={`${item.category} 판매 시작`}
            className={selectClass}
          >
            {SALE_START_HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <span className="text-slate-500">~</span>
          <select
            value={end}
            disabled={!enabled}
            onChange={(e) => setEnd(Number(e.target.value))}
            aria-label={`${item.category} 판매 끝`}
            className={selectClass}
          >
            {SALE_END_HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </span>
        {!hoursOk && (
          <p className="mt-1 text-xs text-red-600">시작 시각이 끝 시각보다 빨라야 해요.</p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={save}
          disabled={!valid || !changed || update.isPending}
          className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-700"
        >
          저장
        </button>
      </td>
    </tr>
  )
}
