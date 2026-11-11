import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'

/** 화면 맨 위 "< 이전 화면" 링크. 주문·결제와 주문 상세에서 휴대폰 뒤로 버튼 없이도 돌아가게 한다(11/11) */
export function BackLink({ to, label, state }: { to: string; label: string; state?: unknown }) {
  return (
    <Link
      to={to}
      state={state}
      className="-ml-1 inline-flex min-h-11 items-center gap-1 pr-2 text-sm text-slate-600"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  )
}
