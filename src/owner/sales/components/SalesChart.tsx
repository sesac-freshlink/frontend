import { formatWon } from '@/customer/order/format'
import type { SalesPeriod, SalesUnit } from '../api'
import { axisLabel, barRatio, chartScale, chartSummary, formatAxisWon, labelEvery } from '../sales'

/** SVG 좌표 (viewBox). 화면 너비에 맞춰 같은 비율로 늘고 준다. 1024px 포스기에서 글자가 거의 제 크기(12px)가 되는 너비다 */
const WIDTH = 720
const HEIGHT = 240
const PAD = { top: 12, right: 8, bottom: 28, left: 56 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom
/** 막대가 너무 굵어지지 않게 (묶음이 적은 월 단위 등) */
const MAX_BAR_W = 48

/**
 * 순매출 막대그래프. 차트 라이브러리 없이 SVG 로 그린다.
 * 화면 읽기 프로그램에는 aria-label 요약을 읽어 주고, 숫자 전체는 같은 화면의 표에 있다
 */
export function SalesChart({
  periods,
  unit,
  title,
}: {
  periods: SalesPeriod[]
  unit: SalesUnit
  title: string
}) {
  const values = periods.map((p) => p.netAmount)
  const scale = chartScale(values)
  const slot = PLOT_W / Math.max(1, periods.length)
  const barW = Math.min(MAX_BAR_W, Math.max(1, slot * 0.6))
  const every = labelEvery(periods.length)
  const y = (value: number) => PAD.top + PLOT_H * (1 - barRatio(value, scale.max))

  return (
    <svg
      role="img"
      aria-label={chartSummary(periods, unit, title)}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
    >
      {scale.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            className={tick === 0 ? 'stroke-slate-300' : 'stroke-slate-200'}
          />
          <text
            x={PAD.left - 8}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-slate-500 text-xs tabular-nums"
          >
            {formatAxisWon(tick)}
          </text>
        </g>
      ))}
      {scale.max === 0 && (
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + PLOT_H}
          y2={PAD.top + PLOT_H}
          className="stroke-slate-300"
        />
      )}
      {periods.map((p, i) => {
        const center = PAD.left + slot * i + slot / 2
        const height = PLOT_H * barRatio(p.netAmount, scale.max)
        return (
          <g key={p.period}>
            <title>{`${axisLabel(p.period, unit)} 순매출 ${formatWon(p.netAmount)}`}</title>
            {height > 0 && (
              <rect
                x={center - barW / 2}
                y={PAD.top + PLOT_H - height}
                width={barW}
                height={height}
                rx={Math.min(3, barW / 4)}
                className="fill-emerald-500 hover:fill-emerald-600"
              />
            )}
            {i % every === 0 && (
              <text
                x={center}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-slate-500 text-xs tabular-nums"
              >
                {axisLabel(p.period, unit)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
