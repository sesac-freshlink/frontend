import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { InventoryItem, InventoryLotItem } from '../api'
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
    totalQuantity: 20,
    reservedQuantity: 1,
    availableQuantity: 19,
    nearestExpiry: '2026-10-24T23:59:59+09:00',
    imminentLotCount: 0,
    expiredLotCount: 0,
    safetyStock: 5,
    lowStock: false,
  },
  {
    productId: 12,
    productCode: 'P012',
    name: '흰 우유 500ml',
    category: '유제품',
    price: 2100,
    totalQuantity: 12,
    reservedQuantity: 0,
    availableQuantity: 10,
    nearestExpiry: '2026-10-09T23:59:59+09:00',
    imminentLotCount: 1,
    expiredLotCount: 1,
    safetyStock: 12,
    lowStock: true,
  },
  {
    productId: 3,
    productCode: 'P003',
    name: '샌드위치 햄치즈',
    category: '샌드위치',
    price: 3200,
    totalQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    nearestExpiry: null,
    imminentLotCount: 0,
    expiredLotCount: 0,
    safetyStock: 5,
    lowStock: true,
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
    get.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText(/아직 입고된 상품이 없어요/)).toBeInTheDocument()
  })

  it('상품 코드·이름·카테고리·가격·수량 3종·유통기한을 서버 순서대로 보여 준다', async () => {
    get.mockResolvedValue({ data: items })
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

  it('nearestExpiry 가 null 이면 "-" 로 보여 준다', async () => {
    get.mockResolvedValue({ data: items })
    renderPage()
    const row = (await screen.findByText('샌드위치 햄치즈')).closest('tr')!
    expect(within(row).getAllByText('-').length).toBeGreaterThan(0)
  })

  it('임박·경과 lot 이 있는 상품에만 개수 배지를 붙인다', async () => {
    get.mockResolvedValue({ data: items })
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
    get.mockResolvedValue({ data: items })
    renderPage()

    const milk = (await screen.findByText('흰 우유 500ml')).closest('tr')!
    expect(within(milk).getByText('부족')).toHaveAttribute('title', '안전재고 12개보다 적어요')
    const noodle = screen.getByText('매운 컵라면 115g').closest('tr')!
    expect(within(noodle).queryByText('부족')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('안전재고보다 적은 상품 2개')
  })

  it('부족한 상품이 없으면 건수를 보여 주지 않는다', async () => {
    get.mockResolvedValue({ data: items.map((item) => ({ ...item, lowStock: false })) })
    renderPage()
    await screen.findByText('흰 우유 500ml')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('부족한 상품만 보기를 켜면 부족 상품만 남는다', async () => {
    get.mockResolvedValue({ data: items })
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: '부족한 상품만 보기' }))

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('p')?.textContent)
    expect(names).toEqual(['흰 우유 500ml', '샌드위치 햄치즈'])
  })

  it('부족 상품이 없는데 부족만 보기를 켜면 안내 문구를 보여 준다', async () => {
    get.mockResolvedValue({ data: items.map((item) => ({ ...item, lowStock: false })) })
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: '부족한 상품만 보기' }))
    expect(screen.getByText('안전재고보다 적은 상품이 없어요.')).toBeInTheDocument()
  })

  it('안전재고 설정 탭으로 바꾸면 상품별 안전재고를 읽어 온다', async () => {
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/owner/inventory/safety-stocks'
            ? [
                {
                  productId: 15,
                  productCode: 'P015',
                  name: '매운 컵라면 115g',
                  category: '라면',
                  safetyStock: 5,
                  customized: false,
                },
              ]
            : items,
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
    get.mockImplementation((url: string) => {
      if (url === '/owner/inventory') return Promise.resolve({ data: items })
      if (url === '/owner/inventory/12/lots') return lotsResult()
      return Promise.reject(new Error(`unexpected ${url}`))
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

  it('lot 조회 오류는 서버 message 로 보여 준다', async () => {
    mockInventoryAndLots(() =>
      Promise.reject(serverError(404, 'PRODUCT_NOT_FOUND', '상품이 없습니다')),
    )
    renderPage()

    await userEvent.click(await screen.findByText('흰 우유 500ml'))
    expect(await screen.findByText('상품이 없습니다')).toBeInTheDocument()
  })
})
