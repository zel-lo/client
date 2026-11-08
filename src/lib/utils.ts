import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 아바타에 쓸 이름 첫 글자. 영문은 대문자로 보여준다. */
export function initial(name?: string | null) {
  return [...(name ?? '').trim()][0]?.toUpperCase() ?? '?'
}
