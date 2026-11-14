import { ChevronLeft, LoaderCircle } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/ui/cn'
import { CONFIRM_PHRASE, useWithdrawal } from '../useWithdrawal'

const GUIDE = [
  '로그인 계정과 회원정보(이름·닉네임·거주 지역)가 지워지고, 다시 로그인할 수 없어요.',
  '결제·픽업 전이거나 환불을 처리하고 있는 주문이 있으면 탈퇴할 수 없어요.',
  '지난 주문·결제 기록은 5년 동안 남지만 다시 가입해도 새 계정과 이어지지 않아요.',
  '탈퇴 기록(이메일·탈퇴 시각)은 지난 결제 내역을 찾을 때 쓰려고 5년 동안 보관한 뒤 지워요.',
  '같은 이메일·닉네임으로 다시 가입할 수 있어요.',
]

/**
 * /customer/my/withdraw 고객 회원탈퇴 (추가 명세 A6): 안내 → 확인 체크 → 마지막 확인 → 탈퇴.
 * 마지막 확인에서 "탈퇴합니다"를 직접 입력해야 [탈퇴]가 켜진다(11/12 경우 결정, 실수로 누르는 것을 막는다)
 */
export function WithdrawalPage() {
  const flow = useWithdrawal()
  const inputId = useId()
  const hintId = useId()
  // 입력했는데 다를 때만 오류로 본다. 비어 있으면 위 안내 글자만 보인다
  const mismatch = flow.confirmText.trim() !== '' && !flow.confirmMatches

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          to="/customer/my"
          aria-label="마이페이지로"
          className="-ml-3 flex size-11 items-center justify-center text-slate-500"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">회원탈퇴</h1>
      </div>

      <ul className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
        {GUIDE.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {flow.error && (
        <div role="alert" className="space-y-1 text-sm text-rose-700">
          <p>{flow.error}</p>
          {flow.blockedByOrders && (
            <Link to="/customer/orders" className="text-slate-600 underline">
              주문 내역 보기
            </Link>
          )}
        </div>
      )}

      {flow.step === 'guide' && (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={flow.acknowledged}
              onChange={(e) => flow.setAcknowledged(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            안내를 모두 확인했어요
          </label>
          <button
            type="button"
            onClick={flow.askConfirm}
            disabled={!flow.acknowledged}
            className="min-h-11 w-full rounded-lg bg-rose-700 py-2 font-medium text-white disabled:opacity-50"
          >
            탈퇴하기
          </button>
        </>
      )}

      {flow.step === 'confirm' && (
        <div className="space-y-3 rounded-lg bg-rose-50 p-4">
          <p className="font-medium text-slate-900">정말 탈퇴할까요? 되돌릴 수 없어요.</p>
          <div className="space-y-1">
            <label htmlFor={inputId} className="block text-sm text-slate-900">
              확인을 위해 <strong>{CONFIRM_PHRASE}</strong>를 입력해 주세요
            </label>
            <input
              id={inputId}
              type="text"
              value={flow.confirmText}
              onChange={(e) => flow.setConfirmText(e.target.value)}
              // 확인 창이 열리면 바로 칠 수 있게 칸으로 포커스를 옮긴다
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={flow.submitting}
              aria-invalid={mismatch}
              aria-describedby={hintId}
              className={cn(
                'min-h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-900',
                mismatch ? 'border-rose-700' : 'border-slate-300',
              )}
            />
            {/* 위 글자와 겹치지 않게, 입력했는데 다를 때만 오류 안내를 보여 준다(화면 읽기 프로그램도 바로 읽는다) */}
            <p id={hintId} aria-live="polite" className="text-sm text-rose-700 empty:hidden">
              {mismatch ? `${CONFIRM_PHRASE}를 똑같이 입력해 주세요` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={flow.back}
              disabled={flow.submitting}
              className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm text-slate-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void flow.withdraw()}
              disabled={flow.submitting || !flow.confirmMatches}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-rose-700 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {flow.submitting && <LoaderCircle className="size-4 animate-spin" />}
              탈퇴
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
