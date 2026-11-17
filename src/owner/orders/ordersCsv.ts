import type { OwnerOrder } from './api'

const HEADER = [
  '주문번호',
  '상품',
  '수량',
  '금액',
  '결제 수단',
  '결제 시각',
  '픽업 기한',
  '픽업 시각',
]

/** 따옴표로 감싸야 하는 글자 */
const NEEDS_QUOTE = /[",\n]/

/** 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다 */
function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return NEEDS_QUOTE.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** 지금 보이는 주문 목록을 CSV 글자로. 엑셀에서 한글이 깨지지 않게 맨 앞에 BOM 을 붙인다 */
export function ordersToCsv(orders: OwnerOrder[]): string {
  const rows = orders.map((o) =>
    [
      o.orderNo,
      o.productName,
      o.quantity,
      o.amount,
      o.payment?.method,
      o.payment?.approvedAt ?? o.paidAt,
      o.pickupDeadline,
      o.pickedUpAt,
    ]
      .map(cell)
      .join(','),
  )
  return '﻿' + [HEADER.join(','), ...rows].join('\n')
}

/** 브라우저에서 파일로 내려받는다 */
export function downloadCsv(fileName: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
