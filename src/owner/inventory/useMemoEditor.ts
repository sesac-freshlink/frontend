import { useState } from 'react'
import { toast } from 'sonner'
import { apiErrorCode, apiErrorMessage, useDeleteMemo, useSaveMemo, type ProductMemo } from './api'
import { memoAction } from './memo'

export interface UseMemoEditorReturn {
  text: string
  setText: (text: string) => void
  /** 다른 화면이 먼저 바꿔 409 를 받았는지 */
  conflict: boolean
  /** 고치기 시작한 순간의 메모(이 version 으로 저장한다). 없으면 null */
  opened: ProductMemo | null
  /** 저장·삭제할 때 version 을 쓰는 메모. 없으면 새로 만든다 */
  target: ProductMemo | null
  busy: boolean
  saving: boolean
  submit: () => void
  remove: (memo: ProductMemo) => void
}

/**
 * 메모 고치기 규칙 하나(메모 창 MemoDialog·메모 탭 카드가 같이 쓴다).
 * 고치기 시작한 순간의 version 으로 저장해 그 사이 다른 화면의 변경을 알아챈다. 빈 내용 저장은 삭제
 */
export function useMemoEditor({
  productId,
  productName,
  latest,
  onSaved,
  onDeleted,
}: {
  productId: number
  productName: string
  /** 서버의 지금 메모. 저장·삭제 뒤 다시 읽으면 바뀐다. 없으면 null */
  latest: ProductMemo | null
  onSaved: () => void
  onDeleted: () => void
}): UseMemoEditorReturn {
  const save = useSaveMemo()
  const del = useDeleteMemo()
  const [opened] = useState(latest)
  const [text, setText] = useState(latest?.content ?? '')
  const [conflict, setConflict] = useState(false)
  // 충돌을 본 뒤에는 다른 화면이 저장한 최신 메모 위에 저장한다(덮어쓰기를 점주가 고른 것)
  const target = conflict ? latest : opened

  const onError = (error: unknown, fallback: string) => {
    if (apiErrorCode(error) === 'MEMO_CHANGED') setConflict(true)
    toast.error(apiErrorMessage(error, fallback))
  }

  const remove = (memo: ProductMemo) =>
    del.mutate(
      { productId, version: memo.version },
      {
        onSuccess: () => {
          toast.success(`${productName} 메모를 삭제했어요`)
          onDeleted()
        },
        onError: (e) => onError(e, '메모를 삭제하지 못했어요.'),
      },
    )

  const submit = () => {
    const action = memoAction(text, target !== null)
    if (action === 'none') {
      onSaved()
    } else if (action === 'delete' && target) {
      remove(target)
    } else {
      save.mutate(
        { productId, content: text.trim(), version: target?.version ?? null },
        {
          onSuccess: () => {
            toast.success(`${productName} 메모를 저장했어요`)
            onSaved()
          },
          onError: (e) => onError(e, '메모를 저장하지 못했어요.'),
        },
      )
    }
  }

  return {
    text,
    setText,
    conflict,
    opened,
    target,
    busy: save.isPending || del.isPending,
    saving: save.isPending,
    submit,
    remove,
  }
}
