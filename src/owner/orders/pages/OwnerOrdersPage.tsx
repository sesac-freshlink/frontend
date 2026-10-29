import { LoaderCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { ReceiptLink } from '@/customer/order/components/ReceiptLink'
import { formatDateTime, formatShortPickupDate, formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { useOwnerOrders } from '../api'
import { PickupConfirmModal } from '../components/PickupConfirmModal'

/**
 * S-50 신규 주문 목록: 결제가 끝난 주문을 최신순으로 보여 준다.
 * A5 [픽업 확인] → 확인 모달 → 픽업 완료하면 목록에서 빠진다
 */
export function OwnerOrdersPage() {
  const orders = useOwnerOrders()

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">신규 주문</h1>
          <p className="text-sm text-slate-500">결제가 끝난 주문이에요. 최신 주문이 위에 있어요.</p>
        </div>
        <button
          type="button"
          onClick={() => void orders.refetch()}
          disabled={orders.isFetching}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={cn('size-4', orders.isFetching && 'animate-spin')} />
          새로 고침
        </button>
      </div>
      <OrderTable orders={orders} />
    </section>
  )
}

function OrderTable({ orders }: { orders: ReturnType<typeof useOwnerOrders> }) {
  // 확인 모달을 연 주문. 주문 내용은 목록(서버 상태)에서 찾는다
  const [pickupOrderId, setPickupOrderId] = useState<number | null>(null)
  if (orders.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (orders.isError) {
    return <p className="py-16 text-center text-sm text-red-600">주문을 불러오지 못했어요.</p>
  }
  if (orders.data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">아직 들어온 주문이 없어요.</p>
  }

  const pickupOrder = orders.data.find((o) => o.orderId === pickupOrderId)
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      {pickupOrder && (
        <PickupConfirmModal order={pickupOrder} onClose={() => setPickupOrderId(null)} />
      )}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
          <tr>
            <th className="px-2 py-3 font-medium">주문번호</th>
            <th className="px-2 py-3 font-medium">상품</th>
            <th className="px-2 py-3 text-right font-medium">수량</th>
            <th className="px-2 py-3 text-right font-medium">금액</th>
            <th className="px-2 py-3 font-medium">결제 수단</th>
            <th className="px-2 py-3 text-right font-medium">결제 시각</th>
            <th className="px-2 py-3 text-right font-medium">영수증</th>
            <th className="px-2 py-3 font-medium">픽업 기한</th>
            <th className="px-2 py-3 text-right font-medium">
              <span className="sr-only">픽업</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 whitespace-nowrap text-slate-900">
          {orders.data.map((o) => (
            <tr key={o.orderId}>
              <td className="px-2 py-3 font-medium">{o.orderNo}</td>
              {/* 상품명만 줄바꿈을 허용해 1024px 포스기에서도 표가 화면 안에 들어오게 한다 */}
              <td className="min-w-24 px-2 py-3 break-keep whitespace-normal">{o.productName}</td>
              <td className="px-2 py-3 text-right">{o.quantity}개</td>
              <td className="px-2 py-3 text-right">{formatWon(o.amount)}</td>
              <td className="px-2 py-3">{o.payment?.method ?? '-'}</td>
              <td className="px-2 py-3 text-right text-slate-500">
                {formatDateTime(o.payment?.approvedAt ?? o.paidAt)}
              </td>
              <td className="px-2 py-3 text-right">
                <ReceiptLink url={o.payment?.receiptUrl ?? null} />
              </td>
              <td className="px-2 py-3">
                {o.pickupDeadline ? formatShortPickupDate(o.pickupDeadline) : '-'}
              </td>
              <td className="px-2 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setPickupOrderId(o.orderId)}
                  aria-label={`${o.orderNo} 픽업 확인`}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  픽업 확인
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
