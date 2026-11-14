import {
  ChartColumn,
  CircleHelp,
  ClipboardList,
  History,
  House,
  LogOut,
  Megaphone,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { Fragment, useState, type KeyboardEvent, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuthStore } from '@/shared/auth'
import { PickupScanListener } from '@/owner/orders/pickup/components/PickupScanListener'
import { PickupStreamDot } from '@/owner/orders/pickup/components/PickupStreamDot'
import { AssistantLauncher } from '@/owner/assistant/components/AssistantLauncher'
import { NotificationBell } from '@/shared/notifications/NotificationBell'
import { useNotificationRefresh } from '@/shared/realtime/useNotificationRefresh'
import { useOwnerStore } from '@/owner/store/api'
import { cn } from '@/shared/ui/cn'
import { useOwnerSidebar } from './ownerSidebar'

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

/** 접힌 메뉴의 아이콘 칸: 누르는 곳 44px(tap-min), 마우스·키보드로 닿으면 이름 말풍선 (11/14 E2·E5) */
const railItemClass = (isActive = false) =>
  cn(
    'group relative flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100',
    isActive && 'bg-emerald-50 text-emerald-700',
  )

/**
 * 접혔을 때만 보이는 이름 말풍선. 화면 읽기는 숨긴 이름(sr-only)을 읽으므로 말풍선은 읽지 않는다.
 * 바깥 칸의 왼쪽 여백(pl-2)도 아이콘 칸 안이라 마우스를 말풍선으로 옮겨도 사라지지 않고,
 * Esc 를 누르면 초점·마우스를 옮기지 않고 닫힌다 (WCAG 1.4.13)
 */
function RailTip({ children, dismissed }: { children: ReactNode; dismissed: boolean }) {
  return (
    <span
      aria-hidden
      data-rail-tip
      className={cn(
        'absolute top-1/2 left-full z-20 -translate-y-1/2 pl-2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
        dismissed && 'hidden',
      )}
    >
      <span className="block rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white">
        {children}
      </span>
    </span>
  )
}

/** 말풍선을 Esc 로 닫고, 마우스가 떠나거나 초점이 빠지면 다시 쓸 수 있게 한다 */
function useTipDismiss() {
  const [dismissed, setDismissed] = useState(false)
  return {
    dismissed,
    handlers: {
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Escape') setDismissed(true)
      },
      onMouseLeave: () => setDismissed(false),
      onBlur: () => setDismissed(false),
    },
  }
}

interface MenuLinkProps {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  collapsed: boolean
}

/** 왼쪽 메뉴 한 줄. 펼치면 아이콘 + 이름, 접으면 아이콘만 + 말풍선 */
function MenuLink({ to, label, icon: Icon, end, collapsed }: MenuLinkProps) {
  if (!collapsed) {
    return (
      <NavLink to={to} end={end} className={menuLinkClass}>
        <Icon className="size-4" aria-hidden />
        {label}
      </NavLink>
    )
  }
  return <RailLink to={to} end={end} label={label} icon={Icon} />
}

function RailLink({ to, end, label, icon: Icon }: Omit<MenuLinkProps, 'collapsed'>) {
  const { dismissed, handlers } = useTipDismiss()
  return (
    <NavLink to={to} end={end} className={({ isActive }) => railItemClass(isActive)} {...handlers}>
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
      <RailTip dismissed={dismissed}>{label}</RailTip>
    </NavLink>
  )
}

/** 접힌 메뉴의 로그아웃 버튼 */
function RailLogout({ onClick }: { onClick: () => void }) {
  const { dismissed, handlers } = useTipDismiss()
  return (
    <button type="button" onClick={onClick} className={railItemClass()} {...handlers}>
      <LogOut className="size-4" aria-hidden />
      <span className="sr-only">로그아웃</span>
      <RailTip dismissed={dismissed}>로그아웃</RailTip>
    </button>
  )
}

/** "내 점포" 아래 늘 보이는 하위 메뉴 (추가 명세 A15). 비밀번호 변경은 비밀번호로 가입한 계정만 */
const STORE_SUBMENU = [
  { to: '/owner/store', label: '점포 수정', end: true, passwordOnly: false },
  { to: '/owner/store/password', label: '비밀번호 변경', end: false, passwordOnly: true },
]

