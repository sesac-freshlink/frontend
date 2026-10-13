import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 조건부 Tailwind 클래스를 충돌 없이 합친다 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
