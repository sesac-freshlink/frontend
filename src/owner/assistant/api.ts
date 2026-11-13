import { useMutation } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { apiErrorCode } from '@/shared/api/errors'

/**
 * AI 점주 비서 (.github docs/기능이해/AI-점주-비서.md). inventory-service POST /owner/inventory/assistant/ask.
 * 서버가 점포 요약과 질문을 Bedrock Claude에 보내 답한다. 질문 하나에 답 하나이고 앞 질문을 기억하지 않는다.
 */

/** 자주 묻는 질문 5개. 버튼 글자는 서버 AssistantPreset 문구와 같다 */
export const ASSISTANT_PRESETS = [
  { id: 'Q1', label: '오늘까지 유통기한이 끝나는 상품 알려줘' },
  { id: 'Q2', label: '이번 달 매출 기준으로 더 발주해야 할 상품 알려줘' },
  { id: 'Q3', label: '재고가 부족하거나 곧 떨어질 상품 알려줘' },
  { id: 'Q4', label: '시간대별로 잘 팔리는 상품 알려줘' },
  { id: 'Q5', label: '폐기가 많아서 덜 주문해야 할 상품 알려줘' },
] as const

export type AssistantPresetId = (typeof ASSISTANT_PRESETS)[number]['id']

/** 직접 입력 최대 길이 (서버 AskRequest.MAX_QUESTION_LENGTH) */
export const MAX_QUESTION_LENGTH = 200

/** 요청: 버튼 번호와 직접 입력 중 하나만 */
export type AskAssistantRequest = { presetId: AssistantPresetId } | { question: string }

/** 응답. source = AI(Claude 답) 또는 RULE(AI를 부를 수 없어 서버 규칙으로 만든 답) */
export interface AssistantAnswer {
  answer: string
  source: 'AI' | 'RULE'
  /** +09:00 시각 */
  generatedAt: string
}

/** 질문 보내기. 답은 몇 초 걸린다(서버는 늦어도 25초 안에 답한다) */
export function useAskAssistant() {
  return useMutation({
    mutationFn: async (body: AskAssistantRequest) =>
      (await api.post<AssistantAnswer>('/owner/inventory/assistant/ask', body)).data,
  })
}

/** 오류 응답을 화면 문구로. 모르는 오류는 일반 문구 */
export function assistantErrorMessage(e: unknown): string {
  switch (apiErrorCode(e)) {
    case 'ASSISTANT_DISABLED':
      return '지금은 AI 비서를 쓸 수 없어요.'
    case 'ASSISTANT_BUSY':
      return '잠시 뒤 다시 물어봐 주세요.'
    case 'ASSISTANT_RATE_LIMITED':
      return '오늘 질문 횟수를 다 썼어요.'
    case 'VALIDATION_ERROR':
      return `질문은 ${MAX_QUESTION_LENGTH}자까지 쓸 수 있어요.`
    default:
      return '답을 받지 못했어요. 잠시 뒤 다시 물어봐 주세요.'
  }
}
