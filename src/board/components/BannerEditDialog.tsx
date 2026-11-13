import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import { apiErrorCode } from '@/shared/api/errors'
import { cn } from '@/shared/ui/cn'
import { useAdminNotices } from '../api'
import { type AdminBanner, BANNER_IMAGES, useSaveBanner } from '../banners'
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

/** 관리자 메인배너 등록·수정 창 (추가 명세 A18). 그림은 지금 frontend 가 가진 4장 중에서 고른다 */
export function BannerEditDialog({ banner, nextSortOrder, onClose }: Props) {
  const save = useSaveBanner()
  // 공지 고르기: 최근 공지 20개(고정 먼저). 지금 연결한 공지가 그 밖이면 따로 넣는다
  const notices = useAdminNotices(0)
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState, control } = useForm<
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

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-900">그림</legend>
          <div className="grid grid-cols-2 gap-2">
            {BANNER_IMAGES.map((img) => (
              <label
                key={img.url}
                className={cn(
                  'cursor-pointer rounded-lg border-2 border-transparent p-1 has-checked:border-emerald-600',
                  'has-focus-visible:ring-2 has-focus-visible:ring-emerald-600',
                )}
              >
                <input type="radio" value={img.url} {...register('imageUrl')} className="sr-only" />
                <img src={img.url} alt="" className="aspect-2/1 w-full rounded object-cover" />
                <span className="mt-1 block text-center text-xs text-slate-600">{img.label}</span>
              </label>
            ))}
          </div>
          {errors.imageUrl && <p className="text-xs text-red-600">{errors.imageUrl.message}</p>}
        </fieldset>

        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900">미리보기 (홈 배너 칸, 가로 2:1)</p>
          <img
            src={imageUrl}
            alt={title ? `미리보기: ${title}` : '미리보기'}
            className="aspect-2/1 w-full rounded-2xl object-cover"
          />
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
