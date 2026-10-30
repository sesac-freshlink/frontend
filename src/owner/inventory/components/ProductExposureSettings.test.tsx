import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { FirstComeSetting, RecommendationItem } from '../api'
import { ProductExposureSettings } from './ProductExposureSettings'

vi.mock('@/shared/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const put = vi.mocked(api.put)
const del = vi.mocked(api.delete)

const recommendations: RecommendationItem[] = [
  {
    productId: 15,
    productCode: 'P015',
    name: '매운 컵라면 115g',
    category: '라면',
    recommended: true,
  },
  {
    productId: 12,
    productCode: 'P012',
    name: '흰 우유 500ml',
    category: '유제품',
    recommended: false,
  },
]

const firstCome: FirstComeSetting[] = [
  {
    productId: 15,
    productCode: 'P015',
    name: '매운 컵라면 115g',
    category: '라면',
    firstCome: true,
    limit: 3,
    used: 1,
    remaining: 2,
  },
  {
    productId: 12,
    productCode: 'P012',
    name: '흰 우유 500ml',
    category: '유제품',
    firstCome: false,
    limit: null,
    used: null,
    remaining: null,
  },
]

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

function serve() {
  get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === '/owner/inventory/recommendations' ? recommendations : firstCome,
    }),
  )
}

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ProductExposureSettings />
    </QueryClientProvider>,
  )
}

async function rowOf(name: string) {
  return (await screen.findByText(name)).closest('tr')!
}

describe('추천·선착순 설정', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    del.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('상품마다 추천 여부와 선착순 한도·남은 수량을 보여 준다', async () => {
    serve()
    renderSettings()

    const noodle = await rowOf('매운 컵라면 115g')
    expect(within(noodle).getByRole('button', { name: '매운 컵라면 115g 추천' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      within(noodle).getByRole('spinbutton', { name: '매운 컵라면 115g 선착순 한도' }),
    ).toHaveValue(3)
    expect(within(noodle).getByText('남은 2개')).toBeInTheDocument()
    expect(within(noodle).getByRole('button', { name: '끄기' })).toBeInTheDocument()

    const milk = await rowOf('흰 우유 500ml')
    expect(within(milk).getByRole('button', { name: '흰 우유 500ml 추천' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(milk).getByRole('button', { name: '선착순 켜기' })).toBeDisabled()
    expect(within(milk).queryByRole('button', { name: '끄기' })).not.toBeInTheDocument()
  })

  it('추천 버튼은 켜면 PUT, 끄면 DELETE 를 보낸다', async () => {
    serve()
    put.mockResolvedValue({ data: {} })
    del.mockResolvedValue({ data: {} })
    renderSettings()

    await userEvent.click(
      within(await rowOf('흰 우유 500ml')).getByRole('button', { name: '흰 우유 500ml 추천' }),
    )
    await waitFor(() => expect(put).toHaveBeenCalledWith('/owner/inventory/recommendations/12'))

    await userEvent.click(
      within(await rowOf('매운 컵라면 115g')).getByRole('button', {
        name: '매운 컵라면 115g 추천',
      }),
    )
    await waitFor(() => expect(del).toHaveBeenCalledWith('/owner/inventory/recommendations/15'))
  })

  it('한도를 넣고 선착순 켜기를 누르면 그 한도로 PUT 한다', async () => {
    serve()
    put.mockResolvedValue({ data: {} })
    renderSettings()
    const milk = await rowOf('흰 우유 500ml')

    await userEvent.type(
      within(milk).getByRole('spinbutton', { name: '흰 우유 500ml 선착순 한도' }),
      '5',
    )
    await userEvent.click(within(milk).getByRole('button', { name: '선착순 켜기' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/first-come/12', { limit: 5 }),
    )
    expect(toast.success).toHaveBeenCalledWith('흰 우유 500ml 선착순 한도를 5개로 정했어요')
  })

  it('한도가 1~999 정수가 아니면 안내하고 저장할 수 없다', async () => {
    serve()
    renderSettings()
    const milk = await rowOf('흰 우유 500ml')

    await userEvent.type(
      within(milk).getByRole('spinbutton', { name: '흰 우유 500ml 선착순 한도' }),
      '0',
    )

    expect(within(milk).getByText('1~999 사이 정수로 넣어 주세요.')).toBeInTheDocument()
    expect(within(milk).getByRole('button', { name: '선착순 켜기' })).toBeDisabled()
  })

  it('끄기를 누르면 DELETE 를 보내고, 실패하면 서버 message 를 알린다', async () => {
    serve()
    del.mockRejectedValue(serverError(404, 'PRODUCT_NOT_FOUND', '상품이 없습니다'))
    renderSettings()

    await userEvent.click(
      within(await rowOf('매운 컵라면 115g')).getByRole('button', { name: '끄기' }),
    )

    await waitFor(() => expect(del).toHaveBeenCalledWith('/owner/inventory/first-come/15'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('상품이 없습니다'))
  })
})
