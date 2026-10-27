import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useInventory, type InventoryItem } from '../api'
import { LotDetailPanel } from '../components/LotDetailPanel'
import { SafetyStockSettings } from '../components/SafetyStockSettings'
import { TabButton } from '../components/TabButton'
import { formatExpiry, formatWon } from '../format'
import { useInventoryChanges } from '../useInventoryChanges'

type Tab = 'stock' | 'safetyStock'

/**
 * S-10·S-15 점주 재고 목록. 3초마다 다시 읽고(POLL_MS.ownerInventory) 숫자가 바뀐 행을 잠깐 강조한다.
 * 행을 고르면 오른쪽에 S-11 lot 상세 패널이 열린다 (포스기 가로 화면).
 * 구매 가능 수량이 안전재고보다 적은 상품은 "부족" 배지와 상단 건수로 알리고, 안전재고는 옆 탭(S-40)에서 정한다
 */
export function InventoryPage() {
  const inventory = useInventory()
  const { changedIds } = useInventoryChanges(inventory.data)
  const [tab, setTab] = useState<Tab>('stock')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lowOnly, setLowOnly] = useState(false)

  const selected = inventory.data?.find((item) => item.productId === selectedId)
  const lowStockCount = inventory.data?.filter((item) => item.lowStock).length ?? 0

  const openSafetyStock = () => {
    setTab('safetyStock')
    setSelectedId(null)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">재고</h1>
          <p className="text-sm text-slate-500">
            3초마다 새로 읽어요. 상품을 누르면 유통기한별 lot이 보여요.
          </p>
        </div>
        {lowStockCount > 0 && (
          <p
            role="status"
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800"
          >
            <TriangleAlert className="size-4" aria-hidden />
            안전재고보다 적은 상품 {lowStockCount}개
          </p>
        )}
      </div>

      <div
        role="tablist"
        aria-label="재고·안전재고"
        className="flex gap-1 border-b border-slate-200"
      >
        <TabButton label="재고 목록" selected={tab === 'stock'} onSelect={() => setTab('stock')} />
        <TabButton
          label="안전재고 설정"
          selected={tab === 'safetyStock'}
          onSelect={openSafetyStock}
        />
      </div>

      {tab === 'safetyStock' ? (
        <SafetyStockSettings />
      ) : (
        <>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            부족한 상품만 보기
          </label>
          {/* 패널이 열리면 목록 칸을 minmax(0,1fr) 로 둬서 표가 넓어도 레이아웃이 화면 밖으로 밀리지 않게 한다 */}
          <div
            className={cn(
              'grid items-start gap-4',
              selectedId !== null ? 'grid-cols-[minmax(0,1fr)_20rem]' : 'grid-cols-1',
            )}
          >
            <InventoryTable
              inventory={inventory}
              lowOnly={lowOnly}
              changedIds={changedIds}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selectedId !== null && (
              <LotDetailPanel
                key={selectedId}
                productId={selectedId}
                productName={selected?.name}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        </>
      )}
    </section>
  )
}

interface TableProps {
  inventory: ReturnType<typeof useInventory>
  /** true 면 lowStock 인 상품만 */
  lowOnly: boolean
  changedIds: ReadonlySet<number>
  selectedId: number | null
  onSelect: (productId: number) => void
}

function InventoryTable({ inventory, lowOnly, changedIds, selectedId, onSelect }: TableProps) {
  if (inventory.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
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
  if (inventory.data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        아직 입고된 상품이 없어요. 입고되면 여기에 바로 보여요.
      </p>
    )
  }
  const rows = lowOnly ? inventory.data.filter((item) => item.lowStock) : inventory.data
  if (rows.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">안전재고보다 적은 상품이 없어요.</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">상품</th>
            <th className="px-3 py-3 font-medium">카테고리</th>
            <th className="px-3 py-3 text-right font-medium">가격</th>
            <th className="px-3 py-3 text-right font-medium">총 수량</th>
            <th className="px-3 py-3 text-right font-medium">예약 수량</th>
            <th className="px-3 py-3 text-right font-medium">구매 가능</th>
            <th className="px-3 py-3 text-right font-medium">가장 빠른 기한</th>
            <th className="px-4 py-3 text-right font-medium">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-900">
          {rows.map((item) => (
            <InventoryRow
              key={item.productId}
              item={item}
              changed={changedIds.has(item.productId)}
              selected={item.productId === selectedId}
              onSelect={() => onSelect(item.productId)}
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
}

function InventoryRow({ item, changed, selected, onSelect }: RowProps) {
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
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-slate-400">{item.productCode}</p>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-600">{item.category}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
        {formatWon(item.price)}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{item.totalQuantity}</td>
      <td className="px-3 py-3 text-right tabular-nums">{item.reservedQuantity}</td>
      <td
        className={cn(
          'px-3 py-3 text-right font-semibold text-emerald-700 tabular-nums',
          item.lowStock && 'text-orange-700',
        )}
      >
        {item.availableQuantity}
      </td>
      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
        {formatExpiry(item.nearestExpiry)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <StatusBadges
          lowStock={item.lowStock}
          safetyStock={item.safetyStock}
          imminent={item.imminentLotCount}
          expired={item.expiredLotCount}
        />
      </td>
    </tr>
  )
}

interface BadgeProps {
  lowStock: boolean
  safetyStock: number
  imminent: number
  expired: number
}

/** 안전재고보다 적으면 "부족", 임박·경과 lot 이 있으면 개수와 함께 배지를 붙인다 */
function StatusBadges({ lowStock, safetyStock, imminent, expired }: BadgeProps) {
  if (!lowStock && imminent === 0 && expired === 0) {
    return <span className="text-xs text-slate-400">-</span>
  }
  return (
    <span className="inline-flex justify-end gap-1">
      {lowStock && (
        <span
          title={`안전재고 ${safetyStock}개보다 적어요`}
          className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800"
        >
          부족
        </span>
      )}
      {imminent > 0 && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          임박 {imminent}
        </span>
      )}
      {expired > 0 && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          경과 {expired}
        </span>
      )}
    </span>
  )
}
