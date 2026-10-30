/**
 * 주문 상태 → 고객 화면 문구를 바꾸는 곳은 여기 한 곳이다.
 * 상태 이름은 기획안 7장 그대로 쓰고, 고객 문구에는 "예약"을 쓰지 않는다
 * (.github docs/기능이해/주문-결제-흐름과-재고-예약.md 3장, order-service API 명세 7장).
 */
export const ORDER_STATUSES = [
  'RESERVING',
  'PAYMENT_WAITING',
  'PAYMENT_APPROVING',
  'PAID',
  'OUT_OF_STOCK',
  'PAYMENT_FAILED',
  'EXPIRED',
  'PICKED_UP',
  'PICKUP_EXPIRED',
  'READY_FOR_PICKUP',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type FailureReason =
  | 'OUT_OF_STOCK'
  | 'PRODUCT_NOT_FOUND'
  | 'INVALID_QUANTITY'
  | 'PAYMENT_FAILED'
  | 'EXPIRED'
  | 'PICKUP_DEADLINE'

/**
 * loading: 기다리기만 한다 (로딩 표시)
 * payable: 결제창을 띄운다
 * done: 결제 완료
 * pickedUp: 픽업 완료 (A5)
 * failed: 끝난 실패. [상품으로 돌아가기]를 둔다 (같은 주문을 다시 결제하지 않는다)
 */
export type MessageTone = 'loading' | 'payable' | 'done' | 'pickedUp' | 'failed'

export interface CustomerMessage {
  title: string
  tone: MessageTone
}

const OUT_OF_STOCK_MESSAGES: Record<string, string> = {
  OUT_OF_STOCK: '재고가 부족해 주문이 취소됐어요.',
  PRODUCT_NOT_FOUND: '상품을 찾을 수 없어 주문이 취소됐어요.',
  INVALID_QUANTITY: '주문 수량이 올바르지 않아 주문이 취소됐어요.',
}

export function customerMessage(
  status: OrderStatus,
  failureReason: FailureReason | null,
): CustomerMessage {
  switch (status) {
    case 'RESERVING':
      return { title: '주문을 확인하고 있어요', tone: 'loading' }
    case 'PAYMENT_WAITING':
      return { title: '결제 대기', tone: 'payable' }
    case 'PAYMENT_APPROVING':
      return { title: '결제 결과를 확인하고 있어요', tone: 'loading' }
    case 'PAID':
      return { title: '결제 완료', tone: 'done' }
    case 'READY_FOR_PICKUP':
      return { title: '픽업 준비 완료 · 가게에서 받아 가세요', tone: 'done' }
    case 'OUT_OF_STOCK':
      return {
        title:
          OUT_OF_STOCK_MESSAGES[failureReason ?? 'OUT_OF_STOCK'] ??
          OUT_OF_STOCK_MESSAGES.OUT_OF_STOCK,
        tone: 'failed',
      }
    case 'PAYMENT_FAILED':
      return { title: '결제에 실패했어요', tone: 'failed' }
    case 'EXPIRED':
      return failureReason === 'PICKUP_DEADLINE'
        ? { title: '픽업 기한이 지나 주문이 취소됐어요', tone: 'failed' }
        : { title: '결제 시간이 지나 주문이 취소됐어요', tone: 'failed' }
    case 'PICKED_UP':
      return { title: '픽업 완료', tone: 'pickedUp' }
    case 'PICKUP_EXPIRED':
      return { title: '픽업 기한이 지났어요', tone: 'failed' }
  }
}

/** 주문 내역(A3)·점주 목록(A6)에 쓰는 짧은 상태 이름 */
export function orderStatusLabel(status: OrderStatus, failureReason: FailureReason | null): string {
  switch (status) {
    case 'RESERVING':
      return '주문 확인 중'
    case 'PAYMENT_WAITING':
      return '결제 대기'
    case 'PAYMENT_APPROVING':
      return '결제 확인 중'
    case 'PAID':
      return '픽업 대기'
    case 'READY_FOR_PICKUP':
      return '픽업 준비 완료'
    case 'PICKED_UP':
      return '픽업 완료'
    case 'PICKUP_EXPIRED':
      return '픽업 기한 지남'
    case 'EXPIRED':
      return failureReason === 'PICKUP_DEADLINE' ? '픽업 기한 지나 취소' : '결제 시간 지나 취소'
    case 'OUT_OF_STOCK':
      return '재고 부족 취소'
    case 'PAYMENT_FAILED':
      return '결제 실패'
  }
}

/** 결제창을 닫거나 결제에 실패하고 돌아왔는데 아직 결제할 수 있을 때 (명세 7장) */
export function paymentInterruptedMessage(expiresAtHHmm: string): string {
  return `결제가 완료되지 않았어요. 이 주문은 ${expiresAtHHmm}에 자동 취소됩니다.`
}

/** RESERVING·PAYMENT_WAITING·PAYMENT_APPROVING 에서만 2초 폴링. 아직 모르면(첫 조회 전) 계속 */
export function isPollingStatus(status: OrderStatus | undefined): boolean {
  return (
    status === undefined ||
    status === 'RESERVING' ||
    status === 'PAYMENT_WAITING' ||
    status === 'PAYMENT_APPROVING'
  )
}

/** OR-03 결제 승인 요청이 오류로 끝났을 때 고객 문구 (order-service API 명세 8장 code 기준) */
export function confirmErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'ORDER_EXPIRED':
      return '결제 시간이 지나 주문이 취소됐어요'
    case 'PICKUP_DEADLINE_PASSED':
      return '픽업 기한이 지나 주문이 취소됐어요'
    case 'ORDER_NO_MISMATCH':
    case 'PAYMENT_AMOUNT_MISMATCH':
      return '결제 정보가 주문과 맞지 않아요. 다시 결제해 주세요.'
    case 'PAYMENT_INFO_MISMATCH':
      return '이미 다른 결제로 처리 중이에요.'
    case 'ORDER_NOT_PAYABLE':
      return '결제할 수 없는 주문이에요.'
    default:
      return '결제 결과를 확인하지 못했어요. 잠시 뒤 다시 확인해 주세요.'
  }
}
