import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import type { NoticeDetail } from '../api'
import { useSaveNotice } from '../api'
import { type NoticeForm, noticeDefaults, noticeSchema, toNoticeRequest } from '../boardForm'
import { AudienceSelect } from './AudienceSelect'
import { BoardDialog } from './BoardDialog'
import { DialogButtons } from './DialogButtons'

interface Props {
  /** 고칠 공지. 없으면 새 글 */
  notice?: NoticeDetail
  onClose(): void
}

/** 관리자 공지 쓰기·수정 창 (추가 명세 A17) */
export function NoticeEditDialog({ notice, onClose }: Props) {
  const save = useSaveNotice()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<
    NoticeForm,
    unknown,
    z.output<typeof noticeSchema>
  >({
    resolver: zodResolver(noticeSchema),
    defaultValues: noticeDefaults(notice),
  })
  const { errors, isSubmitting } = formState

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await save.mutateAsync({ noticeId: notice?.noticeId ?? null, body: toNoticeRequest(values) })
      toast.success(notice ? '공지를 수정했어요' : '공지를 올렸어요')
      onClose()
    } catch {
      setFormError('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요')
    }
  })

  return (
    <BoardDialog title={notice ? '공지 수정' : '공지 쓰기'} busy={isSubmitting} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id="notice-title" label="제목" error={errors.title?.message} hint="100자까지">
          <input
            id="notice-title"
            autoFocus
            aria-describedby={describedBy('notice-title')}
            {...register('title')}
            className={inputClass}
          />
        </FormField>
        <FormField
          id="notice-content"
          label="본문"
          error={errors.content?.message}
          hint="5000자까지"
        >
          <textarea
            id="notice-content"
            rows={8}
            aria-describedby={describedBy('notice-content')}
            {...register('content')}
            className={inputClass}
          />
        </FormField>
        <AudienceSelect
          id="notice-audience"
          error={errors.audience?.message}
          field={register('audience')}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" {...register('pinned')} className="size-4 accent-emerald-600" />맨
          위에 고정
        </label>
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
