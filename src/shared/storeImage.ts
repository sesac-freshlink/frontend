/**
 * 점포 이미지 형식 (관리자 점포 수정 A-02, 점주 내 점포 A15 공통).
 * 고른 파일 형식을 업로드 주소 요청에 보내면 서버가 .jpg·.png 키로 그 Content-Type 을 서명한다
 */
export const STORE_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const
export type StoreImageType = (typeof STORE_IMAGE_TYPES)[number]

export function isStoreImageType(type: string): type is StoreImageType {
  return (STORE_IMAGE_TYPES as readonly string[]).includes(type)
}
