import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode } from '@/auth/api'
import { useConfirmPayment } from './api'
import { parseTossRedirect } from './checkout'
import { confirmErrorMessage } from './orderStatus'

export interface UseTossReturnReturn {
  /** OR-03 승인 요청 중 */
  confirming: boolean
  /** 결제창을 닫았거나 결제가 실패해 돌아왔다 (아직 결제 대기면 안내 문구를 바꾼다) */
  interrupted: boolean
  markInterrupted(): void
}

/**
 * 토스 결제창이 이 주문 화면으로 돌려보냈을 때 처리한다.
 * 성공 쿼리(paymentKey·orderId·amount)면 OR-03 을 한 번만 부르고, 실패 쿼리(code)면 중단으로 본다.
 * 처리한 뒤에는 주소에서 토스 쿼리를 지워 새로 고침해도 다시 보내지 않는다 (같은 paymentKey 재요청은 서버도 막는다).
 */
export function useTossReturn(orderId: number): UseTossReturnReturn {
  const [params, setParams] = useSearchParams()
  const confirm = useConfirmPayment(orderId)
  const handled = useRef(false)
  const redirect = parseTossRedirect(params)
  // 실패 쿼리로 돌아왔으면 처음부터 중단 상태다
  const [interrupted, setInterrupted] = useState(() => redirect?.kind === 'fail')

  useEffect(() => {
    if (!redirect || handled.current) return
    handled.current = true
    setParams({}, { replace: true })
    if (redirect.kind === 'fail') return
    confirm.mutate(redirect.confirm, {
      onError: (e) => toast.error(confirmErrorMessage(apiErrorCode(e))),
    })
  }, [redirect, confirm, setParams])

  return {
    // 쿼리를 지우기 전 첫 렌더에서도 결제창을 다시 그리지 않게 승인 대기로 본다
    confirming: confirm.isPending || redirect?.kind === 'success',
    interrupted,
    markInterrupted: () => setInterrupted(true),
  }
}
