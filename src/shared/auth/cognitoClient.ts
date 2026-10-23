import { Amplify } from 'aws-amplify'
import { confirmSignUp, fetchAuthSession, signIn, signOut, signUp } from 'aws-amplify/auth'
import { userFromClaims } from './claims'
import type { AuthClient, AuthUser } from './types'

/**
 * Amazon Cognito 사용자 풀로 로그인한다. 토큰 저장·갱신은 Amplify 가 localStorage 로 한다.
 */
export function createCognitoClient(userPoolId: string, userPoolClientId: string): AuthClient {
  Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } })

  async function currentUser(): Promise<AuthUser | null> {
    const { tokens } = await fetchAuthSession()
    return tokens?.idToken ? userFromClaims(tokens.idToken.payload) : null
  }

  return {
    async signIn(email, password) {
      const result = await signIn({ username: email, password })
      if (!result.isSignedIn) {
        throw new Error(`추가 단계가 필요합니다: ${result.nextStep.signInStep}`)
      }
      const user = await currentUser()
      if (!user) throw new Error('계정에 역할(OWNER/CUSTOMER/ADMIN)이 지정되지 않았습니다')
      return user
    },
    async signUp({ email, password, role }) {
      // Cognito 에는 계정(이메일)만 둔다. 이름은 가입 뒤 member-service(POST /members/me)에 저장한다
      // 역할은 Cognito 그룹이라 클라이언트가 직접 넣을 수 없어 clientMetadata 로 넘긴다
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email }, clientMetadata: { role } },
      })
    },
    async confirmSignUp(email, code, role) {
      // 가입 후(Post confirmation) Lambda 는 confirmSignUp 의 clientMetadata 만 받으므로 역할을 다시 넘긴다
      await confirmSignUp({
        username: email,
        confirmationCode: code,
        options: { clientMetadata: { role } },
      })
    },
    async signOut() {
      await signOut()
    },
    async restore() {
      try {
        return await currentUser()
      } catch {
        return null
      }
    },
    async getToken() {
      // gateway 가 점포 ID(custom:storeId)와 그룹을 함께 보려면 ID 토큰이 필요하다
      const { tokens } = await fetchAuthSession()
      return tokens?.idToken?.toString() ?? null
    },
  }
}
