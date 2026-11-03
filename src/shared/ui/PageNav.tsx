interface PageNavProps<S extends number> {
  /** 0부터 */
  page: number
  totalPages: number
  size: S
  /** 고를 수 있는 한 페이지 개수 (예: 10·20·50) */
  sizes: readonly S[]
  /** 다음 페이지를 받는 중이면 [다음]을 막는다 */
  loading: boolean
  onPageChange(page: number): void
  onSizeChange(size: S): void
}

/**
 * 목록 페이지 이동([이전]·[다음])과 한 페이지 개수 고르기.
 * 고객 주문 내역(A3)과 점주 주문 목록(A6)이 같이 쓴다. 개수 목록은 화면이 넘긴다
 */
export function PageNav<S extends number>({
  page,
  totalPages,
  size,
  sizes,
  loading,
  onPageChange,
  onSizeChange,
}: PageNavProps<S>) {
  return (
    <nav
      aria-label="페이지"
      className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
      >
        이전
      </button>
      <span className="tabular-nums">
        {page + 1} / {Math.max(totalPages, 1)}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={loading || page + 1 >= totalPages}
        className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
      >
        다음
      </button>
      <label className="flex items-center gap-1 text-slate-500">
        <span className="sr-only">한 페이지에</span>
        <select
          value={size}
          onChange={(e) => {
            const next = sizes.find((s) => s === Number(e.target.value))
            if (next !== undefined) onSizeChange(next)
          }}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1"
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}개씩
            </option>
          ))}
        </select>
      </label>
    </nav>
  )
}
