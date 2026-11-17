import { LoaderCircle, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/ui/cn'
import { apiErrorMessage, useDeleteMemo, useMemos, type ProductMemo } from '../api'
import { formatDateTime } from '../format'
import { MEMO_MAX_LENGTH } from '../memo'
import { useMemoEditor } from '../useMemoEditor'
import { MemoConflictNotice } from './MemoConflictNotice'
import { SearchBox } from './tableParts'
import { matchesText } from '../stockFilter'

/**
 * 메모 탭. 메모가 있는 상품만 최근에 고친 순서로 포스트잇 카드로 보여 준다(11/14 경우 결정, 11/12 메모 보드).
 * 카드 바로 아래 [수정]을 누르면 카드 안에서 고치고, [삭제]를 누르면 카드 안에서 한 번 더 묻는다.
 * 재고 목록 행의 메모 버튼(MemoDialog)과 같은 규칙: 빈 내용으로 저장하면 삭제, 다른 화면이 먼저 바꾸면 409 안내.
 * 11/15 재고 목록 탭처럼 검색 칸(상품명·메모 내용)과 개수를 둔다. 순서는 서버가 준 최근에 고친 순
 */
export function MemoList() {
  const memos = useMemos()
  const [q, setQ] = useState('')
  // 지운 카드가 사라지면 초점이 갈 곳이 없어지므로 메모 구역으로 옮긴다(마지막 메모를 지워 빈 안내가 떠도 남는다)
  const areaRef = useRef<HTMLElement>(null)

  if (memos.isPending) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (memos.isError) {
    return (
      <p className="py-16 text-center text-sm text-red-600">
        {apiErrorMessage(memos.error, '메모를 불러오지 못했어요.')}
      </p>
    )
  }

  const shown = memos.data.filter(
    (memo) => matchesText(memo.name, q) || matchesText(memo.content, q),
  )

  return (
    <section ref={areaRef} tabIndex={-1} aria-label="메모" className="space-y-3 focus:outline-none">
      {memos.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} label="상품명·메모 검색" />
          <p className="text-sm text-slate-500 tabular-nums">메모 {shown.length}개</p>
        </div>
      )}
      {memos.data.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          아직 메모가 없어요. 재고 목록에서 상품의 메모 버튼을 눌러 남길 수 있어요.
        </p>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">검색한 내용이 든 메모가 없어요.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((memo) => (
            <li key={memo.productId}>
              <MemoCard memo={memo} onRemoved={() => areaRef.current?.focus()} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type Mode = 'view' | 'edit' | 'confirmDelete'

function MemoCard({ memo, onRemoved }: { memo: ProductMemo; onRemoved: () => void }) {
  const [mode, setMode] = useState<Mode>('view')
  const editButton = useRef<HTMLButtonElement>(null)
  const deleteButton = useRef<HTMLButtonElement>(null)
  // 고치기·삭제 묻기를 닫으면 누른 버튼으로 초점을 돌려준다
  const [returnFocus, setReturnFocus] = useState<'edit' | 'delete' | null>(null)

  useEffect(() => {
    if (mode !== 'view' || returnFocus === null) return
    const button = returnFocus === 'edit' ? editButton : deleteButton
    button.current?.focus()
  }, [mode, returnFocus])

  const close = (from: 'edit' | 'delete') => {
    setReturnFocus(from)
    setMode('view')
  }

  return (
    <article
      aria-label={mode === 'edit' ? `${memo.name} 메모 고치는 중` : `${memo.name} 메모`}
      className={cn(
        'flex h-full min-h-52 flex-col gap-2 rounded-md rounded-br-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm',
        mode === 'edit' && 'border-emerald-700 ring-2 ring-emerald-50',
      )}
    >
      <h3 className="flex flex-col text-sm font-bold text-slate-900">
        {memo.name}
        <span className="text-xs font-normal text-slate-500">{memo.category}</span>
        <span className="text-xs font-normal text-slate-500 tabular-nums">
          {formatDateTime(memo.updatedAt)} 저장
        </span>
      </h3>

      {mode === 'edit' ? (
        <MemoEditor memo={memo} onDone={() => close('edit')} onRemoved={onRemoved} />
      ) : (
        <>
          <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-900">
            {memo.content}
          </p>
          {mode === 'confirmDelete' ? (
            <DeleteConfirm memo={memo} onCancel={() => close('delete')} onRemoved={onRemoved} />
          ) : (
            <div className="flex justify-end gap-1 border-t border-dashed border-amber-100 pt-2">
              <button
                ref={editButton}
                type="button"
                onClick={() => setMode('edit')}
                aria-label={`${memo.name} 메모 수정`}
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-900 hover:bg-amber-100"
              >
                <Pencil className="size-4" aria-hidden />
                수정
              </button>
              <button
                ref={deleteButton}
                type="button"
                onClick={() => setMode('confirmDelete')}
                aria-label={`${memo.name} 메모 삭제`}
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="size-4" aria-hidden />
                삭제
              </button>
            </div>
          )}
        </>
      )}
    </article>
  )
}

/** 카드 안에서 고치기. 규칙은 메모 창(MemoDialog)과 같은 useMemoEditor */
function MemoEditor({
  memo,
  onDone,
  onRemoved,
}: {
  memo: ProductMemo
  onDone: () => void
  onRemoved: () => void
}) {
  const memos = useMemos()
  // 서버의 지금 메모. 409 뒤 다시 읽으면 다른 화면이 저장한 내용이 된다. 지워졌으면 null
  const latest = memos.data?.find((m) => m.productId === memo.productId) ?? null
  const { text, setText, conflict, busy, saving, submit } = useMemoEditor({
    productId: memo.productId,
    productName: memo.name,
    latest,
    onSaved: onDone,
    onDeleted: onRemoved,
  })
  const textId = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  return (
    <form
      className="flex flex-1 flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) onDone()
      }}
    >
      <label htmlFor={textId} className="sr-only">
        {memo.name} 메모
      </label>
      <textarea
        id={textId}
        ref={textRef}
        maxLength={MEMO_MAX_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-24 flex-1 resize-none rounded-lg border border-amber-100 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none"
      />
      <p className="text-right text-xs text-slate-500 tabular-nums">
        {text.length}/{MEMO_MAX_LENGTH}
      </p>
      {conflict && <MemoConflictNotice latest={latest} className="bg-white" />}
      <div className="flex justify-end gap-2 border-t border-dashed border-amber-100 pt-2">
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          저장
        </button>
      </div>
    </form>
  )
}

/** 카드 안에서 삭제를 한 번 더 묻는다(11/12 메모 보드) */
function DeleteConfirm({
  memo,
  onCancel,
  onRemoved,
}: {
  memo: ProductMemo
  onCancel: () => void
  onRemoved: () => void
}) {
  const remove = useDeleteMemo()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  const confirm = () =>
    remove.mutate(
      { productId: memo.productId, version: memo.version },
      {
        onSuccess: () => {
          toast.success(`${memo.name} 메모를 삭제했어요`)
          onRemoved()
        },
        onError: (e) => {
          toast.error(apiErrorMessage(e, '메모를 삭제하지 못했어요.'))
          onCancel()
        },
      },
    )

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg bg-rose-50 py-2 pr-2 pl-3 text-sm font-medium text-rose-700"
    >
      <span>이 메모를 삭제할까요?</span>
      <span className="flex justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={remove.isPending}
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={remove.isPending}
          aria-label={`${memo.name} 메모 삭제 확인`}
          className="min-h-11 rounded-lg bg-rose-700 px-4 text-white disabled:opacity-50"
        >
          삭제
        </button>
      </span>
    </div>
  )
}
