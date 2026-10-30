import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/shared/auth'
import { NOTIFICATION_STREAM_PATH, notificationKeys, type AppNotification } from './api'

/** 연결이 서버 응답(401 등)으로 닫혔을 때 다시 붙기 전에 기다리는 시간. 다시 붙기를 되풀이하지 않게 늘려 간다 */
const RECONNECT_MS = [3_000, 10_000, 30_000]

/**
 * 실시간 알림 SSE (notification-service GET /notifications/stream). 로그인한 동안 한 번만 연다(레이아웃의 알림 종이 부른다).
 * - notification 이벤트: 종 숫자·목록을 다시 읽고 sonner 토스트를 띄운다. 같은 알림(id)이 두 번 오면 한 번만 띄운다
 * - 네트워크로 끊기면 EventSource 가 Last-Event-ID 를 붙여 스스로 다시 붙는다(서버가 놓친 알림을 보낸다)
 * - 로그인 만료(401)로 닫히면 refresh 를 한 번 하고 ?lastEventId= 를 붙여 새로 연다. 갱신이 안 되면 다시 열지 않는다
 */
export function useNotificationStream() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.userId)

  useEffect(() => {
    if (!userId || typeof EventSource === 'undefined') return
    const seen = new Set<number>()
    let lastId = 0
    let source: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false

    const onNotification = (e: MessageEvent<string>) => {
      failures = 0
      let n: AppNotification
      try {
        n = JSON.parse(e.data) as AppNotification
      } catch {
        return
      }
      lastId = Math.max(lastId, n.id)
      if (seen.has(n.id)) return
      seen.add(n.id)
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      const link = n.link
      toast(n.title, {
        id: `notification-${n.id}`,
        description: n.body,
        ...(link && { action: { label: '보기', onClick: () => void navigate(link) } }),
      })
    }

    const open = () => {
      const url =
        lastId > 0 ? `${NOTIFICATION_STREAM_PATH}?lastEventId=${lastId}` : NOTIFICATION_STREAM_PATH
      source = new EventSource(url, { withCredentials: true })
      source.addEventListener('notification', onNotification as EventListener)
      source.onopen = () => {
        failures = 0
      }
      source.onerror = () => {
        // CONNECTING 이면 브라우저가 스스로 다시 붙는 중이다. CLOSED 는 서버가 오류 응답(401·5xx)으로 닫은 것
        if (!source || source.readyState !== EventSource.CLOSED || stopped) return
        source.close()
        const wait = RECONNECT_MS[Math.min(failures, RECONNECT_MS.length - 1)]
        failures += 1
        timer = setTimeout(() => void reopen(), wait)
      }
    }

    const reopen = async () => {
      if (stopped) return
      try {
        // 401 이었으면 쿠키를 새로 받는다. 세션이 끝났으면(false) 다시 열지 않는다(로그인 화면으로 간다)
        if (!(await useAuthStore.getState().refreshSession())) return
      } catch {
        // 갱신 서버 오류: 세션은 살아 있을 수 있어 그대로 다시 열어 본다
      }
      if (!stopped) open()
    }

    open()
    return () => {
      stopped = true
      clearTimeout(timer)
      source?.close()
    }
  }, [userId, queryClient, navigate])
}
