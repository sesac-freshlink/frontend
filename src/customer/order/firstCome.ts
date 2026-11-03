/** 선착순 주문·줄 서기 오류 코드 → 화면 문구 */
export function firstComeErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'FIRST_COME_TICKET_REQUIRED':
      return '차례가 오면 주문할 수 있어요. 대기 화면에서 순서를 기다려 주세요.'
    case 'FIRST_COME_ALREADY_ORDERED':
      return '이미 주문한 선착순 상품이에요. 한 사람이 1개만 살 수 있어요.'
    case 'FIRST_COME_QUANTITY_LIMIT':
      return '선착순 상품은 1개만 주문할 수 있어요.'
    case 'FIRST_COME_UNAVAILABLE':
      return '지금 대기열을 쓸 수 없어요. 잠시 후 다시 시도해 주세요.'
    default:
      return null
  }
}
