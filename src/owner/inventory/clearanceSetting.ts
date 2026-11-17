import type { ClearanceSettingItem } from './api'

/** 마감세일 할인율 범위(%). inventory-service ClearanceSetting, DB CHECK 제약(V14)과 같다 */
export const MIN_CLEARANCE_DISCOUNT = 10
export const MAX_CLEARANCE_DISCOUNT = 90
/** 정하지 않은 분류의 할인율. "할인율 바꿈" 거르기의 기준이다 */
export const DEFAULT_CLEARANCE_DISCOUNT = 30
/** −/+ 한 번에 움직이는 폭(%) */
export const CLEARANCE_DISCOUNT_STEP = 10

/** 판매 시작 시(0~23)와 끝 시(1~24, 24 = 자정) 고르기 칸 */
export const SALE_START_HOURS = Array.from({ length: 24 }, (_, i) => i)
export const SALE_END_HOURS = Array.from({ length: 24 }, (_, i) => i + 1)

/** 입력칸 글자를 할인율로 바꾼다. 10~90 정수가 아니면 null */
export function parseDiscountPercent(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value >= MIN_CLEARANCE_DISCOUNT && value <= MAX_CLEARANCE_DISCOUNT ? value : null
}

/**
 * −/+ 한 번 누른 뒤의 할인율. 10% 단위 칸으로 움직인다(35에서 + 면 40, − 면 30). 10~90 밖으로는 멈춘다.
 * 지금 값이 비었거나 범위 밖이면 기본 30에서 시작한다
 */
export function stepDiscount(now: number | null, direction: 1 | -1): number {
  const from = now ?? DEFAULT_CLEARANCE_DISCOUNT
  const step = CLEARANCE_DISCOUNT_STEP
  const next =
    direction > 0 ? Math.floor(from / step) * step + step : Math.ceil(from / step) * step - step
  return Math.min(MAX_CLEARANCE_DISCOUNT, Math.max(MIN_CLEARANCE_DISCOUNT, next))
}

/** 판매 시간이 맞는지. 시작이 끝보다 빨라야 한다(같으면 파는 시간이 없다) */
export function validSaleHours(start: number, end: number): boolean {
  return start < end
}

/** 시 표시. 24는 자정이라 "24시"로 그대로 쓴다 */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}시`
}

export interface ClearanceFilters {
  /** 카테고리 이름에 들어간 글자(앞뒤 공백 무시) */
  q: string
  /** 마감세일을 적용한 분류만 */
  enabledOnly: boolean
  /** 할인율을 기본(30%)에서 바꾼 분류만 */
  changedOnly: boolean
}

export const NO_CLEARANCE_FILTERS: ClearanceFilters = {
  q: '',
  enabledOnly: false,
  changedOnly: false,
}

/** 서버에 저장된 값으로 거른다(입력 중인 값은 보지 않는다). 두 칩을 같이 누르면 둘 다 맞는 분류만 */
export function filterClearanceSettings(
  items: ClearanceSettingItem[],
  filters: ClearanceFilters,
): ClearanceSettingItem[] {
  const q = filters.q.trim()
  return items.filter(
    (item) =>
      (q === '' || item.category.includes(q)) &&
      (!filters.enabledOnly || item.enabled) &&
      (!filters.changedOnly || item.discountPercent !== DEFAULT_CLEARANCE_DISCOUNT),
  )
}

export type ClearanceSortKey = 'category' | 'customized' | 'enabled' | 'discount' | 'hours'

/** 칸 제목 정렬 값. 판매 시간은 시작 시, 같으면 끝 시 순이다 */
export function clearanceSortValue(
  item: ClearanceSettingItem,
  key: ClearanceSortKey,
): string | number {
  switch (key) {
    case 'category':
      return item.category
    case 'customized':
      return item.customized ? 1 : 0
    case 'enabled':
      return item.enabled ? 1 : 0
    case 'discount':
      return item.discountPercent
    case 'hours':
      return item.saleStartHour * 100 + item.saleEndHour
  }
}
