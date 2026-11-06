import type { RegionCode } from '@/auth/regions'
import type { UpdateProfileRequest } from './api'

/** 지금 저장된 회원정보 (MB-03 고객 응답의 고칠 수 있는 칸) */
export interface EditableProfile {
  name: string
  nickname: string
  region: RegionCode
}

/** 수정 폼 입력 (검사 전 값) */
export interface ProfileInput {
  name: string
  nickname: string
  region: string
}

/** 닉네임 비교값: 앞뒤 공백 제거 + 영문 소문자 (member-service 와 같다) */
export function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase()
}

/**
 * MB-04 로 보낼 바뀐 칸만 고른다. 이름·닉네임은 앞뒤 공백을 지운 값으로 비교한다.
 * 아무것도 안 바뀌었으면 빈 객체
 */
export function profileChanges(
  current: EditableProfile,
  input: ProfileInput,
): UpdateProfileRequest {
  const changes: UpdateProfileRequest = {}
  const name = input.name.trim()
  const nickname = input.nickname.trim()
  if (name !== current.name) changes.name = name
  if (nickname !== current.nickname) changes.nickname = nickname
  if (input.region !== current.region) changes.region = input.region as RegionCode
  return changes
}

export function hasChanges(changes: UpdateProfileRequest): boolean {
  return Object.keys(changes).length > 0
}

/**
 * 저장 전에 MB-01 닉네임 중복 확인이 필요한지. 대소문자만 바꾼 내 닉네임은 MB-01 이 '사용 중'으로 답하므로 부르지 않는다
 * (서버 MB-04 는 내 닉네임을 중복에서 뺀다)
 */
export function needsNicknameCheck(
  current: EditableProfile,
  changes: UpdateProfileRequest,
): boolean {
  return (
    changes.nickname !== undefined &&
    normalizeNickname(changes.nickname) !== normalizeNickname(current.nickname)
  )
}
