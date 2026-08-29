// Device icons: name = `${model}_${online|offline}` (naming convention inherited from Vue2 deviceIcon computed).
// Icons are original art for this repo (2026-07-18 user requested replacement of third-party assets
// copied from Vue2, and added missing mobile_offline from Vue2).
// Unknown model falls back to desktop_same state.
const ICONS = import.meta.glob<string>('./assets/*.svg', { eager: true, query: '?url&no-inline', import: 'default' }) as Record<string, string>
const URL_BY_NAME: Record<string, string> = {}
for (const [path, url] of Object.entries(ICONS)) {
  const m = path.match(/\/([^/]+)\.svg$/)
  if (m) URL_BY_NAME[m[1]] = url
}

export function dropIconUrl(model: string, offline: boolean, isSelf: boolean): string {
  if (isSelf) return URL_BY_NAME['self']
  const state = offline ? 'offline' : 'online'
  return URL_BY_NAME[`${model}_${state}`] || URL_BY_NAME[`desktop_${state}`]
}

export function dropAsset(name: 'add_btn' | 'drop_icon'): string {
  return URL_BY_NAME[name]
}
