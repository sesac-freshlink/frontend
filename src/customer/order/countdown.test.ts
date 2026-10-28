import { describe, expect, it } from 'vitest'
import { clockOffsetMs, formatRemaining, remainingSeconds } from './countdown'

const SERVER_NOW = '2026-10-20T15:34:30+09:00'
const EXPIRES_AT = '2026-10-20T15:42:00+09:00'
const MIN = 60_000

describe('결제 남은 시간 (U-22)', () => {
  it('기기 시계가 맞으면 마감까지 그대로 센다', () => {
    const device = Date.parse(SERVER_NOW)
    const offset = clockOffsetMs(SERVER_NOW, device)
    expect(offset).toBe(0)
    expect(remainingSeconds(EXPIRES_AT, device, offset)).toBe(450)
  })

  it('기기 시계가 5분 느려도 서버 기준 7분 30초가 남는다', () => {
    const device = Date.parse(SERVER_NOW) - 5 * MIN
    const offset = clockOffsetMs(SERVER_NOW, device)
    expect(offset).toBe(5 * MIN)
    expect(remainingSeconds(EXPIRES_AT, device, offset)).toBe(450)
    // 기기 시계로 1분 지나면 서버 기준으로도 1분 줄어든다
    expect(remainingSeconds(EXPIRES_AT, device + MIN, offset)).toBe(390)
  })

  it('기기 시계가 5분 빨라도 서버 기준 7분 30초가 남는다', () => {
    const device = Date.parse(SERVER_NOW) + 5 * MIN
    const offset = clockOffsetMs(SERVER_NOW, device)
    expect(offset).toBe(-5 * MIN)
    expect(remainingSeconds(EXPIRES_AT, device, offset)).toBe(450)
  })

  it('마감이 지나면 0에서 멈춘다', () => {
    const device = Date.parse(SERVER_NOW)
    expect(remainingSeconds(EXPIRES_AT, device + 8 * MIN, 0)).toBe(0)
    expect(remainingSeconds(EXPIRES_AT, device + 60 * MIN, 0)).toBe(0)
  })

  it('1초가 안 남아도 0이 되기 전에는 1초로 보여 준다', () => {
    expect(remainingSeconds(EXPIRES_AT, Date.parse(EXPIRES_AT) - 400, 0)).toBe(1)
    expect(remainingSeconds(EXPIRES_AT, Date.parse(EXPIRES_AT), 0)).toBe(0)
  })

  it('"9분 12초 남음" 형식', () => {
    expect(formatRemaining(552)).toBe('9분 12초 남음')
    expect(formatRemaining(600)).toBe('10분 0초 남음')
    expect(formatRemaining(45)).toBe('45초 남음')
    expect(formatRemaining(0)).toBe('0초 남음')
  })
})
