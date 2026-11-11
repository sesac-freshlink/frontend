import { SAME_DAY_PICKUP_NOTICE } from '@/customer/order/clearance'
import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/shared/ui/cn'

/**
 * 상품 상세 맨 아래 접는 안내 2줄: 이용 안내·취소·환불 안내 (11/11 경우 결정 "2줄만").
 * 문구는 이미 정한 규칙만 옮겼다: 매장 픽업만(기획안 36줄), 한 번에 5개(checkout.ts), 10분 결제(MVP 명세 107줄),
 * 픽업 신청·기한(추가 명세 A4·A17), 취소·환불(A7~A9), 마감세일(stores/api.ts 83줄)·선착순(기획안 73줄·A17).
 * 마감세일이 있는 상품·선착순 상품이면 이용 안내 맨 위에 한 줄을 더 붙인다
 */
export function DetailGuide({ clearance, firstCome }: { clearance: boolean; firstCome: boolean }) {
  return (
    <section
      aria-label="구매 안내"
      className="divide-y divide-slate-200 rounded-lg border border-slate-200"
    >
      <GuideRow title="이용 안내">
        {clearance && (
          <>
            <li className="font-medium text-slate-900">
              마감세일 상품은 유통기한이 하루 안 남은 상품이라 30% 싸게 팔아요. 06~23시에만 팔고,
              마감세일이 들어간 주문은 결제하면 바로 픽업 신청돼요.
            </li>
            {SAME_DAY_PICKUP_NOTICE.map((line) => (
              <li key={line} className="font-medium text-red-700">
                {line}
              </li>
            ))}
          </>
        )}
        {firstCome && (
          <li className="font-medium text-slate-900">
            선착순 상품은 줄을 선 뒤 차례가 오면 정해진 시간 안에 주문할 수 있어요. 한 사람에 1개만
            살 수 있어요. 선착순 상품은 마감세일 할인이 없어요.
          </li>
        )}
        <li>배송 없이 고른 점포에서 직접 받아 가는 상품이에요.</li>
        <li>한 번에 5개까지 살 수 있어요.</li>
        <li>주문하고 10분 안에 결제해 주세요. 지나면 주문이 취소돼요.</li>
        <li>
          결제한 뒤 주문 내역에서 [픽업 신청]을 눌러 주세요. 신청한 날 23시 59분까지 받아 가야 해요.
        </li>
        <li>점주가 준비를 마치면 알려 드려요. 점포에서 [픽업 QR]을 보여 주고 받아 가세요.</li>
        <li className="text-red-700">
          픽업 신청을 하지 않거나 기한 안에 받아 가지 않으면 환불되지 않아요.
        </li>
      </GuideRow>
      <GuideRow title="취소·환불 안내">
        <li>결제 전에는 언제든 주문을 취소할 수 있어요.</li>
        <li>
          결제한 뒤에는 점주가 준비를 마치기 전까지, 픽업 기한 안에 주문 상세에서 직접 취소할 수
          있어요. 주문 전체가 취소되고 결제 금액 전부를 돌려 드려요.
        </li>
        <li>점주가 준비를 마친 뒤, 받아 간 뒤, 픽업 기한이 지난 뒤에는 취소할 수 없어요.</li>
        <li>일부 수량만 취소할 수는 없어요.</li>
        <li>점포 사정(재고 부족·상품 상태 등)으로 점주가 주문을 취소하면 전액 돌려 드려요.</li>
        <li>
          환불은 결제한 카드의 결제 취소로 처리돼요. 환불이 안 되면 주문 상세에서 다시 신청할 수
          있어요.
        </li>
      </GuideRow>
    </section>
  )
}

/** 누르면 펼치고 접는 한 줄. 버튼 높이 44px 이상, 펼침 상태는 aria-expanded 로 알린다 */
function GuideRow({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-medium text-slate-900"
      >
        {title}
        <ChevronDown
          className={cn('size-4 text-slate-600 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="list-disc space-y-1.5 px-4 pb-4 pl-8 text-sm leading-relaxed text-slate-700"
      >
        {children}
      </ul>
    </div>
  )
}
