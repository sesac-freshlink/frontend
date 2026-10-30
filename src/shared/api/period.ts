/**
 * 목록 기간 검색 값 (order-service A3·A6 `from`·`to`). KST 날짜 `yyyy-MM-dd`, 둘 다 포함, 빈 문자열은 그쪽 끝을 열어 둔다.
 * `<input type="date">` 값이 같은 형식이라 그대로 담는다
 */
export interface DatePeriod {
  from: string
  to: string
}

export const EMPTY_PERIOD: DatePeriod = { from: '', to: '' }

/** 시작 날짜가 끝 날짜보다 늦은지. 같은 형식(yyyy-MM-dd)이라 문자열 비교로 충분하다. 서버도 이 경우 400 을 준다 */
export function isReversedPeriod({ from, to }: DatePeriod): boolean {
  return from !== '' && to !== '' && from > to
}

/** 쿼리 파라미터·queryKey 용. 빈 쪽은 넣지 않는다 */
export function periodParams({ from, to }: DatePeriod): { from?: string; to?: string } {
  return { ...(from && { from }), ...(to && { to }) }
}
