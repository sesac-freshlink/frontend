import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { FormField } from '@/auth/components/FormField'
import { describedBy, inputClass } from '@/auth/components/fieldStyles'
import type { FaqItem } from '../api'
import { useSaveFaq } from '../api'
import { type FaqForm, faqDefaults, faqSchema, toFaqRequest } from '../boardForm'
import { AudienceSelect } from './AudienceSelect'
import { BoardDialog } from './BoardDialog'
import { DialogButtons } from './DialogButtons'

interface Props {
  /** 고칠 질문. 없으면 새 질문 */
  faq?: FaqItem
  onClose(): void
}

/** 관리자 FAQ 쓰기·수정 창 (추가 명세 A17) */
export function FaqEditDialog({ faq, onClose }: Props) {
  const save = useSaveFaq()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<
    FaqForm,
    unknown,
    z.output<typeof faqSchema>
  >({
    resolver: zodResolver(faqSchema),
    defaultValues: faqDefaults(faq),
  })
  const { errors, isSubmitting } = formState

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await save.mutateAsync({ faqId: faq?.faqId ?? null, body: toFaqRequest(values) })
      toast.success(faq ? '질문을 수정했어요' : '질문을 올렸어요')
      onClose()
    } catch {
      setFormError('저장하지 못했어요. 잠시 뒤 다시 시도해 주세요')
    }
  })

  return (
    <BoardDialog title={faq ? '질문 수정' : '질문 쓰기'} busy={isSubmitting} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id="faq-question" label="질문" error={errors.question?.message} hint="200자까지">
          <input
            id="faq-question"
            autoFocus
            aria-describedby={describedBy('faq-question')}
            {...register('question')}
            className={inputClass}
          />
        </FormField>
        <FormField id="faq-answer" label="답" error={errors.answer?.message} hint="2000자까지">
          <textarea
            id="faq-answer"
            rows={6}
            aria-describedby={describedBy('faq-answer')}
            {...register('answer')}
            className={inputClass}
          />
        </FormField>
        <AudienceSelect
          id="faq-audience"
          error={errors.audience?.message}
          field={register('audience')}
        />
        <FormField
          id="faq-sort"
          label="순서"
          error={errors.sortOrder?.message}
          hint="작은 숫자가 위에 나와요 (0~9999)"
        >
          <input
            id="faq-sort"
            inputMode="numeric"
            aria-describedby={describedBy('faq-sort')}
            {...register('sortOrder')}
            className={inputClass}
          />
        </FormField>
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
