/** 입력 칸 안내 문구 id (aria-describedby) */
export function describedBy(id: string): string {
  return `${id}-note`
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600'

export const primaryButtonClass =
  'w-full rounded-lg bg-emerald-600 py-2 font-medium text-white disabled:opacity-50'
