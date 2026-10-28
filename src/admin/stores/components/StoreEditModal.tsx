import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { type SyntheticEvent, useLayoutEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import { REGIONS } from '@/auth/regions'
import { cn } from '@/shared/ui/cn'
import { type AdminStore, useUpdateAdminStore } from '../api'
import {
  buildStorePatch,
  type StoreEditForm,
  type StoreEditValues,
  storeEditSchema,
} from '../storeForm'
import { STORE_STATUS_LABEL, STORE_TEXT, storeErrorMessage } from '../storeText'

interface StoreEditModalProps {
  store: AdminStore
  onClose(): void
}

/** A-02 점포 정보 수정 모달 (member-service AD-03). 이름·주소·시도만 바꿀 수 있다 */
export function StoreEditModal({ store, onClose }: StoreEditModalProps) {
  const update = useUpdateAdminStore()
  const [formError, setFormError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { register, handleSubmit, control, formState, setFocus } = useForm<
    StoreEditForm,
    unknown,
    StoreEditValues
  >({
    resolver: zodResolver(storeEditSchema),
    defaultValues: { name: store.name, address: store.address, region: store.region },
  })
  const { errors, isSubmitting } = formState

  const watched = useWatch({ control })
  const unchanged =
    Object.keys(
      buildStorePatch(store, {
        name: watched.name ?? store.name,
        address: watched.address ?? store.address,
        region: watched.region ?? store.region,
      }),
    ).length === 0

  // 네이티브 모달로 연다. 포커스 가두기·Escape·닫을 때 [수정] 버튼으로 포커스 복귀는 브라우저가 맡는다.
  // 언마운트(부모가 닫음) 때 close() 를 불러야 포커스가 돌아간다. 레이아웃 정리 단계라 DOM 제거 전에 실행된다
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    setFocus('name')
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [setFocus])

  // Escape(cancel). 저장 중에는 막는다
  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    if (isSubmitting) e.preventDefault()
  }

  // 브라우저가 닫은 경우(Escape 등)만 부모에 알린다. 다시 열려 있으면(StrictMode 재마운트) 무시.
  // 저장 중에 cancel 없이 닫히면(Chrome close watcher 는 Escape 를 두 번 누르면 cancel 없이 닫는다)
  // 다시 열어, 저장이 실패했을 때 오류 문구가 모달에 남게 한다
  const onDialogClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget
    if (dialog.open) return
    if (isSubmitting) dialog.showModal()
    else onClose()
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await update.mutateAsync({ storeId: store.storeId, body: buildStorePatch(store, values) })
      toast.success(STORE_TEXT.updated)
      onClose()
    } catch (e) {
      setFormError(storeErrorMessage(e, STORE_TEXT.updateFailed))
    }
  })

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="store-edit-title"
      onCancel={onCancel}
      onClose={onDialogClose}
      className={cn(
        'm-auto w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-lg',
        'backdrop:bg-slate-900/40',
      )}
    >
      <h2 id="store-edit-title" className="text-lg font-bold text-slate-900">
        점포 정보 수정
      </h2>
      <dl className="grid grid-cols-3 gap-y-1 text-sm">
        <dt className="text-slate-500">점포 코드</dt>
        <dd className="col-span-2 text-slate-900">{store.storeCode}</dd>
        <dt className="text-slate-500">점주 이메일</dt>
        <dd className="col-span-2 text-slate-900">{store.ownerEmail ?? '-'}</dd>
        <dt className="text-slate-500">상태</dt>
        <dd className="col-span-2 text-slate-900">{STORE_STATUS_LABEL[store.status]}</dd>
      </dl>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id="edit-store-name" label="점포명" error={errors.name?.message} hint="2~30자">
          <input
            id="edit-store-name"
            aria-describedby={describedBy('edit-store-name')}
            {...register('name')}
            className={inputClass}
          />
        </FormField>
        <FormField id="edit-store-address" label="주소" error={errors.address?.message}>
          <input
            id="edit-store-address"
            aria-describedby={describedBy('edit-store-address')}
            {...register('address')}
            className={inputClass}
          />
        </FormField>
        <FormField id="edit-store-region" label="시도" error={errors.region?.message}>
          <select
            id="edit-store-region"
            aria-describedby={describedBy('edit-store-region')}
            {...register('region')}
            className={inputClass}
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </FormField>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={unchanged || isSubmitting}
            aria-busy={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            저장
          </button>
        </div>
      </form>
    </dialog>
  )
}
