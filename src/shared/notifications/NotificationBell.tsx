import { Bell, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { formatDateTime } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
  type AppNotification,
} from './api'
import { useNotificationStream } from './useNotificationStream'

interface Props {
  /** 패널을 펼칠 쪽. 고객 상단 바는 오른쪽 끝(end), 점주 사이드 메뉴는 왼쪽 위(start) */
  align?: 'start' | 'end'
  className?: string
}

/**
 * 공통 헤더의 알림 종. 안 읽은 개수를 숫자로 보이고, 누르면 알림 목록 패널을 연다.
 * 실시간 알림 SSE 도 여기서 연다(레이아웃마다 하나). 알림을 누르면 읽음으로 바꾸고 그 화면으로 간다
 */
export function NotificationBell({ align = 'end', className }: Props) {
  useNotificationStream()
  const [open, setOpen] = useState(false)
  const unread = useUnreadCount()
  const count = unread.data ?? 0
  const box = useRef<HTMLDivElement>(null)

  // 패널 밖을 누르거나 Esc 를 누르면 닫는다
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? `알림 ${count}개 안 읽음` : '알림'}
        aria-expanded={open}
        className="relative rounded-full p-1 text-slate-500 hover:bg-slate-100"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] leading-4 font-bold text-white tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel align={align} onClose={() => setOpen(false)} hasUnread={count > 0} />
      )}
    </div>
  )
}

function NotificationPanel({
  align,
  onClose,
  hasUnread,
}: {
  align: 'start' | 'end'
  onClose: () => void
  hasUnread: boolean
}) {
  const list = useNotifications(true)
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const navigate = useNavigate()

  const onPick = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id)
    onClose()
    if (n.link) void navigate(n.link)
  }

  return (
    <div
      role="dialog"
      aria-label="알림 목록"
      className={cn(
        'absolute top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-lg',
        align === 'end' ? 'right-0' : 'left-0',
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <p className="text-sm font-semibold text-slate-900">알림</p>
        <button
          type="button"
          onClick={() => markAllRead.mutate()}
          disabled={!hasUnread || markAllRead.isPending}
          className="text-xs text-emerald-600 disabled:text-slate-300"
        >
          모두 읽음
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {list.isPending ? (
          <div className="flex justify-center py-8 text-slate-400">
            <LoaderCircle className="size-5 animate-spin" aria-label="불러오는 중" />
          </div>
        ) : list.isError ? (
          <p className="py-8 text-center text-sm text-red-600">알림을 불러오지 못했어요.</p>
        ) : list.data.content.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">새 알림이 없어요.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.data.content.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onPick(n)}
                  className={cn(
                    'block w-full px-4 py-3 text-left hover:bg-slate-50',
                    !n.read && 'bg-emerald-50/60',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    {!n.read && (
                      <span className="size-1.5 rounded-full bg-emerald-500" aria-label="안 읽음" />
                    )}
                    {n.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-900">{n.body}</span>
                  <span className="mt-0.5 block text-xs text-slate-400 tabular-nums">
                    {formatDateTime(n.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
