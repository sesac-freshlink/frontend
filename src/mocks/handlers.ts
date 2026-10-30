import { http, HttpResponse } from 'msw'
import type { StoreProduct } from '@/customer/stores/api'
import type {
  AdjustmentHistoryItem,
  AdjustRequest,
  AdjustResponse,
  DisposalHistoryItem,
  DisposalStatus,
  DisposeRequest,
  DisposeResponse,
  ExpiringLot,
  ExpiryCalendar,
  ExpiryCalendarLot,
  InventoryItem,
  InventoryLotItem,
  InventoryListPage,
  InventoryStats,
  LedgerItem,
  LedgerType,
  ProductMemo,
  ProductStats,
  SafetyStockItem,
  SalesRankItem,
  SalesRanking,
} from '@/owner/inventory/api'
import { adminHandlers } from './adminHandlers'
import { authHandlers, csrfGuard } from './authHandlers'
import { memberHandlers } from './memberHandlers'
import { orderHandlers } from './orderHandlers'
import { salesHandlers } from './salesHandlers'

/**
 * 백엔드가 나오기 전까지 쓰는 가짜 API. 실제 API 명세(Swagger)가 나오면 응답 모양을 맞춘다.
 * 화면 담당자가 자기 API 핸들러를 여기에 추가한다.
 */
/** 안전재고 두 값(safetyStock·lowStock)과 hasMemo 는 응답할 때 safetyStocks·memos 로 채운다 */
const inventory: Omit<InventoryItem, 'safetyStock' | 'lowStock' | 'hasMemo'>[] = [
  {
    productId: 1,
    productCode: 'P001',
    name: '삼각김밥 참치마요',
    category: '김밥',
    price: 1500,
    imageUrl: 'https://tqklhszfkvzk6518638.edge.naverncp.com/product/8800279675761_2.png',
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
    imageUrl: 'https://tqklhszfkvzk6518638.edge.naverncp.com/product/0000088002798.png',
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
    imageUrl: null,
    totalQuantity: 5,
    reservedQuantity: 2,
    availableQuantity: 3,
    nearestExpiry: null,
    imminentLotCount: 0,
    expiredLotCount: 0,
  },
]

/** S-40 점포 안전재고. 정하지 않은 상품은 5. 바나나우유는 12로 정해 두어 처음부터 부족 배지가 보인다 */
const DEFAULT_SAFETY_STOCK = 5
const safetyStocks = new Map<number, number>([[2, 12]])

function safetyStockOf(productId: number): number {
  return safetyStocks.get(productId) ?? DEFAULT_SAFETY_STOCK
}

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

