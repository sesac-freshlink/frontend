import { http, HttpResponse } from 'msw'
import type {
  Audience,
  BoardPage,
  FaqItem,
  FaqRequest,
  NoticeDetail,
  NoticeRequest,
  NoticeSummary,
} from '@/board/api'
import type { AdminBanner, BannerRequest } from '@/board/banners'
import type { HomeBanner } from '@/customer/banners/api'
import { mockSessionUser } from './authHandlers'

/** member-service 가짜 API (김경우): 게시판 BD-01~03, 관리자 공지·FAQ (추가 명세 A17), 메인배너 BN-01·AD-13~17 (A18) */
const PAGE_SIZE = 20

const seedNotices: NoticeDetail[] = [
  {
    noticeId: 1,
    title: '프레시링크 서비스를 시작했어요',
    content:
      '유통기한이 가까운 상품을 가까운 점포에서 싸게 사서 픽업할 수 있어요.\n앱을 써 보시고 불편한 점은 자주 묻는 질문을 먼저 봐 주세요.',
    audience: 'ALL',
    pinned: true,
    createdAt: '2026-11-01T09:00:00+09:00',
    updatedAt: '2026-11-01T09:00:00+09:00',
  },
  {
    noticeId: 2,
    title: '픽업 QR로 더 빠르게 받아 가세요',
    content: '주문 내역에서 [픽업 QR 보여 주기]를 누르고 점포 스캐너에 비춰 주세요.',
    audience: 'CUSTOMER',
    pinned: false,
    createdAt: '2026-11-04T10:00:00+09:00',
    updatedAt: '2026-11-04T10:00:00+09:00',
  },
  {
    noticeId: 3,
    title: '점주 화면에 내 점포 메뉴가 생겼어요',
    content: '점포 설명과 사진을 직접 고칠 수 있어요.',
    audience: 'OWNER',
    pinned: false,
    createdAt: '2026-11-05T14:00:00+09:00',
    updatedAt: '2026-11-05T14:00:00+09:00',
  },
]

const seedFaqs: FaqItem[] = [
  {
    faqId: 1,
    question: '산 상품은 언제까지 받아 가야 하나요?',
    answer: '결제한 날 점포 영업시간 안에 받아 가 주세요.',
    audience: 'CUSTOMER',
    sortOrder: 1,
  },
  {
    faqId: 2,
    question: '결제를 취소하고 싶어요',
    answer: '픽업 전이면 주문 상세에서 취소할 수 있어요.',
    audience: 'CUSTOMER',
    sortOrder: 2,
  },
  {
    faqId: 3,
    question: '폐기 등록은 어디서 하나요?',
    answer: '임박·폐기 메뉴에서 상품을 고르고 [폐기]를 누르세요.',
    audience: 'OWNER',
    sortOrder: 1,
  },
  {
    faqId: 4,
    question: '문의는 어디로 하나요?',
    answer: '고객센터 이메일 help@freshlink.test 로 보내 주세요.',
    audience: 'ALL',
    sortOrder: 9,
  },
]

const seedBanners: Omit<AdminBanner, 'noticeTitle'>[] = [
  {
    bannerId: 1,
    title: '마감세일, 오늘 23시 59분까지 픽업',
    imageUrl: '/banners/clearance.svg',
    noticeId: 1,
  },
  { bannerId: 2, title: '선착순 신상품', imageUrl: '/banners/first-come.svg', noticeId: null },
  {
    bannerId: 3,
    title: '픽업 신청 잊지 마세요',
    imageUrl: '/banners/pickup-request.svg',
    noticeId: 2,
  },
  { bannerId: 4, title: 'FreshLink 이용 안내', imageUrl: '/banners/guide.svg', noticeId: null },
].map((b, i) => ({
  ...b,
  sortOrder: i,
  visible: true,
  startsAt: null,
  endsAt: null,
  createdAt: '2026-11-11T09:00:00+09:00',
  updatedAt: '2026-11-11T09:00:00+09:00',
}))

let notices: NoticeDetail[] = []
let faqs: FaqItem[] = []
let banners: Omit<AdminBanner, 'noticeTitle'>[] = []
let nextNoticeId = 1
let nextFaqId = 1
let nextBannerId = 1

/** 테스트마다 처음 글로 되돌린다 */
export function resetMockBoard() {
  notices = seedNotices.map((n) => ({ ...n }))
  faqs = seedFaqs.map((f) => ({ ...f }))
  banners = seedBanners.map((b) => ({ ...b }))
  nextNoticeId = seedNotices.length + 1
  nextFaqId = seedFaqs.length + 1
  nextBannerId = seedBanners.length + 1
}
resetMockBoard()

