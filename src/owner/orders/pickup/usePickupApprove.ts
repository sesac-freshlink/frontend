import { useState } from 'react'
import {
  pickupPassErrorMessage,
  type PickupApproveResult,
  type PickupPassOrder,
  useApprovePickup,
  usePickupPassOrders,
} from './api'
import { toggleSelection } from './pickupSelection'

export type ApproveStep = 'select' | 'confirm' | 'done'

export interface UsePickupApproveReturn {
  orders: PickupPassOrder[]
  loading: boolean
  /** 목록을 못 읽음 (만료·코드 틀림 등) */
  loadError: string | null
  selected: number[]
  step: ApproveStep
  submitting: boolean
  submitError: string | null
  results: PickupApproveResult['results']
  toggle(order: PickupPassOrder): void
  /** [픽업 승인] → 확인 단계 */
  askConfirm(): void
  back(): void
  /** 확인 뒤 승인 */
  approve(): Promise<void>
}

/** 점주 컴퓨터 픽업 승인 창의 동작 (추가 명세 A16). 처음에는 아무것도 고르지 않는다 */
export function usePickupApprove(pickupKey: string): UsePickupApproveReturn {
  const list = usePickupPassOrders(pickupKey)
  const approveMutation = useApprovePickup()
  const [selected, setSelected] = useState<number[]>([])
  const [step, setStep] = useState<ApproveStep>('select')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [results, setResults] = useState<PickupApproveResult['results']>([])

  return {
    orders: list.data?.orders ?? [],
    loading: list.isPending,
    loadError: list.isError
      ? pickupPassErrorMessage(list.error, '주문을 불러오지 못했어요. 다시 시도해 주세요.')
      : null,
    selected,
    step,
    submitting: approveMutation.isPending,
    submitError,
    results,
    toggle(order) {
      setSelected((prev) => toggleSelection(prev, order))
    },
    askConfirm() {
      if (selected.length > 0) setStep('confirm')
    },
    back() {
      setStep('select')
    },
    async approve() {
      const token = list.data?.token
      if (!token || selected.length === 0) return
      setSubmitError(null)
      try {
        const r = await approveMutation.mutateAsync({ token, orderIds: selected })
        setResults(r.results)
        setStep('done')
      } catch (e) {
        setSubmitError(pickupPassErrorMessage(e, '픽업 승인에 실패했어요. 다시 시도해 주세요.'))
        setStep('select')
      }
    },
  }
}
