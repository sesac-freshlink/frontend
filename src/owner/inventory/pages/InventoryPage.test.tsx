import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosRequestConfig } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { InventoryItem, InventoryListPage, InventoryLotItem } from '../api'
import { InventoryPage } from './InventoryPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
const get = vi.mocked(api.get)

const items: InventoryItem[] = [
  {
    productId: 15,
    productCode: 'P015',
    name: '매운 컵라면 115g',
    category: '라면',
    price: 1700,
    imageUrl: 'https://img.example/P015.jpg',
    totalQuantity: 20,
    reservedQuantity: 1,
    availableQuantity: 19,
    nearestExpiry: '2026-10-24T23:59:59+09:00',
    imminentLotCount: 0,
    expiredLotCount: 0,
    safetyStock: 5,
    lowStock: false,
    hasMemo: true,
  },
  {
    productId: 12,
    productCode: 'P012',
    name: '흰 우유 500ml',
    category: '유제품',
    price: 2100,
    imageUrl: null,
    totalQuantity: 12,
    reservedQuantity: 0,
    availableQuantity: 10,
    nearestExpiry: '2026-10-09T23:59:59+09:00',
    imminentLotCount: 1,
    expiredLotCount: 1,
    safetyStock: 12,
    lowStock: true,
    hasMemo: false,
  },
  {
    productId: 3,
    productCode: 'P003',
    name: '샌드위치 햄치즈',
    category: '샌드위치',
    price: 3200,
    imageUrl: null,
    totalQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    nearestExpiry: null,
    imminentLotCount: 0,
    expiredLotCount: 0,
    safetyStock: 5,
    lowStock: true,
    hasMemo: false,
  },
]

const lots: InventoryLotItem[] = [
  {
    lotId: 301,
    expiryDate: '2026-10-09T23:59:59+09:00',
    quantity: 2,
    reservedQuantity: 0,
    availableQuantity: 0,
    status: 'EXPIRED',
  },
  {
    lotId: 302,
    expiryDate: '2026-10-22T23:59:59+09:00',
    quantity: 4,
    reservedQuantity: 1,
    availableQuantity: 3,
    status: 'IMMINENT',
  },
  {
    lotId: 303,
    expiryDate: '2026-10-30T23:59:59+09:00',
    quantity: 6,
    reservedQuantity: 0,
    availableQuantity: 6,
    status: 'NORMAL',
  },
]

/** 서버 오류 모양(common ErrorResponse)으로 axios 오류를 만든다 */
function serverError(status: number, code: string, message: string) {
  const headers = new AxiosHeaders()
  return new AxiosError(message, String(status), { headers }, null, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: { code, message, traceId: '' },
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <InventoryPage />
    </QueryClientProvider>,
  )
}

type Params = Record<string, string | number | boolean>

/**
 * 서버처럼 검색(q)·상태(status 쉼표, 모두 만족)·메모·페이지를 처리해 페이지 응답을 만든다.
 * 순서는 받은 목록 그대로(서버가 정한다). 다른 주소는 others 에서 찾는다
 */
function serveInventory(list: InventoryItem[], others: Record<string, unknown> = {}) {
  return (url: string, config?: AxiosRequestConfig) => {
    if (url !== '/owner/inventory') {
      return url in others
        ? Promise.resolve({ data: others[url] })
        : Promise.reject(new Error(`unexpected ${url}`))
    }
    const params = (config?.params ?? {}) as Params
    const q = String(params.q ?? '').toLowerCase()
    const statuses = String(params.status ?? '')
      .split(',')
      .filter(Boolean)
    const page = Number(params.page ?? 0)
    const size = Number(params.size ?? 20)
    const filtered = list.filter(
      (item) =>
        (!q || item.name.toLowerCase().includes(q) || item.productCode.toLowerCase().includes(q)) &&
        (!params.memo || item.hasMemo) &&
        statuses.every(
          (status) =>
            (status === 'LOW_STOCK' && item.lowStock) ||
            (status === 'IMMINENT' && item.imminentLotCount > 0) ||
            (status === 'EXPIRED' && item.expiredLotCount > 0) ||
            (status === 'SOLD_OUT' && item.availableQuantity === 0),
        ),
    )
    const data: InventoryListPage = {
      items: filtered.slice(page * size, page * size + size),
      page,
      size,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      lowStockCount: list.filter((item) => item.lowStock).length,
    }
    return Promise.resolve({ data })
  }
}

/** 표에 보이는 상품명(서버 순서) */
const shownNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.querySelector('p')?.textContent)

