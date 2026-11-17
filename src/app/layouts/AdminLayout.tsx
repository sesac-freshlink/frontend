import { CircleHelp, GalleryHorizontal, House, LogOut, Megaphone, Plus, Store } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useAuthStore } from '@/shared/auth'
import { cn } from '@/shared/ui/cn'

// 점포 목록은 end 가 있어야 /admin/stores/new 에서 두 메뉴가 함께 켜지지 않는다
// 메뉴 묶음(11/10 결정): 점포 / 게시판(공지사항·자주 묻는 질문·메인배너)
const MENU_GROUPS = [
  {
    label: '점포',
    items: [
      { to: '/admin/stores', label: '점포 목록', icon: Store, end: true },
      { to: '/admin/stores/new', label: '점포 등록', icon: Plus, end: false },
    ],
  },
  {
    label: '게시판',
    items: [
      { to: '/admin/notices', label: '공지사항', icon: Megaphone, end: false },
      { to: '/admin/faqs', label: '자주 묻는 질문', icon: CircleHelp, end: false },
      { to: '/admin/banners', label: '메인배너', icon: GalleryHorizontal, end: false },
    ],
  },
]

function menuLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100',
    isActive && 'bg-emerald-50 text-emerald-700',
  )
}

/** 관리자 화면: PC 브라우저용 왼쪽 사이드 메뉴 */
export function AdminLayout() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col self-start border-r border-slate-200 bg-white">
        <div className="px-5 py-4">
          <img src="/logo.png" alt="freshLink" className="h-7 w-auto" />
          <p className="mt-1 text-xs text-slate-500">관리자</p>
          {user?.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
        </div>
        <nav aria-label="관리자 메뉴" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3">
          {/* 홈(11/13): 점주 메뉴처럼 맨 위. end 가 있어야 다른 메뉴에서 같이 켜지지 않는다 */}
          <NavLink to="/admin" end className={menuLinkClass}>
            <House className="size-4" aria-hidden />홈
          </NavLink>
          {MENU_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-xs text-slate-500">{group.label}</p>
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={menuLinkClass}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => void signOut()}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
        >
          <LogOut className="size-4" aria-hidden />
          로그아웃
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
