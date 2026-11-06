import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/shared/ui/cn'
import type { TermsDocument } from '../terms'

interface Props {
  /** 보여 줄 약관. 여러 개면 차례로 보여 준다 (마이페이지 "이용약관") */
  documents: TermsDocument[]
  onClose(): void
}

/**
 * 약관 전문 보기 창 (추가 명세 A16). 네이티브 모달이라 포커스 가두기·Escape 닫기는 브라우저가 맡는다.
 * 뒤 화면은 그대로라 가입 폼에 넣은 값은 닫아도 남는다
 */
export function TermsDialog({ documents, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = `terms-dialog-${documents.map((d) => d.id).join('-')}`

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // 브라우저가 맨 아래 [닫기]에 포커스를 두며 내려가므로, 글은 맨 위부터 보이게 되돌린다
    dialog.scrollTop = 0
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={(e) => {
        if (!e.currentTarget.open) onClose()
      }}
      className={cn(
        'm-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-lg',
        'backdrop:bg-slate-900/40',
      )}
    >
      <div className="space-y-6">
        {documents.map((doc, i) => (
          <article key={doc.id} className="space-y-3">
            <h2 id={i === 0 ? titleId : undefined} className="text-lg font-bold text-slate-900">
              {doc.title}
            </h2>
            {doc.sections.map((s) => (
              <section key={s.heading} className="space-y-1">
                <h3 className="text-sm font-medium text-slate-900">{s.heading}</h3>
                {s.lines.map((line) => (
                  <p key={line} className="text-sm text-slate-600">
                    {line}
                  </p>
                ))}
              </section>
            ))}
            <p className="text-xs text-slate-400">시행일: {doc.effectiveDate}</p>
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={() => dialogRef.current?.close()}
        className="mt-6 w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-100"
      >
        닫기
      </button>
    </dialog>
  )
}
