import { http, HttpResponse } from 'msw'
import type { StoreProduct } from '@/customer/stores/api'
import type { InventoryItem, InventoryLotItem } from '@/owner/inventory/api'
import { adminHandlers } from './adminHandlers'
import { memberHandlers } from './memberHandlers'
import { orderHandlers } from './orderHandlers'

/**
 * 백엔드가 나오기 전까지 쓰는 가짜 API. 실제 API 명세(Swagger)가 나오면 응답 모양을 맞춘다.
 * 화면 담당자가 자기 API 핸들러를 여기에 추가한다.
 */
const inventory: InventoryItem[] = [
  {
    productId: 1,
    productCode: 'P001',
    name: '삼각김밥 참치마요',
    category: '김밥',
    price: 1500,
    totalQuantity: 20,
    reservedQuantity: 1,
    availableQuantity: 19,
    nearestExpiry: '2026-10-24T23:59:59+09:00',
    imminentLotCount: 0,
    expiredLotCount: 0,
  },
  {
    productId: 2,
    productCode: 'P002',
    name: '바나나우유',
    category: '유제품',
    price: 1700,
    totalQuantity: 12,
    reservedQuantity: 0,
    availableQuantity: 10,
    nearestExpiry: '2026-10-20T23:59:59+09:00',
    imminentLotCount: 1,
    expiredLotCount: 1,
  },
  {
    productId: 3,
    productCode: 'P003',
    name: '샌드위치 햄치즈',
    category: '샌드위치',
    price: 3200,
    totalQuantity: 5,
    reservedQuantity: 2,
    availableQuantity: 3,
    nearestExpiry: null,
    imminentLotCount: 0,
    expiredLotCount: 0,
  },
]

/** S-11 상품별 lot. 유통기한 빠른 순, 수량 0 은 서버가 빼고 내려 준다 */
const lots: Record<number, InventoryLotItem[]> = {
  1: [
    {
      lotId: 101,
      expiryDate: '2026-10-24T23:59:59+09:00',
      quantity: 20,
      reservedQuantity: 1,
      availableQuantity: 19,
      status: 'NORMAL',
    },
  ],
  2: [
    {
      lotId: 201,
      expiryDate: '2026-10-19T23:59:59+09:00',
      quantity: 2,
      reservedQuantity: 0,
      availableQuantity: 0,
      status: 'EXPIRED',
    },
    {
      lotId: 202,
      expiryDate: '2026-10-20T23:59:59+09:00',
      quantity: 4,
      reservedQuantity: 0,
      availableQuantity: 4,
      status: 'IMMINENT',
    },
    {
      lotId: 203,
      expiryDate: '2026-10-28T23:59:59+09:00',
      quantity: 6,
      reservedQuantity: 0,
      availableQuantity: 6,
      status: 'NORMAL',
    },
  ],
  3: [],
}

/** U-10 점포 상품. 점포마다 같은 목록을 준다. 상품 1~3 은 orderHandlers 의 상품과 같아 가짜 주문까지 이어진다 */
const storeProducts: StoreProduct[] = [
  {
    productId: 2,
    name: '바나나우유',
    category: '유제품',
    price: 1700,
    availableQuantity: 10,
    soldOut: false,
  },
  {
    productId: 1,
    name: '삼각김밥 참치마요',
    category: '김밥',
    price: 1500,
    availableQuantity: 19,
    soldOut: false,
  },
  {
    productId: 3,
    name: '샌드위치 햄치즈',
    category: '샌드위치',
    price: 3200,
    availableQuantity: 3,
    soldOut: false,
  },
  {
    productId: 4,
    name: '아메리카노 캔 240ml',
    category: '음료',
    price: 1200,
    availableQuantity: 0,
    soldOut: true,
  },
  {
    productId: 5,
    name: '초코빵',
    category: '빵',
    price: 1800,
    availableQuantity: 0,
    soldOut: true,
  },
]

export const handlers = [
  http.get('/api/stores/:storeId/products', () => HttpResponse.json(storeProducts)),
  http.get('/api/owner/inventory', () => HttpResponse.json(inventory)),
  http.get('/api/owner/inventory/:productId/lots', ({ params }) => {
    const found = lots[Number(params.productId)]
    if (!found) {
      return HttpResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: '상품이 없습니다', traceId: '' },
        { status: 404 },
      )
    }
    return HttpResponse.json(found)
  }),
  ...adminHandlers,
  ...memberHandlers,
  ...orderHandlers,
]
