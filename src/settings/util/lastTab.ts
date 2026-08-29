import { DEFAULT_TAB, isSettingsTab, type SettingsTab } from './tabs'

/** Key name kept from Vue2 (SettingsPanel.vue L854/L1179) so memory survives switching over from the old UI. */
export const LAST_TAB_KEY = 'nimoos_settings_last_tab'

/**
 * Vue2 does `localStorage.getItem(KEY) || 'general'` -- an invalid stored value gets
 * swallowed as-is and then renders a blank page (every branch of Vue2's v-else-if chain
 * misses). Fixed here: any invalid value falls back to general.
 * (Porting discipline: do not copy Vue2's bugs.)
 */
export function readLastTab(): SettingsTab {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(LAST_TAB_KEY)
  } catch {
    return DEFAULT_TAB // Storage disabled (private mode etc.): degrade to default, don't throw
  }
  return isSettingsTab(raw) ? raw : DEFAULT_TAB
}

export function writeLastTab(tab: SettingsTab): void {
  try {
    localStorage.setItem(LAST_TAB_KEY, tab)
  } catch {
    /* Quota / private mode: losing the memory doesn't break usage, degrade silently */
  }
}
