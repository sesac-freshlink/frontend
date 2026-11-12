import { ImageOff } from 'lucide-react'
import { Link } from 'react-router'
import { formatWon } from '@/customer/order/format'
import { cn } from '@/shared/ui/cn'
import { useState } from 'react'
import { useBestProducts, useStoreCategories } from '../../api'
import { clearanceOf } from '../../clearance'
import { productLabel } from '../../productLabel'
import { PhotoOrIcon } from '../PhotoOrIcon'

/** 이 순위까지는 순위 숫자를 초록 바탕으로(1~3위), 그 뒤는 회색(4~5위) */
const TOP_RANK = 3

/**
 * 홈 베스트 상품: 지난 7일 많이 팔린 상품 1~5위 세로 목록(11/11), 분류별로 고르기(11/12 경우 결정).
 * 제목 아래 분류 버튼 줄(전체 + 점포 분류), 고른 분류의 추천순 앞 5개에서 판매 0개는 뺀다.
 * 사진 72px 왼쪽 위에 순위 숫자, 마감세일 중이면 작은 로즈 "마감세일" 표시와 할인가.
 * 처음(전체) 읽기에 실패하면 칸을 통째로 숨긴다(판매 순위를 못 받아도 홈이 깨지지 않게)
 */
export function BestProducts({ storeId, storeName }: { storeId: number; storeName: string }) {
  const [category, setCategory] = useState('')
  const best = useBestProducts(storeId, category)
  const categories = useStoreCategories(storeId)
  if (category === '' && (best.isError || (best.data && best.data.length === 0))) return null
  if (!best.data) return null
  return (
    <section aria-labelledby="home-best" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 id="home-best" className="text-lg font-bold text-slate-900">
          베스트 상품
        </h2>
        <Link
          to={`/customer/stores/${storeId}?sort=POPULAR`}
          state={{ storeName }}
          aria-label="베스트 상품 전체 보기"
          className="-mr-2 flex min-h-11 items-center px-2 text-sm font-medium text-slate-600"
        >
          전체 보기
        </Link>
      </div>
      <div
        role="group"
        aria-label="베스트 분류"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {['', ...(categories.data ?? [])].map((c) => (
          <button
            key={c || 'all'}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              'min-h-11 shrink-0 rounded-full border px-4 text-sm',
              category === c
                ? 'border-emerald-700 bg-emerald-700 font-semibold text-white'
                : 'border-slate-300 bg-white text-slate-800',
            )}
          >
            {c || '전체'}
          </button>
        ))}
      </div>
      {best.data.length === 0 ? (
        <p className="py-3 text-sm text-slate-600">아직 판매 기록이 없어요.</p>
      ) : (
        <ol className="space-y-2.5">
          {best.data.map((p, i) => {
            const rank = i + 1
            const sale = clearanceOf(p)
            return (
              <li key={p.productId}>
                <Link
                  to={`/customer/stores/${storeId}/products/${p.productId}`}
                  state={{ storeName }}
                  aria-label={`${rank}위, ${productLabel(p)}`}
                  className="flex items-center gap-3.5"
                >
                  <span className="relative shrink-0">
                    <PhotoOrIcon
                      src={p.imageUrl}
                      icon={ImageOff}
                      className="size-18 rounded-xl bg-slate-50 p-1.5"
                    />
                    <span
                      className={cn(
                        'absolute top-1 left-1 flex size-5.5 items-center justify-center rounded-md text-xs font-bold text-white',
                        rank <= TOP_RANK ? 'bg-emerald-700' : 'bg-slate-500',
                      )}
                    >
                      {rank}
                    </span>
                  </span>
                  <span className="min-w-0 space-y-0.5">
                    <span className="block truncate text-base text-slate-900">{p.name}</span>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      {sale && (
                        <span className="rounded bg-rose-50 px-1.5 py-px text-xs font-bold text-rose-700">
                          마감세일
                        </span>
                      )}
                      {formatWon(sale ? sale.price : p.price)}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
