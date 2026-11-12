import { ChevronDown, LoaderCircle } from 'lucide-react'
import { BackLink } from '@/customer/order/components/BackLink'
import { useFaqs } from '../api'

/** 자주 묻는 질문 (추가 명세 A17). 질문을 누르면 답이 펼쳐진다 */
export function FaqPage({ back }: { back?: { to: string; label: string } } = {}) {
  const faqs = useFaqs()

  return (
    <section className="space-y-4">
      {back && <BackLink to={back.to} label={back.label} />}
      <h1 className="text-xl font-bold text-slate-900">자주 묻는 질문</h1>
      {faqs.isPending && (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          질문을 불러오는 중이에요
        </p>
      )}
      {faqs.isError && (
        <p role="alert" className="text-sm text-rose-700">
          질문을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
        </p>
      )}
      {faqs.data && faqs.data.length === 0 && (
        <p className="text-sm text-slate-500">등록된 질문이 없어요.</p>
      )}
      {faqs.data && faqs.data.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {faqs.data.map((f) => (
            <li key={f.faqId}>
              <details className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-slate-900">
                  <span>Q. {f.question}</span>
                  <ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm whitespace-pre-line text-slate-600">{f.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
