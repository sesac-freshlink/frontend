import { http, HttpResponse } from 'msw'
import type { StoreProduct } from '@/customer/stores/api'
import type {
  DisposalHistoryItem,
  DisposalStatus,
  DisposeRequest,
  DisposeResponse,
  ExpiringLot,
  InventoryItem,
  InventoryLotItem,
  LedgerItem,
  LedgerType,
} from '@/owner/inventory/api'
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

/** S-13 변동 이력. 최신순, 수량은 부호 포함(입고 +, 판매·폐기 −) */
const ledger: LedgerItem[] = [
  {
    ledgerId: 9008,
    type: 'DISPOSE',
    productId: 2,
    productName: '바나나우유',
    lotId: 201,
    expiryDate: '2026-10-19T23:59:59+09:00',
    quantity: -2,
    refId: '501',
    createdAt: '2026-10-21T09:12:40+09:00',
  },
  {
    ledgerId: 9007,
    type: 'SALE',
    productId: 1,
    productName: '삼각김밥 참치마요',
    lotId: 101,
    expiryDate: '2026-10-24T23:59:59+09:00',
    quantity: -1,
    refId: '1025',
    createdAt: '2026-10-21T08:47:05+09:00',
  },
  {
    ledgerId: 9006,
    type: 'SALE',
    productId: 3,
    productName: '샌드위치 햄치즈',
    lotId: 301,
    expiryDate: '2026-10-22T23:59:59+09:00',
    quantity: -2,
    refId: '1024',
    createdAt: '2026-10-21T08:30:11+09:00',
  },
  {
    ledgerId: 9005,
    type: 'INBOUND',
    productId: 2,
    productName: '바나나우유',
    lotId: 203,
    expiryDate: '2026-10-28T23:59:59+09:00',
    quantity: 6,
    refId: 'SHP-20261021-070000123-S1',
    createdAt: '2026-10-21T07:00:01+09:00',
  },
  {
    ledgerId: 9004,
    type: 'INBOUND',
    productId: 1,
    productName: '삼각김밥 참치마요',
    lotId: 101,
    expiryDate: '2026-10-24T23:59:59+09:00',
    quantity: 20,
    refId: 'SHP-20261021-070000123-S1',
    createdAt: '2026-10-21T07:00:01+09:00',
  },
  {
    ledgerId: 9003,
    type: 'SALE',
    productId: 2,
    productName: '바나나우유',
    lotId: 202,
    expiryDate: '2026-10-20T23:59:59+09:00',
    quantity: -1,
    refId: '1019',
    createdAt: '2026-10-20T18:22:47+09:00',
  },
  {
    ledgerId: 9002,
    type: 'INBOUND',
    productId: 3,
    productName: '샌드위치 햄치즈',
    lotId: 301,
    expiryDate: '2026-10-22T23:59:59+09:00',
    quantity: 7,
    refId: 'SHP-20261020-050000004-S1',
    createdAt: '2026-10-20T05:00:03+09:00',
  },
  {
    ledgerId: 9001,
    type: 'INBOUND',
    productId: 2,
    productName: '바나나우유',
    lotId: 202,
    expiryDate: '2026-10-20T23:59:59+09:00',
    quantity: 5,
    refId: 'SHP-20261020-050000004-S1',
    createdAt: '2026-10-20T05:00:03+09:00',
  },
]

/**
 * S-30 임박·경과 lot. 유통기한 빠른 순, 수량 0 은 서버가 빼고 내려 준다.
 * S-32 로 폐기하면 1초 뒤(쪽지 처리 흉내) 수량을 줄여 폴링으로 줄어드는 모습을 볼 수 있다
 */
