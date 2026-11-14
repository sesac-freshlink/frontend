/**
 * 재고 목록·추천·선착순 표가 같이 쓰는 칸 너비. 탭을 바꿔도 같은 칸이 같은 너비로 보이게
 * table-fixed 와 함께 <col> 에 건다. 상품명 칸은 너비를 주지 않아 남는 자리를 가진다
 */
export const COL_WIDTH = {
  category: 'w-30',
  brand: 'w-24',
  availableQuantity: 'w-28',
  status: 'w-24',
} as const
