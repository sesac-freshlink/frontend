import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useInventory } from '../api'
import { LotDetailPanel } from '../components/LotDetailPanel'

const NAME_LOOKUP = { q: '', statuses: [], memoOnly: false, page: 0, size: 100 }

/** S-11 /owner/inventory/:productId 바로 열기용. 재고 화면의 lot 상세 패널을 그대로 쓴다 */
export function LotDetailPage() {
  const { productId } = useParams()
  const id = productId !== undefined && /^\d+$/.test(productId) ? Number(productId) : undefined
  // 상품명만 찾는다. 첫 100개 안에 없으면 이름 없이 보여 준다(패널은 이름이 없어도 동작한다)
  const inventory = useInventory(NAME_LOOKUP)
  const productName = inventory.data?.items.find((item) => item.productId === id)?.name

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
