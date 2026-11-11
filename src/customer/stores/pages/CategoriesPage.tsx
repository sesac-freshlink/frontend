import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/QueryState'
import { useStoreCategories } from '../api'
import { useStoreName } from '../useStoreName'

/**
 * 전체 분류 (/customer/stores/:storeId/categories). 홈 카테고리 8칸의 마지막 [카테고리] 칸이 연다.
 * 그 점포 상품의 카테고리를 모두 보여 주고, 누르면 그 카테고리 상품 목록(?category=)으로 간다
 */
export function CategoriesPage() {
  const { storeId: raw } = useParams()
  const storeId = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : undefined
  if (storeId === undefined) {
    return <EmptyState message="점포 주소가 올바르지 않아요." />
  }
  return <Categories storeId={storeId} />
}

function Categories({ storeId }: { storeId: number }) {
  const storeName = useStoreName(storeId)
  const categories = useStoreCategories(storeId)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <Link
          to="/customer"
          aria-label="홈으로"
          className="-ml-2 flex size-11 items-center justify-center text-slate-700"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          {storeName ? `${storeName} 카테고리` : '카테고리'}
        </h1>
      </div>
      <CategoryList storeId={storeId} storeName={storeName} categories={categories} />
    </div>
  )
}

function CategoryList({
  storeId,
  storeName,
  categories,
}: {
  storeId: number
  storeName: string | undefined
  categories: ReturnType<typeof useStoreCategories>
}) {
  if (categories.isPending) return <LoadingState label="카테고리를 불러오는 중" />
  if (categories.isError) {
    return (
      <ErrorState
        message="카테고리를 불러오지 못했어요."
        onRetry={() => void categories.refetch()}
        retrying={categories.isFetching}
      />
    )
  }
  if (categories.data.length === 0) {
    return <EmptyState message="이 점포에는 아직 상품이 없어요." />
  }
  return (
    <ul className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
      {categories.data.map((c) => (
        <li key={c}>
          <Link
            to={`/customer/stores/${storeId}?category=${encodeURIComponent(c)}`}
            state={storeName ? { storeName } : undefined}
            className="flex min-h-12 items-center justify-between px-4 text-base text-slate-900"
          >
            {c}
            <ChevronRight className="size-4 text-slate-600" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
