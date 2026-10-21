import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/shared/auth'
import { apiErrorCode, useCheckNickname, useRegisterProfile } from './api'
import { signInErrorMessage, signUpErrorMessage } from './authErrors'
import type { ProfileValues, SignupValues } from './signupSchema'

export type SignupStep = 'form' | 'code' | 'profile'

/** 입력 칸 하나에 붙일 오류. 화면이 react-hook-form setError 로 보여 준다 */
export class FieldError extends Error {
  readonly field: 'nickname' | 'code'

  constructor(field: 'nickname' | 'code', message: string) {
    super(message)
    this.field = field
  }
}

/** 로그인 화면이 "인증 전 계정"이라며 이 화면으로 보낼 때 넘기는 state */
export interface SignupLocationState {
  step: 'code'
  email: string
}

function isSignupLocationState(v: unknown): v is SignupLocationState {
  return (
    typeof v === 'object' &&
    v !== null &&
    'step' in v &&
    v.step === 'code' &&
    'email' in v &&
    typeof v.email === 'string'
  )
}

export const NICKNAME_TAKEN = '이미 사용 중인 닉네임이에요'

export interface UseSignupFlowReturn {
  step: SignupStep
  email: string | undefined
  /** 프로필 등록 단계에 미리 채울 값 (가입 화면에서 입력한 값) */
  profileDefaults: ProfileValues | undefined
  submitForm(values: SignupValues): Promise<void>
  submitCode(code: string): Promise<void>
  submitProfile(values: ProfileValues): Promise<void>
}

/**
 * C-01 가입 흐름 (기능명세 M1): 입력 → Cognito 가입 → 이메일 코드 확인 → 로그인 → MB-02 프로필 등록 → 고객 홈.
 * 로그인했는데 프로필이 없는 고객은 프로필 등록 단계부터 한다.
 * 비밀번호는 로그인에만 쓰고 화면 메모리에만 둔다 (member-service 로 보내지 않는다).
 */
export function useSignupFlow(): UseSignupFlowReturn {
  const { user, signUp, confirmSignUp, signIn } = useAuthStore()
  const navigate = useNavigate()
  const locationState: unknown = useLocation().state
  const checkNickname = useCheckNickname()
  const registerProfile = useRegisterProfile()

  const [step, setStep] = useState<SignupStep>(() => {
    if (user?.role === 'CUSTOMER') return 'profile'
    return isSignupLocationState(locationState) ? 'code' : 'form'
  })
  const [email, setEmail] = useState<string | undefined>(() =>
    isSignupLocationState(locationState) ? locationState.email : undefined,
  )
  const [password, setPassword] = useState<string>()
  const [profileDefaults, setProfileDefaults] = useState<ProfileValues>()

  async function saveProfile(values: ProfileValues) {
    try {
      await registerProfile.mutateAsync(values)
    } catch (e) {
      if (apiErrorCode(e) === 'NICKNAME_DUPLICATED')
        throw new FieldError('nickname', NICKNAME_TAKEN)
      throw new Error('프로필 저장에 실패했어요. 다시 시도해 주세요.', { cause: e })
    }
    navigate('/customer', { replace: true })
  }

  return {
    step,
    email,
    profileDefaults,

    async submitForm(values) {
      const availability = await checkNickname.mutateAsync(values.nickname).catch((e: unknown) => {
        throw new Error('닉네임을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.', { cause: e })
      })
      if (!availability.available) throw new FieldError('nickname', NICKNAME_TAKEN)
      try {
        await signUp({
          email: values.email,
          password: values.password,
          name: values.name,
          role: 'CUSTOMER',
        })
      } catch (e) {
        throw new Error(signUpErrorMessage(e), { cause: e })
      }
      setEmail(values.email)
      setPassword(values.password)
      setProfileDefaults({ name: values.name, nickname: values.nickname, region: values.region })
      setStep('code')
    },

    async submitCode(code) {
      if (!email) throw new Error('가입 정보를 다시 입력해 주세요.')
      try {
        await confirmSignUp(email, code, 'CUSTOMER')
      } catch (e) {
        const message = signUpErrorMessage(e)
        if (e instanceof Error && e.name === 'CodeMismatchException') {
          throw new FieldError('code', message)
        }
        throw new Error(message, { cause: e })
      }
      // 로그인 화면에서 넘어와 비밀번호를 모르면 로그인부터 다시 한다. 프로필은 로그인 뒤에 등록한다
      if (!password) {
        toast.success('이메일 인증이 끝났어요. 로그인해 주세요.')
        navigate('/login', { replace: true })
        return
      }
      try {
        await signIn(email, password)
      } catch (e) {
        throw new Error(signInErrorMessage(e), { cause: e })
      }
      setStep('profile')
      if (!profileDefaults) return
      try {
        await saveProfile(profileDefaults)
      } catch (e) {
        // 인증·로그인은 끝났으니 프로필 저장만 다시 하게 한다 (M1 실패·재시도)
        if (e instanceof FieldError) toast.error(e.message)
        else toast.error('프로필 저장에 실패했어요. 다시 시도해 주세요.')
      }
    },

    submitProfile: saveProfile,
  }
}
