import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

/** 묶음 단위. day = 하루, week = 월요일부터 일요일, month = 달 */
export type SalesUnit = 'day' | 'week' | 'month'

/**
 * 매출 응답 한 묶음. order-service SalesResponse.Period 와 같은 모양.
 * 환불(A8·A9)·결제 전 취소(A7)가 생기기 전까지 refundAmount·refundCount·canceledCount 는 늘 0 이다
 */
export interface SalesPeriod {
  /** 묶음 이름. day·week 는 첫날 "yyyy-MM-dd"(week 는 월요일), month 는 "yyyy-MM" */
  period: string
  /** 결제 금액 합계 (결제 승인 시각 기준, 한국 날짜) */
  paidAmount: number
  refundAmount: number
  /** 순매출 = 결제 − 환불 */
  netAmount: number
  paidCount: number
  refundCount: number
  canceledCount: number
}

/** 매출 응답. order-service SalesResponse 와 같은 모양. periods 는 기간 안 모든 묶음을 오래된 순으로(매출 없으면 0) */
export interface SalesResponse {
  from: string
  to: string
  unit: SalesUnit
  periods: SalesPeriod[]
}

/** 매출 조회 조건. from·to 는 한국 날짜 "yyyy-MM-dd", 둘 다 포함, 최대 366일 */
export interface SalesQuery {
  from: string
  to: string
  unit: SalesUnit
}

/**
 * 점주 매출 대시보드(기능 ID 미정) 기간별 매출 (order-service GET /owner/orders/sales).
 * 점포는 gateway 가 붙이는 X-Store-Id 로 정해진다. query 가 null 이면(잘못된 기간) 부르지 않는다.
 * 기간·단위를 바꾸는 동안에는 앞 결과를 그대로 보여 준다. 폴링은 하지 않는다 (실시간 매출 SSE 는 따로 만든다)
 */
export function useSales(query: SalesQuery | null) {
  return useQuery({
    queryKey: ['owner', 'sales', query?.from, query?.to, query?.unit],
    queryFn: query
      ? async () => (await api.get<SalesResponse>('/owner/orders/sales', { params: query })).data
      : skipToken,
    placeholderData: keepPreviousData,
  })
}
