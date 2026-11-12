import {
  ANONYMOUS,
  loadTossPayments,
  type TossPaymentsWidgets,
  type WidgetAgreementWidget,
  type WidgetPaymentMethodWidget,
} from '@tosspayments/tosspayments-sdk'
import { LoaderCircle, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { successUrlFor } from './checkout'
import { formatWon } from './format'

/** 필수 약관에 동의하지 않고 [결제하기]를 눌렀을 때 (11/11 경우 문구) */
export const AGREEMENT_REQUIRED_MESSAGE = '필수 약관에 동의해야 구매할 수 있어요.'

/** 결제 수단을 이 시간 안에 못 그리면 안내와 [다시 불러오기]를 보여 준다 (11/12 경우 결정 10초) */
export const WIDGET_SLOW_MS = 10_000

/** 결제위젯을 그리는 단계. 실패하면 어느 단계에서 멈췄는지 콘솔에 남긴다 */
type WidgetStep = 'SDK 불러오기' | '금액 설정' | '결제 수단 그리기' | '약관 그리기'

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
    <p className="text-sm text-rose-700">결제를 준비하지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
  )
}

/** 실제 토스 결제위젯. 테스트가 키를 직접 넘겨 그릴 수 있게 내보낸다 */
export function RealWidget({
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
  // 10초가 지나도 결제 수단이 안 그려졌으면 true (안내와 [다시 불러오기])
  const [slow, setSlow] = useState(false)
  // [다시 불러오기]를 누를 때마다 1 늘린다. 바뀌면 이전 위젯을 정리하고 처음부터 다시 그린다(새로 고침 대신, 11/12)
  const [attempt, setAttempt] = useState(0)
  // [다시 불러오기] 버튼이 사라지므로 키보드·화면 읽기 사용자의 위치를 로딩 표시로 옮긴다
  const loadingRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (attempt > 0) loadingRef.current?.focus()
  }, [attempt])
  const [requesting, setRequesting] = useState(false)
  // 토스 약관 UI 의 필수 약관 동의 상태(agreementStatusChange). 이벤트가 오기 전에는 모르므로 null(토스가 결제 요청 때 다시 본다)
  const agreedRef = useRef<boolean | null>(null)
  const agreementElRef = useRef<HTMLElement | null>(null)
  const [agreementError, setAgreementError] = useState(false)

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
    let step: WidgetStep = 'SDK 불러오기'
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, WIDGET_SLOW_MS)
    void (async () => {
      try {
        const toss = await loadTossPayments(clientKey)
        // 결제 수단 저장(브랜드페이)을 쓰지 않으므로 고객 식별값을 토스에 넘기지 않는다
        // 다시 그릴 때도 새 widgets 를 만든다(이전 위젯은 정리 함수에서 destroy). 토스 순서: widgets → setAmount → render
        const widgets = toss.widgets({ customerKey: ANONYMOUS })
        step = '금액 설정'
        await widgets.setAmount({ currency: 'KRW', value: amount })
        step = '결제 수단 그리기'
        methods = await widgets.renderPaymentMethods({ selector: `#${id}-methods` })
        step = '약관 그리기'
        agreement = await widgets.renderAgreement({ selector: `#${id}-agreement` })
        // 필수 약관 동의를 지켜본다. 동의하면 빨간 안내를 지운다(토스 SDK WidgetAgreementWidget.on)
        agreement.on('agreementStatusChange', (status) => {
          agreedRef.current = status.agreedRequiredTerms
          if (status.agreedRequiredTerms) setAgreementError(false)
        })
        agreementElRef.current = document.getElementById(`${id}-agreement`)
        if (cancelled) {
          // 그리는 도중에 화면을 떠났으면 정리 함수가 이미 돌았으니 여기서 지운다
          void methods.destroy().catch(() => undefined)
          void agreement.destroy().catch(() => undefined)
          return
        }
        widgetsRef.current = widgets
        window.clearTimeout(slowTimer)
        setSlow(false)
        setReady(true)
      } catch (error) {
        // 원인을 나중에 찾을 수 있게 단계와 토스 오류(code·message)를 남긴다. 고객에게는 [다시 불러오기]만 보인다
        // 화면을 떠났거나 다시 그리느라 그만둔 시도(개발 모드 두 번 그리기 포함)는 남기지 않는다
        window.clearTimeout(slowTimer)
        if (cancelled) return
        console.error(`[결제위젯] ${step} 실패`, error)
        setLoadFailed(true)
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
      widgetsRef.current = undefined
      agreedRef.current = null
      agreementElRef.current = null
      setReady(false)
      void methods?.destroy().catch(() => undefined)
      void agreement?.destroy().catch(() => undefined)
      slot.remove()
    }
  }, [clientKey, amount, attempt])

  // 위젯만 처음부터 다시 그린다. 정리 함수가 이전 위젯을 지운 뒤 새로 그리므로 두 벌이 겹치지 않는다
  const reload = () => {
    setLoadFailed(false)
    setSlow(false)
    setAttempt((n) => n + 1)
  }

  const pay = async () => {
    const widgets = widgetsRef.current
    if (!widgets) return
    // 필수 약관에 동의하지 않았으면 결제창을 열지 않고 알린다(버튼은 누를 수 있게 둔다, 11/11 경우 결정)
    if (agreedRef.current === false) {
      setAgreementError(true)
      toast.error(AGREEMENT_REQUIRED_MESSAGE)
      const el = agreementElRef.current
      if (el) {
        el.tabIndex = -1
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el.focus({ preventScroll: true })
      }
      return
    }
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
      {/* 약관 UI 바로 아래 빨간 안내 한 줄. 화면 읽기 프로그램에도 바로 읽힌다 */}
      <p aria-live="assertive" className="text-sm font-medium text-rose-700 empty:hidden">
        {agreementError ? AGREEMENT_REQUIRED_MESSAGE : ''}
      </p>
      {!ready && !loadFailed && (
        <div
          ref={loadingRef}
          tabIndex={-1}
          className="flex justify-center py-6 text-slate-400 outline-none"
        >
          <LoaderCircle className="size-6 animate-spin" aria-label="결제 수단 불러오는 중" />
        </div>
      )}
      {!ready && (loadFailed || slow) && (
        <div role="alert" className="space-y-2 rounded-lg bg-rose-50 p-3">
          <p className="text-sm text-rose-700">
            {loadFailed
              ? '결제 수단을 불러오지 못했어요.'
              : '결제 수단을 불러오는 데 시간이 걸리고 있어요.'}
          </p>
          <button
            type="button"
            onClick={reload}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800"
          >
            <RotateCw className="size-4" aria-hidden />
            다시 불러오기
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={!ready || requesting}
        className="w-full rounded-lg bg-emerald-700 py-3 font-medium text-white disabled:opacity-50"
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
        className="w-full rounded-lg bg-emerald-700 py-3 font-medium text-white"
      >
        {formatWon(amount)} 결제하기
      </button>
    </div>
  )
}
