import { ExternalLink } from 'lucide-react'
import { cn } from '@/shared/ui/cn'

/**
 * U-22 [영수증 보기]. 토스 영수증 페이지를 새 창으로 연다. 주소가 없으면 아무것도 그리지 않는다
 * (영수증이 없어도 결제는 완료다). 고객 주문 상세와 점주 주문 목록이 함께 쓴다
 */
export function ReceiptLink({ url, className }: { url: string | null; className?: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 text-sm text-emerald-600 underline', className)}
    >
      영수증 보기
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  )
}
