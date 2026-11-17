import { useState } from 'react'
import { DEFAULT_REGION, type RegionCode } from '@/auth/regions'
import { useStores, type StoreSummary } from './api'
import { closerStore, regionOf, type CloserStore } from './nearbyNotice'
import { useCurrentPosition, useGeolocationGranted } from './useCurrentPosition'

export interface FarPick extends CloserStore {
  targetName: string
  /** 지금 있는 시·도 ([가까운 점포 보기]가 이 지역 가까운순으로 연다) */
  region: RegionCode
  save: () => void
}

export interface UseFarPickGuardReturn {
  /** 점포를 픽업 점포로 정하기 전에 부른다. 멀지 않거나 모르면 바로 save, 멀면 확인 창을 띄운다 */
  guard: (
    target: Pick<StoreSummary, 'storeId' | 'name' | 'latitude' | 'longitude'> | undefined,
    save: () => void,
  ) => void
  pending: FarPick | null
  close: () => void
}

/**
 * 점포 정할 때 확인 창 (11/14 경우 결정): 지금 위치에서 10km 넘게 먼 점포를 정하려 하고 지금 시·도에 더 가까운 점포가 있으면
 * 정하기 전에 묻는다. 위치 권한을 이미 허용한 기기에서만 쓴다(권한 창을 새로 띄우지 않는다)
 */
export function useFarPickGuard(): UseFarPickGuardReturn {
  const granted = useGeolocationGranted()
  const position = useCurrentPosition(granted)
  const origin = position.status === 'ok' ? position.position : null
  const region = origin ? regionOf(origin) : DEFAULT_REGION
  const stores = useStores({ region, keyword: '' })
  const [pending, setPending] = useState<FarPick | null>(null)

  const guard: UseFarPickGuardReturn['guard'] = (target, save) => {
    const closer = closerStore(origin, target, stores.data)
    if (!closer || !target) {
      save()
      return
    }
    setPending({ ...closer, targetName: target.name, region, save })
  }
  return { guard, pending, close: () => setPending(null) }
}
