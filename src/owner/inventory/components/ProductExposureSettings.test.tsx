import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { FirstComeSetting, RecommendationItem } from '../api'
import {
  FirstComeSettings,
  LIMIT_SAVE_DELAY_MS,
  RecommendSettings,
} from './ProductExposureSettings'

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

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. 열고 닫기만 흉내 낸다 (매출 날짜 창 테스트와 같음)
const proto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>
const showModal = proto.showModal
const close = proto.close
beforeAll(() => {
  proto.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  proto.close ??= function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    setTimeout(() => this.dispatchEvent(new Event('close')), 0)
  }
})
afterAll(() => {
  proto.showModal = showModal
  proto.close = close
})

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

/** 재고 목록 한 쪽(브랜드·판매 가능·상태 칸). 흰 우유는 아직 재고 목록에 없다고 둔다 */
const inventoryPage = {
  items: [{ productId: 15, brand: '농심', availableQuantity: 0, lowStock: true, safetyStock: 5 }],
  page: 0,
  size: 100,
  totalElements: 1,
  totalPages: 1,
}

function serve() {
  get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/owner/inventory/recommendations'
          ? recommendations
          : url === '/owner/inventory'
            ? inventoryPage
            : firstCome,
    }),
  )
}

function renderSettings(tab: 'recommend' | 'firstCome') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      {tab === 'recommend' ? <RecommendSettings /> : <FirstComeSettings />}
    </QueryClientProvider>,
  )
}

async function rowOf(name: string) {
  return (await screen.findByText(name)).closest('tr')!
}

