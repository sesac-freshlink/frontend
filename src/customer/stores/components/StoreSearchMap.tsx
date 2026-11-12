import { MapPin } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/ui/cn'
import {
  kakaoMapKey,
  loadKakaoMaps,
  type KakaoCustomOverlay,
  type KakaoMap,
  type KakaoMaps,
} from '../kakaoMap'
import { distanceKm, formatDistance, type LatLng } from '../nearby'
import { groupOverlapping, pinLabel, type StoreRow } from '../storeSearchTabs'

/** 처음 확대 단계(카카오맵 1~14, 작을수록 가깝다). 점포가 하나뿐이거나 내 위치만 있을 때 쓴다 */
const MAP_LEVEL = 5
/** 위치·점포 좌표를 하나도 모를 때 처음 보여 줄 곳(서울시청) */
const FALLBACK_CENTER: LatLng = { latitude: 37.566535, longitude: 126.977969 }

/** 지도에 그릴 수 있는(좌표가 있는) 점포 */
type Pin = StoreRow & { latitude: number; longitude: number }

function hasCoords(row: StoreRow): row is Pin {
  return row.latitude !== null && row.longitude !== null
}

/**
 * 핀(점포 하나) 버튼을 만든다. 누르는 칸은 44px 이상, 보이는 모양은 아래 꼬리가 달린 작은 이름표.
 * 꼬리 끝이 점포 자리를 가리키고 그 아래를 비워 두어, 내 위치 점이 바로 옆이어도 이름표를 가리지 않는다
 */
function pinButton(row: Pin, selected: boolean, pickup: boolean, onSelect: () => void) {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.pinId = String(row.storeId)
  button.className =
    'flex min-h-11 min-w-11 flex-col items-center justify-end pb-2 focus-visible:outline-2 focus-visible:outline-emerald-700'
  button.setAttribute(
    'aria-label',
    [
      row.name,
      row.distanceKm === null ? null : formatDistance(row.distanceKm),
      pickup ? '내 픽업 점포' : null,
    ]
      .filter(Boolean)
      .join(', '),
  )
  button.setAttribute('aria-pressed', String(selected))
  const tag = document.createElement('span')
  tag.className = cn(
    'rounded-full px-2.5 py-1 text-sm font-semibold whitespace-nowrap shadow-sm ring-1',
    selected
      ? 'bg-emerald-700 text-white ring-emerald-800'
      : 'bg-white text-emerald-800 ring-emerald-700',
  )
  tag.textContent = `${pickup ? '✓ ' : ''}${pinLabel(row.name)}`
  const tail = document.createElement('span')
  tail.setAttribute('aria-hidden', 'true')
  tail.className =
    '-mt-px block size-0 border-x-5 border-t-6 border-x-transparent border-t-emerald-700'
  button.append(tag, tail)
  button.addEventListener('click', onSelect)
  return button
}

/**
 * 겹친 핀 묶음 버튼("N곳"). 누르면 그 점포들이 떨어져 보이게 확대하고, 더 확대해도 겹치면 목록으로 보여 준다(onClick 이 정한다)
 */
function clusterButton(members: Pin[], onClick: () => void) {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.clusterIds = members.map((m) => m.storeId).join(',')
  button.className =
    'flex min-h-11 min-w-11 flex-col items-center justify-end pb-2 focus-visible:outline-2 focus-visible:outline-emerald-700'
  button.setAttribute(
    'aria-label',
    `점포 ${members.length}곳: ${members.map((m) => m.name).join(', ')}. 누르면 가까이 보여 줘요`,
  )
  const tag = document.createElement('span')
  tag.className =
    'rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold whitespace-nowrap text-emerald-800 shadow-sm ring-2 ring-emerald-700'
  tag.textContent = `${members.length}곳`
  const tail = document.createElement('span')
  tail.setAttribute('aria-hidden', 'true')
  tail.className =
    '-mt-px block size-0 border-x-5 border-t-6 border-x-transparent border-t-emerald-700'
  button.append(tag, tail)
  button.addEventListener('click', onClick)
  return button
}

/** 묶음을 눌렀을 때 이 단계 이하이거나 점포끼리 이 거리(km) 안이면 더 확대하지 않고 목록으로 보여 준다 */
const CLUSTER_LIST_LEVEL = 2
const SAME_SPOT_KM = 0.03

/** 내 위치 점 */
function myDot() {
  const dot = document.createElement('span')
  dot.className = 'block size-3.5 rounded-full bg-slate-900 ring-3 ring-white shadow'
  dot.setAttribute('aria-hidden', 'true')
  return dot
}

