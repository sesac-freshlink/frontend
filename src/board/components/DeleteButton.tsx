import { useState } from 'react'

interface Props {
  /** 지울 글 이름 (화면 읽기용) */
  label: string
  busy: boolean
  onConfirm(): void
}

/** [지우기] → 한 번 더 [정말 지우기]·[취소]. 지운 글은 되돌릴 수 없다 */
export function DeleteButton({ label, busy, onConfirm }: Props) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`${label} 지우기`}
        className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
      >
        지우기
      </button>
    )
  }
  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        정말 지우기
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
      >
        취소
      </button>
    </span>
  )
}
