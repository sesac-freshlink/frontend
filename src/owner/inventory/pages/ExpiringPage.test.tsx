import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { ExpiringLot } from '../api'
import { ExpiringPage } from './ExpiringPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

const lots: ExpiringLot[] = [
  {
    lotId: 412,
    productId: 3,
    productName: '흰우유 200ml',
    expiryDate: '2026-10-24T23:59:59+09:00',
    expired: true,
    quantity: 10,
    reservedQuantity: 0,
    disposableQuantity: 10,
  },
  {
    lotId: 413,
    productId: 7,
    productName: '제육볶음 도시락',
    expiryDate: '2026-10-24T20:00:00+09:00',
    expired: true,
    quantity: 3,
    reservedQuantity: 1,
    disposableQuantity: 2,
  },
  {
    lotId: 501,
    productId: 15,
    productName: '매운 컵라면 115g',
    expiryDate: '2026-10-25T23:59:59+09:00',
    expired: false,
    quantity: 4,
    reservedQuantity: 0,
    disposableQuantity: 4,
  },
  {
    lotId: 502,
    productId: 12,
    productName: '샌드위치 햄치즈',
    expiryDate: '2026-10-26T09:00:00+09:00',
    expired: false,
    quantity: 2,
    reservedQuantity: 2,
    disposableQuantity: 0,
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

/** 임박 목록은 lots 로, 같이 읽는 폐기 이력(/owner/disposals)은 비어 있게 답한다 */
function mockLots(data: ExpiringLot[]) {
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === '/owner/disposals' ? [] : data }),
  )
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ExpiringPage />
    </QueryClientProvider>,
  )
}

const disposeButton = () => screen.getByRole('button', { name: /선택 폐기/ })

describe('유통기한 관리 (S-30·S-32)', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('불러오는 동안 스피너를 보여 준다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('임박·경과 탭에 건수를 붙이고, 경과가 있으면 경과 탭을 먼저 보여 준다', async () => {
    mockLots(lots)
    renderPage()

    // 역할(role) 찾기는 매번 접근성 트리를 계산해 느리다. 글자로 먼저 기다리고 역할은 한 번만 찾는다
    await screen.findByText('흰우유 200ml')
    expect(screen.getByRole('tab', { name: '경과 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '임박 2' })).toHaveAttribute('aria-selected', 'false')
    expect(get).toHaveBeenCalledWith('/owner/inventory/expiring')
    expect(screen.getByText('흰우유 200ml')).toBeInTheDocument()
    expect(screen.queryByText('매운 컵라면 115g')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: '임박 2' }))

    const noodle = screen.getByText('매운 컵라면 115g').closest('tr')!
    expect(within(noodle).getByText('임박')).toBeInTheDocument()
    expect(within(noodle).getByText('10/25 23:59')).toBeInTheDocument()
    expect(screen.queryByText('흰우유 200ml')).not.toBeInTheDocument()
  })

  it('경과 lot 이 없으면 임박 탭을 먼저 보여 준다', async () => {
    mockLots(lots.filter((lot) => !lot.expired))
    renderPage()
    expect(await screen.findByRole('tab', { name: '임박 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: '경과 0' })).toBeInTheDocument()
  })

  it('폐기 가능 수량이 0 인 lot 은 고를 수 없고 "예약 중" 으로 보인다', async () => {
    mockLots(lots)
    renderPage()
    await userEvent.click(await screen.findByRole('tab', { name: '임박 2' }))

    const row = screen.getByText('샌드위치 햄치즈').closest('tr')!
    expect(within(row).getByRole('checkbox')).toBeDisabled()
    expect(within(row).getByText('예약 중')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '매운 컵라면 115g 선택' })).toBeEnabled()
  })

  it('고른 lot 이 없으면 선택 폐기 버튼이 꺼져 있고, 고르면 개수와 함께 켜진다', async () => {
    mockLots(lots)
    renderPage()
    await screen.findByText('흰우유 200ml')
    expect(disposeButton()).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: '흰우유 200ml 선택' }))
    expect(disposeButton()).toBeEnabled()
    expect(disposeButton()).toHaveTextContent('선택 폐기 (1)')
  })

  it('확인 모달에서 폐기 요청하면 lot 마다 전량을 보내고 성공 토스트를 띄운다', async () => {
    mockLots(lots)
    post.mockImplementation((_url: string, body: unknown) =>
      Promise.resolve({ data: { disposalId: 900, ...(body as object) } }),
    )
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: '흰우유 200ml 선택' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '제육볶음 도시락 선택' }))
    await userEvent.click(disposeButton())

    const dialog = screen.getByRole('dialog', { name: '폐기 요청' })
    expect(within(dialog).getByText('폐기하면 되돌릴 수 없어요.')).toBeInTheDocument()
    expect(within(dialog).getByText('10개')).toBeInTheDocument()
    expect(within(dialog).getByText('2개')).toBeInTheDocument()
    expect(within(dialog).getByText('12개')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: '폐기 요청' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('폐기 요청됨'))
    expect(post).toHaveBeenCalledTimes(2)
    expect(post).toHaveBeenNthCalledWith(1, '/owner/disposals', { lotId: 412, quantity: 10 })
    expect(post).toHaveBeenNthCalledWith(2, '/owner/disposals', { lotId: 413, quantity: 2 })
    expect(toast.error).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // 성공한 lot 은 선택이 풀린다. 수량은 쪽지 처리 뒤 폴링으로 줄어든다
    expect(disposeButton()).toHaveTextContent('선택 폐기 (0)')
  })

  it('409 응답이면 실패한 lot 만 오류 토스트로 알리고 선택을 남긴다', async () => {
    mockLots(lots)
    post.mockImplementation((_url: string, body: unknown) =>
      (body as { lotId: number }).lotId === 413
        ? Promise.reject(serverError(409, 'NOT_DISPOSABLE', '폐기할 수 없는 상태입니다'))
        : Promise.resolve({ data: { disposalId: 901, lotId: 412, quantity: 10 } }),
    )
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: '흰우유 200ml 선택' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '제육볶음 도시락 선택' }))
    await userEvent.click(disposeButton())
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '폐기 요청' }),
    )

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '폐기할 수 없는 상태입니다',
        expect.objectContaining({ description: expect.stringContaining('제육볶음 도시락') }),
      ),
    )
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: '흰우유 200ml 선택' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '제육볶음 도시락 선택' })).toBeChecked()
  })

  it('취소하면 요청하지 않고 선택을 그대로 둔다', async () => {
    mockLots(lots)
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: '흰우유 200ml 선택' }))
    await userEvent.click(disposeButton())
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))

    expect(post).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(disposeButton()).toHaveTextContent('선택 폐기 (1)')
  })

  it('빈 목록이면 안내 문구를 보여 준다', async () => {
    mockLots([])
    renderPage()
    expect(await screen.findByText('임박하거나 지난 lot이 없어요.')).toBeInTheDocument()
  })

  it('서버 오류 본문의 message 를 보여 준다', async () => {
    get.mockImplementation((url: string) =>
      url === '/owner/disposals'
        ? Promise.resolve({ data: [] })
        : Promise.reject(serverError(403, 'STORE_NOT_LINKED', '연결된 점포가 없습니다')),
    )
    renderPage()
    expect(await screen.findByText('연결된 점포가 없습니다')).toBeInTheDocument()
  })
})
