import { LoaderCircle } from 'lucide-react'

interface Props {
  busy: boolean
  onCancel(): void
}

/** 쓰기 창 아래 [취소] [저장] */
export function DialogButtons({ busy, onCancel }: Props) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        저장
      </button>
    </div>
  )
}
