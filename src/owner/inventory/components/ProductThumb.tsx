import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'

interface Props {
  /** 없으면(null) 자리표시를 보여 준다 */
  src: string | null
  /** 상품명. 이미지를 못 불러왔을 때 접근성 이름으로 쓴다 */
  name: string
  className?: string
}

/**
 * 상품 썸네일. 주소가 없거나 불러오지 못하면 회색 자리표시를 보여 준다.
 * 이미지는 외부(CU 사이트 CDN) 주소라 언제든 막힐 수 있어 자리표시가 꼭 있어야 한다
 */
export function ProductThumb({ src, name, className }: Props) {
  const [failed, setFailed] = useState(false)
  const box = cn(
    'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50',
    className,
  )

  if (src === null || failed) {
    return (
      <span role="img" aria-label={`${name} 이미지 없음`} className={cn(box, 'text-slate-300')}>
        <ImageOff className="size-4" aria-hidden />
      </span>
    )
  }
  return (
    <span className={box}>
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </span>
  )
}
