import { useState } from 'react'
import { useSales, useSalesStream } from './api'
import { kstToday, sumPeriods, type SalesTotals } from './sales'

/**
 * 점주 대시보드 매출 카드용 오늘 매출 (3차 할 일 "점주 대시보드 메뉴 구성", 매출 카드는 김경우).
 * 이미 있는 매출 조회(order-service GET /owner/orders/sales)를 오늘 하루로 부르고, 결제가 완료되면 매출 SSE 로 다시 읽는다.
 * 매출 화면(OwnerSalesPage)처럼 SSE 를 이미 연 화면 안에 둘 때는 live 를 false 로 해 연결을 하나만 둔다
 */
export function useTodaySales({ live = true }: { live?: boolean } = {}) {
  // 오늘은 카드가 처음 그려질 때 정한다 (매출 화면과 같다)
  const [today] = useState(() => kstToday())
  useSalesStream(live)
  const sales = useSales({ from: today, to: today, unit: 'day' })
  const totals: SalesTotals | null = sales.data ? sumPeriods(sales.data.periods) : null
  return { today, totals, isPending: sales.isPending, isError: sales.isError }
}
