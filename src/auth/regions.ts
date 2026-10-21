/** 시·도 코드 17개 (member-service API 명세 0장). 가입 화면과 고객 홈 점포 검색이 함께 쓴다 */
export const REGIONS = [
  { code: 'SEOUL', name: '서울특별시' },
  { code: 'BUSAN', name: '부산광역시' },
  { code: 'DAEGU', name: '대구광역시' },
  { code: 'INCHEON', name: '인천광역시' },
  { code: 'GWANGJU', name: '광주광역시' },
  { code: 'DAEJEON', name: '대전광역시' },
  { code: 'ULSAN', name: '울산광역시' },
  { code: 'SEJONG', name: '세종특별자치시' },
  { code: 'GYEONGGI', name: '경기도' },
  { code: 'GANGWON', name: '강원특별자치도' },
  { code: 'CHUNGBUK', name: '충청북도' },
  { code: 'CHUNGNAM', name: '충청남도' },
  { code: 'JEONBUK', name: '전북특별자치도' },
  { code: 'JEONNAM', name: '전라남도' },
  { code: 'GYEONGBUK', name: '경상북도' },
  { code: 'GYEONGNAM', name: '경상남도' },
  { code: 'JEJU', name: '제주특별자치도' },
] as const

export type RegionCode = (typeof REGIONS)[number]['code']

export const REGION_CODES = REGIONS.map((r) => r.code) as [RegionCode, ...RegionCode[]]

/** 지역을 모를 때(로그인 전, 프로필 없음) 기본값. ST-01도 region 이 없으면 SEOUL 로 찾는다 */
export const DEFAULT_REGION: RegionCode = 'SEOUL'

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && (REGION_CODES as readonly string[]).includes(value)
}
