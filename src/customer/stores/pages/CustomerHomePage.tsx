import { LoaderCircle, MapPin, Search, Store } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useMyProfile } from '@/auth/api'
import { DEFAULT_REGION, isRegionCode, REGIONS, type RegionCode } from '@/auth/regions'
import { FullScreenSpinner } from '@/shared/ui/FullScreenSpinner'
import { STORE_KEYWORD_MAX, useStores } from '../api'

/** U-01 고객 홈: 거주 지역의 점포를 보여 주고 지역·검색어로 다시 찾는다 */
export function CustomerHomePage() {
  const profile = useMyProfile()

  if (profile.isPending) return <FullScreenSpinner />
  // 로그인했는데 프로필이 없으면 프로필 등록 마무리 화면으로 (기능명세 M1)
  if (profile.data === null) return <Navigate to="/signup" replace />

  const me = profile.data?.role === 'CUSTOMER' ? profile.data : undefined
  const myRegion = me && isRegionCode(me.region) ? me.region : DEFAULT_REGION
  return <StoreSearch initialRegion={myRegion} nickname={me?.nickname} />
}

function StoreSearch({
  initialRegion,
  nickname,
}: {
  initialRegion: RegionCode
  nickname: string | undefined
}) {
  const [region, setRegion] = useState<RegionCode>(initialRegion)
  const [draft, setDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const stores = useStores({ region, keyword })

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setKeyword(draft)
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {nickname ? `${nickname}님, 가까운 점포를 골라 보세요` : '점포 찾기'}
        </h1>
        <p className="text-sm text-slate-500">점포를 고르고 바로 구매한 뒤 매장에서 픽업해요</p>
      </div>

      <form onSubmit={onSearch} className="space-y-2" role="search">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <MapPin className="size-4 shrink-0 text-slate-400" />
          <span className="sr-only">지역</span>
          <select
            value={region}
            onChange={(e) => {
              if (isRegionCode(e.target.value)) setRegion(e.target.value)
            }}
            className="w-full bg-white text-sm text-slate-900 outline-none"
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search className="size-4 shrink-0 text-slate-400" />
            <span className="sr-only">검색어</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={STORE_KEYWORD_MAX}
              placeholder="점포명이나 주소"
              className="w-full text-sm text-slate-900 outline-none"
            />
          </label>
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white"
          >
            검색
          </button>
        </div>
      </form>

      <StoreList stores={stores} />
    </section>
  )
}

function StoreList({ stores }: { stores: ReturnType<typeof useStores> }) {
  if (stores.isPending) {
    return (
      <div className="flex justify-center py-10 text-slate-400">
        <LoaderCircle className="size-6 animate-spin" aria-label="불러오는 중" />
      </div>
    )
  }
  if (stores.isError) {
    return (
      <div className="space-y-2 py-10 text-center">
        <p className="text-sm text-red-600">점포를 불러오지 못했어요.</p>
        <button
          type="button"
          onClick={() => void stores.refetch()}
          className="text-sm text-slate-500 underline"
        >
          다시 시도
        </button>
      </div>
    )
  }
  if (stores.data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">검색 결과가 없습니다.</p>
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
      {stores.data.map((s) => (
        <li key={s.storeId}>
          <Link
            to={`/customer/stores/${s.storeId}`}
            state={{ storeName: s.name }}
            className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
          >
            <Store className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <span className="min-w-0">
              <span className="block font-medium text-slate-900">{s.name}</span>
              <span className="block truncate text-sm text-slate-500">{s.address}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
