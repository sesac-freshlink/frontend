import { RefreshCw } from 'lucide-react'
import { cn } from '@/shared/ui/cn'

/** 당겨서 새로고침 표시. 당기는 동안 아래로 내려오고, 충분히 당기면 "놓으면 새로고침" */
export function PullIndicator({ pull, ready }: { pull: number; ready: boolean }) {
  if (pull <= 0) return null
  return (
    <div
      role="status"
      style={{ height: pull }}
      className="flex items-end justify-center overflow-hidden pb-2 text-xs text-slate-500"
    >
      <span className="flex items-center gap-1.5">
        <RefreshCw className={cn('size-4', ready && 'text-emerald-600')} aria-hidden />
        {ready ? '놓으면 새로고침' : '당겨서 새로고침'}
      </span>
    </div>
  )
}
