export interface SystemApp { key: string; name: string; label: string; cls: string; glyph: string }

const G = {
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.5.7l1 1.3h7.1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2Z"/>',
  photos: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="8.8" cy="9.3" r="1.5"/><path d="m4 17 5-4 3.5 2.6L16 13l4.5 3.5"/>',
  vm: '<rect x="3.5" y="4.5" width="17" height="11" rx="2"/><path d="M8 19.5h8M12 15.5v4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.8m0 13.4v2.8M2.5 12h2.8m13.4 0h2.8M5.1 5.1l2 2m9.8 9.8 2 2m0-13.8-2 2M7.1 16.9l-2 2"/>',
  bag: '<path d="M5.5 8h13l-1 11.2a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8Z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/>',
  ai: '<path d="M12 3.5c.45 3.3 1.7 4.55 5 5-3.3.45-4.55 1.7-5 5-.45-3.3-1.7-4.55-5-5 3.3-.45 4.55-1.7 5-5Z"/>',
}

export const SYSTEM_APPS: SystemApp[] = [
  { key: 'files', name: 'Files', label: '文件', cls: 'ic-files', glyph: G.folder },
  { key: 'photos', name: 'Photos', label: '照片', cls: 'ic-photos', glyph: G.photos },
  { key: 'ai', name: 'AI', label: 'AI 助手', cls: 'ic-ai', glyph: G.ai },
  { key: 'vm', name: 'KVM', label: '虚拟机', cls: 'ic-vm', glyph: G.vm },
  { key: 'settings', name: 'Settings', label: '设置', cls: 'ic-settings', glyph: G.gear },
  { key: 'appstore', name: 'App Store', label: 'AppStore', cls: 'ic-appstore', glyph: G.bag },
]

export const SYSTEM_APP_KEYS = SYSTEM_APPS.map((a) => a.key)
