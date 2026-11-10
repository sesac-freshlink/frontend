import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import { FormField } from '../components/FormField'
import { describedBy, inputClass, primaryButtonClass } from '../components/fieldStyles'
import { type PasswordChangeForm, passwordChangeSchema } from '../signupSchema'
import { PasswordFieldError, usePasswordChange } from '../usePasswordChange'

interface Props {
  /** 취소하면 돌아갈 화면 (고객 /customer/my, 점주 /owner/store) */
  backTo: string
}

const FIELDS = [
  { name: 'currentPassword', label: '지금 비밀번호', autoComplete: 'current-password' },
  {
    name: 'newPassword',
    label: '새 비밀번호',
    autoComplete: 'new-password',
    hint: '8자 이상, 대문자·소문자·숫자·특수문자 포함',
  },
  { name: 'newPasswordConfirm', label: '새 비밀번호 확인', autoComplete: 'new-password' },
] as const

type FieldName = (typeof FIELDS)[number]['name']

/** A4 비밀번호 변경 (고객 /customer/my/password, 점주 /owner/store/password). 바꾸면 다시 로그인한다 */
export function PasswordChangePage({ backTo }: Props) {
  const { passwordLogin, submit } = usePasswordChange()
  const { register, handleSubmit, formState, setError, control, trigger, getValues } =
    useForm<PasswordChangeForm>({
      resolver: zodResolver(passwordChangeSchema),
      mode: 'onChange',
    })
  const [visible, setVisible] = useState<Partial<Record<FieldName, boolean>>>({})
  const currentPassword = useWatch({ control, name: 'currentPassword' })

  // 새 비밀번호를 먼저 쓰고 지금 비밀번호를 나중에 고쳐도 "같은 비밀번호" 안내가 맞게 뜨고 사라지게 한다
  useEffect(() => {
    if (getValues('newPassword')) void trigger('newPassword')
  }, [currentPassword, getValues, trigger])

  if (!passwordLogin) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold text-slate-900">비밀번호 변경</h1>
        <p className="text-sm text-slate-500">
          구글로 가입한 계정은 비밀번호가 없어요. 구글 계정에서 관리해 주세요.
        </p>
        <Link to={backTo} className="block text-center text-sm text-slate-500 underline">
          돌아가기
        </Link>
      </div>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await submit(values)
    } catch (e) {
      if (e instanceof PasswordFieldError) setError(e.field, { message: e.message })
      else toast.error(e instanceof Error ? e.message : '비밀번호를 바꾸지 못했어요.')
    }
  })

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4" noValidate>
      <h1 className="text-xl font-bold text-slate-900">비밀번호 변경</h1>
      {FIELDS.map((f) => {
        const id = `password-${f.name}`
        const error = formState.errors[f.name]?.message
        const shown = visible[f.name] === true
        return (
          <FormField
            key={f.name}
            id={id}
            label={f.label}
            error={error}
            hint={'hint' in f ? f.hint : undefined}
          >
            <div className="relative">
              <input
                id={id}
                type={shown ? 'text' : 'password'}
                autoComplete={f.autoComplete}
                aria-describedby={describedBy(id)}
                className={cn(inputClass, 'pr-10')}
                {...register(f.name)}
              />
              <button
                type="button"
                onClick={() => setVisible((v) => ({ ...v, [f.name]: !shown }))}
                aria-label={`${f.label} ${shown ? '숨기기' : '보기'}`}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
              >
                {shown ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </FormField>
        )
      })}
      <button
        type="submit"
        disabled={!formState.isValid || formState.isSubmitting}
        className={primaryButtonClass}
      >
        비밀번호 바꾸기
      </button>
      <Link to={backTo} className="block text-center text-sm text-slate-500 underline">
        취소
      </Link>
    </form>
  )
}
