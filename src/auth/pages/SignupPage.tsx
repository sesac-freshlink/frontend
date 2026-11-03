import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router'
import { toast } from 'sonner'
import { homePathFor, useAuthStore } from '@/shared/auth'
import { FullScreenSpinner } from '@/shared/ui/FullScreenSpinner'
import { useCheckNickname, useMyProfile } from '../api'
import { describedBy, inputClass, primaryButtonClass } from '../components/fieldStyles'
import { FormField } from '../components/FormField'
import { ProfileFields } from '../components/ProfileFields'
import {
  codeSchema,
  profileSchema,
  signupSchema,
  type CodeForm,
  type ProfileForm,
  type ProfileValues,
  type SignupForm,
  type SignupValues,
} from '../signupSchema'
import { FieldError, NICKNAME_TAKEN, useSignupFlow } from '../useSignupFlow'

/** C-01 고객 회원가입 (기능명세 M1). 입력 → 이메일 인증 코드 → 프로필 등록 */
export function SignupPage() {
  const restoring = useAuthStore((s) => s.restoring)
  // 새로고침 직후 세션 확인이 끝나야 로그인한 고객인지 알고 시작 단계를 고를 수 있다
  if (restoring) return <FullScreenSpinner />
  return <SignupSteps />
}

function SignupSteps() {
  const user = useAuthStore((s) => s.user)
  const flow = useSignupFlow()

  // 고객 가입 화면이라 점주·관리자는 자기 홈으로 보낸다
  if (user && user.role !== 'CUSTOMER') return <Navigate to={homePathFor(user.role)} replace />

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-emerald-600">FreshLink 회원가입</h1>
      {flow.step === 'form' && <SignupFormStep onSubmit={flow.submitForm} />}
      {flow.step === 'code' && <CodeStep email={flow.email} onSubmit={flow.submitCode} />}
      {flow.step === 'profile' && flow.autoSaving && (
        <p role="status" className="text-center text-sm text-slate-500">
          프로필을 저장하고 있어요…
        </p>
      )}
      {flow.step === 'profile' && !flow.autoSaving && (
        <ProfileStep
          defaults={flow.profileDefaults}
          onSubmit={flow.submitProfile}
          onBack={flow.leaveProfile}
        />
      )}
      {flow.step !== 'profile' && (
        <Link to="/login" className="text-center text-sm text-slate-500 underline">
          로그인으로
        </Link>
      )}
    </div>
  )
}

function SignupFormStep({ onSubmit }: { onSubmit(values: SignupValues): Promise<void> }) {
  const { register, handleSubmit, formState, setError, getValues, trigger } = useForm<
    SignupForm,
    unknown,
    SignupValues
  >({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      name: '',
      nickname: '',
    },
  })
  const checkNickname = useCheckNickname()

  const onCheckNickname = async () => {
    if (!(await trigger('nickname'))) return
    try {
      const { available } = await checkNickname.mutateAsync(getValues('nickname'))
      if (available) toast.success('사용할 수 있는 닉네임이에요')
      else setError('nickname', { message: NICKNAME_TAKEN })
    } catch {
      toast.error('닉네임을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    }
  }

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (e) {
      if (e instanceof FieldError && e.field === 'nickname')
        setError('nickname', { message: e.message })
      else toast.error(e instanceof Error ? e.message : '가입에 실패했어요.')
    }
  })

  const { errors } = formState
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormField
        id="signup-email"
        label="이메일"
        error={errors.email?.message}
        hint="인증 코드를 받을 수 있는 주소"
      >
        <input
          id="signup-email"
          type="email"
          aria-describedby={describedBy('signup-email')}
          {...register('email')}
          autoComplete="email"
          className={inputClass}
        />
      </FormField>
      <FormField
        id="signup-password"
        label="비밀번호"
        error={errors.password?.message}
        hint="8자 이상, 대문자·소문자·숫자·특수문자 포함"
      >
        <input
          id="signup-password"
          type="password"
          aria-describedby={describedBy('signup-password')}
          {...register('password')}
          autoComplete="new-password"
          className={inputClass}
        />
      </FormField>
      <FormField
        id="signup-password-confirm"
        label="비밀번호 확인"
        error={errors.passwordConfirm?.message}
      >
        <input
          id="signup-password-confirm"
          aria-describedby={describedBy('signup-password-confirm')}
          type="password"
          {...register('passwordConfirm')}
          autoComplete="new-password"
          className={inputClass}
        />
      </FormField>
      <ProfileFields
        register={register}
        errors={errors}
        onCheckNickname={() => void onCheckNickname()}
        checkingNickname={checkNickname.isPending}
      />
      <button type="submit" disabled={formState.isSubmitting} className={primaryButtonClass}>
        가입하기
      </button>
    </form>
  )
}

function CodeStep({
  email,
  onSubmit,
}: {
  email: string | undefined
  onSubmit(code: string): Promise<void>
}) {
  const { register, handleSubmit, formState, setError } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  })

  const submit = handleSubmit(async ({ code }) => {
    try {
      await onSubmit(code)
    } catch (e) {
      if (e instanceof FieldError) setError('code', { message: e.message })
      else toast.error(e instanceof Error ? e.message : '인증에 실패했어요.')
    }
  })

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-900">{email}</span> 로 보낸 인증 코드 6자리를
        입력하세요.
      </p>
      <FormField id="signup-code" label="인증 코드" error={formState.errors.code?.message}>
        <input
          id="signup-code"
          aria-describedby={describedBy('signup-code')}
          {...register('code')}
          inputMode="numeric"
          autoComplete="one-time-code"
          className={inputClass}
        />
      </FormField>
      <button type="submit" disabled={formState.isSubmitting} className={primaryButtonClass}>
        인증하기
      </button>
    </form>
  )
}

function ProfileStep({
  defaults,
  onSubmit,
  onBack,
}: {
  defaults: ProfileValues | undefined
  onSubmit(values: ProfileValues): Promise<void>
  onBack(): Promise<void>
}) {
  const user = useAuthStore((s) => s.user)
  const profile = useMyProfile()
  const { register, handleSubmit, formState, setError } = useForm<
    ProfileForm,
    unknown,
    ProfileValues
  >({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults ?? { name: '', nickname: '' },
  })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (e) {
      if (e instanceof FieldError) setError('nickname', { message: e.message })
      else toast.error(e instanceof Error ? e.message : '프로필 저장에 실패했어요.')
    }
  })

  // 로그인이 풀렸으면 로그인부터, 이미 프로필이 있으면 고객 홈으로
  if (!user) return <Navigate to="/login" replace />
  if (profile.isPending) return <FullScreenSpinner />
  if (profile.data) return <Navigate to="/customer" replace />

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600">마지막으로 프로필을 등록하면 가입이 끝나요.</p>
      <ProfileFields register={register} errors={formState.errors} />
      <button type="submit" disabled={formState.isSubmitting} className={primaryButtonClass}>
        프로필 등록
      </button>
      <button
        type="button"
        onClick={() => void onBack()}
        disabled={formState.isSubmitting}
        className="w-full text-center text-sm text-slate-500 underline"
      >
        뒤로가기
      </button>
    </form>
  )
}
