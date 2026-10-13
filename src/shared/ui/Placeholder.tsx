import type { ReactNode } from 'react'

interface Props {
  /** 기능 ID, 예: S-10 */
  featureId: string
  title: string
  owner: string
  children?: ReactNode
}

/** 아직 만들지 않은 화면 자리. 담당자가 화면을 만들면서 지운다 */
export function Placeholder({ featureId, title, owner, children }: Props) {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-slate-500">
        {featureId} · 담당 {owner}
      </p>
      {children}
    </section>
  )
}
