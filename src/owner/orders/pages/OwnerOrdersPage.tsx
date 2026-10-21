import { LoaderCircle, RefreshCw } from 'lucide-react'
import { formatDateTime, formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { useOwnerOrders } from '../api'

/** S-50 신규 주문 목록: 결제가 끝난 주문을 최신순으로 보여 준다 (매장 픽업 확인용) */
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

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">주문번호</th>
            <th className="px-4 py-3 font-medium">상품</th>
            <th className="px-4 py-3 text-right font-medium">수량</th>
            <th className="px-4 py-3 text-right font-medium">금액</th>
            <th className="px-4 py-3 text-right font-medium">결제 시각</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-900">
          {orders.data.map((o) => (
            <tr key={o.orderId}>
              <td className="px-4 py-3 font-medium">{o.orderNo}</td>
              <td className="px-4 py-3">{o.productName}</td>
              <td className="px-4 py-3 text-right">{o.quantity}개</td>
              <td className="px-4 py-3 text-right">{formatWon(o.amount)}</td>
              <td className="px-4 py-3 text-right text-slate-500">{formatDateTime(o.paidAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
