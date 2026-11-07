import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AUDIENCE_LABEL, type FaqItem, useAdminFaqs, useDeleteFaq } from '../api'
import { DeleteButton } from '../components/DeleteButton'
import { FaqEditDialog } from '../components/FaqEditDialog'

/** 고칠 질문: 'new' 는 새 질문 */
type Editing = 'new' | FaqItem | null

/** 관리자 자주 묻는 질문 관리 (추가 명세 A17, member-service AD-09~12) */
export function AdminFaqsPage() {
  const [editing, setEditing] = useState<Editing>(null)
  const faqs = useAdminFaqs()
  const remove = useDeleteFaq()

  const onDelete = async (faqId: number) => {
    try {
      await remove.mutateAsync(faqId)
      toast.success('질문을 지웠어요')
    } catch {
      toast.error('지우지 못했어요. 잠시 뒤 다시 시도해 주세요')
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">자주 묻는 질문</h1>
          <p className="text-sm text-slate-500">순서 숫자가 작은 질문이 위에 나와요.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          질문 쓰기
        </button>
      </div>
      {faqs.isPending && (
        <div className="flex justify-center py-16 text-slate-400">
          <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
        </div>
      )}
      {faqs.isError && (
        <p role="alert" className="py-16 text-center text-sm text-red-600">
          질문을 불러오지 못했어요.
        </p>
      )}
      {faqs.data && faqs.data.length === 0 && (
        <p className="py-16 text-center text-sm text-slate-500">등록된 질문이 없어요.</p>
      )}
      {faqs.data && faqs.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">순서</th>
                <th className="px-4 py-3 font-medium">질문</th>
                <th className="px-4 py-3 font-medium">볼 사람</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {faqs.data.map((f) => (
                <tr key={f.faqId}>
                  <td className="px-4 py-3 text-slate-600">{f.sortOrder}</td>
                  <td className="px-4 py-3 text-slate-900">{f.question}</td>
                  <td className="px-4 py-3 text-slate-600">{AUDIENCE_LABEL[f.audience]}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setEditing(f)}
                      aria-label={`${f.question} 고치기`}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      고치기
                    </button>
                    <DeleteButton
                      label={f.question}
                      busy={remove.isPending}
                      onConfirm={() => void onDelete(f.faqId)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing === 'new' && <FaqEditDialog onClose={() => setEditing(null)} />}
      {editing !== null && editing !== 'new' && (
        <FaqEditDialog faq={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  )
}
