import { useState } from 'react'
import { PRIVACY_POLICY, TERMS_OF_SERVICE, type TermsDocument } from '../terms'
import { TermsDialog } from './TermsDialog'

export interface Agreements {
  termsAgreed: boolean
  privacyAgreed: boolean
}

interface Props {
  value: Agreements
  onChange(next: Agreements): void
  error?: string
}

/**
 * 회원가입 필수 약관 동의 묶음 (추가 명세 A16): 전체 동의, [필수] 이용약관, [필수] 개인정보 처리방침.
 * 일반 가입 입력 단계와 구글 첫 프로필 단계가 같이 쓴다. [전문 보기]는 모달이라 입력한 값이 그대로 남는다
 */
export function TermsAgreement({ value, onChange, error }: Props) {
  const [open, setOpen] = useState<TermsDocument | null>(null)
  const all = value.termsAgreed && value.privacyAgreed
  const rows = [
    { key: 'termsAgreed', label: '이용약관 동의', doc: TERMS_OF_SERVICE },
    { key: 'privacyAgreed', label: '개인정보 처리방침 동의', doc: PRIVACY_POLICY },
  ] as const

  return (
    <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
      <legend className="sr-only">약관 동의</legend>
      <label className="flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-medium text-slate-900">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) =>
            onChange({ termsAgreed: e.target.checked, privacyAgreed: e.target.checked })
          }
          className="size-4 accent-emerald-600"
        />
        전체 동의
      </label>
      {rows.map(({ key, label, doc }) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              className="size-4 accent-emerald-600"
            />
            <span>
              <span className="text-emerald-700">[필수]</span> {label}
            </span>
          </label>
          <button
            type="button"
            onClick={() => setOpen(doc)}
            aria-label={`${doc.title} 전문 보기`}
            className="shrink-0 text-xs text-slate-500 underline"
          >
            전문 보기
          </button>
        </div>
      ))}
      {error && <p className="text-xs text-rose-700">{error}</p>}
      {open && <TermsDialog documents={[open]} onClose={() => setOpen(null)} />}
    </fieldset>
  )
}
