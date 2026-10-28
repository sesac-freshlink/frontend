import { LoaderCircle } from 'lucide-react'

export function FullScreenSpinner() {
  return (
    <div className="flex h-dvh items-center justify-center text-slate-400">
      <LoaderCircle className="size-8 animate-spin" aria-label="불러오는 중" />
    </div>
  )
}
