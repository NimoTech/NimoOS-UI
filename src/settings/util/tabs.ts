// 系统设置的 tab 模型。对位 Vue2 src/components/settings/SettingsPanel.vue:
//   - data().tabs (L855-863) —— 侧栏 rail 的 7 项
//   - visibleTabs (L1034)    —— 非 admin 过滤掉 folder-permissions
//   - 用户块 (L13-20)         —— account 的唯一入口,不在 rail 上
//   - general 页内一行 (L315) —— developer 的唯一入口,不在 rail 上,且无任何开关门控
// spec §4.1 写「rail 9 项」「developer 只在开发者模式开启后出现」与源码不符,
// 此处以源码为准(移植纪律:界面严格 1:1)。

export const SETTINGS_TABS = [
  'general',
  'storage',
  'network',
  'apps',
  'terminal',
  'system-status',
  'lan-devices',
  'folder-permissions',
  'account',
  'developer',
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]

/** The 8 tabs visible on the sidebar rail (account / developer have their own entry points, not on the rail). */
export const RAIL_TABS: readonly SettingsTab[] = SETTINGS_TABS.slice(0, 8)

export const DEFAULT_TAB: SettingsTab = 'general'

export const TAB_LABEL_KEY: Record<SettingsTab, string> = {
  general: 'settingsTabGeneral',
  storage: 'settingsTabStorage',
  network: 'settingsTabNetwork',
  apps: 'settingsTabApps',
  terminal: 'settingsTabTerminal',
  'system-status': 'settingsTabSystemStatus',
  'lan-devices': 'settingsTabLanDevices',
  'folder-permissions': 'settingsTabFolderPermissions',
  account: 'settingsTabAccount',
  developer: 'settingsTabDeveloper',
}

export function isSettingsTab(v: unknown): v is SettingsTab {
  return typeof v === 'string' && (SETTINGS_TABS as readonly string[]).includes(v)
}

/** Vue2 visibleTabs:只有 admin 能看到 folder-permissions。role 缺失按非 admin 处理。 */
export function railTabsFor(role: string | undefined): readonly SettingsTab[] {
  if (role === 'admin') return RAIL_TABS
  return RAIL_TABS.filter((t) => t !== 'folder-permissions')
}
