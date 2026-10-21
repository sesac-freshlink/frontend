import { http, HttpResponse } from 'msw'
import type { InventoryItem } from '@/owner/inventory/api'
import { memberHandlers } from './memberHandlers'

/**
 * 백엔드가 나오기 전까지 쓰는 가짜 API. 실제 API 명세(Swagger)가 나오면 응답 모양을 맞춘다.
 * 화면 담당자가 자기 API 핸들러를 여기에 추가한다.
 */
const inventory: InventoryItem[] = [
  {
    productId: 1,
    name: '삼각김밥 참치마요',
    totalQuantity: 20,
    reservedQuantity: 1,
    availableQuantity: 19,
  },
  {
    productId: 2,
    name: '바나나우유',
    totalQuantity: 12,
    reservedQuantity: 0,
    availableQuantity: 12,
  },
  {
    productId: 3,
    name: '샌드위치 햄치즈',
    totalQuantity: 5,
    reservedQuantity: 2,
    availableQuantity: 3,
  },
]

export const handlers = [
  http.get('/api/owner/inventory', () => HttpResponse.json(inventory)),
  ...memberHandlers,
]
