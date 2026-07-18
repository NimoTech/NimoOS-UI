// 设备图标:名字 = `${model}_${online|offline}`(Vue2 deviceIcon computed)。
// Vue2 资产缺 mobile_offline(离线手机在 Vue2 会 require 炸)——此处兜底回退 desktop_同状态。
const ICONS = import.meta.glob<string>('./assets/*.svg', { eager: true, import: 'default' }) as Record<string, string>
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
