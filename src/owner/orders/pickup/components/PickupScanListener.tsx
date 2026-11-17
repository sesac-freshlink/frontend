import { useCallback, useState } from 'react'
import { usePickupScanStream } from '../api'
import { PickupApproveDialog } from './PickupApproveDialog'

/**
 * 점주 공통 틀에 두는 픽업 QR 알림 (추가 명세 A16). 점주 핸드폰이 고객 QR을 찍으면 어느 점주 화면에 있든
 * 승인 창이 뜬다. 창이 열려 있을 때 새 스캔이 오면 새 고객으로 바꾼다.
 * 알림 통로가 붙고 끊길 때마다 onConnectionChange 로 알린다(점포명 옆 불, 11/13). 이 함수는 바뀌지 않는 것을 넘긴다
 */
export function PickupScanListener({
  onConnectionChange,
}: {
  onConnectionChange?: (connected: boolean) => void
}) {
  const [token, setToken] = useState<string | null>(null)
  const onScan = useCallback((next: string) => setToken(next), [])
  usePickupScanStream(onScan, onConnectionChange)
  if (!token) return null
  return <PickupApproveDialog key={token} pickupKey={token} onClose={() => setToken(null)} />
}
