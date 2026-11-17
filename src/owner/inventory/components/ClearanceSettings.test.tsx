import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import type { ClearanceSettingItem } from '../api'
import { ClearanceSettings } from './ClearanceSettings'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const get = vi.mocked(api.get)
const put = vi.mocked(api.put)

const settings: ClearanceSettingItem[] = [
  {
    category: '김밥',
    enabled: true,
    discountPercent: 30,
    saleStartHour: 6,
    saleEndHour: 23,
    customized: false,
  },
  {
    category: '유제품',
    enabled: false,
    discountPercent: 50,
    saleStartHour: 8,
    saleEndHour: 20,
    customized: true,
  },
  {
    category: '도시락',
    enabled: true,
    discountPercent: 40,
    saleStartHour: 6,
    saleEndHour: 23,
    customized: true,
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

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ClearanceSettings />
    </QueryClientProvider>,
  )
}

const row = (category: string) =>
  screen.getByRole('checkbox', { name: `${category} 마감세일 적용` }).closest('tr')!
const saveButton = (category: string) => within(row(category)).getByRole('button', { name: '저장' })
const discountInput = (category: string) =>
  screen.getByRole('textbox', { name: `${category} 할인율` })
const categories = () =>
  screen
    .getAllByRole('checkbox', { name: /마감세일 적용$/ })
    .map((box) => box.getAttribute('aria-label')!.replace(' 마감세일 적용', ''))

describe('분류별 마감세일 설정', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
    get.mockResolvedValue({ data: settings })
  })

  it('분류마다 적용·할인율·판매 시간과 기본값 여부를 보여 준다', async () => {
    renderSettings()

    expect(await screen.findByRole('checkbox', { name: '김밥 마감세일 적용' })).toBeChecked()
    expect(discountInput('김밥')).toHaveValue('30')
    expect(screen.getByRole('combobox', { name: '김밥 판매 시작' })).toHaveValue('6')
    expect(screen.getByRole('combobox', { name: '김밥 판매 끝' })).toHaveValue('23')
    expect(within(row('김밥')).getByText('기본값')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '유제품 마감세일 적용' })).not.toBeChecked()
    // 적용하지 않은 분류는 할인율·시간을 고칠 수 없다
    expect(discountInput('유제품')).toBeDisabled()
    expect(screen.getByRole('button', { name: '유제품 할인율 10% 올리기' })).toBeDisabled()
    expect(within(row('유제품')).getByText('직접 정함')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/inventory/clearance-settings')
  })

  it('−/+ 는 10%씩 움직이고 10~90에서 멈춘다', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByRole('checkbox', { name: '김밥 마감세일 적용' })
    const up = screen.getByRole('button', { name: '김밥 할인율 10% 올리기' })
    const down = screen.getByRole('button', { name: '김밥 할인율 10% 내리기' })
    await user.click(up)
    expect(discountInput('김밥')).toHaveValue('40')
    for (let i = 0; i < 6; i++) await user.click(up)
    expect(discountInput('김밥')).toHaveValue('90')
    expect(up).toBeDisabled()
    for (let i = 0; i < 8; i++) await user.click(down)
    expect(discountInput('김밥')).toHaveValue('10')
    expect(down).toBeDisabled()
  })

  it('바꾼 값을 그 분류만 저장한다', async () => {
    const user = userEvent.setup()
    put.mockResolvedValue({ data: { ...settings[0], discountPercent: 50, customized: true } })
    renderSettings()

    await screen.findByRole('checkbox', { name: '김밥 마감세일 적용' })
    expect(saveButton('김밥')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '김밥 할인율 10% 올리기' }))
    await user.click(screen.getByRole('button', { name: '김밥 할인율 10% 올리기' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '김밥 판매 끝' }), '24')
    await user.click(saveButton('김밥'))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/clearance-settings', {
        category: '김밥',
        enabled: true,
        discountPercent: 50,
        saleStartHour: 6,
        saleEndHour: 24,
      }),
    )
    expect(toast.success).toHaveBeenCalledWith('김밥 마감세일을 50%, 06시~24시로 정했어요')
  })

  it('할인율이 범위 밖이거나 시작이 끝보다 늦으면 저장하지 않는다', async () => {
    const user = userEvent.setup()
    renderSettings()

    const discount = await screen.findByRole('textbox', { name: '김밥 할인율' })
    await user.clear(discount)
    await user.type(discount, '95')
    expect(screen.getByText('10~90 사이 정수로 넣어 주세요.')).toBeInTheDocument()
    expect(saveButton('김밥')).toBeDisabled()

    await user.clear(discount)
    await user.type(discount, '40')
    await user.selectOptions(screen.getByRole('combobox', { name: '김밥 판매 시작' }), '23')
    await user.selectOptions(screen.getByRole('combobox', { name: '김밥 판매 끝' }), '23')
    expect(screen.getByText('시작 시각이 끝 시각보다 빨라야 해요.')).toBeInTheDocument()
    expect(saveButton('김밥')).toBeDisabled()
    expect(put).not.toHaveBeenCalled()
  })

  it('카테고리 검색과 [적용 중]·[할인율 바꿈] 거르기', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByRole('checkbox', { name: '김밥 마감세일 적용' })
    await user.click(screen.getByRole('button', { name: '적용 중' }))
    expect(categories()).toEqual(['김밥', '도시락'])
    await user.click(screen.getByRole('button', { name: '할인율 바꿈' }))
    expect(categories()).toEqual(['도시락'])
    await user.click(screen.getByRole('button', { name: '전체' }))
    expect(categories()).toEqual(['김밥', '유제품', '도시락'])

    await user.type(screen.getByRole('searchbox', { name: '카테고리 검색' }), '유제')
    expect(categories()).toEqual(['유제품'])
    await user.type(screen.getByRole('searchbox', { name: '카테고리 검색' }), '없는')
    expect(screen.getByText('조건에 맞는 분류가 없어요.')).toBeInTheDocument()
  })

  it('칸 제목을 누르면 그 칸으로 정렬하고 한 번 더 누르면 반대로', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByRole('checkbox', { name: '김밥 마감세일 적용' })
    await user.click(screen.getByRole('button', { name: '할인율' }))
    expect(categories()).toEqual(['김밥', '도시락', '유제품'])
    await user.click(screen.getByRole('button', { name: '할인율' }))
    expect(categories()).toEqual(['유제품', '도시락', '김밥'])
    await user.click(screen.getByRole('button', { name: '카테고리' }))
    expect(categories()).toEqual(['김밥', '도시락', '유제품'])
  })

  it('저장에 실패하면 서버 문구를 알린다', async () => {
    const user = userEvent.setup()
    put.mockRejectedValue(serverError(404, 'CATEGORY_NOT_FOUND', '없는 분류입니다'))
    renderSettings()

    await user.click(await screen.findByRole('checkbox', { name: '김밥 마감세일 적용' }))
    await user.click(saveButton('김밥'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('없는 분류입니다'))
  })

  it('불러오지 못하면 오류 문구를 보여 준다', async () => {
    get.mockRejectedValue(serverError(500, 'INTERNAL_ERROR', '서버 오류'))
    renderSettings()

    expect(await screen.findByText('서버 오류')).toBeInTheDocument()
  })
})
