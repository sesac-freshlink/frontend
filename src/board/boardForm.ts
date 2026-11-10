import { z } from 'zod'
import type { Audience, FaqItem, FaqRequest, NoticeDetail, NoticeRequest } from './api'

/** 관리자 공지·FAQ 입력 규칙 (member-service NoticeRequest·FaqRequest 와 같다) */
const audience = z.enum(['ALL', 'CUSTOMER', 'OWNER'], { error: '볼 사람을 고르세요' })

export const noticeSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력하세요').max(100, '100자까지 쓸 수 있어요'),
  content: z.string().trim().min(1, '본문을 입력하세요').max(5000, '5000자까지 쓸 수 있어요'),
  audience,
  pinned: z.boolean(),
})
export type NoticeForm = z.input<typeof noticeSchema>

export const faqSchema = z.object({
  question: z.string().trim().min(1, '질문을 입력하세요').max(200, '200자까지 쓸 수 있어요'),
  answer: z.string().trim().min(1, '답을 입력하세요').max(2000, '2000자까지 쓸 수 있어요'),
  audience,
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, '0~9999로 입력하세요'),
})
export type FaqForm = z.input<typeof faqSchema>

export function noticeDefaults(n?: NoticeDetail): NoticeForm {
  return n
    ? { title: n.title, content: n.content, audience: n.audience, pinned: n.pinned }
    : { title: '', content: '', audience: 'ALL', pinned: false }
}

export function faqDefaults(f?: FaqItem): FaqForm {
  return f
    ? {
        question: f.question,
        answer: f.answer,
        audience: f.audience,
        sortOrder: String(f.sortOrder),
      }
    : { question: '', answer: '', audience: 'ALL', sortOrder: '0' }
}

export function toNoticeRequest(v: z.output<typeof noticeSchema>): NoticeRequest {
  return { title: v.title, content: v.content, audience: v.audience as Audience, pinned: v.pinned }
}

export function toFaqRequest(v: z.output<typeof faqSchema>): FaqRequest {
  return {
    question: v.question,
    answer: v.answer,
    audience: v.audience as Audience,
    sortOrder: Number(v.sortOrder),
  }
}
