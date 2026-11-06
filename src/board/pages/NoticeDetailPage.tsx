import { ChevronLeft, LoaderCircle } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { apiErrorCode } from '@/shared/api/errors'
import { useNotice } from '../api'
import { formatDate } from '../format'

interface Props {
  /** 목록 주소 (고객 /customer/notices, 점주 /owner/notices) */
  basePath: string
}

/** 공지사항 상세 (추가 명세 A17). 본문은 줄바꿈 그대로 */
export function NoticeDetailPage({ basePath }: Props) {
  const { noticeId } = useParams()
  const notice = useNotice(Number(noticeId))

  return (
    <article className="space-y-4">
      <Link to={basePath} className="flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft className="size-4" />
        공지사항
      </Link>
      {notice.isPending && (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          공지를 불러오는 중이에요
        </p>
      )}
      {notice.isError && (
        <p role="alert" className="text-sm text-red-600">
          {apiErrorCode(notice.error) === 'NOTICE_NOT_FOUND'
            ? '없는 공지예요.'
            : '공지를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'}
        </p>
      )}
      {notice.data && (
        <>
          <header className="space-y-1 border-b border-slate-200 pb-3">
            <h1 className="text-xl font-bold text-slate-900">{notice.data.title}</h1>
            <p className="text-xs text-slate-400">{formatDate(notice.data.createdAt)}</p>
          </header>
          <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
            {notice.data.content}
          </p>
        </>
      )}
    </article>
  )
}
