import { useParams } from 'react-router'
import { Placeholder } from '@/shared/ui/Placeholder'

export function LotDetailPage() {
  const { productId } = useParams()
  return <Placeholder featureId="S-11" title={`lot 상세 (상품 ${productId})`} owner="이태우" />
}
