import iconFiles from './icons/files.svg'
import iconPhotos from './icons/photos.svg'
import iconAi from './icons/ai.svg'
import iconVm from './icons/kvm.svg'
import iconSettings from './icons/settings.png'
import iconAppstore from './icons/appstore.svg'
import iconStorage from './icons/storage.svg'

// `label` holds an i18n key (translated at render via t(label)) — see AppTile/GridItem.
// `icon` 来自旧 Vue2 UI(NimoOS-UI/src/assets/img/app/),cls/glyph 保留作无图兜底。
export interface SystemApp { key: string; name: string; label: string; cls: string; glyph: string; icon: string }

const G = {
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.5.7l1 1.3h7.1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2Z"/>',
  photos: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="8.8" cy="9.3" r="1.5"/><path d="m4 17 5-4 3.5 2.6L16 13l4.5 3.5"/>',
  vm: '<rect x="3.5" y="4.5" width="17" height="11" rx="2"/><path d="M8 19.5h8M12 15.5v4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.8m0 13.4v2.8M2.5 12h2.8m13.4 0h2.8M5.1 5.1l2 2m9.8 9.8 2 2m0-13.8-2 2M7.1 16.9l-2 2"/>',
  bag: '<path d="M5.5 8h13l-1 11.2a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8Z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/>',
  ai: '<path d="M12 3.5c.45 3.3 1.7 4.55 5 5-3.3.45-4.55 1.7-5 5-.45-3.3-1.7-4.55-5-5 3.3-.45 4.55-1.7 5-5Z"/>',
  drive: '<rect x="4" y="7" width="16" height="10" rx="2"/><path d="M4 13.5h16"/><circle cx="16.5" cy="15.2" r=".8"/>',
}

export const SYSTEM_APPS: SystemApp[] = [
  { key: 'files', name: 'Files', label: 'appFiles', cls: 'ic-files', glyph: G.folder, icon: iconFiles },
  { key: 'storage', name: 'Storage', label: 'appStorage', cls: 'ic-storage', glyph: G.drive, icon: iconStorage },
  { key: 'photos', name: 'Photos', label: 'appPhotos', cls: 'ic-photos', glyph: G.photos, icon: iconPhotos },
  { key: 'ai', name: 'AI', label: 'appAi', cls: 'ic-ai', glyph: G.ai, icon: iconAi },
  { key: 'vm', name: 'KVM', label: 'appVm', cls: 'ic-vm', glyph: G.vm, icon: iconVm },
  { key: 'settings', name: 'Settings', label: 'appSettings', cls: 'ic-settings', glyph: G.gear, icon: iconSettings },
  { key: 'appstore', name: 'App Store', label: 'appAppStore', cls: 'ic-appstore', glyph: G.bag, icon: iconAppstore },
]

export const SYSTEM_APP_KEYS = SYSTEM_APPS.map((a) => a.key)
