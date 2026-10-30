import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import {
  type ChangeEvent,
  type SyntheticEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import { REGIONS } from '@/auth/regions'
import { cn } from '@/shared/ui/cn'
import { ProductThumb } from '@/shared/ui/ProductThumb'
import { type AdminStore, STORE_IMAGE_TYPE, useUpdateAdminStore, useUploadStoreImage } from '../api'
import {
  buildStorePatch,
  type StoreEditForm,
  type StoreEditValues,
  storeDetailEditSchema,
  storeEditDefaults,
} from '../storeForm'
import { STORE_STATUS_LABEL, STORE_TEXT, storeErrorMessage } from '../storeText'

interface StoreEditModalProps {
  store: AdminStore
  onClose(): void
}

/** 새로 올린 이미지: 저장할 키와 미리보기 주소(브라우저 안 임시 주소) */
interface UploadedImage {
  imageKey: string
  previewUrl: string
}

/**
 * A-02 점포 정보 수정 모달 (member-service AD-03). 이름·주소·시도와 점포 상세(지도 좌표·설명·이미지)를 바꾼다.
 * 이미지는 고르면 바로 S3 에 올리고(업로드 주소 발급 → PUT), 저장을 눌러야 점포에 연결된다
 */
export function StoreEditModal({ store, onClose }: StoreEditModalProps) {
  const update = useUpdateAdminStore()
  const upload = useUploadStoreImage()
  const [formError, setFormError] = useState<string | null>(null)
  const [image, setImage] = useState<UploadedImage | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { register, handleSubmit, control, formState, setFocus } = useForm<
    StoreEditForm,
    unknown,
    StoreEditValues
  >({
    resolver: zodResolver(storeDetailEditSchema),
    defaultValues: storeEditDefaults(store),
  })
  const { errors, isSubmitting } = formState

  const watched = useWatch({ control })
  const unchanged =
    Object.keys(
      buildStorePatch(
        store,
        {
          name: watched.name ?? store.name,
          address: watched.address ?? store.address,
          region: watched.region ?? store.region,
          latitude: watched.latitude,
          longitude: watched.longitude,
          description: watched.description,
        },
        image?.imageKey,
      ),
    ).length === 0

  // 미리보기 임시 주소는 바뀌거나 모달을 닫을 때 지운다
  useEffect(() => {
    if (!image) return
    return () => URL.revokeObjectURL(image.previewUrl)
  }, [image])

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageError(null)
    if (file.type !== STORE_IMAGE_TYPE) {
      setImageError('JPG 이미지만 올릴 수 있어요')
      return
    }
    try {
      const issued = await upload.mutateAsync({ storeId: store.storeId, file })
      setImage({ imageKey: issued.imageKey, previewUrl: URL.createObjectURL(file) })
    } catch {
      setImageError('이미지를 올리지 못했어요. 다시 시도해 주세요')
    }
  }

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
      await update.mutateAsync({
        storeId: store.storeId,
        body: buildStorePatch(store, values, image?.imageKey),
      })
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
        'm-auto max-h-screen w-full max-w-md space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-lg',
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
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="edit-store-lat"
            label="위도"
            error={errors.latitude?.message}
            hint="예: 37.498095"
          >
            <input
              id="edit-store-lat"
              inputMode="decimal"
              aria-describedby={describedBy('edit-store-lat')}
              {...register('latitude')}
              className={inputClass}
            />
          </FormField>
          <FormField
            id="edit-store-lng"
            label="경도"
            error={errors.longitude?.message}
            hint="예: 127.027610"
          >
            <input
              id="edit-store-lng"
              inputMode="decimal"
              aria-describedby={describedBy('edit-store-lng')}
              {...register('longitude')}
              className={inputClass}
            />
          </FormField>
        </div>
        <FormField
          id="edit-store-description"
          label="점포 설명"
          error={errors.description?.message}
          hint="500자까지"
        >
          <textarea
            id="edit-store-description"
            rows={3}
            aria-describedby={describedBy('edit-store-description')}
            {...register('description')}
            className={inputClass}
          />
        </FormField>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">점포 이미지</p>
          <div className="flex items-center gap-3">
            <ProductThumb
              src={image?.previewUrl ?? store.imageUrl}
              name={`${store.name} 점포`}
              className="size-16"
            />
            <label
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100',
                upload.isPending && 'pointer-events-none opacity-50',
              )}
            >
              {upload.isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="size-4" aria-hidden="true" />
              )}
              {image ? '다른 이미지 고르기' : '이미지 올리기'}
              <input
                type="file"
                accept={STORE_IMAGE_TYPE}
                onChange={(e) => void onPickImage(e)}
                disabled={upload.isPending}
                className="sr-only"
              />
            </label>
          </div>
          <p className="text-xs text-slate-400">
            JPG만 올릴 수 있어요. 저장을 눌러야 점포에 반영돼요
          </p>
          {imageError && (
            <p role="alert" className="text-sm text-red-600">
              {imageError}
            </p>
          )}
        </div>
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
            disabled={unchanged || isSubmitting || upload.isPending}
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
