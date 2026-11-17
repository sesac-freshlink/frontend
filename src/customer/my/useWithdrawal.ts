import { useState } from 'react'
import { useNavigate } from 'react-router'
import { apiErrorCode } from '@/shared/api/errors'
import { useAuthStore } from '@/shared/auth'
import { clearAccountStorePrefs } from '@/customer/stores/accountStorage'
import { useWithdraw } from './api'

export type WithdrawalStep = 'guide' | 'confirm'

/** 마지막 확인에서 직접 입력해야 하는 문구 (11/12 경우 결정, 이메일·구글 가입자 모두) */
export const CONFIRM_PHRASE = '탈퇴합니다'

/** 앞뒤 빈칸은 무시하고 글자가 똑같아야 통과한다. 붙여넣기도 받는다 */
export function isConfirmPhrase(value: string): boolean {
  return value.trim() === CONFIRM_PHRASE
}

/** 탈퇴 실패 문구. 진행 중 주문은 따로 안내한다 */
export function withdrawalErrorMessage(e: unknown): string {
  switch (apiErrorCode(e)) {
    case 'WITHDRAWAL_BLOCKED_ACTIVE_ORDER':
      return '진행 중인 주문이 있어 탈퇴할 수 없어요. 주문을 받아 가거나 취소한 뒤 다시 시도해 주세요.'
    case 'WITHDRAWAL_CHECK_UNAVAILABLE':
      return '지금은 주문을 확인할 수 없어 탈퇴할 수 없어요. 잠시 뒤 다시 시도해 주세요.'
    default:
      return '탈퇴를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
  }
}

export interface UseWithdrawalReturn {
  step: WithdrawalStep
  /** 안내를 확인했다는 체크 */
  acknowledged: boolean
  setAcknowledged(value: boolean): void
  /** [탈퇴하기] → 마지막 확인 */
  askConfirm(): void
  back(): void
  /** 마지막 확인 칸에 입력한 글자 */
  confirmText: string
  setConfirmText(value: string): void
  /** 입력한 글자가 확인 문구와 같은지. 같아야 [탈퇴]가 켜진다 */
  confirmMatches: boolean
  submitting: boolean
  error: string | null
  /** 진행 중 주문 때문에 막혔는지 (주문 내역 링크를 보여 준다) */
  blockedByOrders: boolean
  /** 마지막 확인 뒤 탈퇴. 성공하면 로그아웃하고 로그인 화면에서 안내한다 */
  withdraw(): Promise<void>
}

/** 고객 회원탈퇴 화면의 동작 (추가 명세 A6) */
export function useWithdrawal(): UseWithdrawalReturn {
  const navigate = useNavigate()
  const signOut = useAuthStore((s) => s.signOut)
  const mutation = useWithdraw()
  const [step, setStep] = useState<WithdrawalStep>('guide')
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const confirmMatches = isConfirmPhrase(confirmText)
  const [error, setError] = useState<string | null>(null)
  const [blockedByOrders, setBlockedByOrders] = useState(false)

  return {
    step,
    acknowledged,
    setAcknowledged,
    askConfirm() {
      if (acknowledged) setStep('confirm')
    },
    back() {
      setConfirmText('')
      setStep('guide')
    },
    confirmText,
    setConfirmText,
    confirmMatches,
    submitting: mutation.isPending,
    error,
    blockedByOrders,
    async withdraw() {
      // 버튼이 꺼져 있어도 한 번 더 막는다 (확인 문구를 똑같이 입력해야 보낸다)
      if (!confirmMatches || mutation.isPending) return
      setError(null)
      setBlockedByOrders(false)
      try {
        await mutation.mutateAsync()
      } catch (e) {
        setError(withdrawalErrorMessage(e))
        setBlockedByOrders(apiErrorCode(e) === 'WITHDRAWAL_BLOCKED_ACTIVE_ORDER')
        setConfirmText('')
        setStep('guide')
        return
      }
      // 계정은 서버가 지웠다. 이 기기에 남긴 그 계정의 점포 설정(픽업·단골)도 지운다(11/11)
      const userId = useAuthStore.getState().user?.userId
      if (userId) clearAccountStorePrefs(userId)
      // 남은 로그인 쿠키를 지우고 로그인 화면에서 안내한다
      await signOut('WITHDRAWN')
      navigate('/login', { replace: true })
    },
  }
}
