import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { isMockApi } from '@/shared/api/mockMode'
import { homePathFor, useAuthStore, type Role } from '@/shared/auth'
import { useLoadMyProfile } from '../api'
import { isUnconfirmedSignIn, loginNoticeMessage, signInErrorMessage } from '../authErrors'
import { goToGoogleLogin, MOCK_GOOGLE_EMAIL } from '../googleLogin'
import type { SignupLocationState } from '../useSignupFlow'

const schema = z.object({
  email: z.email('이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
})
type Form = z.infer<typeof schema>

/** 로그인 전에 보던 화면이 이 영역 안이면 그리로 돌려보낸다 */
const AREA: Record<Role, string> = { OWNER: '/owner', CUSTOMER: '/customer', ADMIN: '/admin' }

/** C-02 로그인 (기능명세 M2, 이메일·구글). 프로필이 없는 고객은 프로필 등록 마무리 화면으로 보낸다 */
export function LoginPage() {
  const { user, signIn, loginNotice } = useAuthStore()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from
  const [searchParams] = useSearchParams()
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) })
  const loadMyProfile = useLoadMyProfile()
  const [googlePending, setGooglePending] = useState(false)
  const notice = loginNoticeMessage(searchParams.get('error'), loginNotice)

  // 이 화면에서 로그인했으면 갈 곳(원래 보던 화면, 프로필 등록)은 아래 onSubmit 이 정한다.
  // 이미 로그인한 채로 이 화면에 들어왔을 때만 바로 홈으로 보낸다
  const submitted = formState.isSubmitting || formState.isSubmitSuccessful
  if (user && !submitted) return <Navigate to={homePathFor(user.role)} replace />

  const onSubmit = handleSubmit(async ({ email, password }) => {
    let signedIn
    try {
      signedIn = await signIn(email, password)
    } catch (e) {
      if (isUnconfirmedSignIn(e)) {
        // 가입만 하고 이메일 인증을 안 했으면 인증 코드 입력부터 이어서 한다
        const state: SignupLocationState = { step: 'code', email }
        navigate('/signup', { state })
        return
      }
      toast.error(signInErrorMessage(e))
      return
    }
    // MB-03 이 404 면 프로필 등록 마무리 화면으로. 조회 자체가 실패하면 고객 홈이 다시 확인한다
    if (signedIn.role === 'CUSTOMER') {
      const profile = await loadMyProfile(signedIn.userId).catch(() => undefined)
      if (profile === null) {
        navigate('/signup', { replace: true })
        return
      }
    }
    // 로그인 전에 보던 화면이 자기 영역(/owner, /customer, /admin)이면 그리로 돌려보낸다
    const area = AREA[signedIn.role]
    navigate(from?.startsWith(area) ? from : homePathFor(signedIn.role), { replace: true })
  })

  // 실서버는 gateway 로 전체 페이지 이동. 가짜 모드는 이동을 가로챌 수 없어 가짜 구글 고객으로 바로 들어간다
  async function onGoogle() {
    if (!isMockApi) {
      goToGoogleLogin()
      return
    }
    setGooglePending(true)
    try {
      await signIn(MOCK_GOOGLE_EMAIL, 'mock')
      navigate('/', { replace: true })
    } catch (e) {
      toast.error(signInErrorMessage(e))
    } finally {
      setGooglePending(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-emerald-600">FreshLink 로그인</h1>
      {notice && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
        >
          {notice}
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">이메일</span>
          <input
            type="email"
            {...register('email')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <span className="text-xs text-red-600">{formState.errors.email?.message}</span>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">비밀번호</span>
          <input
            type="password"
            {...register('password')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <span className="text-xs text-red-600">{formState.errors.password?.message}</span>
        </label>
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white disabled:opacity-50"
        >
          로그인
        </button>
      </form>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        또는
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <button
        type="button"
        onClick={() => void onGoogle()}
        disabled={formState.isSubmitting || googlePending}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 font-medium text-slate-900 disabled:opacity-50"
      >
        구글로 로그인
      </button>
      {isMockApi && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          개발용 가짜 로그인: admin 으로 시작하는 이메일은 관리자, owner 로 시작하는 이메일은 점주,
          나머지는 고객으로 들어갑니다. 구글로 로그인은 프로필 없는 가짜 구글 고객, dup 으로
          시작하는 이메일은 이메일 가입자 막기 확인용입니다.
        </p>
      )}
      <Link to="/signup" className="text-center text-sm text-slate-500 underline">
        회원가입
      </Link>
    </div>
  )
}
