import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useExpiring, type ExpiringLot } from '../api'
import { DisposalHistory } from '../components/DisposalHistory'
import { DisposeConfirmDialog } from '../components/DisposeConfirmDialog'
import { ExpiryCalendar } from '../components/ExpiryCalendar'
import { LotStatusBadge } from '../components/LotDetailPanel'
import { TabButton } from '../components/TabButton'
import { formatDateTime } from '../format'

type Tab = 'imminent' | 'expired' | 'calendar'

/**
 * S-30·S-32 유통기한 관리. 임박(24시간 이내)·경과 lot 을 탭으로 나누고, 골라서 폐기 요청한다.
 * 폐기 수량은 lot 의 폐기 가능 수량 전량이다(부분 폐기는 미정).
 * 달력 탭은 달마다 기한이 끝나는 lot 을 날짜 칸에 보여 준다(날짜를 누르면 그날 lot 목록)
 */
export function ExpiringPage() {
  const expiring = useExpiring()
  // null 이면 아직 고르지 않은 것. 경과 lot 이 있으면 경과 탭을 먼저 보여 준다
  const [tab, setTab] = useState<Tab | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const lots = expiring.data ?? []
  const imminent = lots.filter((lot) => !lot.expired)
  const expired = lots.filter((lot) => lot.expired)
  const activeTab: Tab = tab ?? (expired.length > 0 ? 'expired' : 'imminent')
  const rows = activeTab === 'expired' ? expired : activeTab === 'imminent' ? imminent : []
  // 폴링으로 목록이 바뀌면 사라졌거나 폐기할 수 없게 된 lot 은 선택에서 빠진다
  const selectedLots = rows.filter((lot) => selected.has(lot.lotId) && lot.disposableQuantity > 0)

  const changeTab = (next: Tab) => {
    setTab(next)
    setSelected(new Set())
  }

  const toggle = (lotId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(lotId)) next.delete(lotId)
      else next.add(lotId)
      return next
    })
  }

  const closeDialog = (succeededLotIds: number[]) => {
    setConfirming(false)
    if (succeededLotIds.length === 0) return
    setSelected((prev) => {
      const next = new Set(prev)
      succeededLotIds.forEach((lotId) => next.delete(lotId))
      return next
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">임박·폐기</h1>
          <p className="text-sm text-slate-500">
            유통기한이 24시간 안에 끝나거나 지난 lot이에요. 폐기는 고른 lot의 폐기 가능 수량 전부를
            요청해요.
          </p>
        </div>
        {activeTab !== 'calendar' && (
          <button
            type="button"
            disabled={selectedLots.length === 0}
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600"
          >
            선택 폐기 ({selectedLots.length})
          </button>
        )}
      </div>

      <div
        role="tablist"
        aria-label="임박·경과·달력"
        className="flex gap-1 border-b border-slate-200"
      >
        <TabButton
          label={`임박 ${imminent.length}`}
          selected={activeTab === 'imminent'}
          onSelect={() => changeTab('imminent')}
        />
        <TabButton
          label={`경과 ${expired.length}`}
          selected={activeTab === 'expired'}
          onSelect={() => changeTab('expired')}
        />
        <TabButton
          label="달력"
          selected={activeTab === 'calendar'}
          onSelect={() => changeTab('calendar')}
        />
      </div>

      {activeTab === 'calendar' ? (
        <ExpiryCalendar />
      ) : (
        <>
          <ExpiringTable expiring={expiring} rows={rows} selected={selected} onToggle={toggle} />
          <DisposalHistory />
        </>
      )}

      {confirming && <DisposeConfirmDialog lots={selectedLots} onClose={closeDialog} />}
    </section>
  )
}

interface TableProps {
  expiring: ReturnType<typeof useExpiring>
  rows: ExpiringLot[]
  selected: ReadonlySet<number>
  onToggle: (lotId: number) => void
}

function ExpiringTable({ expiring, rows, selected, onToggle }: TableProps) {
  if (expiring.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (expiring.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(expiring.error, '임박 목록을 불러오지 못했어요.')}
      </p>
    )
  }
  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">임박하거나 지난 lot이 없어요.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            <th className="w-12 px-4 py-3 font-medium">
              <span className="sr-only">선택</span>
            </th>
            <th className="px-3 py-3 font-medium">상품</th>
            <th className="px-3 py-3 font-medium">유통기한</th>
            <th className="px-3 py-3 font-medium">상태</th>
            <th className="px-3 py-3 text-right font-medium">실물</th>
            <th className="px-3 py-3 text-right font-medium">예약</th>
            <th className="px-4 py-3 text-right font-medium">폐기 가능</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-900">
          {rows.map((lot) => (
            <ExpiringRow
              key={lot.lotId}
              lot={lot}
              checked={selected.has(lot.lotId)}
              onToggle={() => onToggle(lot.lotId)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExpiringRow({
  lot,
  checked,
  onToggle,
}: {
  lot: ExpiringLot
  checked: boolean
  onToggle: () => void
}) {
  const disposable = lot.disposableQuantity > 0
  return (
    <tr className={cn(checked && disposable && 'bg-red-50')}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          aria-label={`${lot.productName} 선택`}
          checked={checked && disposable}
          disabled={!disposable}
          onChange={onToggle}
          className="size-4 accent-red-600 disabled:cursor-not-allowed"
        />
      </td>
      <td className="px-3 py-3 font-medium whitespace-nowrap">{lot.productName}</td>
      <td className="px-3 py-3 whitespace-nowrap text-slate-600 tabular-nums">
        {formatDateTime(lot.expiryDate)}
      </td>
      <td className="px-3 py-3">
        <LotStatusBadge status={lot.expired ? 'EXPIRED' : 'IMMINENT'} />
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{lot.quantity}</td>
      <td className="px-3 py-3 text-right tabular-nums">{lot.reservedQuantity}</td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums">
        {disposable ? (
          lot.disposableQuantity
        ) : (
          <span className="text-xs font-normal text-slate-400">예약 중</span>
        )}
      </td>
    </tr>
  )
}
