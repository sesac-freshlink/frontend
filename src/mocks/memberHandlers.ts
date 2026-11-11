import { http, HttpResponse } from 'msw'
import type {
  CustomerMe,
  NicknameAvailability,
  ProfileResponse,
  RegisterProfileRequest,
} from '@/auth/api'
import type { UpdateProfileRequest } from '@/customer/my/api'
import type { HomeBanner } from '@/customer/banners/api'
import type { StoreDetail, StoreSummary } from '@/customer/stores/api'
import { findActiveStore } from './adminHandlers'
import { mockSessionUser, resetMockSession } from './authHandlers'
import { activeMockOrderCount } from './orderHandlers'

/** member-service 가짜 API (김경우): MB-01~04 회원, ST-01 점포 검색, 점포 상세 */
// 프로필은 가짜 세션 사용자(userId)마다 따로 둔다. 처음 고객으로 들어오면 프로필 등록부터 한다
const profiles = new Map<string, CustomerMe>()
const sessionUserId = () => mockSessionUser()?.userId ?? 'mock-customer'
const takenNicknames = ['fresh01', 'admin']

const stores: StoreSummary[] = [
  {
    storeId: 1,
    storeCode: 'S1',
    name: '프레시 강남점',
    address: '서울 강남구 테헤란로 1',
    region: 'SEOUL',
  },
  {
    storeId: 2,
    storeCode: 'S2',
    name: '프레시 역삼점',
    address: '서울 강남구 역삼로 2',
    region: 'SEOUL',
  },
  {
    storeId: 3,
    storeCode: 'S3',
    name: '프레시 해운대점',
    address: '부산 해운대구 해운대로 3',
    region: 'BUSAN',
  },
]

/** 홈 메인 배너 가짜 데이터. 미확정(member 배너 V6 전). 첫 장은 공지로 이어진다 */
const homeBanners: HomeBanner[] = [
  { bannerId: 1, title: '오늘 밤 마감세일 30% 할인', imageUrl: '/mock-banner-1.svg', noticeId: 1 },
  {
    bannerId: 2,
    title: '픽업 신청하고 기다리지 말고 가져가세요',
    imageUrl: '/mock-banner-2.svg',
    noticeId: null,
  },
]

