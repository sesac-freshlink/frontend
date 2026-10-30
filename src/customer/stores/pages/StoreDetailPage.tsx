import { ChevronLeft, LoaderCircle, MapPin } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import { useStoreDetail } from '../api'
import { StoreMap } from '../components/StoreMap'

/**
 * 고객 점포 상세 (/customer/stores/:storeId/info). 점포 이미지·이름·주소·설명과 카카오맵 위치를 보여 준다.
 * member-service GET /stores/{storeId}(공개). 관리자가 아직 넣지 않은 값은 자리표시·안내로 둔다. 들어올 때만 읽는다
 */
export function StoreDetailPage() {
  const { storeId: raw } = useParams()
  const storeId = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : undefined
  if (storeId === undefined) {
    return (
      <section className="space-y-3 py-6 text-center">
        <p className="text-sm text-slate-500">점포 주소가 올바르지 않아요.</p>
        <Link to="/customer" className="text-sm text-emerald-600 underline">
          점포 찾기로
        </Link>
      </section>
    )
  }
  return <StoreDetailView key={storeId} storeId={storeId} />
}

function StoreDetailView({ storeId }: { storeId: number }) {
  const store = useStoreDetail(storeId)

  return (
    <section className="space-y-4">
      <Link
        to={`/customer/stores/${storeId}`}
        state={store.data ? { storeName: store.data.name } : undefined}
        className="inline-flex items-center gap-1 text-sm text-slate-500"
      >
        <ChevronLeft className="size-4" />
        상품 목록
      </Link>
      {store.isPending ? (
        <div className="flex justify-center py-10 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      ) : store.isError ? (
        <div className="space-y-2 py-10 text-center">
          <p className="text-sm text-red-600">점포 정보를 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => void store.refetch()}
            className="text-sm text-slate-500 underline"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <ProductThumb
            src={store.data.imageUrl}
            name={store.data.name}
            className="aspect-video size-auto w-full rounded-lg"
          />
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">{store.data.name}</h1>
            <p className="flex items-start gap-1 text-sm text-slate-500">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {store.data.address}
            </p>
          </div>
          {store.data.description && (
            <p className="text-sm whitespace-pre-line text-slate-700">{store.data.description}</p>
          )}
          <StoreMap
            latitude={store.data.latitude}
            longitude={store.data.longitude}
            name={store.data.name}
          />
          <Link
            to={`/customer/stores/${storeId}`}
            state={{ storeName: store.data.name }}
            className="block rounded-lg bg-emerald-600 py-3 text-center text-sm font-medium text-white"
          >
            이 점포 상품 보기
          </Link>
        </>
      )}
    </section>
  )
}
