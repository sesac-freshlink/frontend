import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { apiErrorMessage, useMemos, type ProductMemo } from '../api'
import { formatDateTime } from '../format'
import { MemoDialog } from './MemoDialog'

/** 메모 탭. 메모가 있는 상품만 최근에 고친 순서로 보여 주고, 수정을 누르면 메모 모달을 연다 */
export function MemoList() {
  const memos = useMemos()
  const [editing, setEditing] = useState<ProductMemo | null>(null)

  if (memos.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (memos.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(memos.error, '메모를 불러오지 못했어요.')}
      </p>
    )
  }
  if (memos.data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        아직 메모가 없어요. 재고 목록에서 상품의 메모 버튼을 눌러 남길 수 있어요.
      </p>
    )
  }

  return (
    <>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {memos.data.map((memo) => (
          <li key={memo.productId} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-slate-900">
                {memo.name}
                <span className="ml-2 text-xs font-normal text-slate-400">{memo.productCode}</span>
              </p>
              <p className="text-sm whitespace-pre-wrap text-slate-600">{memo.content}</p>
              <p className="text-xs text-slate-400 tabular-nums">
                {formatDateTime(memo.updatedAt)} 저장
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(memo)}
              aria-label={`${memo.name} 메모 수정`}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              수정
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <MemoDialog
          productId={editing.productId}
          productName={editing.name}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
