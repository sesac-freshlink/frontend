import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass, primaryButtonClass } from '@/auth/components/fieldStyles'
import { REGIONS } from '@/auth/regions'
import { cn } from '@/shared/ui/cn'
import { useCreateAdminStore } from '../api'
import { type StoreRegisterForm, type StoreRegisterValues, storeRegisterSchema } from '../storeForm'
import { STORE_TEXT, storeErrorMessage } from '../storeText'

/** A-01 점포·점주 등록 (member-service AD-01). 점주 초기 비밀번호는 요청 본문에만 싣고 어디에도 남기지 않는다 */
export function StoreRegisterPage() {
  const createStore = useCreateAdminStore()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, reset, resetField, formState } = useForm<
    StoreRegisterForm,
    unknown,
    StoreRegisterValues
  >({
    resolver: zodResolver(storeRegisterSchema),
    // 시도는 기본값 없이 직접 고르게 한다
    defaultValues: { name: '', address: '', ownerEmail: '', initialPassword: '' },
  })
  const { errors, isSubmitting } = formState

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await createStore.mutateAsync(values)
      toast.success(STORE_TEXT.created)
      reset()
    } catch (e) {
      setFormError(storeErrorMessage(e, STORE_TEXT.createFailed))
      // 실패하면 비밀번호 칸만 비운다 (나머지 칸은 고쳐서 다시 보낼 수 있게 둔다)
      resetField('initialPassword')
    } finally {
      // 요청 값(비밀번호 포함)을 mutation 상태에서 지운다
      createStore.reset()
    }
  })

  return (
    <section className="max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">점포 등록</h1>
        <Link to="/admin/stores" className="text-sm text-slate-500 underline">
          목록으로
        </Link>
      </div>
      <form
        onSubmit={onSubmit}
        noValidate
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <FormField id="store-name" label="점포명" error={errors.name?.message} hint="2~30자">
          <input
            id="store-name"
            aria-describedby={describedBy('store-name')}
            {...register('name')}
            className={inputClass}
          />
        </FormField>
        <FormField id="store-address" label="주소" error={errors.address?.message}>
          <input
            id="store-address"
            aria-describedby={describedBy('store-address')}
            {...register('address')}
            className={inputClass}
          />
        </FormField>
        <FormField id="store-region" label="시도" error={errors.region?.message}>
          <select
            id="store-region"
            aria-describedby={describedBy('store-region')}
            {...register('region')}
            className={inputClass}
          >
            <option value="">시도 선택</option>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="store-owner-email" label="점주 이메일" error={errors.ownerEmail?.message}>
          <input
            id="store-owner-email"
            type="email"
            aria-describedby={describedBy('store-owner-email')}
            {...register('ownerEmail')}
            autoComplete="off"
            className={inputClass}
          />
        </FormField>
        <FormField
          id="store-initial-password"
          label="초기 비밀번호"
          error={errors.initialPassword?.message}
          hint="8자 이상, 대문자·소문자·숫자·특수문자 포함"
        >
          <input
            id="store-initial-password"
            type="password"
            aria-describedby={describedBy('store-initial-password')}
            {...register('initialPassword')}
            autoComplete="new-password"
            className={inputClass}
          />
        </FormField>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={cn(primaryButtonClass, 'flex items-center justify-center gap-2')}
        >
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          등록하기
        </button>
      </form>
    </section>
  )
}
