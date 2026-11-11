import { LoaderCircle, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'

/**
 * 목록·상세가 서버 데이터를 기다리거나, 못 받았거나, 비었을 때 보여 주는 공통 모양.
 * 화면마다 따로 그리던 동그라미·오류 문구·빈 목록 문구를 한 모양으로 맞추고, 오류에는 늘 [다시 시도]를 둔다.
 */

/** 불러오는 중. 화면 읽기 프로그램에는 label 을 읽어 준다 */
export function LoadingState({
  label = '불러오는 중',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div role="status" className={cn('flex justify-center py-10 text-slate-500', className)}>
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** 불러오지 못함. 무엇이 안 됐는지 한 줄과 [다시 시도] 버튼 */
export function ErrorState({
  message,
  onRetry,
  retrying = false,
  className,
}: {
  message: string
  onRetry: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('space-y-3 py-10 text-center', className)}>
      <p className="text-sm text-red-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden />
        다시 시도
      </button>
    </div>
  )
}

/** 빈 목록. 왜 비었는지 한 줄 + 다음에 할 일(children: 링크·버튼) */
export function EmptyState({
  message,
  hint,
  children,
  className,
}: {
  message: string
  hint?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2 py-10 text-center', className)}>
      <p className="text-sm font-medium text-slate-700">{message}</p>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
      {children}
    </div>
  )
}
