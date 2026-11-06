import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { OwnerPickupScanPage } from './OwnerPickupScanPage'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const post = vi.mocked(api.post)

function renderAt(path: string) {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <OwnerPickupScanPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('OwnerPickupScanPage (/owner/pickup-scan, A16)', () => {
  it('표를 한 번 보내고, 열린 컴퓨터 화면이 있으면 "컴퓨터 화면에서 확인해 주세요"', async () => {
    post.mockResolvedValue({ data: { screens: 1 } })
    renderAt('/owner/pickup-scan?t=tok')
    expect(await screen.findByText('컴퓨터 화면에서 확인해 주세요')).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/owner/orders/pickup-scan', { token: 'tok' })
  })

  it('열린 화면이 없으면 "점주 화면을 열어 주세요"', async () => {
    post.mockResolvedValue({ data: { screens: 0 } })
    renderAt('/owner/pickup-scan?t=tok')
    expect(await screen.findByText('점주 화면을 열어 주세요')).toBeInTheDocument()
  })

  it('만료된 표면 안내, 표가 없으면 보내지 않는다', async () => {
    post.mockRejectedValue(
      Object.assign(new Error('404'), {
        isAxiosError: true,
        response: { status: 404, data: { code: 'PICKUP_PASS_NOT_FOUND', message: 'x' } },
      }),
    )
    renderAt('/owner/pickup-scan?t=old')
    expect(await screen.findByRole('alert')).toHaveTextContent('QR이 만료됐거나 없어요')
  })

  it('주소에 표가 없으면 안내만', () => {
    renderAt('/owner/pickup-scan')
    expect(screen.getByRole('alert')).toHaveTextContent('QR 주소가 올바르지 않아요')
    expect(post).not.toHaveBeenCalled()
  })
})