/** 점주 화면: 매장 포스기(가로 화면)용 왼쪽 사이드 메뉴. 맨 위에 알림 종(소비기한 임박·경과). 아이콘만 남게 접을 수 있다(11/14) */
export function OwnerLayout() {
  const { user, signOut } = useAuthStore()
  const store = useOwnerStore()
  // QR 알림 통로가 붙어 있는지 (점포명 옆 불). 처음 열리기 전에는 끊김으로 본다
  const [qrConnected, setQrConnected] = useState(false)
  // 픽업 신청·소비기한 알림이 오면 주문 목록·임박 데이터를 바로 다시 읽는다 (11/14 경우 결정 R1·R6)
  useNotificationRefresh()
  // 왼쪽 메뉴 접기·펴기, 이 브라우저에 기억 (11/14 경우 결정 E1~E8)
  const { collapsed, toggle } = useOwnerSidebar()
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  const toggleLabel = collapsed ? '메뉴 펴기' : '메뉴 접기'
  const bell = <NotificationBell key="bell" align="start" />
  const toggleButton = (
    <button
      key="toggle"
      type="button"
      onClick={toggle}
      aria-label={toggleLabel}
      aria-expanded={!collapsed}
      aria-controls="owner-sidebar"
      title={toggleLabel}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
    >
      <ToggleIcon className="size-5" aria-hidden />
    </button>
  )

  return (
    <div className="flex min-h-dvh">
      <aside
        id="owner-sidebar"
        className={cn(
          // z-10: 접혔을 때 이름 말풍선이 오른쪽 본문 위에 보이게 한다(sticky 는 자기 층을 만든다)
          'sticky top-0 z-10 flex h-dvh shrink-0 flex-col self-start border-r border-slate-200 bg-white',
          collapsed ? 'w-16 items-center' : 'w-56',
        )}
      >
        {/* 펼침: 로고·점포명·QR 불 / 알림 종 / 접기 버튼(로고 줄 오른쪽 끝, E3).
            접힘: 위에서부터 펴기 버튼 → 알림 종 → QR 불, 점포명은 숨김(E7). 알림 종은 한 번만 그려 통로를 다시 열지 않는다 */}
        <div
          className={cn(
            'flex',
            collapsed ? 'flex-col items-center gap-1 pt-3 pb-4' : 'items-start py-4 pr-1 pl-4',
          )}
        >
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <img src="/logo.png" alt="freshLink" className="h-7 w-auto" />
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="min-w-0 truncate">{store.data?.name ?? ''}</span>
                {/* QR 알림 연결 불: 초록 = 연결됨, 회색 = 끊김 (A16, 11/13) */}
                <PickupStreamDot connected={qrConnected} />
              </p>
            </div>
          )}
          {/* 키를 단 배열이라 순서만 바뀌고 알림 종은 다시 만들지 않는다. 화면 순서와 Tab 순서가 같다 */}
          {collapsed ? [toggleButton, bell] : [bell, toggleButton]}
          {collapsed && <PickupStreamDot connected={qrConnected} />}
        </div>
        <nav
          aria-label="점주 메뉴"
          className={cn(
            'min-h-0 flex-1',
            // 접으면 말풍선이 메뉴 밖으로 나와야 해서 스크롤 상자를 두지 않는다(메뉴 9칸이라 넘치지 않는다)
            collapsed ? 'flex flex-col items-center gap-1' : 'space-y-4 overflow-y-auto px-3',
          )}
        >
          <MenuLink to="/owner" end label="홈" icon={House} collapsed={collapsed} />
          {MENU_GROUPS.map((group) =>
            collapsed ? (
              // 접으면 묶음 이름 대신 가는 선(E8)
              <Fragment key={group.label}>
                <hr className="my-2 w-8 border-slate-200" />
                {group.items.map((item) => (
                  <MenuLink key={item.to} {...item} collapsed />
                ))}
              </Fragment>
            ) : (
              <div key={group.label} className="space-y-1">
                <p className="px-3 text-xs text-slate-500">{group.label}</p>
                {group.items.map((item) => (
                  <MenuLink key={item.to} {...item} collapsed={false} />
                ))}
              </div>
            ),
          )}
        </nav>
        <div
          className={cn(
            'border-t border-slate-200',
            collapsed ? 'flex w-full flex-col items-center gap-1 py-3' : 'space-y-1 px-3 pt-3',
          )}
        >
          {/* end 없이: 비밀번호 변경(/owner/store/password) 화면에서도 "내 점포"가 켜져 있게 한다(A15) */}
          <MenuLink to="/owner/store" label="내 점포" icon={Store} collapsed={collapsed} />
          {/* 아이콘 없는 하위 메뉴는 접으면 숨긴다(E8) */}
          {!collapsed && (
            <ul aria-label="내 점포 메뉴" className="space-y-1 pl-7">
              {STORE_SUBMENU.filter(
                (s) =>
                  s.to !== '/owner/store' && (!s.passwordOnly || user?.passwordLogin !== false),
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
          )}
          {collapsed && <RailLogout onClick={() => void signOut()} />}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="mx-3 mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            <LogOut className="size-4" aria-hidden />
            로그아웃
          </button>
        )}
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
