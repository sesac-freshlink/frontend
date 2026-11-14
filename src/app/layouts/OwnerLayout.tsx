import {
  ChartColumn,
  CircleHelp,
  ClipboardList,
  History,
  House,
  LogOut,
  Megaphone,
  Package,
  Store,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuthStore } from '@/shared/auth'
import { PickupScanListener } from '@/owner/orders/pickup/components/PickupScanListener'
import { PickupStreamDot } from '@/owner/orders/pickup/components/PickupStreamDot'
import { AssistantLauncher } from '@/owner/assistant/components/AssistantLauncher'
import { NotificationBell } from '@/shared/notifications/NotificationBell'
import { useNotificationRefresh } from '@/shared/realtime/useNotificationRefresh'
import { useOwnerStore } from '@/owner/store/api'
import { cn } from '@/shared/ui/cn'

/** 점주 메뉴 묶음(11/12 결정): 재고 / 주문 / 소식. 내 점포는 아래 따로 */
const MENU_GROUPS = [
  {
    label: '재고',
    items: [
      { to: '/owner/inventory', label: '매장 재고', icon: Package },
      { to: '/owner/ledger', label: '변동 이력', icon: History },
      { to: '/owner/expiring', label: '임박·폐기', icon: TriangleAlert },
    ],
  },
  {
    label: '주문',
    items: [
      { to: '/owner/orders', label: '결제·픽업', icon: ClipboardList },
      { to: '/owner/sales', label: '매출', icon: ChartColumn },
    ],
  },
  {
    label: '소식',
    items: [
      { to: '/owner/notices', label: '공지사항', icon: Megaphone },
      { to: '/owner/faq', label: '자주 묻는 질문', icon: CircleHelp },
    ],
  },
]

const menuLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100',
    isActive && 'bg-emerald-50 text-emerald-700',
  )

/** "내 점포" 아래 늘 보이는 하위 메뉴 (추가 명세 A15). 비밀번호 변경은 비밀번호로 가입한 계정만 */
const STORE_SUBMENU = [
  { to: '/owner/store', label: '점포 수정', end: true, passwordOnly: false },
  { to: '/owner/store/password', label: '비밀번호 변경', end: false, passwordOnly: true },
]

/** 점주 화면: 매장 포스기(가로 화면)용 왼쪽 사이드 메뉴. 맨 위에 알림 종(소비기한 임박·경과) */
export function OwnerLayout() {
  const { user, signOut } = useAuthStore()
  const store = useOwnerStore()
  // QR 알림 통로가 붙어 있는지 (점포명 옆 불). 처음 열리기 전에는 끊김으로 본다
  const [qrConnected, setQrConnected] = useState(false)
  // 픽업 신청·소비기한 알림이 오면 주문 목록·임박 데이터를 바로 다시 읽는다 (11/14 경우 결정 R1·R6)
  useNotificationRefresh()

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col self-start border-r border-slate-200 bg-white">
        <div className="flex items-start justify-between px-5 py-4">
          <div className="min-w-0">
            <img src="/logo.png" alt="freshLink" className="h-7 w-auto" />
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="min-w-0 truncate">{store.data?.name ?? ''}</span>
              {/* QR 알림 연결 불: 초록 = 연결됨, 회색 = 끊김 (A16, 11/13) */}
              <PickupStreamDot connected={qrConnected} />
            </p>
          </div>
          <NotificationBell align="start" />
        </div>
        <nav aria-label="점주 메뉴" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3">
          <NavLink to="/owner" end className={menuLinkClass}>
            <House className="size-4" aria-hidden />홈
          </NavLink>
          {MENU_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-xs text-slate-500">{group.label}</p>
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={menuLinkClass}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-slate-200 px-3 pt-3">
          {/* end 없이: 비밀번호 변경(/owner/store/password) 화면에서도 "내 점포"가 켜져 있게 한다(A15) */}
          <NavLink to="/owner/store" className={menuLinkClass}>
            <Store className="size-4" aria-hidden />내 점포
          </NavLink>
          <ul aria-label="내 점포 메뉴" className="space-y-1 pl-7">
            {STORE_SUBMENU.filter(
              (s) => s.to !== '/owner/store' && (!s.passwordOnly || user?.passwordLogin !== false),
            ).map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100',
                      isActive && 'font-medium text-emerald-700',
                    )
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mx-3 mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
        >
          <LogOut className="size-4" aria-hidden />
          로그아웃
        </button>
      </aside>
      {/* 점주 핸드폰이 고객 픽업 QR을 찍으면 어느 화면에 있든 승인 창이 뜬다 (추가 명세 A16) */}
      <PickupScanListener onConnectionChange={setQrConnected} />
      {/* AI 점주 비서: 오른쪽 아래 버튼, 화면 이동 없이 대화창을 띄운다 */}
      <AssistantLauncher />
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
