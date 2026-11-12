import { ChevronLeft, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import { useWithdrawal } from '../useWithdrawal'

const GUIDE = [
  '로그인 계정과 회원정보(이름·닉네임·거주 지역)가 지워지고, 다시 로그인할 수 없어요.',
  '결제·픽업 전이거나 환불을 처리하고 있는 주문이 있으면 탈퇴할 수 없어요.',
  '지난 주문·결제 기록은 남지만 다시 가입해도 새 계정과 이어지지 않아요.',
  '탈퇴 기록(이메일·탈퇴 시각)은 30일 동안 보관한 뒤 지워요.',
  '같은 이메일·닉네임으로 다시 가입할 수 있어요.',
]

/** /customer/my/withdraw 고객 회원탈퇴 (추가 명세 A6): 안내 → 확인 체크 → 마지막 확인 → 탈퇴 */
export function WithdrawalPage() {
  const flow = useWithdrawal()

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
              disabled={flow.submitting}
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
