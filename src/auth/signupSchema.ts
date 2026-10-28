import { z } from 'zod'
import { REGION_CODES } from './regions'

/** Cognito 비밀번호 정책이 특수문자로 인정하는 문자 (공백 포함) */
const SPECIAL = /[$^*.[\]{}()?"!@#%&/\\,><':;|_~`=+\- ]/
/** 비밀번호에 넣을 수 있는 문자: 영문·숫자·위 특수문자 */
const PASSWORD_CHARS = /^[A-Za-z0-9$^*.[\]{}()?"!@#%&/\\,><':;|_~`=+\- ]+$/

const password = z
  .string()
  .min(8, '8자 이상 입력하세요')
  .regex(PASSWORD_CHARS, '영문·숫자·특수문자만 쓸 수 있어요')
  .regex(/[a-z]/, '소문자를 넣어 주세요')
  .regex(/[A-Z]/, '대문자를 넣어 주세요')
  .regex(/\d/, '숫자를 넣어 주세요')
  .regex(SPECIAL, '특수문자를 넣어 주세요')

/** member-service MB-02 규칙과 같다 (이름은 앞뒤 공백을 지운 뒤 검사) */
const profileFields = {
  name: z
    .string()
    .trim()
    .regex(/^[가-힣a-zA-Z ]{2,30}$/, '2~30자 한글·영문으로 입력하세요'),
  nickname: z.string().regex(/^[가-힣a-zA-Z0-9]{2,10}$/, '2~10자 한글·영문·숫자로 입력하세요'),
  region: z.enum(REGION_CODES, { error: '거주 지역을 고르세요' }),
}

/** C-01 가입 입력 (기능명세 M1 입력 규칙) */
export const signupSchema = z
  .object({
    email: z.email('이메일 형식이 아닙니다'),
    password,
    passwordConfirm: z.string(),
    ...profileFields,
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 같지 않아요',
  })

export type SignupForm = z.input<typeof signupSchema>
export type SignupValues = z.output<typeof signupSchema>

/** 로그인했는데 프로필이 없을 때 쓰는 프로필 등록 마무리 입력 */
export const profileSchema = z.object(profileFields)

export type ProfileForm = z.input<typeof profileSchema>
export type ProfileValues = z.output<typeof profileSchema>

export const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, '메일로 받은 6자리 숫자를 입력하세요'),
})

export type CodeForm = z.input<typeof codeSchema>