describe('추천·선착순 탭 (11/14 탭 나눔)', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    del.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('추천 탭은 재고 목록과 같은 칸에 [켜기]/[끄기] 하나로 추천 여부를 보이고 선착순 칸은 없다', async () => {
    serve()
    renderSettings('recommend')

    const noodle = await rowOf('매운 컵라면 115g')
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent?.trim())).toEqual([
      '',
      '카테고리',
      '브랜드',
      '상품명',
      '판매 가능',
      '재고 상태',
      '추천',
    ])
    expect(
      within(noodle).getByRole('button', { name: '매운 컵라면 115g 추천 끄기' }),
    ).toBeInTheDocument()
    const milk = await rowOf('흰 우유 500ml')
    expect(
      within(milk).getByRole('button', { name: '흰 우유 500ml 추천 켜기' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /선착순 한도/ })).not.toBeInTheDocument()
    expect(get).not.toHaveBeenCalledWith('/owner/inventory/first-come')
  })

  it('선착순 탭은 재고 목록과 같은 칸에 남은 수량·한도·[켜기]/[끄기]를 두고 추천 버튼은 없다', async () => {
    serve()
    renderSettings('firstCome')
    // 추천 목록은 읽지 않는다(상품 이름·카테고리는 선착순 목록에 있다)
    await rowOf('매운 컵라면 115g')
    expect(get).not.toHaveBeenCalledWith('/owner/inventory/recommendations')
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent?.trim())).toEqual([
      '카테고리',
      '브랜드',
      '상품명',
      '판매 가능',
      '재고 상태',
      '선착순 남은 수량',
      '한도',
      '선착순',
    ])
    // 입력·버튼 칸은 정렬하지 않는다
    expect(screen.queryByRole('button', { name: '한도' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '선착순' })).not.toBeInTheDocument()

    const noodle = await rowOf('매운 컵라면 115g')
    expect(
      within(noodle).getByRole('textbox', { name: '매운 컵라면 115g 선착순 한도' }),
    ).toHaveValue('3')
    // 선착순 남은 수량: 다른 수량 칸처럼 숫자만(단위 없음)
    expect(within(noodle).getAllByRole('cell')[5]).toHaveTextContent(/^2$/)
    // 한도 칸은 [−] 숫자 [+], 저장 아이콘 없음 (11/15)
    expect(
      within(noodle).getByRole('button', { name: '매운 컵라면 115g 한도 줄이기' }),
    ).toBeEnabled()
    expect(
      within(noodle).getByRole('button', { name: '매운 컵라면 115g 한도 늘리기' }),
    ).toBeEnabled()
    expect(screen.queryByRole('button', { name: /한도 저장/ })).not.toBeInTheDocument()
    expect(
      within(noodle).getByRole('button', { name: '매운 컵라면 115g 선착순 끄기' }),
    ).toHaveTextContent('끄기')

    const milk = await rowOf('흰 우유 500ml')
    // 흐린 비활성으로 두지 않는다(누르면 모달로 안내)
    expect(within(milk).getByRole('button', { name: '흰 우유 500ml 선착순 켜기' })).toBeEnabled()
    expect(within(milk).queryByRole('button', { name: /끄기/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /추천/ })).not.toBeInTheDocument()
  })

  it('추천 버튼은 켜면 PUT, 끄면 DELETE 를 보낸다', async () => {
    serve()
    put.mockResolvedValue({ data: {} })
    del.mockResolvedValue({ data: {} })
    renderSettings('recommend')

    await userEvent.click(
      within(await rowOf('흰 우유 500ml')).getByRole('button', { name: '흰 우유 500ml 추천 켜기' }),
    )
    await waitFor(() => expect(put).toHaveBeenCalledWith('/owner/inventory/recommendations/12'))

    await userEvent.click(
      within(await rowOf('매운 컵라면 115g')).getByRole('button', {
        name: '매운 컵라면 115g 추천 끄기',
      }),
    )
    await waitFor(() => expect(del).toHaveBeenCalledWith('/owner/inventory/recommendations/15'))
  })

  it('한도를 넣고 선착순 켜기를 누르면 그 한도로 PUT 한다', async () => {
    serve()
    put.mockResolvedValue({ data: {} })
    renderSettings('firstCome')
    const milk = await rowOf('흰 우유 500ml')

    await userEvent.type(
      within(milk).getByRole('textbox', { name: '흰 우유 500ml 선착순 한도' }),
      '5',
    )
    await userEvent.click(within(milk).getByRole('button', { name: '흰 우유 500ml 선착순 켜기' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/first-come/12', { limit: 5 }),
    )
    expect(toast.success).toHaveBeenCalledWith('흰 우유 500ml 선착순 한도를 5개로 정했어요')
  })

  it.each(['', '0', '1000'])(
    '한도가 1~999 숫자가 아니면(%j) [켜기]를 눌렀을 때 모달로 안내하고 보내지 않는다',
    async (value) => {
      serve()
      renderSettings('firstCome')
      const milk = await rowOf('흰 우유 500ml')

      if (value) {
        await userEvent.type(
          within(milk).getByRole('textbox', { name: '흰 우유 500ml 선착순 한도' }),
          value,
        )
      }
      await userEvent.click(within(milk).getByRole('button', { name: '흰 우유 500ml 선착순 켜기' }))

      const dialog = await screen.findByRole('dialog', { name: '한도를 1~999로 넣어 주세요' })
      expect(put).not.toHaveBeenCalled()
      await userEvent.click(within(dialog).getByRole('button', { name: '확인' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    },
  )

  it('켜진 줄은 −/+ 를 연달아 눌러도 잠깐 뒤 마지막 값 한 번만 저장한다 (11/15)', async () => {
    serve()
    put.mockResolvedValue({ data: {} })
    renderSettings('firstCome')
    const noodle = await rowOf('매운 컵라면 115g')
    const plus = within(noodle).getByRole('button', { name: '매운 컵라면 115g 한도 늘리기' })

    await userEvent.click(plus)
    await userEvent.click(plus)
    await userEvent.click(plus)
    await userEvent.click(
      within(noodle).getByRole('button', { name: '매운 컵라면 115g 한도 줄이기' }),
    )
    expect(
      within(noodle).getByRole('textbox', { name: '매운 컵라면 115g 선착순 한도' }),
    ).toHaveValue('5')
    expect(put).not.toHaveBeenCalled()

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/first-come/15', { limit: 5 }),
    )
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('+ 를 누르고 저장 전에 [끄기]를 누르면 기다리던 저장을 버려 다시 켜지지 않는다', async () => {
    serve()
    put.mockResolvedValue({ data: {} })
    del.mockResolvedValue({ data: {} })
    renderSettings('firstCome')
    const noodle = await rowOf('매운 컵라면 115g')

    await userEvent.click(
      within(noodle).getByRole('button', { name: '매운 컵라면 115g 한도 늘리기' }),
    )
    await userEvent.click(
      within(noodle).getByRole('button', { name: '매운 컵라면 115g 선착순 끄기' }),
    )
    await waitFor(() => expect(del).toHaveBeenCalledWith('/owner/inventory/first-come/15'))

    // 저장 기다림(0.6초)이 지나도 한도 저장(=다시 켜기)을 보내지 않는다
    await new Promise((resolve) => setTimeout(resolve, LIMIT_SAVE_DELAY_MS + 200))
    expect(put).not.toHaveBeenCalled()
  })

  it('켜진 줄은 숫자를 직접 넣고 Enter 면 저장하고, 같은 한도면 보내지 않는다', async () => {
    serve()
    put.mockResolvedValue({ data: {} })
    renderSettings('firstCome')
    const noodle = await rowOf('매운 컵라면 115g')
    const input = within(noodle).getByRole('textbox', { name: '매운 컵라면 115g 선착순 한도' })

    await userEvent.type(input, '{Enter}')
    expect(put).not.toHaveBeenCalled()

    await userEvent.clear(input)
    await userEvent.type(input, '8{Enter}')
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/first-come/15', { limit: 8 }),
    )
  })

  it('−/+ 는 1 아래·999 위로 넘어가지 않고, 꺼진 줄은 [켜기] 때 그 한도로 켠다 (11/15)', async () => {
    serve()
    put.mockResolvedValue({ data: {} })
    renderSettings('firstCome')
    const milk = await rowOf('흰 우유 500ml')
    const input = within(milk).getByRole('textbox', { name: '흰 우유 500ml 선착순 한도' })
    const minus = within(milk).getByRole('button', { name: '흰 우유 500ml 한도 줄이기' })
    const plus = within(milk).getByRole('button', { name: '흰 우유 500ml 한도 늘리기' })

    await userEvent.click(minus)
    expect(input).toHaveValue('1')
    // 끝에 닿으면 그쪽 버튼은 흐리게 막힌다
    expect(minus).toBeDisabled()
    await userEvent.type(input, '{Backspace}999')
    expect(plus).toBeDisabled()
    expect(minus).toBeEnabled()
    expect(input).toHaveValue('999')
    await userEvent.click(minus)
    await userEvent.click(minus)
    // 꺼진 줄은 −/+ 만으로는 보내지 않는다
    expect(put).not.toHaveBeenCalled()

    await userEvent.click(within(milk).getByRole('button', { name: '흰 우유 500ml 선착순 켜기' }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/first-come/12', { limit: 997 }),
    )
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('끄기를 누르면 DELETE 를 보내고, 실패하면 서버 message 를 알린다', async () => {
    serve()
    del.mockRejectedValue(serverError(404, 'PRODUCT_NOT_FOUND', '상품이 없습니다'))
    renderSettings('firstCome')

    await userEvent.click(
      within(await rowOf('매운 컵라면 115g')).getByRole('button', {
        name: '매운 컵라면 115g 선착순 끄기',
      }),
    )

    await waitFor(() => expect(del).toHaveBeenCalledWith('/owner/inventory/first-come/15'))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('상품이 없습니다'))
  })

  it('여러 상품을 골라 추천을 한 번에 켜고, 끝나면 선택이 풀린다', async () => {
    serve()
    put.mockResolvedValue({
      data: recommendations.map((item) => ({ ...item, recommended: true })),
    })
    renderSettings('recommend')

    const toggleOn = await screen.findByRole('button', { name: '선택 추천 켜기' })
    // 흐리게 막지 않고, 0개 고른 채 누르면 모달로 알린다 (11/15)
    await userEvent.click(toggleOn)
    const dialog = await screen.findByRole('dialog', { name: '상품을 먼저 골라 주세요' })
    expect(put).not.toHaveBeenCalled()
    expect(within(dialog).queryByRole('button', { name: '닫기' })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '확인' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: '전체 선택' }))
    expect(screen.getByText('2개 선택')).toBeInTheDocument()
    await userEvent.click(toggleOn)

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/recommendations', {
        productIds: [15, 12],
        recommended: true,
      }),
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('2개 상품을 추천했어요'))
    expect(screen.getByText('0개 선택')).toBeInTheDocument()
  })

  it('하나만 골라 추천을 끌 수 있고, 실패하면 서버 메시지를 띄운다', async () => {
    serve()
    put.mockRejectedValue(serverError(404, 'PRODUCT_NOT_FOUND', '상품이 없습니다'))
    renderSettings('recommend')

    await userEvent.click(await screen.findByRole('checkbox', { name: '매운 컵라면 115g 선택' }))
    await userEvent.click(screen.getByRole('button', { name: '선택 추천 끄기' }))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/recommendations', {
        productIds: [15],
        recommended: false,
      }),
    )
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('상품이 없습니다'))
    // 실패하면 선택을 그대로 둔다
    expect(screen.getByText('1개 선택')).toBeInTheDocument()
  })

  it.each(['recommend', 'firstCome'] as const)(
    '재고 목록의 브랜드·재고 상태를 상품 번호로 붙이고, 없으면 "-" (%s)',
    async (tab) => {
      serve()
      renderSettings(tab)

      const noodle = await rowOf('매운 컵라면 115g')
      expect(await within(noodle).findByText('농심')).toBeInTheDocument()
      expect(within(noodle).getByText('품절')).toBeInTheDocument()
      // 재고를 모르면 브랜드·재고 상태가 "-"
      expect(within(await rowOf('흰 우유 500ml')).getAllByText('-').length).toBeGreaterThanOrEqual(
        2,
      )
      expect(get).toHaveBeenCalledWith('/owner/inventory', {
        params: { page: 0, size: 100 },
      })
    },
  )

  it('상품명 검색·품절 칩으로 거르고, [전체]를 누르면 다 푼다 (11/15)', async () => {
    serve()
    renderSettings('recommend')
    await within(await rowOf('매운 컵라면 115g')).findByText('농심')

    await userEvent.type(screen.getByRole('searchbox', { name: '상품명 검색' }), '우유')
    expect(screen.queryByText('매운 컵라면 115g')).not.toBeInTheDocument()
    expect(screen.getByText('흰 우유 500ml')).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('searchbox', { name: '상품명 검색' }))

    // 재고를 모르는 흰 우유는 품절 칩에서 빠진다
    await userEvent.click(screen.getByRole('button', { name: '품절' }))
    expect(screen.getByText('매운 컵라면 115g')).toBeInTheDocument()
    expect(screen.queryByText('흰 우유 500ml')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '부족' }))
    await userEvent.click(screen.getByRole('button', { name: '전체' }))
    expect(screen.getByRole('button', { name: '품절' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('흰 우유 500ml')).toBeInTheDocument()
  })

  it('칸 제목을 누르면 그 칸으로 정렬하고, 한 번 더 누르면 반대로 (11/15)', async () => {
    serve()
    renderSettings('firstCome')
    await rowOf('매운 컵라면 115g')
    const names = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((tr) => within(tr).getAllByRole('cell')[2].textContent)

    // 서버 순서 그대로
    expect(names()).toEqual(['매운 컵라면 115g', '흰 우유 500ml'])
    await userEvent.click(screen.getByRole('button', { name: '상품명' }))
    expect(names()).toEqual(['매운 컵라면 115g', '흰 우유 500ml'])
    await userEvent.click(screen.getByRole('button', { name: '상품명' }))
    expect(names()).toEqual(['흰 우유 500ml', '매운 컵라면 115g'])
    expect(screen.getByRole('columnheader', { name: '상품명' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('선착순 탭 칩으로 선착순 중·안 함만 거른다 (11/15)', async () => {
    serve()
    renderSettings('firstCome')
    await rowOf('매운 컵라면 115g')

    await userEvent.click(screen.getByRole('button', { name: '선착순 안 함' }))
    expect(screen.queryByText('매운 컵라면 115g')).not.toBeInTheDocument()
    expect(screen.getByText('흰 우유 500ml')).toBeInTheDocument()
  })

  it('추천 탭 칩으로 추천 중·추천 안 함만 거르고, 기본은 전체다 (11/14)', async () => {
    serve()
    renderSettings('recommend')

    await rowOf('매운 컵라면 115g')
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('흰 우유 500ml')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '추천 중' }))
    expect(screen.getByText('매운 컵라면 115g')).toBeInTheDocument()
    expect(screen.queryByText('흰 우유 500ml')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '추천 안 함' }))
    expect(screen.queryByText('매운 컵라면 115g')).not.toBeInTheDocument()
    expect(screen.getByText('흰 우유 500ml')).toBeInTheDocument()
  })

  it.each([
    ['recommend', '추천'],
    ['firstCome', '선착순'],
  ] as const)(
    '재고 목록에 상품이 없으면 입고 뒤에 정할 수 있다고 안내한다 (%s)',
    async (tab, label) => {
      get.mockResolvedValue({ data: [] })
      renderSettings(tab)

      expect(
        await screen.findByText(
          `재고 목록에 상품이 없어요. 입고되면 여기서 ${label}을 정할 수 있어요.`,
        ),
      ).toBeInTheDocument()
    },
  )
})
