import { ChevronRight, LoaderCircle, Pin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { BackLink } from '@/customer/order/components/BackLink'
import { formatDate } from '../format'
import { useNotices } from '../api'

interface Props {
  /** 상세 주소 앞부분 (고객 /customer/notices, 점주 /owner/notices) */
  basePath: string
  /** 위 뒤로 링크 (고객은 마이페이지에서 들어온다). 없으면 그리지 않는다 */
  back?: { to: string; label: string }
}

/** 공지사항 목록 (추가 명세 A17). 고정 글 먼저, 최신순 20개씩 */
export function NoticeListPage({ basePath, back }: Props) {
  const [page, setPage] = useState(0)
  const notices = useNotices(page)
  const data = notices.data

  return (
    <section className="space-y-4">
      {back && <BackLink to={back.to} label={back.label} />}
      <h1 className="text-xl font-bold text-slate-900">공지사항</h1>
      {notices.isPending && (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          공지사항을 불러오는 중이에요
        </p>
      )}
      {notices.isError && (
        <p role="alert" className="text-sm text-red-600">
          공지사항을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}
      {data && data.content.length === 0 && (
        <p className="text-sm text-slate-500">공지사항이 없어요.</p>
      )}
      {data && data.content.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {data.content.map((n) => (
            <li key={n.noticeId}>
              <Link
                to={`${basePath}/${n.noticeId}`}
                className="flex items-center gap-2 px-4 py-3 text-sm"
              >
                {n.pinned && <Pin className="size-4 shrink-0 text-emerald-600" aria-label="고정" />}
                <span className="min-w-0 flex-1 truncate text-slate-900">{n.title}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatDate(n.createdAt)}</span>
                <ChevronRight className="size-4 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
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
    </section>
  )
}
