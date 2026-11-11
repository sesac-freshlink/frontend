import type { ReactNode } from 'react'

/**
 * 상품 상세의 [구매하기]를 화면 아래(하단 메뉴 바로 위)에 고정해 두는 띠.
 * 마감세일 상품처럼 상세가 길어도 내리지 않고 바로 살 수 있게 한다(11/11 경우 결정).
 * 하단 메뉴 가운데 [픽업 QR] 동그라미가 위로 솟아 있어 그만큼 아래 여백을 둔다.
 * 이 띠가 상세 끝 내용을 가리지 않게 상세 화면에 아래 여백(pb-28)을 같이 준다
 */
export function BuyBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-14 z-10 mx-auto w-full max-w-md border-t border-slate-200 bg-white px-4 pt-3 pb-8">
      {children}
    </div>
  )
}
