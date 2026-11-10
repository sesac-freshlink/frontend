import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { apiErrorCode } from '@/shared/api/errors'
import { type PickupPass, useIssuePickupPass } from './api'
import { pickupScanUrl, renewDelayMs, secondsLeft } from './pickupQr'

export interface UsePickupQrReturn {
  pass: PickupPass | null
  /** QR 그림 (data: 주소). 만드는 중이면 null */
  qrImage: string | null
  /** 만료까지 남은 초 */
  secondsLeft: number
  /** 받아 갈 주문이 없음(409 NO_PICKUP_WAITING_ORDER) */
  noOrders: boolean
  /** 그 밖의 실패 문구 */
  error: string | null
  /** 지금 다시 만들기 */
  renew(): void
}

/**
 * 고객 픽업 QR 화면 (추가 명세 A16): 들어오면 QR을 만들고, 만료 30초 전에 저절로 새로 만든다.
 * QR 안에는 점주 화면 주소(/owner/pickup-scan?t=표)를 넣는다
 */
export function usePickupQr(origin: string): UsePickupQrReturn {
  const issue = useIssuePickupPass()
  const { mutateAsync } = issue
  const [pass, setPass] = useState<PickupPass | null>(null)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [noOrders, setNoOrders] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // 효과(useEffect)에서도 부르므로 상태는 응답이 온 뒤에만 바꾼다
  const issueNow = useCallback(() => {
    mutateAsync()
      .then(async (next) => {
        setError(null)
        setNoOrders(false)
        setPass(next)
        setQrImage(
          await QRCode.toDataURL(pickupScanUrl(origin, next.token), { width: 280, margin: 1 }),
        )
      })
      .catch((e: unknown) => {
        if (apiErrorCode(e) === 'NO_PICKUP_WAITING_ORDER') setNoOrders(true)
        else setError('QR을 만들지 못했어요. 다시 시도해 주세요.')
      })
  }, [mutateAsync, origin])

  // 처음 한 번 만든다
  useEffect(() => {
    issueNow()
  }, [issueNow])

  // 만료 30초 전에 새로 만든다
  useEffect(() => {
    if (!pass) return
    const timer = setTimeout(issueNow, renewDelayMs(pass.expiresAt, Date.now()))
    return () => clearTimeout(timer)
  }, [pass, issueNow])

  // 남은 시간 표시
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return {
    pass,
    qrImage,
    secondsLeft: pass ? secondsLeft(pass.expiresAt, now) : 0,
    noOrders,
    error,
    renew() {
      setError(null)
      issueNow()
    },
  }
}
