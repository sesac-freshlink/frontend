import { LoaderCircle, Users } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { apiErrorCode } from '@/shared/api/errors'
import { useJoinQueue, useLeaveQueue, useQueueStatus, type QueueStatusResponse } from '../api'
import { checkoutPath, parseCheckout, type CheckoutItem } from '../checkout'
import { firstComeErrorMessage } from '../firstCome'

/**
 * 선착순 대기 화면 (/customer/stores/:storeId/products/:productId/queue, 오픈런 문서 2장).
 * 들어오면 줄을 서고 2.5초마다 내 순번·앞에 남은 사람·남은 수량을 다시 읽는다. 차례가 오면(입장권 5분) 주문 화면으로 간다.
 * 상품 상세 [구매하기]가 checkoutPath 와 같은 쿼리로 보내 준다(frontend #60 queuePath)
 */
export function FirstComeQueuePage() {
  const [params] = useSearchParams()
  const item = parseCheckout(params)
  if (!item) {
    return (
      <section className="space-y-3 py-10 text-center">
        <p className="text-sm text-slate-500">
          상품 정보를 찾을 수 없어요. 상품을 다시 골라 주세요.
        </p>
        <Link to="/customer" className="text-sm text-emerald-600 underline">
          점포 찾기로
        </Link>
      </section>
    )
  }
  return <QueueView item={item} />
}

/** 선착순 상품은 1개만 살 수 있어 주문 화면 수량을 1로 묶는다 */
function firstComeCheckoutPath(item: CheckoutItem): string {
  return checkoutPath({ ...item, available: 1, firstCome: true })
}

function QueueView({ item }: { item: CheckoutItem }) {
  const navigate = useNavigate()
  const join = useJoinQueue(item.storeId, item.productId)
  const leave = useLeaveQueue(item.storeId, item.productId)
  const statusQuery = useQueueStatus(item.storeId, item.productId, join.isSuccess)
  const joined = useRef(false)
  const productPath = `/customer/stores/${item.storeId}/products/${item.productId}`

  useEffect(() => {
    if (joined.current) return
    joined.current = true
    join.mutate()
  }, [join])

  const joinCode = apiErrorCode(join.error)
  // 기다리는 중에 점주가 선착순을 껐다 (줄 설 때는 바로 주문 화면으로 가지만, 기다리는 중에는 안내를 보여 준다)
  const ended = apiErrorCode(statusQuery.error) === 'NOT_FIRST_COME'
  const status: QueueStatusResponse | undefined = statusQuery.data ?? join.data

  useEffect(() => {
    if (joinCode === 'NOT_FIRST_COME') navigate(checkoutPath(item), { replace: true })
  }, [joinCode, item, navigate])

  useEffect(() => {
    if (status?.status === 'ADMITTED') navigate(firstComeCheckoutPath(item), { replace: true })
  }, [status?.status, item, navigate])

  const rejoin = () => {
    join.mutate(undefined, { onSuccess: () => void statusQuery.refetch() })
  }

  const stopWaiting = () => {
    leave.mutate(undefined, { onSettled: () => navigate(productPath, { replace: true }) })
  }

  if (join.isError && joinCode !== 'NOT_FIRST_COME') {
    return (
      <section className="space-y-4 py-10 text-center">
        <p className="text-sm text-red-600" role="alert">
          {firstComeErrorMessage(joinCode) ?? '줄을 서지 못했어요. 다시 시도해 주세요.'}
        </p>
        {joinCode === 'FIRST_COME_ALREADY_ORDERED' ? (
          <Link to="/customer/orders" className="text-sm text-emerald-600 underline">
            주문 내역 보기
          </Link>
        ) : (
          <button
            type="button"
            onClick={rejoin}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            다시 줄 서기
          </button>
        )}
        <Link to={productPath} className="block text-sm text-slate-500 underline">
          상품으로 돌아가기
        </Link>
      </section>
    )
  }

  if (ended) {
    return (
      <section className="space-y-4 py-10 text-center">
        <p className="font-medium text-slate-900">선착순 판매가 끝났어요</p>
        <p className="text-sm text-slate-500">이제 줄을 서지 않고 바로 주문할 수 있어요.</p>
        <button
          type="button"
          onClick={() => navigate(checkoutPath(item), { replace: true })}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          주문하기
        </button>
        <Link to={productPath} className="block text-sm text-slate-500 underline">
          상품으로 돌아가기
        </Link>
      </section>
    )
  }

  if (!status || status.status === 'ADMITTED') {
    return (
      <section className="flex flex-col items-center gap-3 py-16 text-slate-500">
        <LoaderCircle className="size-8 animate-spin text-emerald-600" />
        <p className="font-medium text-slate-900">
          {status?.status === 'ADMITTED' ? '차례예요! 주문 화면으로 가요' : '줄을 서고 있어요'}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-medium text-emerald-700">선착순 상품</p>
        <h1 className="text-xl font-bold text-slate-900">{item.productName}</h1>
        <p className="text-sm text-slate-500">{item.storeName}</p>
      </div>

      {status.status === 'WAITING' && <WaitingCard status={status} />}

      {status.status === 'SOLD_OUT' && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
          <p className="font-medium text-slate-900">준비한 수량이 모두 나갔어요</p>
          <p className="text-sm text-slate-500">
            결제하지 않은 주문이 생기면 자리가 날 수 있어요. 기다리면 순서대로 들어가요.
          </p>
        </div>
      )}

      {status.status === 'NOT_IN_QUEUE' && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
          <p className="font-medium text-slate-900">줄에서 빠졌어요</p>
          <p className="text-sm text-slate-500">
            화면을 30초 넘게 떠나 있었거나 그만 기다리기를 눌렀어요.
          </p>
          <button
            type="button"
            onClick={rejoin}
            disabled={join.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            다시 줄 서기
          </button>
        </div>
      )}

      <ul className="space-y-1 text-xs text-slate-500">
        <li>차례가 오면 5분 안에 결제하기를 눌러야 해요.</li>
        <li>한 사람이 1개만 살 수 있어요.</li>
        <li>이 화면을 떠나 30초가 지나면 줄에서 빠져요.</li>
      </ul>

      <button
        type="button"
        onClick={stopWaiting}
        disabled={leave.isPending}
        className="w-full rounded-lg border border-slate-300 py-3 text-sm font-medium text-slate-600 disabled:opacity-50"
      >
        그만 기다리기
      </button>
    </section>
  )
}

function WaitingCard({ status }: { status: QueueStatusResponse }) {
  return (
    <div
      className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
      aria-live="polite"
    >
      <div className="text-center">
        <p className="text-sm text-slate-600">내 순번</p>
        <p className="text-4xl font-bold text-emerald-700">{status.position}번째</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs text-slate-500">내 앞</dt>
          <dd className="font-medium text-slate-900">{status.ahead}명</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">남은 수량</dt>
          <dd className="font-medium text-slate-900">
            {status.remaining === null ? '-' : `${status.remaining}개`}
          </dd>
        </div>
        <div>
          <dt className="flex items-center justify-center gap-1 text-xs text-slate-500">
            <Users className="size-3" />
            기다리는 사람
          </dt>
          <dd className="font-medium text-slate-900">{status.waiting}명</dd>
        </div>
      </dl>
    </div>
  )
}