const errorBody = (code: string, message: string) => ({ code, message, traceId: null })

/** 지금 사용자에게 보이는가 (모두 + 내 역할 대상). 관리자는 이 함수를 쓰지 않는다 */
function visible(audience: Audience): boolean {
  const role = mockSessionUser()?.role
  return audience === 'ALL' || audience === role
}

const noticeOrder = (a: NoticeDetail, b: NoticeDetail) =>
  Number(b.pinned) - Number(a.pinned) ||
  b.createdAt.localeCompare(a.createdAt) ||
  b.noticeId - a.noticeId

const faqOrder = (a: FaqItem, b: FaqItem) => a.sortOrder - b.sortOrder || a.faqId - b.faqId

function toSummary({ noticeId, title, audience, pinned, createdAt }: NoticeDetail): NoticeSummary {
  return { noticeId, title, audience, pinned, createdAt }
}

function pageOf(list: NoticeDetail[], url: string): BoardPage<NoticeSummary> {
  const page = Math.max(0, Number(new URL(url).searchParams.get('page') ?? 0) || 0)
  const sorted = [...list].sort(noticeOrder)
  return {
    content: sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(toSummary),
    page,
    size: PAGE_SIZE,
    totalElements: sorted.length,
    totalPages: Math.ceil(sorted.length / PAGE_SIZE),
  }
}

/** 고객·점주 화면이 아닌 사람(관리자, 로그아웃)은 403 */
function memberOnly() {
  const role = mockSessionUser()?.role
  return role === 'CUSTOMER' || role === 'OWNER'
    ? null
    : HttpResponse.json(errorBody('FORBIDDEN', '권한이 없습니다'), { status: 403 })
}

function adminOnly() {
  return mockSessionUser()?.role === 'ADMIN'
    ? null
    : HttpResponse.json(errorBody('FORBIDDEN', '권한이 없습니다'), { status: 403 })
}

function invalidNotice(req: NoticeRequest): boolean {
  const title = req.title?.trim() ?? ''
  const content = req.content?.trim() ?? ''
  return !title || title.length > 100 || !content || content.length > 5000 || !req.audience
}

function invalidFaq(req: FaqRequest): boolean {
  const question = req.question?.trim() ?? ''
  const answer = req.answer?.trim() ?? ''
  return (
    !question ||
    question.length > 200 ||
    !answer ||
    answer.length > 2000 ||
    !req.audience ||
    !Number.isInteger(req.sortOrder) ||
    req.sortOrder < 0 ||
    req.sortOrder > 9999
  )
}

const validation = () =>
  HttpResponse.json(errorBody('VALIDATION_ERROR', '입력값을 확인해 주세요'), { status: 400 })
const noticeNotFound = () =>
  HttpResponse.json(errorBody('NOTICE_NOT_FOUND', '공지사항이 없습니다'), { status: 404 })
const faqNotFound = () =>
  HttpResponse.json(errorBody('FAQ_NOT_FOUND', '질문이 없습니다'), {
    status: 404,
  })

/** 메인배너 (A18): 서버 BannerRequest·BannerService 와 같은 규칙 */
const BANNER_IMAGE = /^\/(images\/)?banners\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|webp|svg)$/
const HOME_LIMIT = 5

function invalidBanner(req: BannerRequest): boolean {
  const title = req.title?.trim() ?? ''
  return (
    !title ||
    title.length > 50 ||
    typeof req.imageUrl !== 'string' ||
    !BANNER_IMAGE.test(req.imageUrl) ||
    !Number.isInteger(req.sortOrder) ||
    req.sortOrder < 0 ||
    req.sortOrder > 9999 ||
    (req.noticeId !== null && (!Number.isInteger(req.noticeId) || req.noticeId < 1))
  )
}

const bannerOrder = (
  a: { sortOrder: number; bannerId: number },
  b: { sortOrder: number; bannerId: number },
) => a.sortOrder - b.sortOrder || a.bannerId - b.bannerId

function withNoticeTitle(b: Omit<AdminBanner, 'noticeTitle'>): AdminBanner {
  const notice = b.noticeId === null ? undefined : notices.find((n) => n.noticeId === b.noticeId)
  return { ...b, noticeTitle: notice?.title ?? null }
}