describe('점주 재고 목록 (S-10)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('불러오는 동안 스피너를 보여 준다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('서버 오류 본문의 message 를 보여 준다', async () => {
    get.mockRejectedValue(serverError(403, 'STORE_NOT_LINKED', '연결된 점포가 없습니다'))
    renderPage()
    expect(await screen.findByText('연결된 점포가 없습니다')).toBeInTheDocument()
  })

  it('message 가 없는 오류는 기본 문구로 보여 준다', async () => {
    get.mockRejectedValue(new Error('network'))
    renderPage()
    expect(await screen.findByText('재고를 불러오지 못했어요.')).toBeInTheDocument()
  })

  it('빈 목록이면 안내 문구를 보여 준다', async () => {
    get.mockImplementation(serveInventory([]))
    renderPage()
    expect(await screen.findByText(/아직 입고된 상품이 없어요/)).toBeInTheDocument()
  })

  it('상품 코드·이름·카테고리·가격·수량 3종·유통기한을 서버 순서대로 보여 준다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()

    const row = (await screen.findByText('매운 컵라면 115g')).closest('tr')!
    expect(within(row).getByText('P015')).toBeInTheDocument()
    expect(within(row).getByText('라면')).toBeInTheDocument()
    expect(within(row).getByText('1,700원')).toBeInTheDocument()
    expect(within(row).getByText('20')).toBeInTheDocument()
    expect(within(row).getByText('1')).toBeInTheDocument()
    expect(within(row).getByText('19')).toBeInTheDocument()
    expect(within(row).getByText('10/24')).toBeInTheDocument()

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('p')?.textContent)
    expect(names).toEqual(['매운 컵라면 115g', '흰 우유 500ml', '샌드위치 햄치즈'])
  })

  it('이미지가 있는 상품은 썸네일을, 없는 상품은 자리표시를 보여 준다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()
    const noodle = (await screen.findByText('매운 컵라면 115g')).closest('tr')!
    expect(within(noodle).getByRole('img', { name: '매운 컵라면 115g' })).toHaveAttribute(
      'src',
      'https://img.example/P015.jpg',
    )
    const milk = screen.getByText('흰 우유 500ml').closest('tr')!
    expect(within(milk).getByRole('img', { name: '흰 우유 500ml 이미지 없음' })).toBeInTheDocument()
  })

  it('nearestExpiry 가 null 이면 "-" 로 보여 준다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()
    const row = (await screen.findByText('샌드위치 햄치즈')).closest('tr')!
    expect(within(row).getAllByText('-').length).toBeGreaterThan(0)
  })

  it('임박·경과 lot 이 있는 상품에만 개수 배지를 붙인다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()
    const milk = (await screen.findByText('흰 우유 500ml')).closest('tr')!
    expect(within(milk).getByText('임박 1')).toBeInTheDocument()
    expect(within(milk).getByText('경과 1')).toBeInTheDocument()

    const noodle = screen.getByText('매운 컵라면 115g').closest('tr')!
    expect(within(noodle).queryByText(/임박/)).not.toBeInTheDocument()
    expect(within(noodle).queryByText(/경과/)).not.toBeInTheDocument()
  })
})

describe('안전재고 부족 표시 (S-40)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('구매 가능 수량이 안전재고보다 적은 상품에 부족 배지를 붙이고 위에 건수를 보여 준다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()

    const milk = (await screen.findByText('흰 우유 500ml')).closest('tr')!
    expect(within(milk).getByText('부족')).toHaveAttribute('title', '안전재고 12개보다 적어요')
    const noodle = screen.getByText('매운 컵라면 115g').closest('tr')!
    expect(within(noodle).queryByText('부족')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('안전재고보다 적은 상품 2개')
  })

  it('부족한 상품이 없으면 건수를 보여 주지 않는다', async () => {
    get.mockImplementation(serveInventory(items.map((item) => ({ ...item, lowStock: false }))))
    renderPage()
    await screen.findByText('흰 우유 500ml')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('부족 칩을 누르면 status=LOW_STOCK 으로 서버에 묻고 부족 상품만 남는다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '부족' }))

    expect(screen.getByRole('button', { name: '부족' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(shownNames()).toEqual(['흰 우유 500ml', '샌드위치 햄치즈']))
    expect(get).toHaveBeenCalledWith('/owner/inventory', {
      params: { status: 'LOW_STOCK', page: 0, size: 20 },
    })
  })

  it('부족 상품이 없는데 부족만 보기를 켜면 안내 문구를 보여 준다', async () => {
    get.mockImplementation(serveInventory(items.map((item) => ({ ...item, lowStock: false }))))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '부족' }))
    expect(await screen.findByText('안전재고보다 적은 상품이 없어요.')).toBeInTheDocument()
  })

  it('안전재고 설정 탭으로 바꾸면 상품별 안전재고를 읽어 온다', async () => {
    get.mockImplementation(
      serveInventory(items, {
        '/owner/inventory/safety-stocks': [
          {
            productId: 15,
            productCode: 'P015',
            name: '매운 컵라면 115g',
            category: '라면',
            safetyStock: 5,
            customized: false,
          },
        ],
      }),
    )
    renderPage()
    await userEvent.click(await screen.findByRole('tab', { name: '안전재고 설정' }))

    expect(screen.getByRole('tab', { name: '안전재고 설정' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await screen.findByRole('spinbutton', { name: '매운 컵라면 115g 안전재고' }),
    ).toHaveValue(5)
    expect(get).toHaveBeenCalledWith('/owner/inventory/safety-stocks')
  })
})

