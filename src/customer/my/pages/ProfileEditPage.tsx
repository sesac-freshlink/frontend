import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useMyProfile } from '@/auth/api'
import { FormField } from '@/auth/components/FormField'
import { ProfileFields } from '@/auth/components/ProfileFields'
import { inputClass, primaryButtonClass } from '@/auth/components/fieldStyles'
import { type ProfileForm, type ProfileValues, profileSchema } from '@/auth/signupSchema'
import { FieldError } from '@/auth/useSignupFlow'
import { useAuthStore } from '@/shared/auth'
import { type EditableProfile, hasChanges, profileChanges } from '../profileChanges'
import { useProfileEdit } from '../useProfileEdit'

/** /customer/my/profile 회원정보 수정 (MB-04, 추가 명세 A3). 지금 값으로 미리 채운다 */
export function ProfileEditPage() {
  const profile = useMyProfile()

  if (profile.isPending) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="size-4 animate-spin" />내 정보를 불러오는 중이에요
      </p>
    )
  }
  if (profile.isError) {
    return (
      <p role="alert" className="text-sm text-rose-700">
        내 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
      </p>
    )
  }
  if (profile.data?.role !== 'CUSTOMER') {
    return <p className="text-sm text-slate-500">등록된 회원정보가 없어요.</p>
  }
  const { name, nickname, region } = profile.data
  // 저장 뒤 MB-03 을 다시 읽어 값이 바뀌면 폼을 새 값으로 다시 만든다
  return (
    <ProfileEditForm key={`${name}|${nickname}|${region}`} current={{ name, nickname, region }} />
  )
}

function ProfileEditForm({ current }: { current: EditableProfile }) {
  const email = useAuthStore((s) => s.user?.email)
  const { save } = useProfileEdit()
  const { register, handleSubmit, formState, setError, control } = useForm<
    ProfileForm,
    unknown,
    ProfileValues
  >({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: current,
  })

  const values = useWatch({ control })
  const changed = hasChanges(
    profileChanges(current, {
      name: values.name ?? '',
      nickname: values.nickname ?? '',
      region: values.region ?? '',
    }),
  )

  const submit = handleSubmit(async (v) => {
    try {
      await save(current, v)
    } catch (e) {
      if (e instanceof FieldError) setError('nickname', { message: e.message })
      else toast.error(e instanceof Error ? e.message : '회원정보를 저장하지 못했어요.')
    }
  })

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="text-xl font-bold text-slate-900">회원정보 수정</h1>
      <FormField id="profile-email" label="이메일" hint="이메일은 바꿀 수 없어요">
        <input id="profile-email" value={email ?? ''} readOnly disabled className={inputClass} />
      </FormField>
      <ProfileFields register={register} errors={formState.errors} />
      <button
        type="submit"
        disabled={!changed || !formState.isValid || formState.isSubmitting}
        className={primaryButtonClass}
      >
        저장
      </button>
      <Link
        to="/customer/my"
        className="flex min-h-11 items-center justify-center text-sm text-slate-500 underline"
      >
        취소
      </Link>
    </form>
  )
}
