import { ChevronLeft, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import { usePickupWaitingOrders } from '../api'
import { formatMmSs } from '../pickupQr'
import { usePickupQr } from '../usePickupQr'

/**
 * /customer/orders/pickup-qr 고객 픽업 QR (추가 명세 A16). 점주에게 보여 주면 점주가 핸드폰으로 찍고,
 * 컴퓨터 화면에서 고른 주문을 픽업 완료로 바꾼다. 픽업 대기 목록은 5초마다 다시 읽는다
 */
export function PickupQrPage() {
  const qr = usePickupQr(window.location.origin)
  const waiting = usePickupWaitingOrders(!qr.noOrders)
  const orders = waiting.data?.content ?? []

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/customer/orders" aria-label="주문 내역으로" className="text-slate-500">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">픽업 QR</h1>
      </div>

      {qr.noOrders && (
        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">받아 갈 주문이 없어요.</p>
      )}
      {qr.error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-red-600">
            {qr.error}
          </p>
          <button
            type="button"
            onClick={qr.renew}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
          >
            다시 만들기
          </button>
        </div>
      )}

      {!qr.noOrders && !qr.error && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-600">점주에게 이 화면을 보여 주세요</p>
          {qr.qrImage ? (
            <img src={qr.qrImage} alt="픽업 QR" className="size-56" />
          ) : (
            <div role="status" className="flex size-56 items-center justify-center text-slate-400">
              <LoaderCircle className="size-6 animate-spin" aria-label="QR 만드는 중" />
            </div>
          )}
          {qr.pass && (
            <>
              <p className="text-sm text-slate-500">
                카메라가 안 되면 코드{' '}
                <span className="font-mono text-lg font-bold tracking-widest text-slate-900">
                  {qr.pass.code}
                </span>
              </p>
              <p className="text-xs text-slate-400">
                {formatMmSs(qr.secondsLeft)} 남음 · 끝나기 전에 저절로 새로 바뀌어요
              </p>
            </>
          )}
        </div>
      )}

      {!qr.noOrders && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-slate-500">받아 갈 주문 {orders.length}건</h2>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {orders.map((o) => (
              <li key={o.orderId} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="min-w-0 truncate text-slate-900">
                  {o.storeName} · {o.productName} {o.quantity}개
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {o.status === 'READY_FOR_PICKUP' ? '준비 완료' : '준비 중'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
