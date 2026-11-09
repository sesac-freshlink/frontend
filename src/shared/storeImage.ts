/**
 * 점포 이미지 형식 (관리자 점포 수정 A-02, 점주 내 점포 A15 공통).
 * 고른 파일 형식을 업로드 주소 요청에 보내면 서버가 .jpg·.png 키로 그 Content-Type 을 서명한다
 */
export const STORE_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const
export type StoreImageType = (typeof STORE_IMAGE_TYPES)[number]

export function isStoreImageType(type: string): type is StoreImageType {
  return (STORE_IMAGE_TYPES as readonly string[]).includes(type)
}

/**
 * 고른 사진의 미리 보기 주소(data:). CloudFront CSP 의 img-src 가 'self' data: https: 라서
 * URL.createObjectURL 의 blob: 주소는 dev·prod 에서 막힌다 (가짜 API 화면에는 CSP 가 없어 안 보인다)
 */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다'))
    reader.readAsDataURL(file)
  })
}
