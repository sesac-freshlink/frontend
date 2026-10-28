import { Navigate, Outlet, useLocation } from 'react-router'
import { homePathFor, useAuthStore, type Role } from '@/shared/auth'
import { FullScreenSpinner } from '@/shared/ui/FullScreenSpinner'

/**
 * 로그인하지 않았으면 /login 으로, 역할이 다르면 자기 홈으로 보낸다.
 * 화면 단위 가드일 뿐이고, 진짜 권한 확인은 gateway 가 한다.
 */
export function RequireRole({ role }: { role: Role }) {
  const { user, restoring } = useAuthStore()
  const location = useLocation()

  if (restoring) return <FullScreenSpinner />
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    )
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}

/** / 로 들어오면 로그인 상태에 따라 보낸다 */
export function RootRedirect() {
  const { user, restoring } = useAuthStore()
  if (restoring) return <FullScreenSpinner />
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}
