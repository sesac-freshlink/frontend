import { X } from 'lucide-react'
import { type DatePeriod, EMPTY_PERIOD, isReversedPeriod } from '@/shared/api/period'
import { cn } from './cn'

interface PeriodFilterProps {
  period: DatePeriod
  onChange(period: DatePeriod): void
  /** 기간 옆에 붙이는 기준 설명 (예: "주문일 기준") */
  hint?: string
}

/**
 * 목록 기간 검색 (A3·A6). 시작·끝 날짜를 고르면 바로 적용하고, [기간 지우기](X)로 전체 기간으로 돌린다.
 * 시작이 끝보다 늦으면 빨간 안내를 띄운다. 이때 조회하지 않는 것은 화면(Query 훅) 몫이다
 */
export function PeriodFilter({ period, onChange, hint }: PeriodFilterProps) {
  const reversed = isReversedPeriod(period)
  const empty = period.from === '' && period.to === ''
  const inputClass = cn(
    'min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-sm text-slate-900 lg:w-40 lg:flex-none',
    reversed && 'border-red-600',
  )

  return (
    <fieldset className="space-y-1">
      <legend className="sr-only">기간</legend>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <input
          type="date"
          aria-label="시작 날짜"
          aria-invalid={reversed}
          value={period.from}
          onChange={(e) => onChange({ ...period, from: e.target.value })}
          className={inputClass}
        />
        <span aria-hidden="true">~</span>
        <input
          type="date"
          aria-label="끝 날짜"
          aria-invalid={reversed}
          value={period.to}
          onChange={(e) => onChange({ ...period, to: e.target.value })}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => onChange(EMPTY_PERIOD)}
          disabled={empty}
          aria-label="기간 지우기"
          title="기간 지우기"
          className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        {hint && <span className="hidden shrink-0 text-xs text-slate-400 lg:inline">{hint}</span>}
      </div>
      {reversed && (
        <p role="alert" className="text-sm text-red-600">
          시작 날짜가 끝 날짜보다 늦어요.
        </p>
      )}
    </fieldset>
  )
}
