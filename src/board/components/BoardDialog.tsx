import { type ReactNode, type SyntheticEvent, useLayoutEffect, useRef } from 'react'
import { cn } from '@/shared/ui/cn'

interface Props {
  title: string
  /** 저장 중에는 Escape 로 닫지 않는다 */
  busy: boolean
  onClose(): void
  children: ReactNode
}

/**
 * 관리자 공지·FAQ 쓰기 창 (점포 수정 창과 같은 네이티브 모달).
 * 포커스 가두기·Escape·닫을 때 포커스 복귀는 브라우저가 맡는다
 */
export function BoardDialog({ title, busy, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    if (busy) e.preventDefault()
  }

  // 브라우저가 닫은 경우(Escape 등)만 부모에 알린다. 다시 열려 있으면(StrictMode 재마운트) 무시
  const onDialogClose = (e: SyntheticEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget
    if (dialog.open) return
    if (busy) dialog.showModal()
    else onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="board-dialog-title"
      onCancel={onCancel}
      onClose={onDialogClose}
      className={cn(
        'm-auto max-h-screen w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-lg',
        'backdrop:bg-slate-900/40',
      )}
    >
      <h2 id="board-dialog-title" className="text-lg font-bold text-slate-900">
        {title}
      </h2>
      {children}
    </dialog>
  )
}
