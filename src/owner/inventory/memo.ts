/** 메모 최대 길이. 서버 ProductMemo.MAX_LENGTH, DB VARCHAR(200)과 같다 */
export const MEMO_MAX_LENGTH = 200

/** 저장 버튼을 눌렀을 때 할 일 */
export type MemoAction = 'save' | 'delete' | 'none'

/**
 * 입력과 지금 메모로 할 일을 정한다. 내용을 다 지우고 저장하면 지우기와 같다.
 * 메모가 없는데 빈 채로 저장하면 아무것도 하지 않는다(빈 메모를 만들지 않는다)
 */
export function memoAction(input: string, hasMemo: boolean): MemoAction {
  if (input.trim().length > 0) return 'save'
  return hasMemo ? 'delete' : 'none'
}
