import { useParams } from 'react-router'
import { Placeholder } from '@/shared/ui/Placeholder'

/** 주문 상태는 2초 폴링(POLL_MS.orderDetail)으로 조회한다 */
export function OrderDetailPage() {
  const { id } = useParams()
  return (
    <Placeholder
      featureId="U-21, U-22, U-31"
      title={`주문·결제·주문 상세 (${id})`}
      owner="김경우"
    />
  )
}
