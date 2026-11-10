import { LoaderCircle, Pin } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AUDIENCE_LABEL, useAdminNotice, useAdminNotices, useDeleteNotice } from '../api'
import { DeleteButton } from '../components/DeleteButton'
import { NoticeEditDialog } from '../components/NoticeEditDialog'
import { formatDate } from '../format'

/** 고칠 공지: 'new' 는 새 글, 숫자는 그 글 */
type Editing = 'new' | number | null

/** 관리자 공지사항 관리 (추가 명세 A17, member-service AD-04~08) */
export function AdminNoticesPage() {
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Editing>(null)
  const notices = useAdminNotices(page)
  const remove = useDeleteNotice()

  const onDelete = async (noticeId: number) => {
    try {
      await remove.mutateAsync(noticeId)
      // 이 페이지의 마지막 글을 지우면 빈 페이지가 되지 않게 앞 페이지로 간다
      if (page > 0 && notices.data?.content.length === 1) setPage((p) => p - 1)
      toast.success('공지를 지웠어요')
    } catch {
      toast.error('지우지 못했어요. 잠시 뒤 다시 시도해 주세요')
    }
  }

  const data = notices.data
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">공지사항</h1>
          <p className="text-sm text-slate-500">고정 글이 먼저, 그다음 최근 글 순서예요.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          공지 쓰기
        </button>
      </div>
      {notices.isPending && (
        <div className="flex justify-center py-16 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      )}
      {notices.isError && (
        <p role="alert" className="py-16 text-center text-sm text-red-600">
          공지사항을 불러오지 못했어요.
        </p>
      )}
      {data && data.totalElements === 0 && (
        <p className="py-16 text-center text-sm text-slate-500">공지사항이 없어요.</p>
      )}
      {data && data.totalElements > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">제목</th>
                <th className="px-4 py-3 font-medium">볼 사람</th>
                <th className="px-4 py-3 font-medium">올린 날</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.content.map((n) => (
                <tr key={n.noticeId}>
                  <td className="px-4 py-3 text-slate-900">
                    <span className="flex items-center gap-2">
                      {n.pinned && <Pin className="size-4 text-emerald-600" aria-label="고정" />}
                      {n.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{AUDIENCE_LABEL[n.audience]}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(n.createdAt)}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing(n.noticeId)}
                      aria-label={`${n.title} 고치기`}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      고치기
                    </button>
                    <DeleteButton
                      label={n.title}
                      busy={remove.isPending}
                      onConfirm={() => void onDelete(n.noticeId)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.totalPages > 1 && (
        <nav
          aria-label="페이지"
          className="flex items-center justify-center gap-3 text-sm text-slate-600"
        >
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
          >
            이전
          </button>
          <span>
            {page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= data.totalPages || notices.isFetching}
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
          >
            다음
          </button>
        </nav>
      )}
      {editing === 'new' && <NoticeEditDialog onClose={() => setEditing(null)} />}
      {typeof editing === 'number' && (
        <EditExisting noticeId={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  )
}

/** 본문까지 받아 온 뒤 고치기 창을 연다 */
function EditExisting({ noticeId, onClose }: { noticeId: number; onClose(): void }) {
  const notice = useAdminNotice(noticeId)
  if (notice.isError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        공지를 불러오지 못했어요.
      </p>
    )
  }
  if (!notice.data) return null
  return <NoticeEditDialog notice={notice.data} onClose={onClose} />
}
