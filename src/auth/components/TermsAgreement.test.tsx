import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PRIVACY_POLICY, TERMS_OF_SERVICE, TERMS_VERSION } from '../terms'
import { type Agreements, TermsAgreement } from './TermsAgreement'
import { TermsDialog } from './TermsDialog'

// jsdom 에는 HTMLDialogElement 의 showModal/close 가 없다. 열고 닫기만 흉내 낸다 (close 이벤트는 다음 태스크)
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>
const originalShowModal = dialogProto.showModal
const originalClose = dialogProto.close

beforeAll(() => {
  dialogProto.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogProto.close ??= function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    setTimeout(() => this.dispatchEvent(new Event('close')), 0)
  }
})

afterAll(() => {
  dialogProto.showModal = originalShowModal
  dialogProto.close = originalClose
})

function Harness({ start }: { start: Agreements }) {
  const [value, setValue] = useState(start)
  return (
    <>
      <input aria-label="이름" defaultValue="김경우" />
      <TermsAgreement value={value} onChange={setValue} />
      <p>{`${value.termsAgreed}/${value.privacyAgreed}`}</p>
    </>
  )
}

describe('TermsAgreement (A16)', () => {
  it('전체 동의는 두 개를 함께 켜고 끈다, 하나씩도 된다', async () => {
    render(<Harness start={{ termsAgreed: false, privacyAgreed: false }} />)
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('전체 동의'))
    expect(screen.getByText('true/true')).toBeInTheDocument()
    await user.click(screen.getByLabelText(/개인정보 처리방침 동의/))
    expect(screen.getByText('true/false')).toBeInTheDocument()
    expect(screen.getByLabelText('전체 동의')).not.toBeChecked()
    await user.click(screen.getByLabelText('전체 동의'))
    await user.click(screen.getByLabelText('전체 동의'))
    expect(screen.getByText('false/false')).toBeInTheDocument()
  })

  it('[전문 보기]는 그 약관을 창으로 보여 주고, 닫아도 입력 값은 그대로다', async () => {
    render(<Harness start={{ termsAgreed: true, privacyAgreed: false }} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'FreshLink 이용약관 전문 보기' }))
    const dialog = screen.getByRole('dialog', { name: 'FreshLink 이용약관' })
    expect(dialog).toHaveTextContent('제1조 (목적)')
    expect(dialog).toHaveTextContent(`시행일: ${TERMS_VERSION}`)
    await user.click(screen.getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('이름')).toHaveValue('김경우')
    expect(screen.getByText('true/false')).toBeInTheDocument()
  })
})

describe('TermsDialog', () => {
  it('여러 약관을 차례로 보여 준다 (마이페이지 "이용약관")', () => {
    render(<TermsDialog documents={[TERMS_OF_SERVICE, PRIVACY_POLICY]} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'FreshLink 이용약관' })
    expect(dialog).toHaveTextContent('FreshLink 개인정보 처리방침')
    expect(dialog).toHaveTextContent('privacy@freshlink.test (시연용 가상 주소)')
    expect(dialog).toHaveTextContent('30일 동안 보관합니다')
  })
})
