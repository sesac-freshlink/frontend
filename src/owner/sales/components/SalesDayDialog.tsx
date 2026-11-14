import { LoaderCircle, X } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { useSalesProducts, useStockByProduct, type SalesPeriod } from '../api'
import { formatDayTitle, sumSoldProducts } from '../sales'
import { SoldProductsTable } from './SoldProductsTable'

interface Props {
  /** 누른 날짜 줄 (일 단위 매출 표의 한 줄) */
  period: SalesPeriod
  onClose(): void
}

/**
 * 매출 표에서 날짜를 누르면 뜨는 창 (11/14 경우 결정, 시안 "점주 · 매출 날짜 누르면 창 (예시 안 B)"):
 * 그날 순매출·결제 건수·팔린 수량 한 줄과 팔린 상품 표, [닫기]·[하루 보기에서 열기].
 * 네이티브 모달이라 포커스 가두기·Escape 닫기는 브라우저가 맡는다(약관 창과 같은 방식)
 */
export function SalesDayDialog({ period, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const date = period.period
  const products = useSalesProducts(date)
  const stock = useStockByProduct()
  const items = products.data?.items ?? []
  const sold = sumSoldProducts(items)
  const title = `${formatDayTitle(date)} 팔린 상품`

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const close = () => dialogRef.current?.close()

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="sales-day-title"
      onClose={(e) => {
        if (!e.currentTarget.open) onClose()
      }}
      className="m-auto max-h-[85dvh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-lg backdrop:bg-slate-900/40"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 id="sales-day-title" className="font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
            순매출 {formatWon(period.netAmount)}, 결제 {period.paidCount}건
            {products.data && `, 팔린 수량 ${sold.sold}개`}
          </p>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={close}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {products.isPending ? (
        <div className="flex justify-center py-10 text-slate-500">
          <LoaderCircle className="size-5 animate-spin" aria-label="불러오는 중" />
        </div>
      ) : products.isError ? (
        <p className="py-10 text-center text-sm text-red-600">팔린 상품을 불러오지 못했어요.</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">이날 팔린 상품이 없어요.</p>
      ) : (
        <SoldProductsTable items={items} stock={stock} caption={title} />
      )}
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
        <button
          type="button"
          onClick={close}
          className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          닫기
        </button>
        <Link
          to={`/owner/sales/day?date=${date}`}
          className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-emerald-700 hover:bg-slate-50"
        >
          하루 보기에서 열기
        </Link>
      </div>
    </dialog>
  )
}
