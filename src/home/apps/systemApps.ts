export interface SystemApp { key: string; name: string; label: string; cls: string }

export const SYSTEM_APPS: SystemApp[] = [
  { key: 'files', name: 'Files', label: '文件', cls: 'ic-files' },
  { key: 'photos', name: 'Photos', label: '照片', cls: 'ic-photos' },
  { key: 'ai', name: 'AI', label: 'AI 助手', cls: 'ic-ai' },
  { key: 'vm', name: 'KVM', label: '虚拟机', cls: 'ic-vm' },
  { key: 'settings', name: 'Settings', label: '设置', cls: 'ic-settings' },
  { key: 'appstore', name: 'App Store', label: 'AppStore', cls: 'ic-appstore' },
]

export const SYSTEM_APP_KEYS = SYSTEM_APPS.map((a) => a.key)
