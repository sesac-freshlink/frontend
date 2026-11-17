import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. 열고 닫기만 흉내 낸다
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

describe('ConfirmDialog', () => {
  it('확인 모달(고객 취소·픽업 신청): [닫기]와 확인 버튼 둘, 확인은 onConfirm', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        title="주문을 취소할까요?"
        confirmLabel="주문 취소"
        pending={false}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '주문 취소' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('안내 모달(onConfirm 없음): [확인] 하나만 있고 누르면 닫는다', async () => {
    const onClose = vi.fn()
    render(<ConfirmDialog title="상품을 먼저 골라 주세요" onClose={onClose} />)

    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