/** S-13 변동 이력. 최신순, 수량은 부호 포함(입고 +, 판매·폐기 −, 조정 ±). S-14 조정이 앞에 붙는다 */
let ledger: LedgerItem[] = [
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
/** 가짜 최근 7일 순판매. 추천순(POPULAR) 정렬에 쓴다 */
const storeProductSold: Record<number, number> = { 1: 12, 2: 7, 3: 3 }
const storeProducts: StoreProduct[] = [
  {
    productId: 2,
    name: '바나나우유',
    category: '유제품',
    price: 1700,
    imageUrl: 'https://tqklhszfkvzk6518638.edge.naverncp.com/product/0000088002798.png',
    availableQuantity: 10,
    soldOut: false,
    recommended: true,
    newArrival: false,
    firstCome: false,
  },
  {
    productId: 1,
    name: '삼각김밥 참치마요',
    category: '김밥',
    price: 1500,
    imageUrl: 'https://tqklhszfkvzk6518638.edge.naverncp.com/product/8800279675761_2.png',
    availableQuantity: 19,
    soldOut: false,
    recommended: false,
    newArrival: true,
    firstCome: false,
  },
  {
    productId: 3,
    name: '샌드위치 햄치즈',
    category: '샌드위치',
    price: 3200,
    imageUrl: 'https://tqklhszfkvzk6518638.edge.naverncp.com/product/8800271905354_1.png',
    availableQuantity: 3,
    soldOut: false,
    recommended: false,
    newArrival: false,
    firstCome: true,
  },
  {
    productId: 4,
    name: '아메리카노 캔 240ml',
    category: '음료',
    price: 1200,
    imageUrl: null,
    availableQuantity: 0,
    soldOut: true,
    recommended: false,
    newArrival: false,
    firstCome: false,
  },
  {
    productId: 5,
    name: '초코빵',
    category: '빵',
    price: 1800,
    imageUrl: null,
    availableQuantity: 0,
    soldOut: true,
    recommended: true,
    newArrival: true,
    firstCome: false,
  },
]

/** 점주가 추천으로 정한 상품 (가짜) */
const recommendedIds = new Set<number>([2, 5])
/** 점주가 정한 선착순 한도 (가짜) */
const firstComeLimits = new Map<number, number>([[3, 2]])

function firstComeSettingOf(productId: number) {
  const item = inventory.find((i) => i.productId === productId)
  const limit = firstComeLimits.get(productId)
  return {
    productId,
    productCode: item?.productCode ?? '',
    name: item?.name ?? '',
    category: item?.category ?? '',
    firstCome: limit !== undefined,
    limit: limit ?? null,
    used: limit !== undefined ? 0 : null,
    remaining: limit !== undefined ? Math.min(limit, item?.availableQuantity ?? 0) : null,
  }
}

/** S-42 서버처럼 가짜 원장(ledger)을 기간 안에서 상품별로 더한다. 날짜는 createdAt(+09:00)의 앞 10자리 */
function statsOf(from: string, to: string): InventoryStats {
  const byProduct = new Map<number, ProductStats>()
  for (const item of ledger) {
    const day = item.createdAt.slice(0, 10)
    if (day < from || day > to) continue
    const product = storeProducts.find((p) => p.productId === item.productId)
    const row = byProduct.get(item.productId) ?? {
      productId: item.productId,
      productCode: `P${String(item.productId).padStart(3, '0')}`,
      name: item.productName,
      category: product?.category ?? '-',
      inboundQuantity: 0,
      soldQuantity: 0,
      disposedQuantity: 0,
      adjustedQuantity: 0,
      disposalRate: null,
    }
    const quantity = Math.abs(item.quantity)
    if (item.type === 'INBOUND') row.inboundQuantity += quantity
    if (item.type === 'SALE') row.soldQuantity += quantity
    if (item.type === 'DISPOSE') row.disposedQuantity += quantity
    if (item.type === 'ADJUST') row.adjustedQuantity += item.quantity
    byProduct.set(item.productId, row)
  }
  const rate = (sold: number, disposed: number) =>
    sold + disposed === 0 ? null : Math.round((disposed * 10000) / (sold + disposed)) / 10000
  const products = [...byProduct.values()]
    .map((row) => ({ ...row, disposalRate: rate(row.soldQuantity, row.disposedQuantity) }))
    .sort((a, b) => b.disposedQuantity - a.disposedQuantity || b.soldQuantity - a.soldQuantity)
  const sum = (key: 'inboundQuantity' | 'soldQuantity' | 'disposedQuantity' | 'adjustedQuantity') =>
    products.reduce((total, row) => total + row[key], 0)
  return {
    from,
    to,
    inboundQuantity: sum('inboundQuantity'),
    soldQuantity: sum('soldQuantity'),
    disposedQuantity: sum('disposedQuantity'),
    adjustedQuantity: sum('adjustedQuantity'),
    disposalRate: rate(sum('soldQuantity'), sum('disposedQuantity')),
    products,
  }
}

/** 서버처럼 원장 판매(SALE)를 상품별로 더해 많이 판 순으로 매긴다. 같은 수량은 같은 순위 */
function salesRankingOf(from: string, to: string, limit: number): SalesRanking {
  const sold = new Map<number, { name: string; quantity: number }>()
  for (const item of ledger) {
    const day = item.createdAt.slice(0, 10)
    if (item.type !== 'SALE' || day < from || day > to) continue
    const row = sold.get(item.productId) ?? { name: item.productName, quantity: 0 }
    row.quantity += Math.abs(item.quantity)
    sold.set(item.productId, row)
  }
  const total = [...sold.values()].reduce((sum, row) => sum + row.quantity, 0)
  const sorted = [...sold.entries()].sort(
    ([aId, a], [bId, b]) =>
      b.quantity - a.quantity || a.name.localeCompare(b.name, 'ko') || aId - bId,
  )
  const items: SalesRankItem[] = []
  sorted.slice(0, limit).forEach(([productId, row], i) => {
    const product = storeProducts.find((p) => p.productId === productId)
    items.push({
      rank: i > 0 && sorted[i - 1][1].quantity === row.quantity ? items[i - 1].rank : i + 1,
      productId,
      productCode: `P${String(productId).padStart(3, '0')}`,
      name: row.name,
      category: product?.category ?? '-',
      imageUrl: product?.imageUrl ?? null,
      soldQuantity: row.quantity,
      share: Math.round((row.quantity * 10000) / total) / 10000,
    })
  })
  return { from, to, totalSoldQuantity: total, items }
}

let nextAdjustmentId = 7001
let nextLedgerId = 9100

/** S-14 조정 이력. 최신순 */
let adjustments: AdjustmentHistoryItem[] = []

/** S-14 서버처럼 lot·재고 목록·원장·조정 이력을 한 번에 바꾼다. 예약보다 적게 줄이면 409 */
function adjustLot(body: AdjustRequest): AdjustResponse | 'BELOW_RESERVED' | 'LOT_NOT_FOUND' {
  const productId = Number(
    Object.keys(lots).find((key) => lots[Number(key)].some((lot) => lot.lotId === body.lotId)),
  )
  const lot = lots[productId]?.find((item) => item.lotId === body.lotId)
  if (!lot) return 'LOT_NOT_FOUND'
  const before = lot.quantity
  const after = before + body.delta
  if (after < lot.reservedQuantity) return 'BELOW_RESERVED'
  lot.quantity = after
  lot.availableQuantity = lot.status === 'EXPIRED' ? 0 : after - lot.reservedQuantity
  const summary = inventory.find((item) => item.productId === productId)
  if (summary) {
    summary.totalQuantity += body.delta
    if (lot.status !== 'EXPIRED') summary.availableQuantity += body.delta
  }
  const adjustmentId = nextAdjustmentId++
  const now = new Date().toISOString()
  const productName = summary?.name ?? `상품 ${productId}`
  ledger = [
    {
      ledgerId: nextLedgerId++,
      type: 'ADJUST',
      productId,
      productName,
      lotId: lot.lotId,
      expiryDate: lot.expiryDate,
      quantity: body.delta,
      refId: String(adjustmentId),
      createdAt: now,
    },
    ...ledger,
  ]
  adjustments = [
    {
      adjustmentId,
      lotId: lot.lotId,
      productId,
      productName,
      expiryDate: lot.expiryDate,
      delta: body.delta,
      quantityBefore: before,
      quantityAfter: after,
      reason: body.reason,
      memo: body.memo ?? null,
      createdAt: now,
    },
    ...adjustments,
  ]
  return {
    adjustmentId,
    lotId: lot.lotId,
    delta: body.delta,
    quantityBefore: before,
    quantityAfter: after,
  }
}

/** 점주 상품 메모. 상품 하나에 메모 하나. 고칠 때마다 version 이 오른다 */
const memos = new Map<number, ProductMemo>([
  [
    1,
    {
      productId: 1,
      productCode: 'P001',
      name: '삼각김밥 참치마요',
      category: '김밥',
      content: '아침 7시에 앞줄로 진열',
      version: 0,
      updatedAt: '2026-10-28T09:10:00+09:00',
    },
  ],
])

function memoConflict() {
  return HttpResponse.json(
    {
      code: 'MEMO_CHANGED',
      message: '다른 화면에서 메모가 바뀌었습니다. 다시 확인해 주세요',
      traceId: '',
    },
    { status: 409 },
  )
}

function toSafetyStockItem(productId: number): SafetyStockItem | undefined {
  const product = storeProducts.find((item) => item.productId === productId)
  if (!product) return undefined
  return {
    productId,
    productCode: `P${String(productId).padStart(3, '0')}`,
    name: product.name,
    category: product.category,
    safetyStock: safetyStockOf(productId),
    customized: safetyStocks.has(productId),
  }
}

export const handlers = [
  // CSRF 헤더 검사는 맨 앞 (실서버 gateway 와 같게). 통과하면 다음 핸들러로 넘어간다
  csrfGuard,
  ...authHandlers,
  // U-10 카테고리 칩. :productId 보다 먼저 둬야 categories 가 상품 번호로 잡히지 않는다
  http.get('/api/stores/:storeId/products/categories', () =>
    HttpResponse.json(
      [...new Set(storeProducts.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'ko')),
    ),
  ),
  // U-10 상품 상세. 남은 재고가 있으면 먼저 받게 될 상품의 유통기한(가짜: 모레 23:59)
  http.get('/api/stores/:storeId/products/:productId', ({ params }) => {
    const product = storeProducts.find((p) => p.productId === Number(params.productId))
    if (!product) {
      return HttpResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: '상품이 없습니다', traceId: '' },
        { status: 404 },
      )
    }
    const expiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return HttpResponse.json({
      ...product,
      nearestExpiry: product.soldOut ? null : `${expiry}T23:59:59+09:00`,
    })
  }),
  // 서버처럼 검색어(q)·카테고리·추천상품만·신상품만으로 거르고, 추천순이면 많이 팔린 순(같으면 이름순)
  http.get('/api/stores/:storeId/products', ({ request }) => {
    const params = new URL(request.url).searchParams
    const q = (params.get('q') ?? '').trim()
    const category = params.get('category') ?? ''
    let list = [...storeProducts].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    if (q) list = list.filter((p) => p.name.includes(q))
    if (category) list = list.filter((p) => p.category === category)
    if (params.get('recommended') === 'true') list = list.filter((p) => p.recommended)
    if (params.get('newOnly') === 'true') list = list.filter((p) => p.newArrival)
    if (params.get('sort') === 'POPULAR') {
      list.sort(
        (a, b) => (storeProductSold[b.productId] ?? 0) - (storeProductSold[a.productId] ?? 0),
      )
    }
    return HttpResponse.json(list)
  }),
  // 서버처럼 검색(q)·상태(status, 쉼표로 여러 개는 모두 만족)·메모·페이지를 처리한다
  http.get('/api/owner/inventory', ({ request }) => {
    const params = new URL(request.url).searchParams
    const q = (params.get('q') ?? '').trim().toLowerCase()
    const statuses = (params.get('status') ?? '').split(',').filter(Boolean)
    const memoOnly = params.get('memo') === 'true'
    const page = Number(params.get('page') ?? 0)
    const size = Number(params.get('size') ?? 20)
    const all: InventoryItem[] = inventory.map((item) => {
      const safetyStock = safetyStockOf(item.productId)
      return {
        ...item,
        safetyStock,
        lowStock: item.availableQuantity < safetyStock,
        hasMemo: memos.has(item.productId),
      }
    })
    const matches = (item: InventoryItem) =>
      (!q || item.name.toLowerCase().includes(q) || item.productCode.toLowerCase().includes(q)) &&
      (!memoOnly || item.hasMemo) &&
      statuses.every(
        (status) =>
          (status === 'LOW_STOCK' && item.lowStock) ||
          (status === 'IMMINENT' && item.imminentLotCount > 0) ||
          (status === 'EXPIRED' && item.expiredLotCount > 0) ||
          (status === 'SOLD_OUT' && item.availableQuantity === 0),
      )
    const filtered = all.filter(matches).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    return HttpResponse.json<InventoryListPage>({
      items: filtered.slice(page * size, page * size + size),
      page,
      size,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      lowStockCount: all.filter((item) => item.lowStock).length,
    })
  }),
  http.post('/api/owner/inventory/adjustments', async ({ request }) => {
    const body = (await request.json()) as AdjustRequest
    if (!Number.isInteger(body.delta) || body.delta === 0 || Math.abs(body.delta) > 999) {
      return HttpResponse.json(
        { code: 'INVALID_QUANTITY', message: '수량이 올바르지 않습니다', traceId: '' },
        { status: 400 },
      )
    }
    const result = adjustLot(body)
    if (result === 'LOT_NOT_FOUND') {
      return HttpResponse.json(
        { code: 'LOT_NOT_FOUND', message: 'lot이 없습니다', traceId: '' },
        { status: 404 },
      )
    }
    if (result === 'BELOW_RESERVED') {
      return HttpResponse.json(
        { code: 'BELOW_RESERVED', message: '예약된 수량보다 적게 줄일 수 없습니다', traceId: '' },
        { status: 409 },
      )
    }
    return HttpResponse.json(result, { status: 201 })
  }),
  http.get('/api/owner/inventory/adjustments', () => HttpResponse.json(adjustments)),
  http.get('/api/owner/inventory/stats', ({ request }) => {
    const params = new URL(request.url).searchParams
    const to = params.get('to') ?? new Date().toISOString().slice(0, 10)
    const from = params.get('from') ?? to
    if (from > to) {
      return HttpResponse.json(
        {
          code: 'INVALID_DATE_RANGE',
          message: '조회 시작일은 종료일보다 늦을 수 없습니다',
          traceId: '',
        },
        { status: 400 },
      )
    }
    return HttpResponse.json(statsOf(from, to))
  }),
  http.get('/api/owner/inventory/sales-ranking', ({ request }) => {
    const params = new URL(request.url).searchParams
    const to = params.get('to') ?? new Date().toISOString().slice(0, 10)
    const from = params.get('from') ?? to
    const limit = Number(params.get('limit') ?? 10)
    return HttpResponse.json(salesRankingOf(from, to, limit))
  }),
  http.get('/api/owner/inventory/memos', () =>
    HttpResponse.json<ProductMemo[]>(
      [...memos.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ),
  ),
  // 서버처럼 읽은 version 과 지금 version 이 다르면 409. 처음 만들 때는 version 이 없다
  http.put('/api/owner/inventory/memos/:productId', async ({ params, request }) => {
    const productId = Number(params.productId)
    const { content, version } = (await request.json()) as { content: string; version?: number }
    const product = storeProducts.find((item) => item.productId === productId)
    if (!product) {
      return HttpResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: '상품이 없습니다', traceId: '' },
        { status: 404 },
      )
    }
    if (!content?.trim() || content.length > 200) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'content: 1~200자', traceId: '' },
        { status: 400 },
      )
    }
    const existing = memos.get(productId)
    if ((existing?.version ?? undefined) !== version) return memoConflict()
    const memo: ProductMemo = {
      productId,
      productCode: `P${String(productId).padStart(3, '0')}`,
      name: product.name,
      category: product.category,
      content: content.trim(),
      version: existing ? existing.version + 1 : 0,
      updatedAt: new Date().toISOString(),
    }
    memos.set(productId, memo)
    return HttpResponse.json(memo)
  }),
  http.delete('/api/owner/inventory/memos/:productId', ({ params, request }) => {
    const productId = Number(params.productId)
    const version = new URL(request.url).searchParams.get('version')
    const existing = memos.get(productId)
    if (existing && version !== null && Number(version) !== existing.version) return memoConflict()
    memos.delete(productId)
    return new HttpResponse(null, { status: 204 })
  }),
  // 점주 추천상품 설정. 상품 전체, 추천은 고객 가짜 목록(storeProducts)의 recommended 와 같게 시작한다
  http.get('/api/owner/inventory/recommendations', () =>
    HttpResponse.json(
      inventory.map((item) => ({
        productId: item.productId,
        productCode: item.productCode,
        name: item.name,
        category: item.category,
        recommended: recommendedIds.has(item.productId),
      })),
    ),
  ),
  http.put('/api/owner/inventory/recommendations/:productId', ({ params }) => {
    recommendedIds.add(Number(params.productId))
    return HttpResponse.json({ productId: Number(params.productId), recommended: true })
  }),
  http.delete('/api/owner/inventory/recommendations/:productId', ({ params }) => {
    recommendedIds.delete(Number(params.productId))
    return HttpResponse.json({ productId: Number(params.productId), recommended: false })
  }),
  // 점주 선착순 설정. 한도만 기억하고, 센 수량은 0, 남은 수량은 min(한도, 구매 가능 수량)
  http.get('/api/owner/inventory/first-come', () =>
    HttpResponse.json(inventory.map((item) => firstComeSettingOf(item.productId))),
  ),
  http.put('/api/owner/inventory/first-come/:productId', async ({ params, request }) => {
    const { limit } = (await request.json()) as { limit: number }
    firstComeLimits.set(Number(params.productId), limit)
    return HttpResponse.json(firstComeSettingOf(Number(params.productId)))
  }),
  http.delete('/api/owner/inventory/first-come/:productId', ({ params }) => {
    firstComeLimits.delete(Number(params.productId))
    return HttpResponse.json(firstComeSettingOf(Number(params.productId)))
  }),
  http.get('/api/owner/inventory/safety-stocks', () =>
    HttpResponse.json<SafetyStockItem[]>(
      [...storeProducts]
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .map((product) => toSafetyStockItem(product.productId)!),
    ),
  ),
  http.put('/api/owner/inventory/safety-stocks/:productId', async ({ params, request }) => {
    const productId = Number(params.productId)
    const { safetyStock } = (await request.json()) as { safetyStock: number }
    if (!storeProducts.some((product) => product.productId === productId)) {
      return HttpResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: '상품이 없습니다', traceId: '' },
        { status: 404 },
      )
    }
    if (!Number.isInteger(safetyStock) || safetyStock < 0 || safetyStock > 999) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'safetyStock: 0~999', traceId: '' },
        { status: 400 },
      )
    }
    safetyStocks.set(productId, safetyStock)
    return HttpResponse.json(toSafetyStockItem(productId))
  }),
  http.get('/api/owner/inventory/ledger', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type') as LedgerType | null
    return HttpResponse.json(type ? ledger.filter((item) => item.type === type) : ledger)
  }),
  http.get('/api/owner/inventory/expiring', () => HttpResponse.json(expiring)),
  // 유통기한 달력. 가짜 lot(상품별)에서 그 달에 기한이 끝나고 수량이 남은 것을 날짜별로 묶는다
  http.get('/api/owner/inventory/expiry-calendar', ({ request }) => {
    const month =
      new URL(request.url).searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
    const byDate = new Map<string, ExpiryCalendarLot[]>()
    for (const [productId, productLots] of Object.entries(lots)) {
      const item = inventory.find((p) => p.productId === Number(productId))
      for (const lot of productLots) {
        if (lot.quantity <= 0 || lot.expiryDate.slice(0, 7) !== month) continue
        const date = lot.expiryDate.slice(0, 10)
        byDate.set(date, [
          ...(byDate.get(date) ?? []),
          {
            lotId: lot.lotId,
            productId: Number(productId),
            productCode: item?.productCode ?? `P${String(productId).padStart(3, '0')}`,
            name: item?.name ?? `상품 ${productId}`,
            expiryDate: lot.expiryDate,
            quantity: lot.quantity,
            reservedQuantity: lot.reservedQuantity,
            status: lot.status,
          },
        ])
      }
    }
    const days = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayLots]) => ({
        date,
        lotCount: dayLots.length,
        quantity: dayLots.reduce((sum, lot) => sum + lot.quantity, 0),
        lots: dayLots,
      }))
    return HttpResponse.json<ExpiryCalendar>({ month, days })
  }),
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
  ...salesHandlers,
]
