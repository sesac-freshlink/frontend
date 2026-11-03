import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useExpiryCalendar, type ExpiryCalendarDay } from '../api'
import { monthGrid, monthLabel, shiftMonth, thisMonth, today, worstStatus } from '../calendar'
import { formatDateTime } from '../format'
import { LotStatusBadge } from './LotDetailPanel'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const CELL_CLASS = {
  NORMAL: 'bg-emerald-50 text-emerald-800',
  IMMINENT: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-red-100 text-red-700',
} as const

/**
 * 유통기한 달력. 그 달에 기한이 끝나는 lot(수량이 남은 것)을 날짜 칸에 lot 수·수량으로 보여 주고,
 * 칸 색은 그날 가장 급한 상태(경과 빨강 > 임박 주황 > 정상 초록)다. 날짜를 누르면 아래에 그날 끝나는 lot 목록이 나온다.
 * 달마다 한 번 읽는다(GET /owner/inventory/expiry-calendar?month). 폐기·조정하면 다시 읽는다
 */
export function ExpiryCalendar() {
  const [month, setMonth] = useState(() => thisMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(() => today())
  const calendar = useExpiryCalendar(month)
  const todayDate = today()

  const byDate = new Map<string, ExpiryCalendarDay>(
    (calendar.data?.days ?? []).map((day) => [day.date, day]),
  )
  const selectedDay = selectedDate ? byDate.get(selectedDate) : undefined

  const move = (delta: number) => {
    setMonth((now) => shiftMonth(now, delta))
    setSelectedDate(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="이전 달"
          className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <h2 className="text-base font-semibold text-slate-900">{monthLabel(month)}</h2>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="다음 달"
          className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      {calendar.isError ? (
        <p className="py-16 text-center text-sm text-red-600">
          {apiErrorMessage(calendar.error, '달력을 불러오지 못했어요.')}
        </p>
      ) : (
        <div className="relative">
          {calendar.isPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 text-slate-400">
              <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
            </div>
          )}
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                {WEEKDAYS.map((weekday, i) => (
                  <th
                    key={weekday}
                    className={cn(
                      'pb-2 text-xs font-medium text-slate-500',
                      i === 0 && 'text-red-500',
                      i === 6 && 'text-sky-600',
                    )}
                  >
                    {weekday}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(month).map((week) => (
                <tr key={week[0].date}>
                  {week.map((cell) => {
                    const day = cell.inMonth ? byDate.get(cell.date) : undefined
                    return (
                      <td key={cell.date} className="border border-slate-200 p-0 align-top">
                        {cell.inMonth ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDate(cell.date)}
                            aria-pressed={selectedDate === cell.date}
                            aria-label={dayLabel(cell.date, day)}
                            className={cn(
                              'flex h-20 w-full flex-col gap-1 bg-white p-1.5 text-left hover:bg-slate-50',
                              selectedDate === cell.date && 'ring-2 ring-emerald-600 ring-inset',
                            )}
                          >
                            <span
                              className={cn(
                                'self-start text-xs text-slate-500 tabular-nums',
                                cell.date === todayDate &&
                                  'rounded-full bg-emerald-600 px-1.5 font-semibold text-white',
                              )}
                            >
                              {cell.day}
                            </span>
                            {day && (
                              <span
                                className={cn(
                                  'rounded px-1 py-0.5 text-xs font-medium tabular-nums',
                                  CELL_CLASS[worstStatus(day.lots.map((lot) => lot.status))],
                                )}
                              >
                                {day.lotCount} lot · {day.quantity}개
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="block h-20 bg-slate-50 p-1.5 text-xs text-slate-300 tabular-nums">
                            {cell.day}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {calendar.data && calendar.data.days.length === 0 && (
        <p className="text-center text-sm text-slate-500">이 달에 기한이 끝나는 lot이 없어요.</p>
      )}
      {selectedDate && <DayLots date={selectedDate} day={selectedDay} />}
    </div>
  )
}

function dayLabel(date: string, day: ExpiryCalendarDay | undefined): string {
  const [, mon, d] = date.split('-')
  const base = `${Number(mon)}월 ${Number(d)}일`
  return day ? `${base}, lot ${day.lotCount}개 ${day.quantity}개` : base
}

/** 고른 날짜에 기한이 끝나는 lot 목록 */
function DayLots({ date, day }: { date: string; day: ExpiryCalendarDay | undefined }) {
  const [, mon, d] = date.split('-')
  return (
    <section aria-label={`${Number(mon)}월 ${Number(d)}일 lot`} className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">
        {Number(mon)}월 {Number(d)}일에 기한이 끝나는 lot
      </h3>
      {!day ? (
        <p className="rounded-lg border border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
          이날 기한이 끝나는 lot이 없어요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left whitespace-nowrap text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">상품</th>
                <th className="px-3 py-2 text-right font-medium">기한</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-right font-medium">예약</th>
                <th className="px-4 py-2 text-right font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {day.lots.map((lot) => (
                <tr key={lot.lotId}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <p className="font-medium">{lot.name}</p>
                    <p className="text-xs text-slate-400">{lot.productCode}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                    {formatDateTime(lot.expiryDate)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{lot.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{lot.reservedQuantity}</td>
                  <td className="px-4 py-2 text-right">
                    <LotStatusBadge status={lot.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
