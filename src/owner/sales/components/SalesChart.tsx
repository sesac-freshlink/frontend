import { useLayoutEffect, useRef, useState } from 'react'
import { formatWon } from '@/customer/order/format'
import type { SalesPeriod, SalesUnit } from '../api'
import { axisLabel, barRatio, chartScale, chartSummary, formatAxisWon, labelEvery } from '../sales'

/**
 * SVG 좌표 1 = 화면 1px 로 그린다. 너비는 감싼 칸의 실제 너비를 재서 쓰고(재기 전·테스트 환경은 FALLBACK_WIDTH),
 * 높이는 고정이라 화면이 넓어져도 축 글자(12px)·높이가 커지지 않는다
 */
const FALLBACK_WIDTH = 720
const HEIGHT = 240
/** top 은 막대 위 값 글자 자리를 둔다 */
const PAD = { top: 24, right: 8, bottom: 28, left: 56 }
const PLOT_H = HEIGHT - PAD.top - PAD.bottom
/** 막대는 칸을 채우지 않고 24px 까지만 (남는 칸은 여백). 위 끝만 4px 둥글게, 바닥은 각지게 */
const MAX_BAR_W = 24
const BAR_RADIUS = 4

/** path 글자에 소수점이 길게 붙지 않게 0.1px 단위로 줄인다(화면 차이 없음) */
const r1 = (n: number) => Math.round(n * 10) / 10

/** 바닥(baseline)은 각지고 위 두 모서리만 둥근 막대 path */
function barPath(x: number, top: number, w: number, h: number) {
  const r = Math.min(BAR_RADIUS, w / 2, h)
  const bottom = r1(top + h)
  const [x0, x1, t] = [r1(x), r1(x + w), r1(top)]
  return `M${x0},${bottom} V${r1(top + r)} Q${x0},${t} ${r1(x + r)},${t} H${r1(x + w - r)} Q${x1},${t} ${x1},${r1(top + r)} V${bottom} Z`
}

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
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(FALLBACK_WIDTH)
  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const WIDTH = width
  const PLOT_W = WIDTH - PAD.left - PAD.right
  const values = periods.map((p) => p.netAmount)
  const scale = chartScale(values)
  const slot = PLOT_W / Math.max(1, periods.length)
  const barW = Math.min(MAX_BAR_W, Math.max(1, slot * 0.6))
  const every = labelEvery(periods.length)
  // 값 글자는 가장 높은 막대와 마지막(가장 최근) 막대에만 붙인다. 나머지 값은 마우스를 올리거나 아래 표에서 본다
  const maxIndex = values.indexOf(Math.max(...values))
  const labeled = new Set([maxIndex, periods.length - 1].filter((i) => i >= 0 && values[i] > 0))
  const y = (value: number) => PAD.top + PLOT_H * (1 - barRatio(value, scale.max))

  return (
    <div ref={box}>
      <svg
        role="img"
        aria-label={chartSummary(periods, unit, title)}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        className="block"
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
            <g key={p.period} className="group">
              <title>{`${axisLabel(p.period, unit)} 순매출 ${formatWon(p.netAmount)}`}</title>
              {/* 마우스를 올릴 자리는 막대보다 넓게, 칸 전체 높이로 */}
              <rect
                x={center - slot / 2}
                y={PAD.top}
                width={slot}
                height={PLOT_H}
                className="fill-transparent"
              />
              {height > 0 && (
                <path
                  d={barPath(center - barW / 2, PAD.top + PLOT_H - height, barW, height)}
                  className="fill-emerald-700 group-hover:fill-emerald-800"
                />
              )}
              {labeled.has(i) && (
                <text
                  x={center}
                  y={PAD.top + PLOT_H - height - 6}
                  textAnchor="middle"
                  className="fill-slate-900 text-xs font-semibold tabular-nums"
                >
                  {p.netAmount.toLocaleString('ko-KR')}
                </text>
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
    </div>
  )
}
