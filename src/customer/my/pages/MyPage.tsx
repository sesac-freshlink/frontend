import { ChevronRight, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useMyProfile } from '@/auth/api'
import { TermsDialog } from '@/auth/components/TermsDialog'
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '@/auth/terms'
import { REGIONS } from '@/auth/regions'
import { useAuthStore } from '@/shared/auth'
import { cn } from '@/shared/ui/cn'

function regionName(code: string): string {
  return REGIONS.find((r) => r.code === code)?.name ?? code
}

const rowClass = 'flex items-center justify-between px-4 py-3 text-sm'

/**
 * /customer/my 마이페이지 (3차 할 일 김경우 "마이페이지"). 내 정보(MB-03 + 로그인 이메일)와
 * 회원정보 수정·비밀번호 변경(준비 중)·주문 내역·이용약관(A16, 전문 보기 창)·로그아웃 메뉴
 */
export function MyPage() {
  const email = useAuthStore((s) => s.user?.email)
  const signOut = useAuthStore((s) => s.signOut)
  const profile = useMyProfile()
  const [termsOpen, setTermsOpen] = useState(false)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">마이페이지</h1>

      <section aria-labelledby="my-info" className="space-y-2">
        <h2 id="my-info" className="text-sm font-medium text-slate-500">
          내 정보
        </h2>
        {profile.isPending && (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="size-4 animate-spin" />내 정보를 불러오는 중이에요
          </p>
        )}
        {profile.isError && (
          <p role="alert" className="text-sm text-red-600">
            내 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
          </p>
        )}
        {profile.isSuccess && (profile.data === null || profile.data.role !== 'CUSTOMER') && (
          <p className="text-sm text-slate-500">등록된 회원정보가 없어요.</p>
        )}
        {profile.data?.role === 'CUSTOMER' && (
          <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            <div className={rowClass}>
              <dt className="text-slate-500">이메일</dt>
              <dd className="text-slate-900">{email ?? '-'}</dd>
            </div>
            <div className={rowClass}>
              <dt className="text-slate-500">이름</dt>
              <dd className="text-slate-900">{profile.data.name}</dd>
            </div>
            <div className={rowClass}>
              <dt className="text-slate-500">닉네임</dt>
              <dd className="text-slate-900">{profile.data.nickname}</dd>
            </div>
            <div className={rowClass}>
              <dt className="text-slate-500">거주 지역</dt>
              <dd className="text-slate-900">{regionName(profile.data.region)}</dd>
            </div>
          </dl>
        )}
      </section>

      <nav aria-label="마이페이지 메뉴">
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          <li>
            <Link to="/customer/my/profile" className={rowClass}>
              <span className="text-slate-900">회원정보 수정</span>
              <ChevronRight className="size-4 text-slate-400" />
            </Link>
          </li>
          <li>
            <span aria-disabled="true" className={rowClass}>
              <span className="text-slate-400">비밀번호 변경</span>
              <span className="text-xs text-slate-400">준비 중</span>
            </span>
          </li>
          <li>
            <Link to="/customer/orders" className={rowClass}>
              <span className="text-slate-900">주문 내역</span>
              <ChevronRight className="size-4 text-slate-400" />
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className={cn(rowClass, 'w-full')}
            >
              <span className="text-slate-900">이용약관</span>
              <ChevronRight className="size-4 text-slate-400" />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => void signOut()} className={cn(rowClass, 'w-full')}>
              <span className="text-slate-900">로그아웃</span>
            </button>
          </li>
        </ul>
      </nav>
      {termsOpen && (
        <TermsDialog
          documents={[TERMS_OF_SERVICE, PRIVACY_POLICY]}
          onClose={() => setTermsOpen(false)}
        />
      )}
    </div>
  )
}
