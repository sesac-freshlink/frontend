import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  apiErrorCode,
  apiErrorMessage,
  useDeleteMemo,
  useMemos,
  useSaveMemo,
  type ProductMemo,
} from '../api'
import { formatDateTime } from '../format'
import { MEMO_MAX_LENGTH, memoAction } from '../memo'

interface Props {
  productId: number
  productName: string
  onClose(): void
}

/**
 * 점주 상품 메모 모달. 상품 하나에 메모 하나이고 자유롭게 고친다. 처음 저장할 때 만들어진다.
 * 읽은 뒤 다른 화면(포스기·휴대폰)이 먼저 바꿨으면 서버가 409 MEMO_CHANGED 를 준다. 그때 쓰던 내용은 그대로 두고
 * 다른 화면이 저장한 내용을 아래에 보여 준다. 그걸 본 뒤 다시 저장하면 그 내용 위에 덮어쓴다
 */
export function MemoDialog({ productId, productName, onClose }: Props) {
  const memos = useMemos()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      {memos.isPending ? (
        <div className="rounded-lg bg-white p-6 text-slate-400 shadow-lg">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      ) : memos.isError ? (
        <div role="alertdialog" className="space-y-4 rounded-lg bg-white p-6 shadow-lg">
          <p className="text-sm text-red-600">
            {apiErrorMessage(memos.error, '메모를 불러오지 못했어요.')}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            닫기
          </button>
        </div>
      ) : (
        <MemoForm
          productId={productId}
          productName={productName}
          latest={memos.data.find((memo) => memo.productId === productId) ?? null}
          onClose={onClose}
        />
      )}
    </div>
  )
}

interface FormProps extends Props {
  /** 서버의 지금 메모. 저장·삭제 뒤 다시 읽으면 바뀐다. 없으면 null */
  latest: ProductMemo | null
}

function MemoForm({ productId, productName, latest, onClose }: FormProps) {
  const save = useSaveMemo()
  const remove = useDeleteMemo()
  // 처음 연 순간의 메모. 이 version 으로 저장해야 그 사이 다른 화면이 바꾼 것을 서버가 알아챈다
  const [opened] = useState(latest)
  const [text, setText] = useState(latest?.content ?? '')
  const [conflict, setConflict] = useState(false)
  const textId = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const busy = save.isPending || remove.isPending

  // 충돌을 본 뒤에는 다른 화면이 저장한 최신 메모 위에 저장한다(덮어쓰기를 점주가 고른 것)
  const target = conflict ? latest : opened

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  const onError = (error: unknown, fallback: string) => {
    if (apiErrorCode(error) === 'MEMO_CHANGED') setConflict(true)
    toast.error(apiErrorMessage(error, fallback))
  }

  const deleteMemo = (memo: ProductMemo) =>
    remove.mutate(
      { productId, version: memo.version },
      {
        onSuccess: () => {
          toast.success(`${productName} 메모를 지웠어요`)
          onClose()
        },
        onError: (e) => onError(e, '메모를 지우지 못했어요.'),
      },
    )

  const submit = () => {
    const action = memoAction(text, target !== null)
    if (action === 'none') {
      onClose()
    } else if (action === 'delete' && target) {
      deleteMemo(target)
    } else {
      save.mutate(
        { productId, content: text.trim(), version: target?.version ?? null },
        {
          onSuccess: () => {
            toast.success(`${productName} 메모를 저장했어요`)
            onClose()
          },
          onError: (e) => onError(e, '메모를 저장하지 못했어요.'),
        },
      )
    }
  }

  return (
    <form
      role="dialog"
      aria-modal="true"
      aria-labelledby="memo-title"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-lg"
    >
      <div>
        <h2 id="memo-title" className="text-lg font-bold text-slate-900">
          상품 메모
        </h2>
        <p className="text-sm text-slate-500">
          {productName}
          {opened && ` · ${formatDateTime(opened.updatedAt)} 저장`}
        </p>
      </div>

      <div className="space-y-1 text-sm">
        <label htmlFor={textId} className="block font-medium text-slate-700">
          내용
        </label>
        <textarea
          id={textId}
          ref={textRef}
          rows={5}
          maxLength={MEMO_MAX_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 냉장 2칸에 둠, 다음 주 입고 늘리기"
          className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 focus:border-emerald-600 focus:outline-none"
        />
        <p className="text-right text-xs text-slate-400 tabular-nums">
          {text.length}/{MEMO_MAX_LENGTH}
        </p>
      </div>

      {conflict && (
        <div
          role="status"
          className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert className="size-4" aria-hidden />
            {latest
              ? `다른 화면에서 ${formatDateTime(latest.updatedAt)}에 저장한 내용`
              : '다른 화면에서 메모를 지웠어요'}
          </p>
          {latest && <p className="whitespace-pre-wrap text-amber-800">{latest.content}</p>}
          <p className="text-xs text-amber-700">
            {latest
              ? '확인했으면 다시 저장하세요. 지금 쓴 내용으로 바뀌어요.'
              : '다시 저장하면 지금 쓴 내용으로 새로 만들어요.'}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {target ? (
          <button
            type="button"
            onClick={() => deleteMemo(target)}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            삭제
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600"
          >
            {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            저장
          </button>
        </div>
      </div>
    </form>
  )
}
