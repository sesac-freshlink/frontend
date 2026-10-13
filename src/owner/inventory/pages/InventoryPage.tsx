import { Link } from 'react-router'
import { Placeholder } from '@/shared/ui/Placeholder'
import { useInventory } from '../api'

/** 폴링 예시로 목록만 붙여 두었다. 화면은 이태우 님이 만든다 */
export function InventoryPage() {
  const { data, isPending, isError } = useInventory()

  return (
    <Placeholder featureId="S-10, S-15" title="재고 목록 (3초 폴링)" owner="이태우">
      {isPending && <p className="text-sm text-slate-400">불러오는 중…</p>}
      {isError && <p className="text-sm text-red-600">재고를 불러오지 못했습니다</p>}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {data?.map((item) => (
          <li key={item.productId}>
            <Link
              to={`/owner/inventory/${item.productId}`}
              className="flex justify-between px-4 py-3 text-sm hover:bg-slate-50"
            >
              <span>{item.name}</span>
              <span className="tabular-nums">
                구매 가능 {item.availableQuantity} / 총 {item.totalQuantity}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Placeholder>
  )
}
