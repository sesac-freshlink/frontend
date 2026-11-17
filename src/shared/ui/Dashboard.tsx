import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from './cn'

/**
 * 첫 화면(홈) 부품. 점주 홈과 관리자 홈이 같은 모양을 쓴다(CLAUDE.md: 두 화면 이상이면 shared/ui).
 * Stat = 위 숫자 칸 하나, Card = 제목 + "더 보기" 링크가 있는 흰 상자, Empty = 상자 안 빈 안내
 */
export function Stat({
  value,
  label,
  sub,
  urgent = false,
}: {
  value: string
  label: string
  sub?: string
  urgent?: boolean
}) {
  return (
    <div className="px-4 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{value}</dd>
      {sub && (
        <dd className={cn('mt-0.5 text-xs text-slate-500', urgent && 'font-medium text-rose-700')}>
          {sub}
        </dd>
      )}
    </div>
  )
}

export function Card({
  title,
  count,
  countUnit = '건',
  more,
  moreLabel,
  children,
}: {
  title: string
  count?: number
  /** 제목 옆 개수 단위. 주문은 "건", 점포·배너는 "개" */
  countUnit?: string
  more?: string
  moreLabel?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              {count}
              {countUnit}
            </span>
          )}
        </h2>
        {more && (
          <Link
            to={more}
            aria-label={`${title} ${moreLabel}`}
            className="inline-flex items-center text-sm font-medium text-emerald-700 hover:underline"
          >
            {moreLabel}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>
}
