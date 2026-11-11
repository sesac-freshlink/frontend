import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/ui/cn'

/**
 * 상품 사진(꾸밈 그림, alt="")을 그리고, 사진이 없거나 못 불러오면 선 아이콘을 그린다.
 * 이름은 옆 글자가 라벨이라 사진은 화면 읽기에 읽히지 않게 한다(홈 분류 칸·점포 목록 분류 줄·베스트 상품)
 */
export function PhotoOrIcon({
  src,
  icon: Icon,
  className,
  imgClassName,
}: {
  src: string | null | undefined
  icon: LucideIcon
  className?: string
  imgClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  return (
    <span aria-hidden className={cn('flex items-center justify-center overflow-hidden', className)}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn('size-full object-contain', imgClassName)}
        />
      ) : (
        <Icon className="size-5 text-slate-500" strokeWidth={1.75} />
      )}
    </span>
  )
}
