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

describe('분류별 마감세일 설정', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it('분류마다 적용·할인율·판매 시간과 기본값 여부를 보여 준다', async () => {
    get.mockResolvedValue({ data: settings })
    renderSettings()

    expect(await screen.findByRole('checkbox', { name: '김밥 마감세일 적용' })).toBeChecked()
    expect(screen.getByRole('spinbutton', { name: '김밥 할인율' })).toHaveValue(30)
    expect(screen.getByRole('combobox', { name: '김밥 판매 시작' })).toHaveValue('6')
    expect(screen.getByRole('combobox', { name: '김밥 판매 끝' })).toHaveValue('23')
    expect(within(row('김밥')).getByText('기본값')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '유제품 마감세일 적용' })).not.toBeChecked()
    // 적용하지 않은 분류는 할인율·시간을 고칠 수 없다
    expect(screen.getByRole('spinbutton', { name: '유제품 할인율' })).toBeDisabled()
    expect(within(row('유제품')).getByText('직접 정함')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/owner/inventory/clearance-settings')
  })

  it('바꾼 값을 그 분류만 저장한다', async () => {
    const user = userEvent.setup()
    get.mockResolvedValue({ data: settings })
    put.mockResolvedValue({ data: { ...settings[0], discountPercent: 95, customized: true } })
    renderSettings()

    await screen.findByRole('checkbox', { name: '김밥 마감세일 적용' })
    expect(saveButton('김밥')).toBeDisabled()
    const discount = screen.getByRole('spinbutton', { name: '김밥 할인율' })
    await user.clear(discount)
    await user.type(discount, '95')
    await user.selectOptions(screen.getByRole('combobox', { name: '김밥 판매 끝' }), '24')
    await user.click(saveButton('김밥'))

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/owner/inventory/clearance-settings', {
        category: '김밥',
        enabled: true,
        discountPercent: 95,
        saleStartHour: 6,
        saleEndHour: 24,
      }),
    )
    expect(toast.success).toHaveBeenCalledWith('김밥 마감세일을 95%, 06시~24시로 정했어요')
  })

  it('할인율이 범위 밖이거나 시작이 끝보다 늦으면 저장하지 않는다', async () => {
    const user = userEvent.setup()
    get.mockResolvedValue({ data: settings })
    renderSettings()

    const discount = await screen.findByRole('spinbutton', { name: '김밥 할인율' })
    await user.clear(discount)
    await user.type(discount, '96')
    expect(screen.getByText('1~95 사이 정수로 넣어 주세요.')).toBeInTheDocument()
    expect(saveButton('김밥')).toBeDisabled()

    await user.clear(discount)
    await user.type(discount, '40')
    await user.selectOptions(screen.getByRole('combobox', { name: '김밥 판매 시작' }), '23')
    await user.selectOptions(screen.getByRole('combobox', { name: '김밥 판매 끝' }), '23')
    expect(screen.getByText('시작 시각이 끝 시각보다 빨라야 해요.')).toBeInTheDocument()
    expect(saveButton('김밥')).toBeDisabled()
    expect(put).not.toHaveBeenCalled()
  })

  it('저장에 실패하면 서버 문구를 알린다', async () => {
    const user = userEvent.setup()
    get.mockResolvedValue({ data: settings })
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
