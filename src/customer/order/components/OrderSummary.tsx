export interface SummaryRow {
  label: string
  value: string
}

/** 주문 내용 표 (점포·상품·수량·금액). 주문·결제 화면과 주문 상세가 함께 쓴다 */
export function OrderSummary({ rows }: { rows: SummaryRow[] }) {
  return (
    <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex justify-between gap-4 px-4 py-3">
          <dt className="shrink-0 text-slate-500">{label}</dt>
          <dd className="text-right font-medium text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
