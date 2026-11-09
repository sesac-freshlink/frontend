import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { isStoreImageType, readAsDataUrl } from '@/shared/storeImage'
import { type OwnerStore, useUpdateOwnerStore, useUploadOwnerStoreImage } from './api'
import {
  imageFileError,
  OWNER_STORE_TEXT,
  ownerStoreErrorMessage,
  ownerStorePatch,
} from './ownerStoreForm'

/** 새로 고른 사진: 올릴 파일과 미리보기 주소(data:, CSP 때문에 blob: 은 못 쓴다) */
export interface PickedImage {
  file: File
  previewUrl: string
}

export interface UseOwnerStoreEditReturn {
  /** 새로 고른 사진. 저장 전까지는 올리지 않는다 */
  image: PickedImage | null
  /** 사진 검사 오류 (형식·5MB) */
  imageError: string | null
  /** 저장 실패 문구 */
  saveError: string | null
  saving: boolean
  /** 사진을 고른다. JPG·PNG가 아니거나 5MB를 넘으면 고르지 않고 imageError 를 둔다 */
  pickImage(file: File): void
  /** 설명이나 사진이 바뀌었는지 (저장 버튼) */
  isChanged(description: string): boolean
  /** 사진을 새로 골랐으면 OW-03 → PUT → OW-02, 아니면 설명만 OW-02. 성공하면 안내를 띄우고 그 화면에 남으며 true */
  save(description: string): Promise<boolean>
}

/** A15 점주 내 점포 수정 화면의 동작 */
export function useOwnerStoreEdit(store: OwnerStore): UseOwnerStoreEditReturn {
  const update = useUpdateOwnerStore()
  const upload = useUploadOwnerStoreImage()
  const [image, setImage] = useState<PickedImage | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // 사진을 빠르게 두 번 고르면 마지막에 고른 것만 남긴다
  const lastPick = useRef(0)

  return {
    image,
    imageError,
    saveError,
    saving: update.isPending || upload.isPending,
    pickImage(file) {
      const error = imageFileError(file)
      setImageError(error)
      if (error) return
      const pick = ++lastPick.current
      readAsDataUrl(file).then(
        (previewUrl) => {
          if (pick === lastPick.current) setImage({ file, previewUrl })
        },
        () => {
          if (pick === lastPick.current) setImageError(OWNER_STORE_TEXT.imagePreviewFailed)
        },
      )
    },
    isChanged(description) {
      return image !== null || Object.keys(ownerStorePatch(store, description)).length > 0
    },
    async save(description) {
      setSaveError(null)
      let imageKey: string | undefined
      if (image && isStoreImageType(image.file.type)) {
        try {
          imageKey = (await upload.mutateAsync({ file: image.file, contentType: image.file.type }))
            .imageKey
        } catch (e) {
          setSaveError(ownerStoreErrorMessage(e, OWNER_STORE_TEXT.imageUploadFailed))
          return false
        }
      }
      const patch = ownerStorePatch(store, description, imageKey)
      if (Object.keys(patch).length === 0) return false
      try {
        await update.mutateAsync(patch)
      } catch (e) {
        setSaveError(ownerStoreErrorMessage(e, OWNER_STORE_TEXT.saveFailed))
        return false
      }
      setImage(null)
      setImageError(null)
      toast.success(OWNER_STORE_TEXT.saved)
      return true
    },
  }
}
