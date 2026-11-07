import { describe, expect, it } from 'vitest'
import { faqDefaults, faqSchema, noticeSchema, toFaqRequest } from './boardForm'

describe('게시판 입력 규칙 (A17)', () => {
  it('공지 제목·본문은 비우면 안 되고 제목은 100자까지', () => {
    const base = { title: '제목', content: '본문', audience: 'ALL', pinned: false }
    expect(noticeSchema.safeParse(base).success).toBe(true)
    expect(noticeSchema.safeParse({ ...base, title: '  ' }).success).toBe(false)
    expect(noticeSchema.safeParse({ ...base, title: 'a'.repeat(101) }).success).toBe(false)
    expect(noticeSchema.safeParse({ ...base, content: '' }).success).toBe(false)
  })

  it('FAQ 순서는 0~9999 숫자만, 보낼 때 숫자로 바꾼다', () => {
    const form = { ...faqDefaults(), question: '질문', answer: '답' }
    expect(form.sortOrder).toBe('0')
    expect(faqSchema.safeParse({ ...form, sortOrder: '10000' }).success).toBe(false)
    expect(faqSchema.safeParse({ ...form, sortOrder: '-1' }).success).toBe(false)
    expect(faqSchema.safeParse({ ...form, sortOrder: '1.5' }).success).toBe(false)

    const parsed = faqSchema.parse({ ...form, sortOrder: ' 12 ' })
    expect(toFaqRequest(parsed)).toEqual({
      question: '질문',
      answer: '답',
      audience: 'ALL',
      sortOrder: 12,
    })
  })
})
