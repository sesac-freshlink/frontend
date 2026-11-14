/**
 * 회원가입 필수 약관 글과 버전 (추가 명세 A16, 11/6 경우 결정). 버전은 시행일이고 member-service 상수와 같다.
 * 글을 바꾸면 버전도 바꾸고 member-service MemberRules 의 버전도 같이 바꾼다
 */
export const TERMS_VERSION = '2026-11-06'
/** 11/14 3장 보관 기간 변경(주문·결제 기록 5년, 탈퇴 이력 5년). 다시 동의받지 않는다(11/6 결정). 서버 MemberRules 와 같은 값 */
export const PRIVACY_VERSION = '2026-11-14'

export interface TermsDocument {
  id: 'terms' | 'privacy'
  title: string
  /** 조항 하나가 한 덩어리. 첫 줄은 제목 */
  sections: { heading: string; lines: string[] }[]
  effectiveDate: string
}

export const TERMS_OF_SERVICE: TermsDocument = {
  id: 'terms',
  title: 'FreshLink 이용약관',
  effectiveDate: TERMS_VERSION,
  sections: [
    {
      heading: '제1조 (목적)',
      lines: [
        '이 약관은 FreshLink(이하 "서비스")가 제공하는 편의점 상품 예약·픽업 서비스의 이용 조건과 절차, 회원과 서비스의 권리·의무를 정합니다.',
      ],
    },
    {
      heading: '제2조 (회원 가입)',
      lines: [
        '이메일로 가입하거나 구글 계정으로 가입할 수 있습니다. 가입할 때 이 약관과 개인정보 처리방침에 동의해야 합니다.',
      ],
    },
    {
      heading: '제3조 (서비스 내용)',
      lines: [
        '1. 회원은 가까운 점포의 상품을 앱에서 주문·결제하고, 점포에서 직접 받아 갑니다(픽업).',
        '2. 선착순·마감세일 상품은 수량이 정해져 있어, 남은 수량이 없으면 주문할 수 없습니다.',
        '3. 결제는 토스페이먼츠를 통해 이루어집니다.',
      ],
    },
    {
      heading: '제4조 (픽업)',
      lines: [
        '회원은 점포가 "픽업 준비 완료"로 알린 뒤 정해진 기한 안에 받아 가야 합니다. 기한이 지난 주문의 처리는 서비스 안내를 따릅니다.',
      ],
    },
    {
      heading: '제5조 (주문 취소·환불)',
      lines: [
        '픽업 전 주문은 서비스 화면에서 취소할 수 있고, 결제 금액은 결제 수단으로 돌려드립니다. 이미 받아 간 상품은 취소할 수 없습니다.',
      ],
    },
    {
      heading: '제6조 (회원의 의무)',
      lines: [
        '회원은 다른 사람의 정보를 쓰거나, 서비스를 방해하거나, 주문 후 반복해서 받아 가지 않는 등의 행위를 해서는 안 됩니다.',
      ],
    },
    {
      heading: '제7조 (탈퇴)',
      lines: [
        '회원은 언제든지 탈퇴할 수 있습니다. 다만 진행 중인 주문(결제·픽업 전, 환불 처리 중)이 있으면 그 주문이 끝난 뒤 탈퇴할 수 있습니다.',
      ],
    },
    {
      heading: '제8조 (약관 변경)',
      lines: ['약관을 바꾸면 시행일과 함께 서비스 안에 알립니다.'],
    },
  ],
}

export const PRIVACY_POLICY: TermsDocument = {
  id: 'privacy',
  title: 'FreshLink 개인정보 처리방침',
  effectiveDate: PRIVACY_VERSION,
  sections: [
    {
      heading: '1. 모으는 정보',
      lines: [
        '이메일 가입: 이메일, 비밀번호(암호화되어 인증 시스템에만 저장, 서비스 DB에는 저장하지 않음), 이름, 닉네임, 거주 시·도',
        '구글 가입: 구글 계정 이메일, 이름, 닉네임, 거주 시·도',
        '서비스 이용 중: 주문·결제·픽업 기록, 약관 동의 버전과 시각',
      ],
    },
    {
      heading: '2. 쓰는 목적',
      lines: [
        '회원 확인과 로그인',
        '주문·결제·픽업·환불 처리',
        '지역에 맞는 점포 보여 주기',
        '주문 알림(픽업 준비 완료 등)',
      ],
    },
    {
      heading: '3. 보관 기간',
      lines: [
        '회원 정보: 탈퇴할 때까지',
        '탈퇴 뒤 프로필: 바로 지웁니다.',
        '주문·결제 기록: 탈퇴 뒤에도 이름을 "탈퇴 회원"으로 바꿔 5년 동안 보관합니다. 5년이 지나면 누구의 주문인지 알 수 없게 회원 번호를 지우고, 매출 통계로만 남깁니다.',
        '탈퇴 이력(이메일, 탈퇴 시각): 탈퇴한 분이 지난 결제 내역을 요청할 때 본인을 찾기 위해 5년 동안 보관한 뒤 지웁니다.',
      ],
    },
    {
      heading: '4. 맡기는 곳(처리 위탁)',
      lines: [
        'Amazon Web Services: 계정 인증(Amazon Cognito)과 서버·데이터 보관',
        '토스페이먼츠: 결제 처리',
        'Google: 구글 로그인(구글 가입 회원만)',
      ],
    },
    {
      heading: '5. 회원의 권리',
      lines: [
        '회원은 마이페이지에서 자기 정보를 보고 고칠 수 있고, 탈퇴로 정보 삭제를 요청할 수 있습니다.',
      ],
    },
    {
      heading: '6. 문의',
      lines: ['개인정보 담당: privacy@freshlink.test (시연용 가상 주소)'],
    },
  ],
}
