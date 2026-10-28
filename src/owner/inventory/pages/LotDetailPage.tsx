import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useInventory } from '../api'
import { LotDetailPanel } from '../components/LotDetailPanel'

/** S-11 /owner/inventory/:productId 바로 열기용. 재고 화면의 lot 상세 패널을 그대로 쓴다 */
export function LotDetailPage() {
  const { productId } = useParams()
  const id = productId !== undefined && /^\d+$/.test(productId) ? Number(productId) : undefined
  const inventory = useInventory()
  const productName = inventory.data?.find((item) => item.productId === id)?.name

  return (
    <section className="space-y-4">
      <Link
        to="/owner/inventory"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        재고 목록
      </Link>
      {id === undefined ? (
        <p className="py-16 text-center text-sm text-red-600">상품 번호가 올바르지 않아요.</p>
      ) : (
        <div className="max-w-2xl">
          <LotDetailPanel productId={id} productName={productName} />
        </div>
      )}
    </section>
  )
}
