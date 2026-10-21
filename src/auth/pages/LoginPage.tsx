import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { homePathFor, isMockAuth, useAuthStore } from '@/shared/auth'
import { useLoadMyProfile } from '../api'
import { isUnconfirmedSignIn, signInErrorMessage } from '../authErrors'
import type { SignupLocationState } from '../useSignupFlow'

const schema = z.object({
  email: z.email('이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
})
type Form = z.infer<typeof schema>

/** C-02 로그인 (기능명세 M2). 프로필이 없는 고객은 프로필 등록 마무리 화면으로 보낸다 */
export function LoginPage() {
  const { user, signIn } = useAuthStore()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) })
  const loadMyProfile = useLoadMyProfile()

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
    // 로그인 전에 보던 화면이 자기 영역(/owner, /customer)이면 그리로 돌려보낸다
    const area = signedIn.role === 'OWNER' ? '/owner' : '/customer'
    navigate(from?.startsWith(area) ? from : homePathFor(signedIn.role), { replace: true })
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-emerald-600">FreshLink 로그인</h1>
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
      {isMockAuth && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          개발용 가짜 로그인: owner 로 시작하는 이메일은 점주, 나머지는 고객으로 들어갑니다.
        </p>
      )}
      <Link to="/signup" className="text-center text-sm text-slate-500 underline">
        회원가입
      </Link>
    </div>
  )
}
