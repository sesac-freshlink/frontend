import { useParams } from 'react-router'
import { Placeholder } from '@/shared/ui/Placeholder'

export function StoreProductsPage() {
  const { storeId } = useParams()
  return <Placeholder featureId="U-10" title={`점포 ${storeId} 상품 목록`} owner="이태우" />
}
