import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { SafetyStockItem } from '../api'
import { SafetyStockSettings } from './SafetyStockSettings'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const put = vi.mocked(api.put)

const safetyStocks: SafetyStockItem[] = [
  {
    productId: 15,
    productCode: 'P015',
    name: '매운 컵라면 115g',
    category: '라면',
    safetyStock: 8,
    customized: true,
  },
  {
    productId: 12,
    productCode: 'P012',
    name: '흰 우유 500ml',
    category: '유제품',
    safetyStock: 5,
    customized: false,
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

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SafetyStockSettings />
    </QueryClientProvider>,
  )
}

const input = (name: string) => screen.getByRole('spinbutton', { name: `${name} 안전재고` })
const saveButton = (name: string) =>
  within(input(name).closest('tr')!).getByRole('button', { name: '저장' })

describe('안전재고 설정 (S-40)', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('불러오는 동안 스피너를 보여 준다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderSettings()
    expect(screen.getByLabelText('불러오는 중')).toBeInTheDocument()
  })

  it('서버 오류 본문의 message 를 보여 준다', async () => {
    get.mockRejectedValue(serverError(403, 'STORE_NOT_LINKED', '연결된 점포가 없습니다'))
    renderSettings()
    expect(await screen.findByText('연결된 점포가 없습니다')).toBeInTheDocument()
  })

  it('상품이 없으면 안내 문구를 보여 준다', async () => {
    get.mockResolvedValue({ data: [] })
    renderSettings()
    expect(await screen.findByText('등록된 상품이 없어요.')).toBeInTheDocument()
  })

  it('상품마다 안전재고와 직접 정했는지를 보여 주고, 값이 그대로면 저장할 수 없다', async () => {
    get.mockResolvedValue({ data: safetyStocks })
    renderSettings()

    expect(
      await screen.findByRole('spinbutton', { name: '매운 컵라면 115g 안전재고' }),
    ).toHaveValue(8)
    expect(
      within(input('매운 컵라면 115g').closest('tr')!).getByText('직접 정함'),
    ).toBeInTheDocument()
    expect(within(input('흰 우유 500ml').closest('tr')!).getByText('기본값')).toBeInTheDocument()
    expect(saveButton('매운 컵라면 115g')).toBeDisabled()
    expect(get).toHaveBeenCalledWith('/owner/inventory/safety-stocks')
  })

  it('값을 바꿔 저장하면 그 상품만 PUT 하고 성공 토스트를 띄운다', async () => {
    get.mockResolvedValue({ data: safetyStocks })
    put.mockResolvedValue({ data: { ...safetyStocks[1], safetyStock: 12, customized: true } })
    renderSettings()

    await userEvent.clear(await screen.findByRole('spinbutton', { name: '흰 우유 500ml 안전재고' }))
    await userEvent.type(input('흰 우유 500ml'), '12')
    await userEvent.click(saveButton('흰 우유 500ml'))

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('흰 우유 500ml 안전재고를 12개로 정했어요'),
    )
    expect(put).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledWith('/owner/inventory/safety-stocks/12', { safetyStock: 12 })
  })

  it('Enter 로도 저장한다', async () => {
    get.mockResolvedValue({ data: safetyStocks })
    put.mockResolvedValue({ data: { ...safetyStocks[0], safetyStock: 0 } })
    renderSettings()

    await userEvent.clear(
      await screen.findByRole('spinbutton', { name: '매운 컵라면 115g 안전재고' }),
    )
    await userEvent.type(input('매운 컵라면 115g'), '0{Enter}')

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/safety-stocks/15', { safetyStock: 0 }),
    )
  })

  it('0~999 정수가 아니면 안내를 보여 주고 저장하지 않는다', async () => {
    get.mockResolvedValue({ data: safetyStocks })
    renderSettings()

    await userEvent.clear(await screen.findByRole('spinbutton', { name: '흰 우유 500ml 안전재고' }))
    await userEvent.type(input('흰 우유 500ml'), '1000')

    expect(screen.getByText('0~999 사이 정수로 넣어 주세요.')).toBeInTheDocument()
    expect(input('흰 우유 500ml')).toHaveAttribute('aria-invalid', 'true')
    expect(saveButton('흰 우유 500ml')).toBeDisabled()
    expect(put).not.toHaveBeenCalled()
  })

  it('저장에 실패하면 서버 message 로 오류 토스트를 띄운다', async () => {
    get.mockResolvedValue({ data: safetyStocks })
    put.mockRejectedValue(serverError(404, 'PRODUCT_NOT_FOUND', '상품이 없습니다'))
    renderSettings()

    await userEvent.clear(await screen.findByRole('spinbutton', { name: '흰 우유 500ml 안전재고' }))
    await userEvent.type(input('흰 우유 500ml'), '3')
    await userEvent.click(saveButton('흰 우유 500ml'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('상품이 없습니다'))
    expect(toast.success).not.toHaveBeenCalled()
  })
})
