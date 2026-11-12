import { LoaderCircle, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { apiErrorCode } from '@/shared/api/errors'
import { useJoinQueue, useLeaveQueue, useQueueStatus, type QueueStatusResponse } from '../api'
import { PendingOrderDialog } from '../components/PendingOrderDialog'
import { parseCheckout, productPath as productPathOf, type CheckoutItem } from '../checkout'
import { firstComeErrorMessage } from '../firstCome'
import { useBuyNow } from '../useBuyNow'

/**
 * 선착순 대기 화면 (/customer/stores/:storeId/products/:productId/queue, 오픈런 문서 2장).
 * 들어오면 줄을 서고 2.5초마다 내 순번·앞에 남은 사람·남은 수량을 다시 읽는다. 차례가 오면(입장권 5분) 1개 주문을 만들고
 * 결제 대기 화면으로 간다 (주문·결제 화면은 11/11 없앴다). 상품 상세 [구매하기]가 queuePath 쿼리로 보내 준다
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
        <Link
          to="/customer/stores"
          className="text-sm text-emerald-700 underline hover:text-emerald-800"
        >
          점포 찾기로
        </Link>
      </section>
    )
  }
  return <QueueView item={item} />
}

function QueueView({ item }: { item: CheckoutItem }) {
  const navigate = useNavigate()
  const join = useJoinQueue(item.storeId, item.productId)
  const leave = useLeaveQueue(item.storeId, item.productId)
  const statusQuery = useQueueStatus(item.storeId, item.productId, join.isSuccess)
  const joined = useRef(false)
  const buyNow = useBuyNow()
  // 차례가 와서 주문을 만들었다(한 번만). 실패하면 다시 누를 수 있게 false 로 돌린다
  const ordering = useRef(false)
  const [orderFailed, setOrderFailed] = useState(false)
  const productPath = productPathOf(item)

  useEffect(() => {
    if (joined.current) return
    joined.current = true
    join.mutate()
  }, [join])

  const joinCode = apiErrorCode(join.error)
  // 기다리는 중에 점주가 선착순을 껐다 (줄 설 때는 바로 주문 화면으로 가지만, 기다리는 중에는 안내를 보여 준다)
  const ended = apiErrorCode(statusQuery.error) === 'NOT_FIRST_COME'
  const status: QueueStatusResponse | undefined = statusQuery.data ?? join.data

  // 선착순이 아니면 상품 상세로 돌아가 수량을 고르게 한다
  useEffect(() => {
    if (joinCode === 'NOT_FIRST_COME') navigate(productPath, { replace: true })
  }, [joinCode, productPath, navigate])

  // 선착순 상품은 한 사람이 1개만 산다. 차례가 오면 1개 주문을 만들고 결제 대기 화면으로 간다
  const { buy } = buyNow
  const { storeId, storeName, productId } = item
  const order = useCallback(() => {
    if (ordering.current) return
    ordering.current = true
    setOrderFailed(false)
    void buy(
      { storeId, storeName, productId, quantity: 1, firstCome: true },
      { replace: true },
    ).then((ok) => {
      if (ok) return
      ordering.current = false
      setOrderFailed(true)
    })
  }, [buy, storeId, storeName, productId])

  const admitted = status?.status === 'ADMITTED'
  // 실패한 뒤에는 저절로 다시 만들지 않고 [다시 주문하기]를 기다린다. ordering 이 같은 주문을 두 번 보내지 않게 막는다
  useEffect(() => {
    if (admitted && !orderFailed) order()
  }, [admitted, orderFailed, order])

  const rejoin = () => {
    join.mutate(undefined, { onSuccess: () => void statusQuery.refetch() })
  }

  const stopWaiting = () => {
    leave.mutate(undefined, { onSettled: () => navigate(productPath, { replace: true }) })
  }

  if (join.isError && joinCode !== 'NOT_FIRST_COME') {
    return (
      <section className="space-y-4 py-10 text-center">
        <p className="text-sm text-rose-700" role="alert">
          {firstComeErrorMessage(joinCode) ?? '줄을 서지 못했어요. 다시 시도해 주세요.'}
        </p>
        {joinCode === 'FIRST_COME_ALREADY_ORDERED' ? (
          <Link
            to="/customer/orders"
            className="text-sm text-emerald-700 underline hover:text-emerald-800"
          >
            주문 내역 보기
          </Link>
        ) : (
          <button
            type="button"
            onClick={rejoin}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
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
          onClick={() => navigate(productPath, { replace: true })}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
        >
          주문하기
        </button>
        <Link to={productPath} className="block text-sm text-slate-500 underline">
          상품으로 돌아가기
        </Link>
      </section>
    )
  }

  if (admitted && orderFailed) {
    return (
      <section className="space-y-4 py-10 text-center">
        <p className="font-medium text-slate-900">차례예요! 주문을 만들지 못했어요</p>
        <button
          type="button"
          onClick={order}
          disabled={buyNow.pending}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          다시 주문하기
        </button>
        <Link to={productPath} className="block text-sm text-slate-500 underline">
          상품으로 돌아가기
        </Link>
      </section>
    )
  }

  if (!status || admitted) {
    return (
      <section className="flex flex-col items-center gap-3 py-16 text-slate-500">
        <LoaderCircle className="size-8 animate-spin text-emerald-600" />
        <p className="font-medium text-slate-900">
          {admitted ? '차례예요! 결제 화면으로 가요' : '줄을 서고 있어요'}
        </p>
        {/* 같은 선착순 상품의 결제 대기 주문이 있으면 [이어서 결제하기]·[닫기]만 묻는다 */}
        {buyNow.pendingDialog && <PendingOrderDialog {...buyNow.pendingDialog} />}
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
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            다시 줄 서기
          </button>
        </div>
      )}

      <ul className="space-y-1 text-xs text-slate-500">
        <li>차례가 오면 바로 결제 화면으로 가요. 10분 안에 결제해 주세요.</li>
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
