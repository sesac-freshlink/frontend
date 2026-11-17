import { cn } from '@/shared/ui/cn'
import { PICKUP_STREAM_LABEL } from '../api'

/**
 * A16 점주 왼쪽 메뉴 점포명 옆 QR 알림 연결 불 (11/13 경우 결정). 초록 = 연결됨, 회색 = 끊김(다시 붙는 중이거나 멈춤).
 * 누를 수 없고 움직이지 않는다. 화면에 보이는 글자는 늘리지 않고, 마우스를 올린 글(title)과
 * 화면 읽기 글만 둔다. 상태가 바뀌면 화면 읽기 프로그램이 조용히 읽는다(role="status")
 */
export function PickupStreamDot({ connected }: { connected: boolean }) {
  const label = connected ? PICKUP_STREAM_LABEL.connected : PICKUP_STREAM_LABEL.disconnected
  return (
    <span role="status" title={label} className="inline-flex shrink-0">
      <span
        aria-hidden
        className={cn('size-2 rounded-full', connected ? 'bg-emerald-600' : 'bg-slate-500')}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
