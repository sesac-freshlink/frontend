import {
  Carrot,
  Croissant,
  LayoutGrid,
  Milk,
  Salad,
  Sandwich,
  Triangle,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useCategoryPhotos } from '../../api'
import { HOME_CATEGORIES, type HomeCategory } from '../../homeRows'

/** 사진이 없을 때 그리는 선 아이콘 */
const ICONS: Record<HomeCategory, LucideIcon> = {
  도시락: UtensilsCrossed,
  김밥: Triangle,
  샌드위치: Sandwich,
  샐러드: Salad,
  유제품: Milk,
  빵: Croissant,
  신선식품: Carrot,
}

/**
 * 홈 ④ 카테고리 4×2. 앞 7칸은 그 분류의 상품 목록(?category=), 마지막 칸은 전체 분류 화면.
 * 동그라미 사진은 그 분류에서 사진이 있는 첫 상품이고, 없거나 못 불러오면 선 아이콘이다
 */
export function CategoryGrid({ storeId, storeName }: { storeId: number; storeName: string }) {
  const photos = useCategoryPhotos(storeId)
  return (
    <nav aria-label="카테고리">
      <ul className="grid grid-cols-4 gap-y-3">
        {HOME_CATEGORIES.map((c) => (
          <li key={c}>
            <Tile
              to={`/customer/stores/${storeId}?category=${encodeURIComponent(c)}`}
              storeName={storeName}
              label={c}
              photo={photos.data?.[c] ?? null}
              icon={ICONS[c]}
            />
          </li>
        ))}
        <li>
          <Tile
            to={`/customer/stores/${storeId}/categories`}
            storeName={storeName}
            label="카테고리"
            photo={null}
            icon={LayoutGrid}
          />
        </li>
      </ul>
    </nav>
  )
}

function Tile({
  to,
  storeName,
  label,
  photo,
  icon: Icon,
}: {
  to: string
  storeName: string
  label: string
  photo: string | null
  icon: LucideIcon
}) {
  const [failed, setFailed] = useState(false)
  return (
    <Link
      to={to}
      state={{ storeName }}
      className="flex min-h-11 flex-col items-center gap-1.5 py-1 text-sm text-slate-800"
    >
      <span className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-emerald-700">
        {photo !== null && !failed ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className="size-full object-contain p-1.5 mix-blend-multiply"
          />
        ) : (
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        )}
      </span>
      {label}
    </Link>
  )
}
