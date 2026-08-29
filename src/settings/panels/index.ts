import type { Component } from 'vue'
import type { SettingsTab } from '../util/tabs'
import GeneralPanel from './GeneralPanel.vue'
import StoragePanel from './StoragePanel.vue'
import NetworkPanel from './NetworkPanel.vue'
import AppsPanel from './AppsPanel.vue'
import TerminalPanel from './TerminalPanel.vue'
import SystemStatusPanel from './SystemStatusPanel.vue'
import LanDevicesPanel from './LanDevicesPanel.vue'
import FolderPermissionsPanel from './FolderPermissionsPanel.vue'
import AccountPanel from './AccountPanel.vue'
import DeveloperPanel from './DeveloperPanel.vue'

export const PANEL_BY_TAB: Record<SettingsTab, Component> = {
  general: GeneralPanel,
  storage: StoragePanel,
  network: NetworkPanel,
  apps: AppsPanel,
  terminal: TerminalPanel,
  'system-status': SystemStatusPanel,
  'lan-devices': LanDevicesPanel,
  'folder-permissions': FolderPermissionsPanel,
  account: AccountPanel,
  developer: DeveloperPanel,
}
