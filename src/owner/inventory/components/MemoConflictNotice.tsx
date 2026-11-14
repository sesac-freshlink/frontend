import { TriangleAlert } from 'lucide-react'
import { cn } from '@/shared/ui/cn'
import type { ProductMemo } from '../api'
import { formatDateTime } from '../format'

/** 409 MEMO_CHANGED 뒤 다른 화면이 저장한(또는 지운) 내용 안내. 메모 창·메모 카드가 같이 쓴다 */
export function MemoConflictNotice({
  latest,
  className,
}: {
  latest: ProductMemo | null
  className: string
}) {
  return (
    <div
      role="status"
      className={cn('space-y-1 rounded-lg px-3 py-2 text-sm text-amber-900', className)}
    >
      <p className="flex items-center gap-1.5 font-medium">
        <TriangleAlert className="size-4" aria-hidden />
        {latest
          ? `다른 화면에서 ${formatDateTime(latest.updatedAt)}에 저장한 내용`
          : '다른 화면에서 메모를 삭제했어요'}
      </p>
      {latest && <p className="whitespace-pre-wrap text-amber-800">{latest.content}</p>}
      <p className="text-xs text-amber-700">
        {latest
          ? '확인했으면 다시 저장하세요. 지금 쓴 내용으로 바뀌어요.'
          : '다시 저장하면 지금 쓴 내용으로 새로 만들어요.'}
      </p>
    </div>
  )
}
