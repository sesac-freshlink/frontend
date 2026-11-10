import { CircleCheck, CircleAlert, LoaderCircle, MonitorSmartphone } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useOwnerPickupScan } from '../pickup/useOwnerPickupScan'

/**
 * /owner/pickup-scan?t=표 점주 핸드폰 화면 (추가 명세 A16). 고객 픽업 QR을 핸드폰 카메라로 찍으면 열린다.
 * 승인은 핸드폰에서 하지 않고, 같은 점포의 열린 컴퓨터 화면에 창을 띄운다. 점주 공통 틀 없이 핸드폰 한 화면
 */
export function OwnerPickupScanPage() {
  const [params] = useSearchParams()
  const state = useOwnerPickupScan(params.get('t'))

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-bold text-emerald-600">FreshLink 점주</p>
      {state.kind === 'sending' && (
        <p role="status" className="flex items-center gap-2 text-slate-600">
          <LoaderCircle className="size-5 animate-spin" />
          QR을 확인하고 있어요
        </p>
      )}
      {state.kind === 'sent' && state.screens > 0 && (
        <>
          <CircleCheck className="size-12 text-emerald-600" />
          <p className="text-xl font-bold text-slate-900">컴퓨터 화면에서 확인해 주세요</p>
          <p className="text-sm text-slate-500">점주 컴퓨터에 이 고객의 주문 창이 떴어요.</p>
        </>
      )}
      {state.kind === 'sent' && state.screens === 0 && (
        <>
          <MonitorSmartphone className="size-12 text-amber-500" />
          <p className="text-xl font-bold text-slate-900">점주 화면을 열어 주세요</p>
          <p className="text-sm text-slate-500">
            컴퓨터에서 점주 화면을 연 뒤 QR을 다시 찍거나, 컴퓨터 주문 화면에서 고객 코드를 넣어
            주세요.
          </p>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <CircleAlert className="size-12 text-red-600" />
          <p role="alert" className="text-base text-red-600">
            {state.message}
          </p>
        </>
      )}
    </main>
  )
}
