import { LoaderCircle, PencilLine } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useInventoryLots, type InventoryLotStatus } from '../api'
import { formatExpiry } from '../format'
import { AdjustLotDialog } from './AdjustLotDialog'

const STATUS_LABEL: Record<InventoryLotStatus, string> = {
  NORMAL: '정상',
  IMMINENT: '임박',
  EXPIRED: '경과',
}

const STATUS_CLASS: Record<InventoryLotStatus, string> = {
  NORMAL: 'bg-slate-100 text-slate-600',
  IMMINENT: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-red-100 text-red-700',
}

/** lot 상태 배지. 임박은 경고색, 경과는 오류색 */
export function LotStatusBadge({ status }: { status: InventoryLotStatus }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

interface Props {
  productId: number
  /** 패널 제목에 쓸 상품명. 목록에서 못 찾으면 상품 번호로 보여 준다 */
  productName?: string
  onClose?: () => void
}

/**
 * S-11 lot 상세 패널: 유통기한 빠른 순으로 lot 별 실물·예약·구매 가능 수량과 상태를 보여 준다.
 * lot 마다 S-14 수동 조정(실사) 버튼이 있다
 */
export function LotDetailPanel({ productId, productName, onClose }: Props) {
  const lots = useInventoryLots(productId)
  const [adjustingLotId, setAdjustingLotId] = useState<number | null>(null)
  const title = productName ?? `상품 ${productId}`
  // 폴링으로 새로 읽은 lot 을 모달에 넘겨 "지금 실물"이 최신이게 한다. 수량 0 이 되어 목록에서 빠지면 모달도 닫힌다
  const adjustingLot = lots.data?.find((lot) => lot.lotId === adjustingLotId)

  return (
    <aside
      aria-label="lot 상세"
      className="flex h-full flex-col rounded-lg border border-slate-200 bg-white"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">유통기한별 lot · 빠른 순</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
        )}
      </header>
      <LotTable lots={lots} onAdjust={setAdjustingLotId} />
      {adjustingLot && (
        <AdjustLotDialog
          key={adjustingLot.lotId}
          productName={title}
          lot={adjustingLot}
          onClose={() => setAdjustingLotId(null)}
        />
      )}
    </aside>
  )
}

function LotTable({
  lots,
  onAdjust,
}: {
  lots: ReturnType<typeof useInventoryLots>
  onAdjust: (lotId: number) => void
}) {
  if (lots.isPending) {
    return (
      <div className="flex justify-center py-12 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="lot 불러오는 중" />
      </div>
    )
  }
  if (lots.isError) {
    return (
      <p className="px-4 py-12 text-center text-sm text-red-600">
        {apiErrorMessage(lots.error, 'lot 정보를 불러오지 못했어요.')}
      </p>
    )
  }
  if (lots.data.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-slate-500">남은 lot이 없어요.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
        <tr>
          <th className="px-4 py-2 font-medium">유통기한</th>
          <th className="px-2 py-2 text-right font-medium">실물</th>
          <th className="px-2 py-2 text-right font-medium">예약</th>
          <th className="px-2 py-2 text-right font-medium">구매 가능</th>
          <th className="px-2 py-2 text-right font-medium">상태</th>
          <th className="px-2 py-2">
            <span className="sr-only">조정</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 text-slate-900">
        {lots.data.map((lot) => (
          <tr key={lot.lotId} className="tabular-nums">
            <td className="px-4 py-2 font-medium">{formatExpiry(lot.expiryDate)}</td>
            <td className="px-2 py-2 text-right">{lot.quantity}</td>
            <td className="px-2 py-2 text-right">{lot.reservedQuantity}</td>
            <td className="px-2 py-2 text-right">{lot.availableQuantity}</td>
            <td className="px-2 py-2 text-right">
              <LotStatusBadge status={lot.status} />
            </td>
            <td className="px-2 py-2 text-right">
              <button
                type="button"
                onClick={() => onAdjust(lot.lotId)}
                aria-label={`${formatExpiry(lot.expiryDate)} lot 조정`}
                title="재고 조정"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <PencilLine className="size-4" aria-hidden />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
