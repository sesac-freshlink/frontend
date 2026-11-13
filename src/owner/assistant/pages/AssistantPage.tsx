import { Bot, LoaderCircle, SendHorizontal } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  ASSISTANT_PRESETS,
  MAX_QUESTION_LENGTH,
  assistantErrorMessage,
  useAskAssistant,
  type AskAssistantRequest,
} from '../api'
import { cn } from '@/shared/ui/cn'

/** 화면에 쌓아 보여 주는 질문과 답 한 쌍. 서버는 앞 질문을 기억하지 않는다 */
interface Exchange {
  id: number
  question: string
  answer?: string
  /** "AI가 만든 답이에요 · 14:05 기준" 같은 한 줄 */
  note?: string
  error?: string
}

function noteOf(source: 'AI' | 'RULE', generatedAt: string): string {
  const time = generatedAt.slice(11, 16)
  return source === 'AI'
    ? `AI가 만든 답이에요 · ${time} 기준`
    : `기본 규칙으로 만든 답이에요 · ${time} 기준`
}

/**
 * AI 점주 비서 화면. 자주 묻는 질문 5개 버튼과 직접 입력(200자). 비서는 답만 하고 아무것도 바꾸지 않는다.
 * 질문은 위에서 아래로 쌓아 보여 주지만 서버는 매번 새로 묻는다
 */
export function AssistantPage() {
  const ask = useAskAssistant()
  const [question, setQuestion] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  /** 질문과 답을 짝짓는 화면 안 일련번호 */
  const nextId = useRef(0)

  function send(body: AskAssistantRequest, text: string) {
    nextId.current += 1
    const id = nextId.current
    setExchanges((prev) => [...prev, { id, question: text }])
    ask.mutate(body, {
      onSuccess: (data) =>
        setExchanges((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, answer: data.answer, note: noteOf(data.source, data.generatedAt) }
              : e,
          ),
        ),
      onError: (error) =>
        setExchanges((prev) =>
          prev.map((e) => (e.id === id ? { ...e, error: assistantErrorMessage(error) } : e)),
        ),
    })
  }

  const trimmed = question.trim()
  const canSend = !ask.isPending && trimmed.length > 0 && question.length <= MAX_QUESTION_LENGTH

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-center gap-2">
        <Bot className="size-6 text-emerald-700" aria-hidden />
        <h1 className="text-xl font-semibold text-slate-900">AI 비서</h1>
      </header>
      <p className="text-sm text-slate-500">
        우리 점포 재고·판매·유통기한 숫자를 보고 답해요. 답만 하고 재고를 바꾸지는 않아요.
      </p>

      <section aria-label="자주 묻는 질문" className="flex flex-wrap gap-2">
        {ASSISTANT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={ask.isPending}
            onClick={() => send({ presetId: p.id }, p.label)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </section>

      <ol aria-label="질문과 답" className="flex flex-col gap-3">
        {exchanges.map((e) => (
          <li key={e.id} className="flex flex-col gap-2">
            <p className="self-end rounded-lg bg-emerald-50 px-3 py-2 text-sm text-slate-900">
              {e.question}
            </p>
            {e.answer !== undefined && (
              <div className="self-start rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm whitespace-pre-line text-slate-900">{e.answer}</p>
                <p className="mt-1 text-xs text-slate-500">{e.note}</p>
              </div>
            )}
            {e.error !== undefined && (
              <p role="alert" className="self-start text-sm text-red-600">
                {e.error}
              </p>
            )}
            {e.answer === undefined && e.error === undefined && (
              <p className="flex items-center gap-1.5 self-start text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                생각 중…
              </p>
            )}
          </li>
        ))}
      </ol>

      <form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSend) return
          send({ question: trimmed }, trimmed)
          setQuestion('')
        }}
      >
        <div className="flex gap-2">
          <label htmlFor="assistant-question" className="sr-only">
            AI 비서에게 질문
          </label>
          <input
            id="assistant-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder="예: 내일 아침에 뭐부터 챙겨야 해?"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="보내기"
            className={cn(
              'flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white',
              'disabled:opacity-50',
            )}
          >
            <SendHorizontal className="size-4" aria-hidden />
            보내기
          </button>
        </div>
        <p className="flex justify-between text-xs text-slate-500">
          <span>고객 이름·연락처는 쓰지 마세요.</span>
          <span className="tabular-nums">
            {question.length}/{MAX_QUESTION_LENGTH}
          </span>
        </p>
      </form>
    </div>
  )
}
