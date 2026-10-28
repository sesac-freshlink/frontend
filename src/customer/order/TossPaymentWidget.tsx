import {
  ANONYMOUS,
  loadTossPayments,
  type TossPaymentsWidgets,
  type WidgetAgreementWidget,
  type WidgetPaymentMethodWidget,
} from '@tosspayments/tosspayments-sdk'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { successUrlFor } from './checkout'
import { formatWon } from './format'

const rawClientKey: unknown = import.meta.env.VITE_TOSS_CLIENT_KEY
/** 결제위젯 연동 키(gck). 빌드 때 frontend-deploy 가 넣는다. 로컬에서 없으면 개발용 가짜 결제를 쓴다 */
const clientKey = typeof rawClientKey === 'string' && rawClientKey ? rawClientKey : undefined

interface Props {
  orderId: number
  /** 토스 orderId 로 그대로 쓰는 주문번호 */
  orderNo: string
  /** 서버가 정한 금액 (OR-02 amount). 승인 때 서버가 다시 대조한다 */
  amount: number
  orderName: string
  /** 결제창을 닫거나 결제 요청이 실패했을 때 */
  onInterrupted(): void
}

/**
 * U-22 토스 결제위젯. 결제 수단·약관 UI 를 그리고 [결제하기]로 결제창을 띄운다.
 * 결과는 successUrl·failUrl(= 이 주문 화면)로 돌아와서 OR-03 으로 승인한다.
 */
export function TossPaymentWidget(props: Props) {
  if (clientKey) return <RealWidget clientKey={clientKey} {...props} />
  if (import.meta.env.DEV) return <MockWidget {...props} />
  return (
    <p className="text-sm text-red-600">결제를 준비하지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
  )
}

function RealWidget({
  clientKey,
  orderId,
  orderNo,
  amount,
  orderName,
  onInterrupted,
}: Props & { clientKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetsRef = useRef<TossPaymentsWidgets>(undefined)
  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // 그릴 자리를 렌더링마다 새로 만든다. 개발 모드(StrictMode)에서 두 번 그려도 서로 겹치지 않는다
    const slot = document.createElement('div')
    const id = `toss-${crypto.randomUUID()}`
    slot.innerHTML = `<div id="${id}-methods"></div><div id="${id}-agreement"></div>`
    container.appendChild(slot)

    let cancelled = false
    let methods: WidgetPaymentMethodWidget | undefined
    let agreement: WidgetAgreementWidget | undefined
    void (async () => {
      try {
        const toss = await loadTossPayments(clientKey)
        // 결제 수단 저장(브랜드페이)을 쓰지 않으므로 고객 식별값을 토스에 넘기지 않는다
        const widgets = toss.widgets({ customerKey: ANONYMOUS })
        await widgets.setAmount({ currency: 'KRW', value: amount })
        methods = await widgets.renderPaymentMethods({ selector: `#${id}-methods` })
        agreement = await widgets.renderAgreement({ selector: `#${id}-agreement` })
        if (cancelled) {
          // 그리는 도중에 화면을 떠났으면 정리 함수가 이미 돌았으니 여기서 지운다
          void methods.destroy().catch(() => undefined)
          void agreement.destroy().catch(() => undefined)
          return
        }
        widgetsRef.current = widgets
        setReady(true)
      } catch {
        if (!cancelled) setLoadFailed(true)
      }
    })()

    return () => {
      cancelled = true
      widgetsRef.current = undefined
      setReady(false)
      void methods?.destroy().catch(() => undefined)
      void agreement?.destroy().catch(() => undefined)
      slot.remove()
    }
  }, [clientKey, amount])

  const pay = async () => {
    const widgets = widgetsRef.current
    if (!widgets) return
    setRequesting(true)
    const returnUrl = successUrlFor(orderId, window.location.origin)
    try {
      await widgets.requestPayment({
        orderId: orderNo,
        orderName,
        successUrl: returnUrl,
        failUrl: returnUrl,
      })
    } catch {
      // 결제창을 닫았거나(USER_CANCEL) 약관 미동의 등. 결제 대기 상태로 남는다
      onInterrupted()
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} />
      {!ready && !loadFailed && (
        <div className="flex justify-center py-6 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="결제 수단 불러오는 중" />
        </div>
      )}
      {loadFailed && (
        <p className="text-sm text-red-600">결제 수단을 불러오지 못했어요. 새로 고침해 주세요.</p>
      )}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={!ready || requesting}
        className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white disabled:opacity-50"
      >
        {formatWon(amount)} 결제하기
      </button>
    </div>
  )
}

/** 로컬 개발(토스 키 없음, MSW)용. 토스가 성공 URL 로 돌려보내는 것과 같은 쿼리를 붙여 이동한다 */
function MockWidget({ orderId, orderNo, amount }: Props) {
  const navigate = useNavigate()
  const q = new URLSearchParams({
    paymentType: 'NORMAL',
    orderId: orderNo,
    paymentKey: `mock_${orderId}`,
    amount: String(amount),
  })
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        개발용 가짜 결제: 토스 키(VITE_TOSS_CLIENT_KEY)가 없어 결제창 없이 성공으로 돌아옵니다.
      </p>
      <button
        type="button"
        onClick={() => navigate(`/customer/orders/${orderId}?${q.toString()}`, { replace: true })}
        className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white"
      >
        {formatWon(amount)} 결제하기
      </button>
    </div>
  )
}
