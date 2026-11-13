import { GalleryHorizontal, Megaphone, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAdminStores } from '@/admin/stores/api'
import { regionName, STORE_STATUS_BADGE, STORE_STATUS_LABEL } from '@/admin/stores/storeText'
import { useAdminFaqs, useAdminNotices } from '@/board/api'
import {
  BANNER_STATUS_LABEL,
  bannerHomeStatus,
  HOME_BANNER_LIMIT,
  useAdminBanners,
} from '@/board/banners'
import { cn } from '@/shared/ui/cn'
import { Card, Empty, Stat } from '@/shared/ui/Dashboard'

/** 홈 목록마다 보여 주는 줄 수 (점주 홈과 같음) */
const ROWS = 5

/** "2026-11-12T10:00:00+09:00" → "11.12" */
const shortDate = (iso: string) => iso.slice(5, 10).replace('-', '.')

/**
 * 관리자 첫 화면(11/13 경우 결정 "홈 만들기"): 숫자 4칸(전체 점포·등록 중·홈 배너·공지사항),
 * 최근 등록 점포·메인배너 지금 상태, 최근 공지·바로가기. 점주 홈과 같은 틀이고 이미 있는 API만 쓴다.
 * 점포 상태별 수는 서버에 세는 API가 없어 목록 첫 쪽(최신 20개)으로 세고, 화면에도 그렇게 적는다
 */
export function AdminHomePage() {
  const stores = useAdminStores(0)
  const banners = useAdminBanners()
  const notices = useAdminNotices(0)
  const faqs = useAdminFaqs()
  // 배너 화면과 같게, 화면을 연 시각 기준으로 노출 상태를 판정한다(렌더마다 시계를 읽지 않음)
  const [openedAt] = useState(() => new Date())

  const storeList = stores.data?.content ?? []
  const pendingCount = storeList.filter((s) => s.status === 'PENDING').length
  const inactiveCount = storeList.filter((s) => s.status === 'INACTIVE').length
  const bannerList = banners.data ?? []
  const status = bannerHomeStatus(bannerList, openedAt)
  const showing = [...status.values()].filter((s) => s === 'SHOWING').length
  const ended = [...status.values()].filter((s) => s === 'ENDED').length
  const noticeList = notices.data?.content ?? []

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white">
        <h1 className="border-b border-slate-200 px-4 py-3 text-xl font-bold text-slate-900">
          안녕하세요, 관리자님
        </h1>
        <dl className="grid grid-cols-2 divide-slate-200 lg:grid-cols-4 lg:divide-x">
          <Stat
            value={stores.data ? `${stores.data.totalElements}` : '-'}
            label="전체 점포"
            sub={inactiveCount > 0 ? `운영 중단 ${inactiveCount}` : undefined}
          />
          <Stat
            value={stores.data ? `${pendingCount}` : '-'}
            label="등록 중 점포"
            // 세는 범위를 알리는 글이라 로즈(급함)로 칠하지 않는다. 등록 중 줄은 아래 목록 배지로 보인다
            sub="최근 등록 20개 기준"
          />
          <Stat
            value={banners.data ? `${showing} / ${HOME_BANNER_LIMIT}` : '-'}
            label="고객 홈 배너"
            sub={
              banners.data && showing === 0
                ? '홈에 보이는 배너가 없어요'
                : ended > 0
                  ? `노출 끝 ${ended}`
                  : `${HOME_BANNER_LIMIT}장까지 보여요`
            }
            urgent={banners.data !== undefined && showing === 0}
          />
          <Stat
            value={notices.data ? `${notices.data.totalElements}` : '-'}
            label="공지사항"
            sub={faqs.data ? `자주 묻는 질문 ${faqs.data.length}` : undefined}
          />
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="최근 등록 점포"
          count={stores.data?.totalElements}
          countUnit="개"
          more="/admin/stores"
          moreLabel="점포 목록"
        >
          {storeList.length === 0 ? (
            <Empty>등록된 점포가 없어요. 점포 등록에서 만들 수 있어요.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200">
              {storeList.slice(0, ROWS).map((s) => (
                <li key={s.storeId} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                      STORE_STATUS_BADGE[s.status],
                    )}
                  >
                    {STORE_STATUS_LABEL[s.status]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-900">{s.name}</span>
                  <span className="text-xs text-slate-500">{regionName(s.region)}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {shortDate(s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="메인배너 지금 상태"
          count={bannerList.length}
          countUnit="개"
          more="/admin/banners"
          moreLabel="메인배너"
        >
          {bannerList.length === 0 ? (
            <Empty>올린 배너가 없어요. 메인배너에서 올릴 수 있어요.</Empty>
          ) : (
            <ol className="divide-y divide-slate-200">
              {bannerList.slice(0, ROWS).map((b, i) => {
                const s = status.get(b.bannerId) ?? 'HIDDEN'
                return (
                  <li key={b.bannerId} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="grid size-6 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-900">{b.title}</span>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                        s === 'SHOWING'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {BANNER_STATUS_LABEL[s]}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="최근 공지" more="/admin/notices" moreLabel="공지사항">
            {noticeList.length === 0 ? (
              <Empty>올린 공지가 없어요. 공지사항에서 쓸 수 있어요.</Empty>
            ) : (
              <ul className="divide-y divide-slate-200">
                {noticeList.slice(0, 3).map((n) => (
                  <li
                    key={n.noticeId}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate text-slate-900">
                      {n.pinned && <span className="mr-1.5 text-xs text-emerald-700">고정</span>}
                      {n.title}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {shortDate(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="바로가기">
          <ul className="divide-y divide-slate-200">
            {SHORTCUTS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex items-center gap-3 py-2.5 text-sm text-slate-700 hover:underline"
                >
                  <Icon className="size-4 text-slate-500" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  )
}

/** 바로가기: 관리자가 가장 자주 하는 일(점포 등록·공지·배너) */
const SHORTCUTS = [
  { to: '/admin/stores/new', label: '점포 등록', icon: Plus },
  { to: '/admin/notices', label: '공지사항', icon: Megaphone },
  { to: '/admin/banners', label: '메인배너', icon: GalleryHorizontal },
]
