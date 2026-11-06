import { useEffect, useRef } from 'react'

/**
 * 목록 끝에 둔 요소가 화면에 들어오면 onReach 를 부른다(무한 스크롤). enabled 가 false 면 지켜보지 않는다.
 * IntersectionObserver 가 없는 환경(오래된 브라우저·테스트)에서는 아무것도 하지 않으니, 화면에 [더 보기] 버튼도 같이 둔다
 */
export function useLoadMoreOnScroll<T extends Element>(onReach: () => void, enabled: boolean) {
  const ref = useRef<T>(null)
  const latest = useRef(onReach)
  useEffect(() => {
    latest.current = onReach
  })

  useEffect(() => {
    const target = ref.current
    if (!enabled || target === null || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) latest.current()
      },
      // 끝에 닿기 조금 전에 미리 부른다
      { rootMargin: '200px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [enabled])

  return ref
}
