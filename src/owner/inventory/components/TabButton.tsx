import { cn } from '@/shared/ui/cn'

/** 재고 화면들의 탭 버튼. 감싸는 요소에 role="tablist" 를 둔다 */
export function TabButton({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        '-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900',
        selected && 'border-emerald-600 text-emerald-700 hover:text-emerald-700',
      )}
    >
      {label}
    </button>
  )
}
