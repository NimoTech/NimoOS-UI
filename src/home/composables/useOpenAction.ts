import type { LayoutItem } from '../grid/types'
import { useAppsStore } from '../stores/apps'
import { useStartApp, appUrl } from './useStartApp'

const SYS_ROUTE: Record<string, string> = {
  files: '/#/files', photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy', appstore: '/#/legacy',
}

export function useOpenAction() {
  const apps = useAppsStore()
  const startApp = useStartApp()

  function openApp(key: string) {
    const a = apps.app(key)
    if (!a) return
    if (a.system) { window.location.href = SYS_ROUTE[key] || '/#/legacy'; return }
    if (a.app_type === 'LinkApp') { if (a.hostname) window.open(a.hostname, '_blank', 'noopener'); return }
    const url = appUrl(a)
    if (a.status === 'running') {
      if (url) window.open(url, '_blank', 'noopener')
    } else if (a.status) {
      // 未运行(exited/dead/unknown…):不开网页,弹"是否启动"确认框(StartAppDialog)。
      // status 缺省的非容器来源维持无动作(与灰显判定同一约定)。
      startApp.prompt(key)
    }
  }

  function openItem(it: LayoutItem) {
    if (it.kind === 'app') openApp(it.key)
    else if (it.kind === 'folder') window.location.href = '/#/files?path=' + encodeURIComponent(it.path || '/DATA/' + it.key)
    else if (it.kind === 'photo') window.location.href = '/#/photos'
    else if (it.kind === 'widget' && it.key === 'ai') window.location.href = '/#/ai/agent'
  }

  function sendToAI(text?: string) {
    const q = (text || '').trim()
    window.location.href = '/#/ai/agent' + (q ? '?message=' + encodeURIComponent(q) : '')
  }

  return { openApp, openItem, sendToAI }
}
