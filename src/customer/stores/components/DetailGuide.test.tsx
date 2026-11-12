import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DetailGuide } from './DetailGuide'

describe('상품 상세 안내 2줄', () => {
  it('처음에는 접혀 있고, 누르면 펼쳐지며 aria-expanded 로 알린다', async () => {
    render(<DetailGuide clearance={false} firstCome={false} />)
    const usage = screen.getByRole('button', { name: '이용 안내' })
    const refund = screen.getByRole('button', { name: '취소·환불 안내' })
    expect(usage).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('한 번에 5개까지 살 수 있어요.')).not.toBeVisible()

    await userEvent.click(usage)
    expect(usage).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('한 번에 5개까지 살 수 있어요.')).toBeVisible()
    expect(
      screen.getByText('픽업 신청을 하지 않거나 기한 안에 받아 가지 않으면 환불되지 않아요.'),
    ).toBeVisible()

    await userEvent.click(refund)
    expect(screen.getByText('일부 수량만 취소할 수는 없어요.')).toBeVisible()
    // 상품 정보 줄은 넣지 않는다
    expect(screen.queryByRole('button', { name: '상품 정보' })).not.toBeInTheDocument()
  })

  it('마감세일·선착순 상품이면 이용 안내 맨 위에 한 줄씩 더 붙는다', async () => {
    const { rerender } = render(<DetailGuide clearance={false} firstCome={false} />)
    await userEvent.click(screen.getByRole('button', { name: '이용 안내' }))
    expect(screen.queryByText(/마감세일 상품은/)).not.toBeInTheDocument()
    expect(screen.queryByText(/선착순 상품은/)).not.toBeInTheDocument()

    rerender(<DetailGuide clearance firstCome={false} />)
    expect(
      screen.getByText(/마감세일 상품은 소비기한이 24시간 안에 끝나는 상품이라 30% 싸게/),
    ).toBeVisible()

    rerender(<DetailGuide clearance={false} firstCome />)
    expect(screen.getByText(/선착순 상품은 줄을 선 뒤 차례가 오면/)).toBeVisible()
  })

  it('마감세일 상품은 결제하면 자동으로 픽업 신청되므로 [픽업 신청]을 누르라는 줄을 보이지 않는다', async () => {
    const { rerender } = render(<DetailGuide clearance={false} firstCome={false} />)
    await userEvent.click(screen.getByRole('button', { name: '이용 안내' }))
    expect(screen.getByText(/주문 내역에서 \[픽업 신청\]을 눌러 주세요/)).toBeVisible()
    expect(screen.getByText(/픽업 신청을 하지 않거나/)).toBeVisible()

    rerender(<DetailGuide clearance firstCome={false} />)
    expect(screen.getByText(/결제하면 바로 픽업 신청돼요/)).toBeVisible()
    expect(screen.getByText(/오늘 23시 59분까지 픽업해 주세요/)).toBeVisible()
    expect(screen.queryByText(/주문 내역에서 \[픽업 신청\]을 눌러 주세요/)).not.toBeInTheDocument()
    expect(screen.queryByText(/픽업 신청을 하지 않거나/)).not.toBeInTheDocument()
  })

  it('고객 화면이라 "예약"이라는 말을 쓰지 않는다', async () => {
    const { container } = render(<DetailGuide clearance firstCome />)
    expect(container.textContent).not.toContain('예약')
  })
})
