import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/ui/cn'
import { type AdminStore, useAdminStores } from '../api'
import { StoreEditModal } from '../components/StoreEditModal'
import { regionName, STORE_STATUS_BADGE, STORE_STATUS_LABEL, STORE_TEXT } from '../storeText'

/** A-02 관리자 점포 목록·수정 (member-service AD-02·AD-03) */
export function AdminStoresPage() {
  const [page, setPage] = useState(0)
  // 모달을 연 순간의 점포 값. 편집 중 목록이 다시 와도 입력 초기값이 흔들리지 않게 고정한다
  const [editing, setEditing] = useState<AdminStore | null>(null)
  const stores = useAdminStores(page)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">점포 목록</h1>
          <p className="text-sm text-slate-500">등록된 점포예요. 최근 등록한 점포가 위에 있어요.</p>
        </div>
        <Link
          to="/admin/stores/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          점포 등록
        </Link>
      </div>
      <StoreTable stores={stores} page={page} onPageChange={setPage} onEdit={setEditing} />
      {editing && <StoreEditModal store={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

interface StoreTableProps {
  stores: ReturnType<typeof useAdminStores>
  page: number
  onPageChange(page: number): void
  onEdit(store: AdminStore): void
}

function StoreTable({ stores, page, onPageChange, onEdit }: StoreTableProps) {
  if (stores.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (stores.isError) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-red-600">{STORE_TEXT.listError}</p>
        <button
          type="button"
          onClick={() => void stores.refetch()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          다시 시도
        </button>
      </div>
    )
  }
  const { data } = stores
  if (data.totalElements === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">{STORE_TEXT.empty}</p>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">점포명</th>
              <th className="px-4 py-3 font-medium">주소</th>
              <th className="px-4 py-3 font-medium">시도</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">점주 이메일</th>
              <th className="px-4 py-3">
                <span className="sr-only">수정</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {data.content.map((s) => (
              <tr key={s.storeId} className={cn(s.status === 'PENDING' && 'bg-amber-50')}>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.address}</td>
                <td className="px-4 py-3">{regionName(s.region)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      STORE_STATUS_BADGE[s.status],
                    )}
                  >
                    {STORE_STATUS_LABEL[s.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{s.ownerEmail ?? '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    aria-label={`${s.name} 수정`}
                    disabled={s.status === 'PENDING'}
                    title={s.status === 'PENDING' ? '등록 중인 점포는 수정할 수 없어요' : undefined}
                    onClick={() => onEdit(s)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    수정
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-center gap-4 text-sm text-slate-600">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
        >
          이전
        </button>
        <span>
          {data.page + 1} / {Math.max(data.totalPages, 1)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={stores.isPlaceholderData || page + 1 >= data.totalPages}
          className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
        >
          다음
        </button>
      </div>
    </div>
  )
}
