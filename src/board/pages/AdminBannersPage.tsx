import { ArrowDown, ArrowUp, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import {
  type AdminBanner,
  BANNER_STATUS_LABEL,
  bannerHomeStatus,
  formatPeriod,
  HOME_BANNER_LIMIT,
  moveBanner,
  useAdminBanners,
  useDeleteBanner,
  useReorderBanners,
} from '../banners'
import { BannerEditDialog } from '../components/BannerEditDialog'
import { DeleteButton } from '../components/DeleteButton'

/** 고칠 배너: 'new' 는 새 배너 */
type Editing = 'new' | AdminBanner | null

/**
 * 관리자 메인배너 관리 (추가 명세 A18, member-service AD-13~AD-17). 게시판 메뉴 아래 공지사항·자주 묻는 질문 옆.
 * 위에서부터 홈에 보이는 순서이고, 보이기 켜짐 + 기간 안인 배너 중 앞의 5장만 고객 홈에 나간다
 */
export function AdminBannersPage() {
  const [editing, setEditing] = useState<Editing>(null)
  const banners = useAdminBanners()
  const remove = useDeleteBanner()
  const reorder = useReorderBanners()
  const list = banners.data ?? []
  // 화면을 연 시각 기준 안내. 실제로 홈에 보낼지는 서버가 정한다
  const [openedAt] = useState(() => new Date())
  const status = bannerHomeStatus(list, openedAt)

  const onDelete = async (bannerId: number) => {
    try {
      await remove.mutateAsync(bannerId)
      toast.success('배너를 지웠어요')
    } catch {
      toast.error('지우지 못했어요. 잠시 뒤 다시 시도해 주세요')
    }
  }

  const onMove = async (index: number, delta: -1 | 1) => {
    const ids = moveBanner(
      list.map((b) => b.bannerId),
      index,
      delta,
    )
    try {
      await reorder.mutateAsync(ids)
    } catch {
      toast.error('순서를 바꾸지 못했어요. 목록을 다시 불러온 뒤 시도해 주세요')
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">메인배너</h1>
          <p className="text-sm text-slate-500">
            고객 홈 맨 위에 위에서부터 이 순서로 보여요. 한 번에 {HOME_BANNER_LIMIT}장까지 보이고,
            6번째부터는 홈에 안 보여요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          배너 올리기
        </button>
      </div>
      {banners.isPending && (
        <div className="flex justify-center py-16 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      )}
      {banners.isError && (
        <p role="alert" className="py-16 text-center text-sm text-red-600">
          배너를 불러오지 못했어요.
        </p>
      )}
      {banners.data && list.length === 0 && (
        <p className="py-16 text-center text-sm text-slate-500">
          올린 배너가 없어요. 배너가 없으면 고객 홈에 배너 칸이 보이지 않아요.
        </p>
      )}
      {list.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">순서</th>
                <th className="px-4 py-3 font-medium">그림</th>
                <th className="px-4 py-3 font-medium">제목</th>
                <th className="px-4 py-3 font-medium">누르면 열 공지</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">기간</th>
                <th className="px-4 py-3 font-medium">홈</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((b, i) => {
                const s = status.get(b.bannerId) ?? 'HIDDEN'
                return (
                  <tr key={b.bannerId}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      <span className="mr-2 inline-block w-4 text-right">{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => void onMove(i, -1)}
                        disabled={i === 0 || reorder.isPending}
                        aria-label={`${b.title} 위로`}
                        className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onMove(i, 1)}
                        disabled={i === list.length - 1 || reorder.isPending}
                        aria-label={`${b.title} 아래로`}
                        className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <img
                        src={b.imageUrl}
                        alt=""
                        className="aspect-2/1 w-32 rounded object-cover"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-900">{b.title}</td>
                    <td className="px-4 py-3 text-slate-600">{b.noticeTitle ?? '없음'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatPeriod(b.startsAt, b.endsAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
                          s === 'SHOWING'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600',
                          s === 'OVER_LIMIT' && 'bg-amber-50 text-amber-800',
                        )}
                      >
                        {BANNER_STATUS_LABEL[s]}
                      </span>
                    </td>
                    <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditing(b)}
                        aria-label={`${b.title} 고치기`}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
                      >
                        고치기
                      </button>
                      <DeleteButton
                        label={b.title}
                        busy={remove.isPending}
                        onConfirm={() => void onDelete(b.bannerId)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && (
        <BannerEditDialog
          nextSortOrder={list.length === 0 ? 0 : Math.max(...list.map((b) => b.sortOrder)) + 1}
          onClose={() => setEditing(null)}
        />
      )}
      {editing !== null && editing !== 'new' && (
        <BannerEditDialog banner={editing} nextSortOrder={0} onClose={() => setEditing(null)} />
      )}
    </section>
  )
}
