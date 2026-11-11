import { MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { useProductStores, useStorePlaces } from '../api'
import { formatDistance, nearbyStores } from '../nearby'
import { useCurrentPosition } from '../useCurrentPosition'

/**
 * 주변 점포 재고(11/4 멘토링). 품절 상품 상세에서 이 상품이 남아 있는 다른 점포를 보여 준다.
 * 위치를 쓸 수 있으면 가까운 순, 거부하면 지금 점포와 같은 지역 점포를 많이 남은 순으로 보여 준다.
 * 점포를 누르면 그 점포의 같은 상품 상세로, [위치]를 누르면 점포 정보(지도)로 간다
 */
export function NearbyStoreStock({
  storeId,
  productId,
  soldOut = true,
}: {
  storeId: number
  productId: number
  /** 지금 점포에서 품절인지. 품절이면 "근처 점포에 있어요", 아니면 "구매 가능한 다른 점포" 제목. 팔고 있는데 다른 점포 재고가 없으면 칸을 숨긴다 */
  soldOut?: boolean
}) {
  const stocks = useProductStores(productId, true)
  const position = useCurrentPosition(true)
  const list = Array.isArray(stocks.data) ? stocks.data : []
  const places = useStorePlaces(
    storeId,
    list.map((s) => s.storeId),
  )
  const origin = position.status === 'ok' ? position.position : null
  const items = nearbyStores(list, places.places, storeId, origin)

  if (!stocks.isSuccess || position.status === 'pending' || places.isPending) return null
  if (!soldOut && items.length === 0) return null

  return (
    <section aria-labelledby="nearby-title" className="space-y-2">
      <h2 id="nearby-title" className="text-sm font-semibold text-slate-900">
        {soldOut ? '근처 점포에 있어요' : '구매 가능한 다른 점포'}
      </h2>
      {origin === null && (
        <p className="text-xs text-slate-500">위치를 쓸 수 없어 같은 지역 점포를 보여 드려요.</p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">다른 점포에도 지금은 재고가 없어요.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
          {items.map((s) => (
            <li key={s.storeId} className="flex items-center gap-2 px-3 py-2">
              <Link
                to={`/customer/stores/${s.storeId}/products/${productId}`}
                state={{ storeName: s.name }}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className="block truncate font-medium text-slate-900">{s.name}</span>
                <span className="block text-xs text-slate-500 tabular-nums">
                  {s.distanceKm !== null && `${formatDistance(s.distanceKm)} · `}
                  {s.availableQuantity}개 남음
                </span>
              </Link>
              <Link
                to={`/customer/stores/${s.storeId}/info`}
                state={{ storeName: s.name }}
                aria-label={`${s.name} 위치 보기`}
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
              >
                <MapPin className="size-4" aria-hidden />
                위치
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
