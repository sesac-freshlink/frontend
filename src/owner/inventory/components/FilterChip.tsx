import { cn } from '@/shared/ui/cn'

interface FilterChipProps {
  label: string
  pressed: boolean
  onToggle: () => void
}

/** 매장 재고 탭들의 거르기 칩(재고 목록 탭에서 옮김, 11/14 추천 탭도 같이 쓴다). 감싸는 요소에 role="group" 을 둔다 */
export function FilterChip({ label, pressed, onToggle }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50',
        pressed && 'border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-50',
      )}
    >
      {label}
    </button>
  )
}
