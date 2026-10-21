import { http, HttpResponse } from 'msw'
import type {
  CustomerMe,
  NicknameAvailability,
  ProfileResponse,
  RegisterProfileRequest,
} from '@/auth/api'
import type { StoreSummary } from '@/customer/stores/api'

/** member-service 가짜 API (김경우): MB-01~03 회원, ST-01 점포 검색 */
// 가짜 로그인은 사용자 하나만 있으므로 프로필도 하나만 둔다. 처음 고객으로 들어오면 프로필 등록부터 한다
let myProfile: CustomerMe | null = null
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
  http.get('/api/members/me', () =>
    myProfile
      ? HttpResponse.json(myProfile)
      : HttpResponse.json(
          { code: 'MEMBER_PROFILE_NOT_FOUND', message: '회원 정보가 없습니다' },
          { status: 404 },
        ),
  ),
  http.post('/api/members/me', async ({ request }) => {
    const req = (await request.json()) as RegisterProfileRequest
    if (myProfile) return HttpResponse.json(myProfile)
    if (takenNicknames.includes(req.nickname.toLowerCase())) {
      return HttpResponse.json(
        { code: 'NICKNAME_DUPLICATED', message: '이미 사용 중인 닉네임입니다' },
        { status: 409 },
      )
    }
    myProfile = { memberId: 'mock-customer', role: 'CUSTOMER', ...req }
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
]
