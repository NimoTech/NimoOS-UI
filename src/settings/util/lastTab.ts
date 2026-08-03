import { DEFAULT_TAB, isSettingsTab, type SettingsTab } from './tabs'

/** 键名沿用 Vue2(SettingsPanel.vue L854/L1179),这样从旧 UI 切过来记忆不丢。 */
export const LAST_TAB_KEY = 'nimoos_settings_last_tab'

/**
 * Vue2 是 `localStorage.getItem(KEY) || 'general'` —— 存了非法值会原样吃进去,
 * 之后渲染成空白页(Vue2 的 v-else-if 链全部落空)。此处改正确:非法值一律回落 general。
 * (移植纪律:Vue2 的 bug 不照抄。)
 */
export function readLastTab(): SettingsTab {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(LAST_TAB_KEY)
  } catch {
    return DEFAULT_TAB // 隐私模式等禁用存储:降级到默认,不抛
  }
  return isSettingsTab(raw) ? raw : DEFAULT_TAB
}

export function writeLastTab(tab: SettingsTab): void {
  try {
    localStorage.setItem(LAST_TAB_KEY, tab)
  } catch {
    /* 配额/隐私模式:记忆丢了不影响使用,静默降级 */
  }
}