describe('lot 상세 패널 (S-11)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  /** lot 응답은 호출될 때 만든다. 미리 만든 거부 Promise 는 붙기 전에 unhandled 로 잡힌다 */
  function mockInventoryAndLots(lotsResult: () => Promise<{ data: InventoryLotItem[] }>) {
    get.mockImplementation((url: string, config?: AxiosRequestConfig) => {
      if (url === '/owner/inventory/12/lots') return lotsResult()
      return serveInventory(items)(url, config)
    })
  }

  it('행을 누르면 그 상품의 lot 을 유통기한·수량·상태 배지와 함께 보여 준다', async () => {
    mockInventoryAndLots(() => Promise.resolve({ data: lots }))
    renderPage()

    await userEvent.click(await screen.findByText('흰 우유 500ml'))

    const panel = await screen.findByRole('complementary', { name: 'lot 상세' })
    expect(within(panel).getByRole('heading', { name: '흰 우유 500ml' })).toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalledWith('/owner/inventory/12/lots'))

    const expired = (await within(panel).findByText('10/09')).closest('tr')!
    expect(within(expired).getByText('경과')).toBeInTheDocument()
    expect(within(expired).getByText('2')).toBeInTheDocument()

    const imminent = within(panel).getByText('10/22').closest('tr')!
    expect(within(imminent).getByText('임박')).toBeInTheDocument()
    expect(within(imminent).getByText('4')).toBeInTheDocument()
    expect(within(imminent).getByText('1')).toBeInTheDocument()
    expect(within(imminent).getByText('3')).toBeInTheDocument()

    const normal = within(panel).getByText('10/30').closest('tr')!
    expect(within(normal).getByText('정상')).toBeInTheDocument()

    // 유통기한 빠른 순서를 화면에서 바꾸지 않는다
    const dates = within(panel)
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td')?.textContent)
    expect(dates).toEqual(['10/09', '10/22', '10/30'])
  })

  it('lot 이 없으면 빈 안내를 보여 주고, 닫기를 누르면 패널이 사라진다', async () => {
    mockInventoryAndLots(() => Promise.resolve({ data: [] }))
    renderPage()

    await userEvent.click(await screen.findByText('흰 우유 500ml'))
    expect(await screen.findByText('남은 lot이 없어요.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('complementary', { name: 'lot 상세' })).not.toBeInTheDocument()
  })

  it('lot 옆 조정 버튼을 누르면 그 lot 의 조정 모달이 열린다 (S-14)', async () => {
    mockInventoryAndLots(() => Promise.resolve({ data: lots }))
    renderPage()

    await userEvent.click(await screen.findByText('흰 우유 500ml'))
    await userEvent.click(await screen.findByRole('button', { name: '10/30 lot 조정' }))

    const dialog = screen.getByRole('dialog', { name: '재고 조정' })
    expect(within(dialog).getByText('흰 우유 500ml · 유통기한 10/30')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('실제 수량')).toHaveValue(6)

    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lot 조회 오류는 서버 message 로 보여 준다', async () => {
    mockInventoryAndLots(() =>
      Promise.reject(serverError(404, 'PRODUCT_NOT_FOUND', '상품이 없습니다')),
    )
    renderPage()

    await userEvent.click(await screen.findByText('흰 우유 500ml'))
    expect(await screen.findByText('상품이 없습니다')).toBeInTheDocument()
  })

  it('lot 응답이 목록이 아니면(배포 사이 어긋남) 화면이 멈추지 않고 패널에 안내만 보여 준다', async () => {
    mockInventoryAndLots(() =>
      Promise.resolve({ data: '<!doctype html>' as unknown as InventoryLotItem[] }),
    )
    renderPage()

    await userEvent.click(await screen.findByText('흰 우유 500ml'))

    const panel = await screen.findByRole('complementary', { name: 'lot 상세' })
    expect(await within(panel).findByText('lot 정보를 불러오지 못했어요.')).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { name: '흰 우유 500ml' })).toBeInTheDocument()
  })
})

