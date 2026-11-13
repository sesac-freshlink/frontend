import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
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
import { MAX_FIRST_COME_LIMIT, MIN_FIRST_COME_LIMIT, parseFirstComeLimit } from '../firstCome'

/**
 * 고객 목록에 보이는 방식 설정: 점주 추천상품(고객 목록 '추천상품'과 배지)과 선착순 판매 한도.
 * 선착순 상품은 고객이 대기열을 거쳐 사고(경우님 대기열), 한도를 넘는 주문은 재고가 있어도 거절된다.
 * 그 점포 재고 목록에 있는(입고된 적 있는) 상품만 보여 주고 행마다 따로 저장한다. 추천은 여러 상품을 골라 한 번에 켜고 끌 수도 있다
 */
export function ProductExposureSettings() {
  const recommendations = useRecommendations()
  const firstCome = useFirstComeSettings()
  const setRecommendations = useSetRecommendations()
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())

  if (recommendations.isPending || firstCome.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (recommendations.isError || firstCome.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(
          recommendations.error ?? firstCome.error,
          '추천·선착순 설정을 불러오지 못했어요.',
        )}
      </p>
    )
  }
  if (recommendations.data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        재고 목록에 상품이 없어요. 입고되면 여기서 추천·선착순을 정할 수 있어요.
      </p>
    )
  }

  const firstComeById = new Map(firstCome.data.map((item) => [item.productId, item]))
  const items = recommendations.data
  // 목록에 없는 상품은 선택에서 뺀다
  const selectedIds = items
    .filter((item) => selected.has(item.productId))
    .map((item) => item.productId)
  const allSelected = selectedIds.length === items.length

  const toggle = (productId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.productId)))

  const applySelected = (recommended: boolean) => {
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
        재고 목록에 있는 상품만 보여요. 추천으로 정한 상품은 고객 목록에 '추천'으로 보여요. 선착순은
        한도({MIN_FIRST_COME_LIMIT}~{MAX_FIRST_COME_LIMIT}개)까지만 팔고, 고객은 줄을 서서 차례대로
        사요.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500 tabular-nums">{selectedIds.length}개 선택</span>
        <button
          type="button"
          onClick={() => applySelected(true)}
          disabled={selectedIds.length === 0 || setRecommendations.isPending}
          className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-600"
        >
          선택 추천 켜기
        </button>
        <button
          type="button"
          onClick={() => applySelected(false)}
          disabled={selectedIds.length === 0 || setRecommendations.isPending}
          className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          선택 추천 끄기
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3 font-medium">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 accent-emerald-600"
                />
              </th>
              <th className="px-3 py-3 font-medium">상품</th>
              <th className="px-3 py-3 font-medium">카테고리</th>
              <th className="px-3 py-3 text-center font-medium">추천</th>
              <th className="px-4 py-3 text-right font-medium">선착순</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {items.map((item) => {
              const setting = firstComeById.get(item.productId)
              return (
                <ExposureRow
                  // 저장 뒤 서버 한도가 바뀌면 행을 새로 그려 입력칸을 서버 값으로 되돌린다
                  key={`${item.productId}:${setting?.limit ?? ''}`}
                  item={item}
                  setting={setting}
                  checked={selected.has(item.productId)}
                  onToggle={() => toggle(item.productId)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExposureRow({
  item,
  setting,
  checked,
  onToggle,
}: {
  item: RecommendationItem
  setting: FirstComeSetting | undefined
  checked: boolean
  onToggle: () => void
}) {
  const setRecommendation = useSetRecommendation()
  const setFirstCome = useSetFirstCome()
  const enabled = setting?.firstCome === true
  const [draft, setDraft] = useState(enabled && setting.limit !== null ? String(setting.limit) : '')
  const limit = parseFirstComeLimit(draft)
  const invalid = draft.trim() !== '' && limit === null
  const changed = limit !== null && (!enabled || limit !== setting.limit)

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

  const saveLimit = () => {
    if (limit === null || !changed) return
    setFirstCome.mutate(
      { productId: item.productId, limit },
      {
        onSuccess: () => toast.success(`${item.name} 선착순 한도를 ${limit}개로 정했어요`),
        onError: (e) => toast.error(apiErrorMessage(e, '선착순을 저장하지 못했어요.')),
      },
    )
  }

  const turnOff = () => {
    setFirstCome.mutate(
      { productId: item.productId, limit: null },
      {
        onSuccess: () => toast.success(`${item.name} 선착순을 껐어요`),
        onError: (e) => toast.error(apiErrorMessage(e, '선착순을 끄지 못했어요.')),
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
      <td className="px-3 py-3 whitespace-nowrap">
        <p className="font-medium">{item.name}</p>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-600">{item.category}</td>
      <td className="px-3 py-3 text-center">
        <button
          type="button"
          aria-pressed={item.recommended}
          aria-label={`${item.name} 추천`}
          onClick={toggleRecommended}
          disabled={setRecommendation.isPending}
          className={cn(
            'rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 disabled:opacity-40',
            item.recommended && 'border-emerald-600 bg-emerald-700 text-white',
          )}
        >
          {item.recommended ? '추천 중' : '추천 안 함'}
        </button>
      </td>
      <td className="px-4 py-3">
        <form
          className="flex items-center justify-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            saveLimit()
          }}
        >
          {enabled && (
            <span className="text-xs whitespace-nowrap text-amber-700 tabular-nums">
              남은 {setting.remaining}개
            </span>
          )}
          <input
            type="number"
            inputMode="numeric"
            min={MIN_FIRST_COME_LIMIT}
            max={MAX_FIRST_COME_LIMIT}
            value={draft}
            placeholder="한도"
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`${item.name} 선착순 한도`}
            aria-invalid={invalid || undefined}
            className={cn(
              'w-20 rounded-md border border-slate-200 px-2 py-1 text-right tabular-nums focus:border-emerald-600 focus:outline-none',
              invalid && 'border-red-600 focus:border-red-600',
            )}
          />
          <button
            type="submit"
            disabled={!changed || setFirstCome.isPending}
            className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-600"
          >
            {enabled ? '한도 저장' : '선착순 켜기'}
          </button>
          {enabled && (
            <button
              type="button"
              onClick={turnOff}
              disabled={setFirstCome.isPending}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              끄기
            </button>
          )}
        </form>
        {invalid && (
          <p className="mt-1 text-right text-xs text-red-600">
            {MIN_FIRST_COME_LIMIT}~{MAX_FIRST_COME_LIMIT} 사이 정수로 넣어 주세요.
          </p>
        )}
      </td>
    </tr>
  )
}
