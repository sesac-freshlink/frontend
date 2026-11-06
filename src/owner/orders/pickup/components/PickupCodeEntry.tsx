import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { inputClass } from '@/auth/components/fieldStyles'
import { cn } from '@/shared/ui/cn'
import { PickupApproveDialog } from './PickupApproveDialog'

/** 점주 주문 목록의 [코드 입력]: 카메라가 안 될 때 고객 화면의 6자리 코드로 같은 승인 창을 연다 (추가 명세 A16) */
export function PickupCodeEntry() {
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const valid = /^\d{6}$/.test(code)

  return (
    <>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            setOpenKey(code)
            setEditing(false)
            setCode('')
          }}
          className="flex items-center gap-2"
        >
          <input
            aria-label="고객 픽업 코드 6자리"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={cn(inputClass, 'w-32 py-1.5 font-mono tracking-widest')}
            autoFocus
          />
          <button
            type="submit"
            disabled={!valid}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            열기
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-slate-500 underline"
          >
            취소
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          <KeyRound className="size-4" />
          픽업 코드 입력
        </button>
      )}
      {openKey && (
        <PickupApproveDialog key={openKey} pickupKey={openKey} onClose={() => setOpenKey(null)} />
      )}
    </>
  )
}
