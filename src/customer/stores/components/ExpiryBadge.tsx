import { cn } from '@/shared/ui/cn'
import { expiryBadge } from '../expiry'

/** U-10 유통기한 D-day 배지("오늘까지", "D-2"). 기한이 멀거나 품절이면 그리지 않는다 */
export function ExpiryBadge({
  nearestExpiry,
  className,
}: {
  nearestExpiry: string | null
  className?: string
}) {
  const badge = expiryBadge(nearestExpiry)
  if (badge === null) return null
  return (
    <span
      aria-label={`유통기한 ${badge.label}`}
      className={cn(
        'rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        badge.tone === 'urgent' && 'bg-red-50 text-red-600',
        badge.tone === 'soon' && 'bg-orange-50 text-orange-700',
        className,
      )}
    >
      {badge.label}
    </span>
  )
}
