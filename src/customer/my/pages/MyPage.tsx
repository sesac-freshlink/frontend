import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useMyProfile } from '@/auth/api'
import { TermsDialog } from '@/auth/components/TermsDialog'
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '@/auth/terms'
import { useCustomerOrders, type CustomerOrderTab } from '@/customer/order/api'
import { readFavoriteStores } from '@/customer/stores/favoriteStores'
import { EMPTY_PERIOD } from '@/shared/api/period'
import { useAuthStore } from '@/shared/auth'
import { cn } from '@/shared/ui/cn'

/** 메뉴 칸: 두 줄 글자 메뉴의 한 칸(누르는 높이 44px) */
const cellClass = 'flex min-h-11 items-center text-left text-base text-slate-900'

/**
 * /customer/my 마이페이지(11/12 경우 결정 시안: 인사 카드 + 숫자 3칸 + 두 줄 글자 메뉴 + 로그아웃).
 * 이름·이메일·지역 같은 내 정보는 보이지 않게 하고 "안녕하세요 닉네임님"만 보인다.
 * 숫자: 픽업 대기·픽업 완료는 주문 내역(OR-06) 구분별 전체 개수, 단골 점포는 이 기기·이 계정에 남긴 단골 수.
 * 비밀번호 변경은 비밀번호로 가입한 계정에만 보인다(구글 가입은 숨김, A4)
 */
export function MyPage() {
  const passwordLogin = useAuthStore((s) => s.user?.passwordLogin !== false)
  const signOut = useAuthStore((s) => s.signOut)
  const profile = useMyProfile()
  const nickname = profile.data?.role === 'CUSTOMER' ? profile.data.nickname : undefined
  const [termsOpen, setTermsOpen] = useState(false)
  const [favoriteCount] = useState(() => readFavoriteStores().length)

  return (
    <div className="-mx-4 -mt-4 space-y-0">
      <h1 className="sr-only">마이페이지</h1>
      <section aria-label="인사" className="px-4 pt-4">
        <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
          <span className="inline-block rounded border border-emerald-700 px-1.5 text-xs font-bold text-emerald-700">
            freshLink
          </span>
          <p className="mt-2 text-xl leading-snug font-extrabold text-slate-900">
            안녕하세요 {nickname ?? '고객'}님,
          </p>
          <p className="mt-1 text-sm text-slate-600">오늘도 신선하게 픽업해 보세요!</p>
        </div>
      </section>

      <nav aria-label="내 주문·단골 요약" className="px-4 pt-4">
        <ul className="grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200">
          <li>
            <CountLink to="/customer/orders?tab=PICKUP_WAITING" label="픽업 대기">
              <OrderCount tab="PICKUP_WAITING" />
            </CountLink>
          </li>
          <li>
            <CountLink to="/customer/orders?tab=PICKED_UP" label="픽업 완료">
              <OrderCount tab="PICKED_UP" />
            </CountLink>
          </li>
          <li>
            <CountLink to="/customer/stores?tab=favorite" label="단골 점포">
              {favoriteCount}
            </CountLink>
          </li>
        </ul>
      </nav>

      <MenuGroup title="내 정보">
        <Link to="/customer/my/profile" className={cellClass}>
          회원정보수정
        </Link>
        {passwordLogin && (
          <Link to="/customer/my/password" className={cellClass}>
            비밀번호변경
          </Link>
        )}
        <Link to="/customer/my/withdraw" className={cn(cellClass, 'text-slate-500')}>
          회원탈퇴
        </Link>
      </MenuGroup>
      <MenuGroup title="주문">
        <Link to="/customer/orders" className={cellClass}>
          구매내역
        </Link>
        <Link to="/customer/orders?tab=CANCELED" className={cellClass}>
          취소·환불
        </Link>
      </MenuGroup>
      <MenuGroup title="고객지원">
        <Link to="/customer/notices" className={cellClass}>
          공지사항
        </Link>
        <Link to="/customer/faq" className={cellClass}>
          자주 묻는 질문
        </Link>
        <button type="button" onClick={() => setTermsOpen(true)} className={cellClass}>
          이용약관
        </button>
      </MenuGroup>

      <div className="px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-11 w-full rounded-xl border border-slate-300 text-sm font-medium text-slate-700"
        >
          로그아웃
        </button>
      </div>
      {termsOpen && (
        <TermsDialog
          documents={[TERMS_OF_SERVICE, PRIVACY_POLICY]}
          onClose={() => setTermsOpen(false)}
        />
      )}
    </div>
  )
}

/** 숫자 칸 하나. 숫자는 검은색(강조색을 쓰지 않는다, 11/12) */
function CountLink({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-16 flex-col items-center justify-center py-3 text-center">
      <span className="text-lg font-bold text-slate-900 tabular-nums">{children}</span>
      <span className="text-xs text-slate-600">{label}</span>
    </Link>
  )
}

/** 주문 내역 구분별 전체 개수(OR-06 totalElements). 읽는 중·실패면 "-" */
function OrderCount({ tab }: { tab: CustomerOrderTab }) {
  const orders = useCustomerOrders({ tab, page: 0, size: 10, period: EMPTY_PERIOD })
  return <>{orders.data ? orders.data.totalElements : '-'}</>
}

/** 회색 띠 + 제목 + 두 줄 글자 메뉴 */
function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-4 border-t-8 border-slate-100 px-4 pt-3">
      <h2 className="text-sm font-semibold text-slate-600">{title}</h2>
      <div className="grid grid-cols-2 gap-x-3">{children}</div>
    </section>
  )
}
