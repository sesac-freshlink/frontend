import { http, HttpResponse } from 'msw'
import type {
  CustomerMe,
  NicknameAvailability,
  ProfileResponse,
  RegisterProfileRequest,
} from '@/auth/api'
import type { StoreDetail, StoreSummary } from '@/customer/stores/api'
import { findActiveStore } from './adminHandlers'
import { mockSessionUser } from './authHandlers'

/** member-service 가짜 API (김경우): MB-01~03 회원, ST-01 점포 검색, 점포 상세 */
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
    const myProfile: CustomerMe = { memberId, role: 'CUSTOMER', ...req }
    profiles.set(memberId, myProfile)
    const body: ProfileResponse = { ...myProfile, createdAt: new Date().toISOString() }
    return HttpResponse.json(body, { status: 201 })
  }),
  http.get('/api/stores', ({ request }) => {
    const q = new URL(request.url).searchParams
    const region = q.get('region') ?? 'SEOUL'
    const keyword = (q.get('keyword') ?? '').trim()
    return HttpResponse.json(
      stores.filter(
        (s) =>
          s.region === region &&
          (!keyword || s.name.includes(keyword) || s.address.includes(keyword)),
      ),
    )
  }),
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
