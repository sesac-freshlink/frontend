import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { StoreSummary } from '../api'
import { FarPickDialog } from './FarPickDialog'

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

const gangnam = { storeId: 1, name: '프레시 강남점' } as StoreSummary

function renderDialog() {
  const save = vi.fn()
  const onShowNearby = vi.fn()
  const onClose = vi.fn()
  render(
    <FarPickDialog
      pick={{
        targetName: '프레시 노원점',
        farKm: 15,
        nearest: gangnam,
        nearestKm: 0.1,
        region: 'SEOUL',
        save,
      }}
      onClose={onClose}
      onShowNearby={onShowNearby}
    />,
  )
  return { save, onShowNearby, onClose }
}

describe('점포 정할 때 확인 창 (11/14 시안 ②)', () => {
  it('먼 점포와 더 가까운 점포를 알리고, [○○점으로 정하기]를 누르면 그때 정한다', async () => {
    const { save, onShowNearby, onClose } = renderDialog()
    const dialog = screen.getByRole('dialog', { name: '멀리 있는 점포예요' })
    expect(dialog).toHaveTextContent(
      '프레시 노원점은 지금 계신 곳에서 15.0km예요. 더 가까운 프레시 강남점(100m)이 있어요.',
    )
    fireEvent.click(screen.getByRole('button', { name: '프레시 노원점으로 정하기' }))
    expect(save).toHaveBeenCalledOnce()
    expect(onShowNearby).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('[가까운 점포 보기]는 정하지 않고 가까운 점포로 보낸다', () => {
    const { save, onShowNearby } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: '가까운 점포 보기' }))
    expect(onShowNearby).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled()
  })
})