function showingNow(b: Omit<AdminBanner, 'noticeTitle'>, now: number): boolean {
  return (
    b.visible &&
    (b.startsAt === null || Date.parse(b.startsAt) <= now) &&
    (b.endsAt === null || Date.parse(b.endsAt) > now)
  )
}

/** 저장 전 확인: 기간 앞뒤, 연결할 공지 */
function bannerProblem(req: BannerRequest) {
  if (req.startsAt && req.endsAt && Date.parse(req.startsAt) >= Date.parse(req.endsAt)) {
    return HttpResponse.json(
      errorBody('BANNER_PERIOD_INVALID', '노출 시작은 끝보다 빨라야 합니다'),
      {
        status: 400,
      },
    )
  }
  if (req.noticeId !== null && !notices.some((n) => n.noticeId === req.noticeId))
    return noticeNotFound()
  return null
}

const bannerNotFound = () =>
  HttpResponse.json(errorBody('BANNER_NOT_FOUND', '배너가 없습니다'), { status: 404 })

function bannerFields(req: BannerRequest) {
  return {
    title: req.title.trim(),
    imageUrl: req.imageUrl,
    noticeId: req.noticeId,
    sortOrder: req.sortOrder,
    visible: req.visible !== false,
    startsAt: req.startsAt,
    endsAt: req.endsAt,
  }
}

