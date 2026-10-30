import { cn } from '@/shared/ui/cn'
import type { StoreProduct } from '../api'

const BADGES = [
  { key: 'recommended', label: '추천', className: 'bg-emerald-50 text-emerald-700' },
  { key: 'newArrival', label: '신상품', className: 'bg-sky-50 text-sky-700' },
  { key: 'firstCome', label: '선착순', className: 'bg-amber-50 text-amber-700' },
] as const

/** U-10 상품 표시: 점주 추천, 신상품(첫 입고 7일 안), 선착순. 해당하는 것만 작은 배지로 보여 준다 */
export function ProductBadges({
  product,
  className,
}: {
  product: Pick<StoreProduct, 'recommended' | 'newArrival' | 'firstCome'>
  className?: string
}) {
  const shown = BADGES.filter((badge) => product[badge.key])
  if (shown.length === 0) return null
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {shown.map((badge) => (
        <span
          key={badge.key}
          className={cn('rounded-full px-1.5 py-0.5 text-xs font-medium', badge.className)}
        >
          {badge.label}
        </span>
      ))}
    </span>
  )
}
