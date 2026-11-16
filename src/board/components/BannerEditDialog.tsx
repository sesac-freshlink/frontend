import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import { type ChangeEvent, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import { apiErrorCode } from '@/shared/api/errors'
import { isStoreImageType, readAsDataUrl, STORE_IMAGE_TYPES } from '@/shared/storeImage'
import { cn } from '@/shared/ui/cn'
import { useAdminNotices } from '../api'
import { type AdminBanner, useSaveBanner, useUploadBannerImage } from '../banners'
import { type BannerForm, bannerDefaults, bannerSchema, toBannerRequest } from '../bannerForm'
import { BoardDialog } from './BoardDialog'
import { DialogButtons } from './DialogButtons'

interface Props {
  /** 고칠 배너. 없으면 새 배너 */
  banner?: AdminBanner
  /** 새 배너의 순서 (맨 뒤) */
  nextSortOrder: number
  onClose(): void
}

const SAVE_ERRORS: Record<string, string> = {
  NOTICE_NOT_FOUND: '연결할 공지가 없어요. 공지를 다시 골라 주세요',
  BANNER_PERIOD_INVALID: '노출 시작은 끝보다 빨라야 해요',
  BANNER_NOT_FOUND: '이미 지운 배너예요. 목록을 다시 확인해 주세요',
}

/**
 * 관리자 메인배너 등록·수정 창 (추가 명세 A18). 그림은 파일을 올린다(11/16, 점포 이미지 올리기와 같은 방식, AD-18).
 * 예전 예시 그림(/banners/…)으로 만든 배너도 그대로 보이고 고칠 수 있다
 */
export function BannerEditDialog({ banner, nextSortOrder, onClose }: Props) {
  const save = useSaveBanner()
  const upload = useUploadBannerImage()
  // 방금 올린 그림의 미리 보기(data:). S3에 올린 직후라 같은 주소로 바로 읽지 않는다
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  // 공지 고르기: 최근 공지 20개(고정 먼저). 지금 연결한 공지가 그 밖이면 따로 넣는다
  const notices = useAdminNotices(0)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState, control, setValue } = useForm<
    BannerForm,
    unknown,
    z.output<typeof bannerSchema>
  >({
    resolver: zodResolver(bannerSchema),
    defaultValues: bannerDefaults(banner),
  })
  const { errors, isSubmitting } = formState
  const imageUrl = useWatch({ control, name: 'imageUrl' })
  const title = useWatch({ control, name: 'title' })
  const noticeOptions = notices.data?.content ?? []
  const linkedMissing =
    banner?.noticeId != null && !noticeOptions.some((n) => n.noticeId === banner.noticeId)

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageError(null)
    const contentType = file.type
    if (!isStoreImageType(contentType)) {
      setImageError('JPG나 PNG 그림만 올릴 수 있어요')
      return
    }
    try {
      const issued = await upload.mutateAsync({ file, contentType })
      setPreviewUrl(await readAsDataUrl(file))
      setValue('imageUrl', issued.imageUrl, { shouldValidate: true, shouldDirty: true })
    } catch {
      setImageError('그림을 올리지 못했어요. 다시 시도해 주세요')
    }
  }
  const shown = previewUrl ?? (imageUrl || null)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await save.mutateAsync({
        bannerId: banner?.bannerId ?? null,
        body: toBannerRequest(values, banner?.sortOrder ?? nextSortOrder),
      })
      toast.success(banner ? '배너를 수정했어요' : '배너를 올렸어요')
      onClose()
    } catch (e) {
      setFormError(
        SAVE_ERRORS[apiErrorCode(e) ?? ''] ?? '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요',
      )
    }
  })

  return (
    <BoardDialog title={banner ? '배너 수정' : '배너 올리기'} busy={isSubmitting} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          id="banner-title"
          label="제목"
          error={errors.title?.message}
          hint="50자까지. 그림 위에 쓰지 않고, 화면 읽기 프로그램과 이 목록에서만 보여요"
        >
          <input
            id="banner-title"
            autoFocus
            aria-describedby={describedBy('banner-title')}
            {...register('title')}
            className={inputClass}
          />
        </FormField>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">그림</p>
          <label
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 has-focus-visible:ring-2 has-focus-visible:ring-emerald-600',
              upload.isPending && 'pointer-events-none opacity-50',
            )}
          >
            {upload.isPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            {shown ? '다른 그림 올리기' : '그림 올리기'}
            <input
              type="file"
              accept={STORE_IMAGE_TYPES.join(',')}
              onChange={(e) => void onPickImage(e)}
              disabled={upload.isPending}
              aria-describedby="banner-image-hint"
              className="sr-only"
            />
          </label>
          <p id="banner-image-hint" className="text-xs text-slate-500">
            JPG·PNG를 올릴 수 있어요. 가로 2:1(1200×600)이 홈 배너 칸에 꼭 맞아요. 저장을 눌러야
            반영돼요
          </p>
          {(imageError ?? errors.imageUrl?.message) && (
            <p role="alert" className="text-xs text-red-600">
              {imageError ?? errors.imageUrl?.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900">미리보기 (홈 배너 칸, 가로 2:1)</p>
          {shown ? (
            <img
              src={shown}
              alt={title ? `미리보기: ${title}` : '미리보기'}
              className="aspect-2/1 w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="flex aspect-2/1 w-full items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-600">
              그림을 올리면 여기에 보여요
            </div>
          )}
        </div>

        <FormField
          id="banner-notice"
          label="누르면 열 공지 (선택)"
          error={errors.noticeId?.message}
          hint="고르지 않으면 배너를 눌러도 아무 일이 없어요"
        >
          <select
            id="banner-notice"
            aria-describedby={describedBy('banner-notice')}
            {...register('noticeId')}
            className={inputClass}
          >
            <option value="">연결 안 함</option>
            {linkedMissing && banner && (
              <option value={String(banner.noticeId)}>
                {banner.noticeTitle ?? '지금 연결한 공지'}
              </option>
            )}
            {noticeOptions.map((n) => (
              <option key={n.noticeId} value={String(n.noticeId)}>
                {n.title}
              </option>
            ))}
          </select>
        </FormField>

        <label className="flex items-center gap-2 text-sm text-slate-900">
          <input type="checkbox" {...register('visible')} className="size-4 accent-emerald-600" />
          홈에 보이기
        </label>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="banner-starts"
            label="노출 시작 (선택)"
            error={errors.startsAt?.message}
            hint="비우면 바로"
          >
            <input
              id="banner-starts"
              type="datetime-local"
              aria-describedby={describedBy('banner-starts')}
              {...register('startsAt')}
              className={inputClass}
            />
          </FormField>
          <FormField
            id="banner-ends"
            label="노출 끝 (선택)"
            error={errors.endsAt?.message}
            hint="비우면 계속"
          >
            <input
              id="banner-ends"
              type="datetime-local"
              aria-describedby={describedBy('banner-ends')}
              {...register('endsAt')}
              className={inputClass}
            />
          </FormField>
        </div>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <DialogButtons busy={isSubmitting} onCancel={onClose} />
      </form>
    </BoardDialog>
  )
}