interface StoreSearchMapProps {
  rows: StoreRow[]
  selectedId: number | null
  pickupId: number | undefined
  position: LatLng | null
  onSelect: (storeId: number) => void
  /** 바뀔 때마다 지도를 내 위치로 옮긴다(목록 위 [내 위치로] 버튼, 11/12) */
  recenterToken: number
  /** 지금 지도 범위 안에 보이는 점포 수(지도를 움직이면 다시 센다). 지도가 없으면 null */
  onVisibleCountChange: (count: number | null) => void
  /** 지도 위에 겹쳐 띄울 점포 칸(바텀 시트). 없으면 null */
  sheet: ReactNode
  /** 겹친 핀 묶음을 더 확대할 수 없을 때 그 점포들을 목록으로 보여 달라고 부른다 */
  onClusterList: (storeIds: number[]) => void
  /** 점포 칸을 닫은 뒤 포커스를 돌려줄 핀. 돌려준 뒤 onPinFocused 를 부른다 */
  focusPinId: number | null
  onPinFocused: () => void
}

/**
 * U-01 점포 검색 지도(11/11). 지금 탭의 점포를 핀으로, 내 위치를 점으로 보여 준다.
 * 핀을 누르면 그 점포를 고르고 지도 아래쪽에 점포 칸(sheet)을 겹쳐 띄운다. 목록이 바뀌면 핀과 내 위치가 다 보이게 범위를 맞춘다.
 * 키가 없거나 SDK 를 불러오지 못하면 지도 대신 안내 한 줄만 보여 준다(아래 목록으로 찾을 수 있다)
 */
