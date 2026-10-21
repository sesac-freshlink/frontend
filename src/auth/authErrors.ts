/**
 * Cognito(Amplify) 오류를 화면 문구로 바꾼다. Amplify 오류는 name 에 Cognito 예외 이름이 들어 있다.
 * 문구는 member-service 기능명세 M1·M2 를 따른다.
 */
function errorName(e: unknown): string | undefined {
  return e instanceof Error ? e.name : undefined
}

export const EMAIL_TAKEN_MESSAGE =
  '이미 등록되었거나 가입이 진행 중인 이메일입니다. 로그인하거나 테스트 담당자에게 문의해 주세요.'

export function signUpErrorMessage(e: unknown): string {
  switch (errorName(e)) {
    case 'UsernameExistsException':
    case 'AliasExistsException':
      return EMAIL_TAKEN_MESSAGE
    case 'InvalidPasswordException':
      return '비밀번호 규칙을 확인해 주세요.'
    case 'CodeMismatchException':
      return '인증 코드가 맞지 않아요.'
    case 'ExpiredCodeException':
      return '인증 코드가 만료됐어요. 테스트 담당자에게 문의해 주세요.'
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.'
    default:
      return '가입에 실패했어요. 잠시 뒤 다시 시도해 주세요.'
  }
}

export function signInErrorMessage(e: unknown): string {
  switch (errorName(e)) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return '이메일 또는 비밀번호를 확인해 주세요.'
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return '요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.'
    default:
      // 역할이 없는 계정 같은 안내는 로그인 클라이언트가 만든 문구를 그대로 쓴다
      return e instanceof Error && e.message ? e.message : '로그인에 실패했어요.'
  }
}

/** 가입은 했지만 이메일 인증을 안 한 계정으로 로그인했는지 */
export function isUnconfirmedSignIn(e: unknown): boolean {
  if (errorName(e) === 'UserNotConfirmedException') return true
  return e instanceof Error && e.message.includes('CONFIRM_SIGN_UP')
}
