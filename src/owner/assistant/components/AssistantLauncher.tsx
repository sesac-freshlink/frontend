import { Bot, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { AssistantChat } from './AssistantChat'
import { cn } from '@/shared/ui/cn'

/**
 * 점주 화면 오른쪽 아래 AI 비서 버튼과 대화창. 화면을 옮기지 않고 보던 화면 위에 띄운다.
 * 닫아도 대화창을 지우지 않고 숨겨서, 다른 메뉴로 옮기거나 다시 열어도 앞 질문과 답이 남는다
 */
export function AssistantLauncher() {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <>
      <div
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
        className="fixed right-6 bottom-24 z-40 flex h-128 w-96 flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Bot className="size-4 text-emerald-700" aria-hidden />
            AI 비서
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="대화창 닫기"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <AssistantChat inputRef={inputRef} />
      </div>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'AI 비서 닫기' : 'AI 비서 열기'}
        className={cn(
          'fixed right-6 bottom-6 z-40 flex size-14 items-center justify-center rounded-full shadow-lg',
          open ? 'bg-slate-700 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700',
        )}
      >
        {open ? <X className="size-6" aria-hidden /> : <Bot className="size-6" aria-hidden />}
      </button>
    </>
  )
}
