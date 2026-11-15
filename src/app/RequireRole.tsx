import { Navigate, Outlet, useLocation } from 'react-router'
import { homePathFor, loginPathFor, useAuthStore, type Role } from '@/shared/auth'
import { FullScreenSpinner } from '@/shared/ui/FullScreenSpinner'

/**
 * 로그인하지 않았으면 그 역할의 로그인 화면(/login, /owner/login, /admin/login)으로, 역할이 다르면 자기 홈으로 보낸다.
 * 화면 단위 가드일 뿐이고, 진짜 권한 확인은 gateway 가 한다.
 */
export function RequireRole({ role }: { role: Role }) {
  const { user, restoring } = useAuthStore()
  const location = useLocation()

  if (restoring) return <FullScreenSpinner />
  if (!user)
    return (
      <Navigate
        to={loginPathFor(role)}
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    )
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}

/**
 * 로그인하지 않아도 보는 화면(고객 홈·점포·상품 둘러보기, 11/15 경우 결정).
 * 로그인했는데 역할이 다르면 자기 홈으로 보낸다
 */
export function AllowGuest({ role }: { role: Role }) {
  const { user, restoring } = useAuthStore()
  if (restoring) return <FullScreenSpinner />
  if (user && user.role !== role) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}

/** / 로 들어오면 로그인한 사람은 자기 홈, 로그인하지 않은 사람은 고객 홈으로 보낸다 */
export function RootRedirect() {
  const { user, restoring } = useAuthStore()
  if (restoring) return <FullScreenSpinner />
  return <Navigate to={user ? homePathFor(user.role) : homePathFor('CUSTOMER')} replace />
}
