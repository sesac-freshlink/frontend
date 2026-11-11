import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useHomeBanners, type HomeBanner as Banner } from '@/customer/banners/api'

/** 배너가 저절로 넘어가는 간격 */
export const BANNER_INTERVAL_MS = 4000

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/**
 * 홈 ③ 메인 배너(2:1). 미확정(member 배너 V6 전) API 라 못 받거나 비어 있으면 칸을 숨긴다.
 * 4초마다 다음 장으로 넘어가고, [멈춤] 버튼·손으로 넘기기·키보드로 들어오면 멈춘다.
 * 움직임 줄이기를 켠 사람에게는 저절로 넘기지 않는다
 */
export function HomeBanner() {
  const banners = useHomeBanners()
  if (banners.isPending) {
    return <div aria-hidden className="aspect-2/1 animate-pulse rounded-2xl bg-slate-200" />
  }
  // 미확정 API 라 모양이 다르게 올 수 있다. 목록이 아니거나 비면 숨긴다(홈 전체가 깨지지 않게)
  if (banners.isError || !Array.isArray(banners.data)) return null
  const valid = banners.data.filter(isBanner)
  if (valid.length === 0) return null
  return <BannerCarousel banners={valid} />
}

function isBanner(value: unknown): value is Banner {
  return (
    typeof value === 'object' &&
    value !== null &&
    'bannerId' in value &&
    'title' in value &&
    'imageUrl' in value &&
    'noticeId' in value &&
    typeof value.bannerId === 'number' &&
    typeof value.title === 'string' &&
    typeof value.imageUrl === 'string' &&
    (value.noticeId === null || typeof value.noticeId === 'number')
  )
}

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const listRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(prefersReducedMotion)
  const many = banners.length > 1

  useEffect(() => {
    if (paused || !many) return
    const timer = window.setInterval(() => {
      const list = listRef.current
      if (!list) return
      const next = (Math.round(list.scrollLeft / list.clientWidth) + 1) % banners.length
      list.scrollTo({ left: next * list.clientWidth, behavior: 'smooth' })
    }, BANNER_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [paused, many, banners.length])

  const onScroll = () => {
    const list = listRef.current
    if (list && list.clientWidth > 0) setIndex(Math.round(list.scrollLeft / list.clientWidth))
  }

  return (
    <section aria-roledescription="배너 넘기기" aria-label="알림 배너" className="relative">
      <ul
        ref={listRef}
        onScroll={onScroll}
        onPointerDown={() => setPaused(true)}
        onFocus={() => setPaused(true)}
        className="flex aspect-2/1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl"
      >
        {banners.map((b, i) => (
          <li
            key={b.bannerId}
            aria-roledescription="배너"
            aria-label={`${banners.length}장 중 ${i + 1}번째`}
            className="relative w-full shrink-0 snap-start"
          >
            <BannerSlide banner={b} />
          </li>
        ))}
      </ul>
      {many && (
        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-slate-900/70 pl-3 text-sm text-white">
          <span aria-hidden>
            {Math.min(index, banners.length - 1) + 1} / {banners.length}
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? '배너 저절로 넘기기' : '배너 멈춤'}
            className="flex size-11 items-center justify-center rounded-full"
          >
            {paused ? (
              <Play className="size-4" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}
          </button>
        </div>
      )}
    </section>
  )
}

function BannerSlide({ banner }: { banner: Banner }) {
  const body = (
    <>
      <img src={banner.imageUrl} alt="" className="size-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent px-4 pt-10 pr-28 pb-4 text-base leading-snug font-semibold text-white">
        {banner.title}
      </span>
    </>
  )
  if (banner.noticeId === null) return <div className="relative size-full">{body}</div>
  return (
    <Link to={`/customer/notices/${banner.noticeId}`} className="relative block size-full">
      {body}
    </Link>
  )
}
