import type { LayoutItem } from './types'

// 桌面布局按视觉顺序(先行后列)线性化——手机启动器的排列顺序来源。
// 不改变入参;并列时保持稳定(sort 在现代引擎是稳定的)。
export function linearizeLayout(items: LayoutItem[]): LayoutItem[] {
  return [...items].sort((a, b) => a.r - b.r || a.c - b.c)
}
