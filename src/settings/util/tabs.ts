// Tab model for system settings. Maps to Vue2 src/components/settings/SettingsPanel.vue:
//   - data().tabs (L855-863) -- the 7 sidebar rail items
//   - visibleTabs (L1034)    -- non-admin filters out folder-permissions
//   - user block (L13-20)     -- the only entry point to account, not on the rail
//   - one row inside the general page (L315) -- the only entry point to developer,
//     not on the rail, and not gated behind any toggle
// spec §4.1 says "9 rail items" and "developer appears only after developer mode is
// enabled", which contradicts the source; the source wins here (porting discipline:
// UI strictly 1:1).

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

/** Vue2 visibleTabs: only admin sees folder-permissions. Missing role is treated as non-admin. */
export function railTabsFor(role: string | undefined): readonly SettingsTab[] {
  if (role === 'admin') return RAIL_TABS
  return RAIL_TABS.filter((t) => t !== 'folder-permissions')
}
