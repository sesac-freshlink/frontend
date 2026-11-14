import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { SalesDayDialog } from './SalesDayDialog'

vi.mock('../api', () => ({
  useSalesProducts: (date: string) => ({
    isPending: false,
    isError: false,
    data: {
      date,
      items: [
        {
          productId: 3,
          productName: '샌드위치 햄치즈',
          soldQuantity: 9,
          clearanceQuantity: 2,
          netAmount: 28800,
        },
      ],
    },
  }),
  useStockByProduct: () => new Map([[3, { productId: 3, availableQuantity: 2, lowStock: true }]]),
}))

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. 열고 닫기만 흉내 낸다 (약관 창 테스트와 같음)
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

const period = {
  period: '2026-11-13',
  paidAmount: 124200,
  refundAmount: 1600,
  netAmount: 122600,
  paidCount: 42,
  refundCount: 1,
  canceledCount: 2,
}

describe('매출 날짜 창 (11/14 시안 B)', () => {
  it('제목·요약 한 줄·팔린 상품 표, 하루 보기로 가는 링크를 보여 주고 [닫기]로 닫는다', async () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <SalesDayDialog period={period} onClose={onClose} />
      </MemoryRouter>,
    )
    const dialog = screen.getByRole('dialog', { name: '11월 13일(금) 팔린 상품' })
    expect(
      within(dialog).getByText('순매출 122,600원, 결제 42건, 팔린 수량 9개'),
    ).toBeInTheDocument()
    const row = within(dialog).getAllByRole('row')[1]
    expect(row).toHaveTextContent('샌드위치 햄치즈9개2개28,800원2개부족')
    expect(within(dialog).getByRole('link', { name: '하루 보기에서 열기' })).toHaveAttribute(
      'href',
      '/owner/sales/day?date=2026-11-13',
    )
    fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[1])
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
