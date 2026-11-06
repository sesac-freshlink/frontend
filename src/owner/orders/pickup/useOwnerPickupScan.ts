import { useEffect, useRef, useState } from 'react'
import { pickupPassErrorMessage, useScanPickupPass } from './api'

export type ScanState =
  { kind: 'sending' } | { kind: 'sent'; screens: number } | { kind: 'error'; message: string }

/** 점주 핸드폰 QR 스캔 화면 (추가 명세 A16): 주소의 표를 한 번만 서버에 보낸다 */
export function useOwnerPickupScan(token: string | null): ScanState {
  const scan = useScanPickupPass()
  const { mutateAsync } = scan
  const sent = useRef(false)
  const [state, setState] = useState<ScanState>(() =>
    token ? { kind: 'sending' } : { kind: 'error', message: 'QR 주소가 올바르지 않아요.' },
  )

  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    mutateAsync(token)
      .then((r) => setState({ kind: 'sent', screens: r.screens }))
      .catch((e: unknown) =>
        setState({ kind: 'error', message: pickupPassErrorMessage(e, 'QR을 확인하지 못했어요.') }),
      )
  }, [token, mutateAsync])

  return state
}
