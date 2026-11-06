import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { apiErrorCode, useCheckNickname } from '@/auth/api'
import { FieldError, NICKNAME_TAKEN } from '@/auth/useSignupFlow'
import { useUpdateProfile } from './api'
import {
  type EditableProfile,
  hasChanges,
  needsNicknameCheck,
  type ProfileInput,
  profileChanges,
} from './profileChanges'

export interface UseProfileEditReturn {
  /**
   * 바뀐 칸만 MB-04 로 저장한다. 닉네임을 바꿨으면 먼저 MB-01 로 확인한다(가입 화면과 같다).
   * 닉네임이 이미 쓰이면 FieldError('nickname'), 그 밖의 실패는 Error 를 던진다. 성공하면 마이페이지로 간다
   */
  save(current: EditableProfile, input: ProfileInput): Promise<void>
}

/** MB-04 회원정보 수정 화면의 저장 동작 (추가 명세 A3) */
export function useProfileEdit(): UseProfileEditReturn {
  const navigate = useNavigate()
  const checkNickname = useCheckNickname()
  const updateProfile = useUpdateProfile()

  return {
    async save(current, input) {
      const changes = profileChanges(current, input)
      if (!hasChanges(changes)) return
      if (needsNicknameCheck(current, changes) && changes.nickname !== undefined) {
        const availability = await checkNickname
          .mutateAsync(changes.nickname)
          .catch((e: unknown) => {
            throw new Error('닉네임을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.', { cause: e })
          })
        if (!availability.available) throw new FieldError('nickname', NICKNAME_TAKEN)
      }
      try {
        await updateProfile.mutateAsync(changes)
      } catch (e) {
        if (apiErrorCode(e) === 'NICKNAME_DUPLICATED')
          throw new FieldError('nickname', NICKNAME_TAKEN)
        throw new Error('회원정보를 저장하지 못했어요. 다시 시도해 주세요.', { cause: e })
      }
      toast.success('회원정보를 저장했어요')
      navigate('/customer/my')
    },
  }
}