export const memberHandlers = [
  http.get('/api/members/nickname-availability', ({ request }) => {
    const nickname = new URL(request.url).searchParams.get('nickname') ?? ''
    const body: NicknameAvailability = {
      nickname,
      available: !takenNicknames.includes(nickname.trim().toLowerCase()),
    }
    return HttpResponse.json(body)
  }),
  http.get('/api/members/me', () => {
    const myProfile = profiles.get(sessionUserId())
    return myProfile
      ? HttpResponse.json(myProfile)
      : HttpResponse.json(
          { code: 'MEMBER_PROFILE_NOT_FOUND', message: '회원 정보가 없습니다' },
          { status: 404 },
        )
  }),
  http.post('/api/members/me', async ({ request }) => {
    const req = (await request.json()) as RegisterProfileRequest
    // 필수 약관 두 개 (추가 명세 A16)
    if (req.termsAgreed !== true || req.privacyAgreed !== true) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'requiredAgreed: 필수 약관에 동의해 주세요',
          traceId: null,
        },
        { status: 400 },
      )
    }
    // 같은 이메일로 이메일 가입한 사람이 구글로 처음 들어온 경우를 흉내 낸다 (세션 이메일이 dup 으로 시작)
    if (mockSessionUser()?.email?.startsWith('dup')) {
      return HttpResponse.json(
        {
          code: 'EMAIL_SIGNUP_EXISTS',
          message: '이미 이메일로 가입한 계정이 있습니다. 이메일로 로그인해 주세요',
          traceId: null,
        },
        { status: 409 },
      )
    }
    const memberId = sessionUserId()
    const existing = profiles.get(memberId)
    if (existing) return HttpResponse.json(existing)
    if (takenNicknames.includes(req.nickname.toLowerCase())) {
      return HttpResponse.json(
        { code: 'NICKNAME_DUPLICATED', message: '이미 사용 중인 닉네임입니다' },
        { status: 409 },
      )
    }
    const myProfile: CustomerMe = {
      memberId,
      role: 'CUSTOMER',
      name: req.name,
      nickname: req.nickname,
      region: req.region,
    }
    profiles.set(memberId, myProfile)
    const body: ProfileResponse = { ...myProfile, createdAt: new Date().toISOString() }
    return HttpResponse.json(body, { status: 201 })
  }),
  // MB-04: 보낸 칸만 바꾼다. 한 칸도 없으면 400, 다른 사람 닉네임이면 409 (내 닉네임은 대소문자만 바꿔도 된다)
  // MB-05 고객 회원탈퇴 (추가 명세 A6). 가짜 주문에 진행 중 주문이 있으면 409 (가짜 주문은 고객 한 명 것이다).
  // 이메일이 bye 로 시작하는 가짜 고객은 진행 중 주문이 없는 것으로 보고 탈퇴를 끝까지 해 볼 수 있다
  http.delete('/api/members/me', () => {
    const memberId = sessionUserId()
    if (!profiles.has(memberId)) {
      return HttpResponse.json(
        { code: 'MEMBER_PROFILE_NOT_FOUND', message: '회원 정보가 없습니다' },
        { status: 404 },
      )
    }
    if (!mockSessionUser()?.email?.startsWith('bye') && activeMockOrderCount() > 0) {
      return HttpResponse.json(
        {
          code: 'WITHDRAWAL_BLOCKED_ACTIVE_ORDER',
          message: '진행 중인 주문이 있어 탈퇴할 수 없습니다. 주문이 끝난 뒤 다시 시도해 주세요',
        },
        { status: 409 },
      )
    }
    profiles.delete(memberId)
    resetMockSession()
    return new HttpResponse(null, { status: 204 })
  }),
  http.patch('/api/members/me', async ({ request }) => {
    const memberId = sessionUserId()
    const existing = profiles.get(memberId)
    if (!existing) {
      return HttpResponse.json(
        { code: 'MEMBER_PROFILE_NOT_FOUND', message: '회원 정보가 없습니다' },
        { status: 404 },
      )
    }
    const req = (await request.json()) as UpdateProfileRequest
    if (req.name === undefined && req.nickname === undefined && req.region === undefined) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'anyFieldPresent: 이름·닉네임·지역 중 하나 이상 보내야 합니다',
        },
        { status: 400 },
      )
    }
    const nickname = req.nickname?.trim().toLowerCase()
    const mine = existing.nickname.toLowerCase()
    if (nickname !== undefined && nickname !== mine && takenNicknames.includes(nickname)) {
      return HttpResponse.json(
        { code: 'NICKNAME_DUPLICATED', message: '이미 사용 중인 닉네임입니다' },
        { status: 409 },
      )
    }
    const updated: CustomerMe = {
      ...existing,
      ...(req.name !== undefined && { name: req.name.trim() }),
      ...(req.nickname !== undefined && { nickname: req.nickname.trim() }),
      ...(req.region !== undefined && { region: req.region }),
    }
    profiles.set(memberId, updated)
    const body: ProfileResponse = { ...updated, createdAt: new Date().toISOString() }
    return HttpResponse.json(body)
  }),
  http.get('/api/stores', ({ request }) => {
    const q = new URL(request.url).searchParams
    const region = q.get('region') ?? 'SEOUL'
    const keyword = (q.get('keyword') ?? '').trim()
    // 11/10부터 서버처럼 목록 한 줄에 좌표를 같이 준다(관리자가 안 넣었으면 null)
    return HttpResponse.json(
      stores
        .filter(
          (s) =>
            s.region === region &&
            (!keyword || s.name.includes(keyword) || s.address.includes(keyword)),
        )
        .map((s) => {
          const found = findActiveStore(s.storeId)
          return { ...s, latitude: found?.latitude ?? null, longitude: found?.longitude ?? null }
        }),
    )
  }),
  // 홈 메인 배너. 미확정(member 배너 V6 전): 가짜 API 모드 확인용 2장
  http.get('/api/members/banners', () => HttpResponse.json(homeBanners)),
  http.get('/api/stores/:storeId', ({ params }) => {
    const found = findActiveStore(Number(params.storeId))
    if (!found) {
      return HttpResponse.json(
        { code: 'STORE_NOT_FOUND', message: '점포가 없습니다', traceId: 'mock' },
        { status: 404 },
      )
    }
    const body: StoreDetail = {
      storeId: found.storeId,
      storeCode: found.storeCode,
      name: found.name,
      address: found.address,
      region: found.region,
      latitude: found.latitude,
      longitude: found.longitude,
      description: found.description,
      imageUrl: found.imageUrl,
    }
    return HttpResponse.json(body)
  }),
]