export function StoreSearchMap({
  rows,
  selectedId,
  pickupId,
  position,
  onSelect,
  recenterToken,
  onVisibleCountChange,
  onClusterList,
  sheet,
  focusPinId,
  onPinFocused,
}: StoreSearchMapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<{ maps: KakaoMaps; map: KakaoMap } | null>(null)
  const [failed, setFailed] = useState(false)
  const key = kakaoMapKey()
  // 지도는 처음 한 번만 만든다. 처음 가운데는 그때 아는 내 위치, 모르면 서울시청(곧 핀 범위로 맞춘다)
  const [initialCenter] = useState<LatLng>(() => position ?? FALLBACK_CENTER)
  // 좌표가 있는 점포만 핀으로. rows 는 화면 쪽에서 useMemo 로 묶어 내려와 같은 목록이면 같은 배열이다
  const pins = useMemo(() => rows.filter(hasCoords), [rows])

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    loadKakaoMaps(key)
      .then((maps) => {
        const container = ref.current
        if (cancelled || !container) return
        setMap({
          maps,
          map: new maps.Map(container, {
            center: new maps.LatLng(initialCenter.latitude, initialCenter.longitude),
            level: MAP_LEVEL,
          }),
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [key, initialCenter])

  // 목록(탭·검색·지역)이나 내 위치가 바뀌면 핀과 내 위치가 다 보이게 범위를 맞춘다
  useEffect(() => {
    if (!map) return
    const points = pins.map((p) => new map.maps.LatLng(p.latitude, p.longitude))
    if (position) points.push(new map.maps.LatLng(position.latitude, position.longitude))
    if (points.length === 0) return
    if (points.length === 1) {
      map.map.setLevel(MAP_LEVEL)
      map.map.panTo(points[0])
      return
    }
    const bounds = new map.maps.LatLngBounds()
    points.forEach((p) => bounds.extend(p))
    map.map.setBounds(bounds)
  }, [map, pins, position])

  // 확대 단계. 바뀌면(손가락으로 확대·축소, setBounds) 핀 묶음을 다시 계산한다(카카오 zoom_changed)
  const [zoom, setZoom] = useState<number | null>(null)
  useEffect(() => {
    if (!map) return
    const onZoom = () => setZoom(map.map.getLevel())
    onZoom()
    map.maps.event.addListener(map.map, 'zoom_changed', onZoom)
    return () => map.maps.event.removeListener(map.map, 'zoom_changed', onZoom)
  }, [map])

  // 핀과 내 위치 점을 그린다. 화면에서 이름표가 겹치는 핀은 "N곳" 하나로 묶는다(고른 점포는 묶지 않음).
  // 고른 점포·내 픽업 점포·확대 단계가 바뀌면 다시 그린다
  const pinButtons = useRef(new Map<number, HTMLButtonElement>())
  useEffect(() => {
    if (!map || zoom === null) return
    const buttons = new Map<number, HTMLButtonElement>()
    pinButtons.current = buttons
    const projection = map.map.getProjection()
    const groups = groupOverlapping(
      pins.map((p) => ({
        item: p,
        ...projection.pointFromCoords(new map.maps.LatLng(p.latitude, p.longitude)),
      })),
      selectedId,
    )
    const overlays: KakaoCustomOverlay[] = groups.map((members) => {
      const [first] = members
      if (members.length === 1) {
        const button = pinButton(
          first,
          first.storeId === selectedId,
          first.storeId === pickupId,
          () => onSelect(first.storeId),
        )
        buttons.set(first.storeId, button)
        return new map.maps.CustomOverlay({
          map: map.map,
          position: new map.maps.LatLng(first.latitude, first.longitude),
          content: button,
          clickable: true,
          yAnchor: 1,
          zIndex: first.storeId === selectedId ? 3 : 2,
        })
      }
      const button = clusterButton(members, () => {
        const sameSpot = members.every((m) => distanceKm(first, m) < SAME_SPOT_KM)
        if (sameSpot || map.map.getLevel() <= CLUSTER_LIST_LEVEL) {
          onClusterList(members.map((m) => m.storeId))
          return
        }
        const bounds = new map.maps.LatLngBounds()
        members.forEach((m) => bounds.extend(new map.maps.LatLng(m.latitude, m.longitude)))
        map.map.setBounds(bounds)
      })
      members.forEach((m) => buttons.set(m.storeId, button))
      return new map.maps.CustomOverlay({
        map: map.map,
        position: new map.maps.LatLng(first.latitude, first.longitude),
        content: button,
        clickable: true,
        yAnchor: 1,
        zIndex: 2,
      })
    })
    if (position) {
      overlays.push(
        new map.maps.CustomOverlay({
          map: map.map,
          position: new map.maps.LatLng(position.latitude, position.longitude),
          content: myDot(),
          zIndex: 1,
        }),
      )
    }
    return () => overlays.forEach((o) => o.setMap(null))
  }, [map, zoom, pins, selectedId, pickupId, position, onSelect, onClusterList])

  // 점포 칸을 닫았으면 방금 다시 그린 그 점포 핀으로 포커스를 돌려준다(핀 그리기 효과 다음에 돈다)
  useEffect(() => {
    if (focusPinId === null) return
    pinButtons.current.get(focusPinId)?.focus()
    onPinFocused()
  }, [focusPinId, onPinFocused])

  // 목록 위 [내 위치로]를 누르면 내 위치로 옮긴다(처음 그릴 때 0 은 건너뛴다)
  useEffect(() => {
    if (!map || !position || recenterToken === 0) return
    map.map.panTo(new map.maps.LatLng(position.latitude, position.longitude))
  }, [map, position, recenterToken])

  // 지도 안 점포 수: 지도가 멈출 때마다(idle — 끌기·확대 뒤) 다시 센다. 지도가 없어지면 null 로 돌려준다
  useEffect(() => {
    if (!map) return
    const count = () => {
      const bounds = map.map.getBounds()
      onVisibleCountChange(
        pins.filter((p) => bounds.contain(new map.maps.LatLng(p.latitude, p.longitude))).length,
      )
    }
    count()
    map.maps.event.addListener(map.map, 'idle', count)
    return () => map.maps.event.removeListener(map.map, 'idle', count)
  }, [map, pins, onVisibleCountChange])
  useEffect(() => () => onVisibleCountChange(null), [onVisibleCountChange])

  // 고른 점포로 지도를 옮긴다
  useEffect(() => {
    if (!map || selectedId === null) return
    const p = pins.find((x) => x.storeId === selectedId)
    if (p) map.map.panTo(new map.maps.LatLng(p.latitude, p.longitude))
  }, [map, selectedId, pins])

  if (key === null || failed) {
    return (
      <div className="flex min-h-16 items-center gap-2 rounded-xl bg-slate-50 px-4 text-sm text-slate-600">
        <MapPin className="size-5 shrink-0" aria-hidden />
        {failed
          ? '지도를 불러오지 못했어요. 아래 목록에서 점포를 찾아 주세요.'
          : '지도가 아직 없어요. 아래 목록에서 점포를 찾아 주세요.'}
      </div>
    )
  }

  return (
    // 지도 높이 h-72: 390×844 화면에서 지도 아래 목록이 한두 줄 보이게(11/11 검수)
    <div className="relative h-72 overflow-hidden rounded-xl bg-slate-100">
      <div ref={ref} role="region" aria-label="점포 지도" className="size-full" />
      {sheet}
    </div>
  )
}
