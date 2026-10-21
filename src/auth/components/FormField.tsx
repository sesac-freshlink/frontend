import type { ReactNode } from 'react'
import { cn } from '@/shared/ui/cn'
import { describedBy } from './fieldStyles'

interface Props {
  /** 입력 요소의 id. 이름표(htmlFor)와 안내 문구(aria-describedby)를 이어 준다 */
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

/** 로그인·가입 입력 칸 하나: 이름표 + 입력 + 안내/오류 */
export function FormField({ id, label, error, hint, children }: Props) {
  const note = error ?? hint
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
      </label>
      {children}
      {note && (
        <p id={describedBy(id)} className={cn('text-xs text-slate-500', error && 'text-red-600')}>
          {note}
        </p>
      )}
    </div>
  )
}