describe('점주 상품 메모 (재고 화면)', () => {
  const memoOfRamen = {
    productId: 15,
    productCode: 'P015',
    name: '매운 컵라면 115g',
    category: '라면',
    content: '냉장 2칸에 둠',
    version: 0,
    updatedAt: '2026-10-28T09:10:00+09:00',
  }

  beforeEach(() => {
    get.mockReset()
    get.mockImplementation(serveInventory(items, { '/owner/inventory/memos': [memoOfRamen] }))
  })

  it('메모가 있는 상품의 버튼은 보기, 없는 상품은 쓰기다', async () => {
    renderPage()
    expect(
      await screen.findByRole('button', { name: '매운 컵라면 115g 메모 보기' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '흰 우유 500ml 메모 쓰기' })).toBeInTheDocument()
  })

  it('메모 있음 칩을 누르면 memo=true 로 서버에 묻고 메모가 있는 상품만 남는다', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '메모 있음' }))

    await waitFor(() => expect(shownNames()).toEqual(['매운 컵라면 115g']))
    expect(get).toHaveBeenCalledWith('/owner/inventory', {
      params: { memo: true, page: 0, size: 20 },
    })
  })

  it('부족과 메모 있음을 같이 켜서 남는 상품이 없으면 안내 문구를 보여 준다', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '메모 있음' }))
    await userEvent.click(screen.getByRole('button', { name: '부족' }))
    expect(await screen.findByText('조건에 맞는 상품이 없어요.')).toBeInTheDocument()
  })

  it('메모 버튼을 누르면 메모 모달이 열리고 lot 패널은 열리지 않는다', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '매운 컵라면 115g 메모 보기' }))

    expect(await screen.findByRole('dialog', { name: '상품 메모' })).toBeInTheDocument()
    expect(await screen.findByRole('textbox', { name: '내용' })).toHaveValue('냉장 2칸에 둠')
    expect(get).not.toHaveBeenCalledWith('/owner/inventory/15/lots')
  })

  it('메모 탭으로 바꾸면 메모가 있는 상품만 모아 보여 준다', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('tab', { name: '메모' }))

    expect(await screen.findByText('냉장 2칸에 둠')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '매운 컵라면 115g 메모 수정' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('검색·필터·페이지 (서버가 거르고 자른다)', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('검색어는 다 친 뒤 한 번만 서버에 묻는다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()
    await screen.findByText('매운 컵라면 115g')

    await userEvent.type(screen.getByRole('searchbox', { name: '상품명·코드 검색' }), '우유')

    await waitFor(() => expect(shownNames()).toEqual(['흰 우유 500ml']))
    expect(get).toHaveBeenCalledWith('/owner/inventory', {
      params: { q: '우유', page: 0, size: 20 },
    })
    // 한 글자씩 묻지 않는다
    expect(get).not.toHaveBeenCalledWith('/owner/inventory', {
      params: { q: '우', page: 0, size: 20 },
    })
  })

  it('여러 상태 칩은 쉼표로 이어 보내고 모두 만족하는 상품만 남는다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '임박' }))
    await userEvent.click(screen.getByRole('button', { name: '부족' }))

    await waitFor(() => expect(shownNames()).toEqual(['흰 우유 500ml']))
    expect(get).toHaveBeenCalledWith('/owner/inventory', {
      params: { status: 'IMMINENT,LOW_STOCK', page: 0, size: 20 },
    })
  })

  it('다음 페이지를 누르면 page=1 로 묻고, 조건을 바꾸면 첫 페이지로 돌아간다', async () => {
    const many: InventoryItem[] = Array.from({ length: 25 }, (_, i) => ({
      ...items[0],
      productId: 100 + i,
      productCode: `P${100 + i}`,
      name: `상품 ${String(i + 1).padStart(2, '0')}`,
      lowStock: i % 2 === 0,
    }))
    get.mockImplementation(serveInventory(many))
    renderPage()
    await screen.findByText('상품 01')
    expect(screen.getByText('총 25개')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }))

    expect(await screen.findByText('상품 21')).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
    expect(get).toHaveBeenCalledWith('/owner/inventory', { params: { page: 1, size: 20 } })

    await userEvent.click(screen.getByRole('button', { name: '부족' }))
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeInTheDocument())
    expect(get).toHaveBeenCalledWith('/owner/inventory', {
      params: { status: 'LOW_STOCK', page: 0, size: 20 },
    })
  })

  it('위쪽 부족 건수는 검색·필터와 상관없이 응답의 점포 전체 건수다', async () => {
    get.mockImplementation(serveInventory(items))
    renderPage()
    await userEvent.type(
      await screen.findByRole('searchbox', { name: '상품명·코드 검색' }),
      '컵라면',
    )

    await waitFor(() => expect(shownNames()).toEqual(['매운 컵라면 115g']))
    expect(screen.getByRole('status')).toHaveTextContent('안전재고보다 적은 상품 2개')
  })
})