export const boardHandlers = [
  // BD-01 공지 목록
  http.get('/api/members/notices', ({ request }) => {
    const denied = memberOnly()
    if (denied) return denied
    return HttpResponse.json(
      pageOf(
        notices.filter((n) => visible(n.audience)),
        request.url,
      ),
    )
  }),
  // BD-02 공지 상세 (내 대상이 아니면 없는 글과 같이 404)
  http.get('/api/members/notices/:id', ({ params }) => {
    const denied = memberOnly()
    if (denied) return denied
    const found = notices.find((n) => n.noticeId === Number(params.id))
    return found && visible(found.audience) ? HttpResponse.json(found) : noticeNotFound()
  }),
  // BD-03 FAQ 목록
  http.get('/api/members/faqs', () => {
    const denied = memberOnly()
    if (denied) return denied
    return HttpResponse.json(faqs.filter((f) => visible(f.audience)).sort(faqOrder))
  }),

  http.get(
    '/api/admin/notices',
    ({ request }) => adminOnly() ?? HttpResponse.json(pageOf(notices, request.url)),
  ),
  http.get('/api/admin/notices/:id', ({ params }) => {
    const denied = adminOnly()
    if (denied) return denied
    const found = notices.find((n) => n.noticeId === Number(params.id))
    return found ? HttpResponse.json(found) : noticeNotFound()
  }),
  http.post('/api/admin/notices', async ({ request }) => {
    const denied = adminOnly()
    if (denied) return denied
    const req = (await request.json()) as NoticeRequest
    if (invalidNotice(req)) return validation()
    const now = new Date().toISOString()
    const created: NoticeDetail = {
      noticeId: nextNoticeId++,
      title: req.title.trim(),
      content: req.content.trim(),
      audience: req.audience,
      pinned: req.pinned,
      createdAt: now,
      updatedAt: now,
    }
    notices.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
  http.put('/api/admin/notices/:id', async ({ params, request }) => {
    const denied = adminOnly()
    if (denied) return denied
    const found = notices.find((n) => n.noticeId === Number(params.id))
    if (!found) return noticeNotFound()
    const req = (await request.json()) as NoticeRequest
    if (invalidNotice(req)) return validation()
    Object.assign(found, {
      title: req.title.trim(),
      content: req.content.trim(),
      audience: req.audience,
      pinned: req.pinned,
      updatedAt: new Date().toISOString(),
    })
    return HttpResponse.json(found)
  }),
  http.delete('/api/admin/notices/:id', ({ params }) => {
    const denied = adminOnly()
    if (denied) return denied
    const before = notices.length
    notices = notices.filter((n) => n.noticeId !== Number(params.id))
    if (before === notices.length) return noticeNotFound()
    // 서버 외래 키 ON DELETE SET NULL 처럼 배너 연결만 끊는다 (A18)
    for (const b of banners) if (b.noticeId === Number(params.id)) b.noticeId = null
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/admin/faqs', () => adminOnly() ?? HttpResponse.json([...faqs].sort(faqOrder))),
  http.post('/api/admin/faqs', async ({ request }) => {
    const denied = adminOnly()
    if (denied) return denied
    const req = (await request.json()) as FaqRequest
    if (invalidFaq(req)) return validation()
    const created: FaqItem = {
      faqId: nextFaqId++,
      question: req.question.trim(),
      answer: req.answer.trim(),
      audience: req.audience,
      sortOrder: req.sortOrder,
    }
    faqs.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
  http.put('/api/admin/faqs/:id', async ({ params, request }) => {
    const denied = adminOnly()
    if (denied) return denied
    const found = faqs.find((f) => f.faqId === Number(params.id))
    if (!found) return faqNotFound()
    const req = (await request.json()) as FaqRequest
    if (invalidFaq(req)) return validation()
    Object.assign(found, {
      question: req.question.trim(),
      answer: req.answer.trim(),
      audience: req.audience,
      sortOrder: req.sortOrder,
    })
    return HttpResponse.json(found)
  }),
  http.delete('/api/admin/faqs/:id', ({ params }) => {
    const denied = adminOnly()
    if (denied) return denied
    const before = faqs.length
    faqs = faqs.filter((f) => f.faqId !== Number(params.id))
    return before === faqs.length ? faqNotFound() : new HttpResponse(null, { status: 204 })
  }),

  // BN-01 홈 배너: 고객만, 보이기 + 기간 안, 순서대로 5장
  http.get('/api/members/banners', () => {
    if (mockSessionUser()?.role !== 'CUSTOMER') {
      return HttpResponse.json(errorBody('FORBIDDEN', '권한이 없습니다'), { status: 403 })
    }
    const now = Date.now()
    const home: HomeBanner[] = banners
      .filter((b) => showingNow(b, now))
      .sort(bannerOrder)
      .slice(0, HOME_LIMIT)
      .map(({ bannerId, title, imageUrl, noticeId }) => ({ bannerId, title, imageUrl, noticeId }))
    return HttpResponse.json(home)
  }),
  // AD-13~17 관리자 배너
  http.get(
    '/api/admin/banners',
    () => adminOnly() ?? HttpResponse.json([...banners].sort(bannerOrder).map(withNoticeTitle)),
  ),
  http.post('/api/admin/banners', async ({ request }) => {
    const denied = adminOnly()
    if (denied) return denied
    const req = (await request.json()) as BannerRequest
    if (invalidBanner(req)) return validation()
    const problem = bannerProblem(req)
    if (problem) return problem
    const now = new Date().toISOString()
    const created = {
      bannerId: nextBannerId++,
      ...bannerFields(req),
      createdAt: now,
      updatedAt: now,
    }
    banners.push(created)
    return HttpResponse.json(withNoticeTitle(created), { status: 201 })
  }),
  // 순서 바꾸기는 :id 보다 먼저 둔다
  http.put('/api/admin/banners/order', async ({ request }) => {
    const denied = adminOnly()
    if (denied) return denied
    const { bannerIds } = (await request.json()) as { bannerIds?: number[] }
    if (!Array.isArray(bannerIds)) return validation()
    const current = new Set(banners.map((b) => b.bannerId))
    if (
      bannerIds.length !== banners.length ||
      new Set(bannerIds).size !== bannerIds.length ||
      !bannerIds.every((id) => current.has(id))
    ) {
      return HttpResponse.json(
        errorBody('BANNER_ORDER_INVALID', '지금 있는 배너를 모두 한 번씩 보내 주세요'),
        {
          status: 400,
        },
      )
    }
    bannerIds.forEach((id, i) => {
      const b = banners.find((x) => x.bannerId === id)
      if (b) b.sortOrder = i
    })
    return HttpResponse.json([...banners].sort(bannerOrder).map(withNoticeTitle))
  }),
  http.put('/api/admin/banners/:id', async ({ params, request }) => {
    const denied = adminOnly()
    if (denied) return denied
    const found = banners.find((b) => b.bannerId === Number(params.id))
    if (!found) return bannerNotFound()
    const req = (await request.json()) as BannerRequest
    if (invalidBanner(req)) return validation()
    const problem = bannerProblem(req)
    if (problem) return problem
    Object.assign(found, bannerFields(req), { updatedAt: new Date().toISOString() })
    return HttpResponse.json(withNoticeTitle(found))
  }),
  http.delete('/api/admin/banners/:id', ({ params }) => {
    const denied = adminOnly()
    if (denied) return denied
    const before = banners.length
    banners = banners.filter((b) => b.bannerId !== Number(params.id))
    return before === banners.length ? bannerNotFound() : new HttpResponse(null, { status: 204 })
  }),
]
