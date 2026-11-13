import { describe, expect, it } from 'vitest'
import { bannerDefaults, bannerSchema, toBannerRequest, toOffset } from './bannerForm'
import { type AdminBanner, bannerHomeStatus, formatPeriod, moveBanner } from './banners'

const b = (id: number, over: Partial<AdminBanner> = {}): AdminBanner => ({
  bannerId: id,
  title: 't',
  imageUrl: '/banners/guide.svg',
  noticeId: null,
  noticeTitle: null,
  sortOrder: id,
  visible: true,
  startsAt: null,
  endsAt: null,
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('배너 입력 규칙 (A18)', () => {
  const ok = { ...bannerDefaults(), title: '제목' }

  it('제목 1~50자, 그림은 고를 수 있는 4장, 기간은 비워도 되고 시작 < 끝', () => {
    expect(bannerSchema.safeParse(ok).success).toBe(true)
    expect(bannerSchema.safeParse({ ...ok, title: ' ' }).success).toBe(false)
    expect(bannerSchema.safeParse({ ...ok, title: '가'.repeat(51) }).success).toBe(false)
    expect(bannerSchema.safeParse({ ...ok, title: '가'.repeat(50) }).success).toBe(true)
    expect(bannerSchema.safeParse({ ...ok, imageUrl: 'https://evil.example/a.svg' }).success).toBe(
      false,
    )
    expect(
      bannerSchema.safeParse({ ...ok, startsAt: '2026-11-15T00:00', endsAt: '2026-11-15T00:00' })
        .success,
    ).toBe(false)
    expect(bannerSchema.safeParse({ ...ok, startsAt: '2026-11-15T00:00' }).success).toBe(true)
  })

  it('보낼 값: 공지 비면 null, 기간은 +09:00, 순서는 0~9999 안', () => {
    const parsed = bannerSchema.parse({ ...ok, noticeId: '4', endsAt: '2026-11-21T23:59' })
    expect(toBannerRequest(parsed, 12000)).toEqual({
      title: '제목',
      imageUrl: '/banners/clearance.svg',
      noticeId: 4,
      sortOrder: 9999,
      visible: true,
      startsAt: null,
      endsAt: '2026-11-21T23:59:00+09:00',
    })
    expect(toOffset('')).toBeNull()
  })

  it('수정 기본값은 +09:00 시각을 입력 칸 값으로 바꾼다', () => {
    expect(
      bannerDefaults(b(1, { startsAt: '2026-11-15T00:00:00+09:00', noticeId: 3 })),
    ).toMatchObject({
      startsAt: '2026-11-15T00:00',
      endsAt: '',
      noticeId: '3',
    })
  })
})

describe('배너 목록 안내', () => {
  it('보이기 켜짐 + 기간 안인 것 중 앞의 5장만 홈에 보인다', () => {
    const now = new Date('2026-11-11T12:00:00+09:00')
    const list = [
      b(1),
      b(2, { visible: false }),
      b(3, { startsAt: '2026-11-12T00:00:00+09:00' }),
      b(4, { endsAt: '2026-11-11T12:00:00+09:00' }),
      b(5),
      b(6),
      b(7),
      b(8),
      b(9),
    ]
    const s = bannerHomeStatus(list, now)
    expect([...s.values()]).toEqual([
      'SHOWING',
      'HIDDEN',
      'BEFORE',
      'ENDED',
      'SHOWING',
      'SHOWING',
      'SHOWING',
      'SHOWING',
      'OVER_LIMIT',
    ])
  })

  it('기간 한 줄과 순서 옮기기', () => {
    expect(formatPeriod(null, null)).toBe('제한 없음')
    expect(formatPeriod('2026-11-15T00:00:00+09:00', null)).toBe('11.15 00:00 ~ 계속')
    expect(formatPeriod(null, '2026-11-21T23:59:00+09:00')).toBe('바로 ~ 11.21 23:59')
    expect(moveBanner([1, 2, 3], 2, -1)).toEqual([1, 3, 2])
    expect(moveBanner([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
  })
})
