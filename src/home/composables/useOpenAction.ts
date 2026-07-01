import type { LayoutItem } from '../grid/types'
import { useAppsStore } from '../stores/apps'
import { useToast } from '../../stores/toast'

const SYS_ROUTE: Record<string, string> = {
  files: '/#/files', photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy', appstore: '/#/legacy',
}

export function useOpenAction(notify: (msg: string) => void = (m) => useToast().show(m)) {
  const apps = useAppsStore()

  function openApp(key: string) {
    const a = apps.app(key)
    if (!a) return
    if (a.system) { window.location.href = SYS_ROUTE[key] || '/#/legacy'; return }
    if (a.app_type === 'LinkApp') { if (a.hostname) window.open(a.hostname, '_blank', 'noopener'); return }
    if (a.status === 'running' && (a.port || a.index)) {
      const scheme = a.scheme || 'http'
      const host = a.hostname || window.location.hostname
      const port = a.port ? ':' + a.port : ''
      const idx = a.index || '/'
      window.open(`${scheme}://${host}${port}${idx}`, '_blank', 'noopener')
    } else {
      notify(a.name + ':未运行,请到应用页启动')
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