let expiring: ExpiringLot[] = [
  {
    lotId: 201,
    productId: 2,
    productName: '바나나우유',
    expiryDate: '2026-10-23T23:59:59+09:00',
    expired: true,
    quantity: 2,
    reservedQuantity: 0,
    disposableQuantity: 2,
  },
  {
    lotId: 401,
    productId: 4,
    productName: '흰 우유 200ml',
    expiryDate: '2026-10-24T23:59:59+09:00',
    expired: true,
    quantity: 5,
    reservedQuantity: 1,
    disposableQuantity: 4,
  },
  {
    lotId: 202,
    productId: 2,
    productName: '바나나우유',
    expiryDate: '2026-10-25T23:59:59+09:00',
    expired: false,
    quantity: 4,
    reservedQuantity: 0,
    disposableQuantity: 4,
  },
  {
    lotId: 301,
    productId: 3,
    productName: '샌드위치 햄치즈',
    expiryDate: '2026-10-26T09:00:00+09:00',
    expired: false,
    quantity: 2,
    reservedQuantity: 2,
    disposableQuantity: 0,
  },
]

let nextDisposalId = 503

/** S-33 폐기 요청 이력. 최신순. SKIPPED 한 건은 "요청 뒤 처리 전에 예약이 잡힌" 경우를 화면에서 보려고 둔다 */
let disposals: DisposalHistoryItem[] = [
  {
    disposalId: 502,
    lotId: 301,
    productId: 3,
    productName: '샌드위치 햄치즈',
    expiryDate: '2026-10-26T09:00:00+09:00',
    quantity: 2,
    status: 'SKIPPED',
    createdAt: '2026-10-25T09:40:00+09:00',
    processedAt: '2026-10-25T09:40:02+09:00',
  },
  {
    disposalId: 501,
    lotId: 200,
    productId: 2,
    productName: '바나나우유',
    expiryDate: '2026-10-18T23:59:59+09:00',
    quantity: 5,
    status: 'DONE',
    createdAt: '2026-10-25T09:00:00+09:00',
    processedAt: '2026-10-25T09:00:01+09:00',
  },
]

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
  http.get('/api/owner/inventory/ledger', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') as LedgerType | null
    return HttpResponse.json(type ? ledger.filter((item) => item.type === type) : ledger)
  }),
  http.get('/api/owner/inventory/expiring', () => HttpResponse.json(expiring)),
  http.post('/api/owner/disposals', async ({ request }) => {
    const body = (await request.json()) as DisposeRequest
    const lot = expiring.find((item) => item.lotId === body.lotId)
    if (!lot) {
      return HttpResponse.json(
        { code: 'LOT_NOT_FOUND', message: 'lot이 없습니다', traceId: '' },
        { status: 404 },
      )
    }
    if (body.quantity > lot.disposableQuantity) {
      return HttpResponse.json(
        { code: 'INVALID_QUANTITY', message: '수량이 올바르지 않습니다', traceId: '' },
        { status: 400 },
      )
    }
    const response: DisposeResponse = {
      disposalId: nextDisposalId++,
      lotId: lot.lotId,
      quantity: body.quantity,
    }
    const createdAt = new Date().toISOString()
    disposals = [
      {
        disposalId: response.disposalId,
        lotId: lot.lotId,
        productId: lot.productId,
        productName: lot.productName,
        expiryDate: lot.expiryDate,
        quantity: body.quantity,
        status: 'REQUESTED',
        createdAt,
        processedAt: null,
      },
      ...disposals,
    ]
    setTimeout(() => {
      disposals = disposals.map((item) =>
        item.disposalId === response.disposalId
          ? { ...item, status: 'DONE', processedAt: new Date().toISOString() }
          : item,
      )
      expiring = expiring
        .map((item) =>
          item.lotId === body.lotId
            ? {
                ...item,
                quantity: item.quantity - body.quantity,
                disposableQuantity: item.disposableQuantity - body.quantity,
              }
            : item,
        )
        .filter((item) => item.quantity > 0)
    }, 1000)
    return HttpResponse.json(response, { status: 202 })
  }),
  http.get('/api/owner/disposals', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status') as DisposalStatus | null
    return HttpResponse.json(
      status ? disposals.filter((item) => item.status === status) : disposals,
    )
  }),
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
