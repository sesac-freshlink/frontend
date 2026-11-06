import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { formatShortDate } from '../sales'
import { useTodaySales } from '../useTodaySales'

/**
 * 점주 대시보드 매출 카드 (3차 할 일 "점주 대시보드 메뉴 구성": 매출 카드는 김경우, 레이아웃은 김진아 공통 영역).
 * 오늘 순매출과 결제·환불 건수를 보여 주고, 누르면 매출 화면(/owner/sales)으로 간다.
 * 결제가 완료되면 매출 SSE 로 저절로 바뀐다. 어디에 둘지는 대시보드 구성안이 정해지면 레이아웃 쪽에서 붙인다
 */
export function TodaySalesCard({ live = true }: { live?: boolean }) {
  const { today, totals, isError } = useTodaySales({ live })

  return (
    <Link
      to="/owner/sales"
      aria-label="오늘 매출, 매출 화면으로 가기"
      className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-300"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">오늘 매출</p>
        <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
      </div>
      {isError ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          불러오지 못했어요
        </p>
      ) : (
        <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
          {totals ? formatWon(totals.netAmount) : '-'}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400">
        {formatShortDate(today)} 순매출
        {totals &&
          !isError &&
          ` · 결제 ${totals.paidCount.toLocaleString('ko-KR')}건 · 환불 ${totals.refundCount.toLocaleString('ko-KR')}건`}
      </p>
    </Link>
  )
}
