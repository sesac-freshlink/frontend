import type { FieldErrors, FieldValues, Path, UseFormRegister } from 'react-hook-form'
import { REGIONS } from '../regions'
import { describedBy, inputClass } from './fieldStyles'
import { FormField } from './FormField'

interface ProfileFieldValues extends FieldValues {
  name: string
  nickname: string
  region: string
}

interface Props<T extends ProfileFieldValues> {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  /** 닉네임 칸 옆 [중복 확인] 버튼 */
  onCheckNickname?: () => void
  checkingNickname?: boolean
  nicknameHint?: string
}

/** 가입 화면과 프로필 등록 마무리 화면이 함께 쓰는 이름·닉네임·거주 지역 칸 */
export function ProfileFields<T extends ProfileFieldValues>({
  register,
  errors,
  onCheckNickname,
  checkingNickname,
  nicknameHint,
}: Props<T>) {
  const message = (field: string) => {
    const e = errors[field]
    return typeof e?.message === 'string' ? e.message : undefined
  }

  return (
    <>
      <FormField id="profile-name" label="이름" error={message('name')}>
        <input
          id="profile-name"
          aria-describedby={describedBy('profile-name')}
          {...register('name' as Path<T>)}
          autoComplete="name"
          className={inputClass}
        />
      </FormField>
      <FormField
        id="profile-nickname"
        label="닉네임"
        error={message('nickname')}
        hint={nicknameHint ?? '2~10자 한글·영문·숫자'}
      >
        <div className="flex gap-2">
          <input
            id="profile-nickname"
            aria-describedby={describedBy('profile-nickname')}
            {...register('nickname' as Path<T>)}
            className={inputClass}
          />
          {onCheckNickname && (
            <button
              type="button"
              onClick={onCheckNickname}
              disabled={checkingNickname}
              className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 disabled:opacity-50"
            >
              중복 확인
            </button>
          )}
        </div>
      </FormField>
      <FormField id="profile-region" label="거주 지역" error={message('region')}>
        <select
          id="profile-region"
          aria-describedby={describedBy('profile-region')}
          {...register('region' as Path<T>)}
          className={inputClass}
        >
          {/* 기본으로 고른 지역이 없어야 한다 (필수 선택) */}
          <option value="">시·도를 고르세요</option>
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </FormField>
    </>
  )
}
