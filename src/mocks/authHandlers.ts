import { http, HttpResponse } from 'msw'
import type { AuthUserResponse, ConfirmRequest, LoginRequest } from '@/shared/auth'

/**
 * C-01·C-02 gateway BFF(/api/auth/*) 가짜 API. 개발 서버의 가짜 로그인이 이것을 쓴다.
 * 이메일이 admin 으로 시작하면 관리자, owner 면 점주(storeId "1"), google 이면 가짜 구글 고객,
 * dup 이면 이메일 가입자 막기 확인용 고객, 나머지는 고객. 비밀번호는 보지 않는다.
 */
const SESSION_KEY = 'freshlink.mockSession'

function errorBody(code: string, message: string) {
  return { code, message, traceId: null }
}

/** 이메일 → 가짜 사용자 */
function mockUserFor(email: string): AuthUserResponse {
  if (email.startsWith('admin'))
    return { userId: 'mock-admin', role: 'ADMIN', storeId: null, email }
  if (email.startsWith('owner')) return { userId: 'mock-owner', role: 'OWNER', storeId: '1', email }
  if (email.startsWith('google'))
    return { userId: 'mock-google', role: 'CUSTOMER', storeId: null, email }
  if (email.startsWith('dup')) return { userId: 'mock-dup', role: 'CUSTOMER', storeId: null, email }
  return { userId: 'mock-customer', role: 'CUSTOMER', storeId: null, email }
}

function isAuthUserResponse(v: unknown): v is AuthUserResponse {
  return (
    typeof v === 'object' &&
    v !== null &&
    'userId' in v &&
    typeof v.userId === 'string' &&
    'role' in v &&
    typeof v.role === 'string'
  )
}

/** 지금 가짜 세션 사용자 (가짜 쿠키 대신 localStorage 에 둔다. MSW 한정) */
export function mockSessionUser(): AuthUserResponse | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isAuthUserResponse(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveSession(user: AuthUserResponse) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } catch {
    // 저장소를 못 쓰면 새로 고침 뒤 로그인이 풀린다 (가짜 모드 한정)
  }
}

/** 테스트용: 가짜 세션을 지운다 */
export function resetMockSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // 무시
  }
}

const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/** 실서버 gateway 와 같게 POST·PUT·PATCH·DELETE 에 CSRF 헤더가 없으면 403. 아니면 다음 핸들러로 넘긴다 */
export const csrfGuard = http.all('/api/*', ({ request }) => {
  if (!UNSAFE_METHODS.includes(request.method)) return
  if (request.headers.get('X-Requested-With') === 'freshlink') return
  return HttpResponse.json(errorBody('CSRF_HEADER_REQUIRED', '요청 헤더가 올바르지 않습니다'), {
    status: 403,
  })
})

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const req = (await request.json()) as Partial<LoginRequest>
    const email = req.email?.trim() ?? ''
    if (!email) {
      return HttpResponse.json(errorBody('INVALID_REQUEST', '요청 값이 올바르지 않습니다'), {
        status: 400,
      })
    }
    const user = mockUserFor(email)
    saveSession(user)
    return HttpResponse.json(user)
  }),
  http.post('/api/auth/signup', () => new HttpResponse(null, { status: 201 })),
  http.post('/api/auth/confirm', async ({ request }) => {
    const req = (await request.json()) as Partial<ConfirmRequest>
    if (req.code === '000000') {
      return HttpResponse.json(errorBody('CODE_MISMATCH', '인증 코드가 맞지 않습니다'), {
        status: 400,
      })
    }
    return new HttpResponse(null, { status: 204 })
  }),
  http.post('/api/auth/refresh', () => {
    const user = mockSessionUser()
    return user
      ? HttpResponse.json(user)
      : HttpResponse.json(errorBody('SESSION_EXPIRED', '다시 로그인해 주세요'), { status: 401 })
  }),
  http.post('/api/auth/logout', () => {
    resetMockSession()
    return new HttpResponse(null, { status: 204 })
  }),
  http.get('/api/auth/me', () => {
    const user = mockSessionUser()
    return user
      ? HttpResponse.json(user)
      : HttpResponse.json(errorBody('UNAUTHORIZED', '로그인이 필요합니다'), { status: 401 })
  }),
]
