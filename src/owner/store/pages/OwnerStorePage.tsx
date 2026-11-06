import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import { REGIONS } from '@/auth/regions'
import { cn } from '@/shared/ui/cn'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import { STORE_IMAGE_TYPES } from '@/shared/storeImage'
import { type OwnerStore, useOwnerStore } from '../api'
import { DESCRIPTION_MAX, OWNER_STORE_TEXT, ownerStoreErrorMessage } from '../ownerStoreForm'
import { useOwnerStoreEdit } from '../useOwnerStoreEdit'

const schema = z.object({
  description: z.string().max(DESCRIPTION_MAX, OWNER_STORE_TEXT.descriptionTooLong),
})
type DescriptionForm = z.infer<typeof schema>

function regionName(code: string): string {
  return REGIONS.find((r) => r.code === code)?.name ?? code
}

function coordinates(store: OwnerStore): string {
  return store.latitude === null || store.longitude === null
    ? '-'
    : `${store.latitude}, ${store.longitude}`
}

/** /owner/store 점주 내 점포 수정 (추가 명세 A15, OW-01·02·03). 설명·사진만 바꾸고 나머지는 보기만 한다 */
export function OwnerStorePage() {
  const store = useOwnerStore()

  if (store.isPending) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="size-4 animate-spin" />내 점포 정보를 불러오는 중이에요
      </p>
    )
  }
  if (store.isError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {ownerStoreErrorMessage(store.error, OWNER_STORE_TEXT.loadFailed)}
      </p>
    )
  }
  // 저장 뒤 OW-01 을 다시 읽어 값이 바뀌면 폼을 새 값으로 다시 만든다
  const { data } = store
  return <OwnerStoreForm key={`${data.description ?? ''}|${data.imageUrl ?? ''}`} store={data} />
}

const readOnlyRows = (store: OwnerStore) => [
  { id: 'owner-store-name', label: '점포명', value: store.name },
  { id: 'owner-store-address', label: '주소', value: store.address },
  { id: 'owner-store-region', label: '시도', value: regionName(store.region) },
  { id: 'owner-store-coords', label: '지도 좌표', value: coordinates(store) },
]

function OwnerStoreForm({ store }: { store: OwnerStore }) {
  const edit = useOwnerStoreEdit(store)
  const { register, handleSubmit, control, formState } = useForm<DescriptionForm>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { description: store.description ?? '' },
  })
  const description = useWatch({ control, name: 'description' }) ?? ''
  const changed = edit.isChanged(description)

  const submit = handleSubmit((v) => edit.save(v.description))

  return (
    <form onSubmit={submit} className="max-w-xl space-y-6" noValidate>
      <h1 className="text-xl font-bold text-slate-900">점포 수정</h1>

      <section aria-labelledby="owner-store-fixed" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="owner-store-fixed" className="text-sm font-medium text-slate-500">
            점포 기본 정보
          </h2>
          <p className="text-xs text-slate-400">{OWNER_STORE_TEXT.adminOnly}</p>
        </div>
        {readOnlyRows(store).map((row) => (
          <FormField key={row.id} id={row.id} label={row.label}>
            <input
              id={row.id}
              value={row.value}
              readOnly
              disabled
              className={cn(inputClass, 'bg-slate-100 text-slate-500')}
            />
          </FormField>
        ))}
      </section>

      <FormField
        id="owner-store-description"
        label="점포 설명"
        error={formState.errors.description?.message}
        hint={`${DESCRIPTION_MAX}자까지`}
      >
        <textarea
          id="owner-store-description"
          rows={4}
          aria-describedby={describedBy('owner-store-description')}
          {...register('description')}
          className={inputClass}
        />
      </FormField>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-900">점포 사진</p>
        <div className="flex items-center gap-3">
          <ProductThumb
            src={edit.image?.previewUrl ?? store.imageUrl}
            name={`${store.name} 점포`}
            className="size-20"
          />
          <label
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100',
              edit.saving && 'pointer-events-none opacity-50',
            )}
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            {edit.image ? '다른 사진 고르기' : '사진 고르기'}
            <input
              type="file"
              accept={STORE_IMAGE_TYPES.join(',')}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) edit.pickImage(file)
                e.target.value = ''
              }}
              disabled={edit.saving}
              className="sr-only"
            />
          </label>
        </div>
        <p className="text-xs text-slate-400">
          JPG·PNG, 5MB까지 올릴 수 있어요. 저장을 눌러야 점포에 반영돼요
        </p>
        {edit.imageError && (
          <p role="alert" className="text-sm text-red-600">
            {edit.imageError}
          </p>
        )}
      </div>

      {edit.saveError && (
        <p role="alert" className="text-sm text-red-600">
          {edit.saveError}
        </p>
      )}
      <button
        type="submit"
        disabled={!changed || formState.errors.description !== undefined || edit.saving}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {edit.saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        저장
      </button>
    </form>
  )
}
