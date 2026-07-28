import type { LayoutItem } from '../grid/types'
import { useAppsStore } from '../stores/apps'
import { useStartApp, appUrl } from './useStartApp'
import { router } from '../../router'

// 文件区(/files,SP4-P8)、应用区(/apps,SP5-P8)与存储区(/storage,SP6-P1)已活在本应用;
// 其余系统入口仍指 Vue2,各自 SP 迁移时再改。
// router 模块环(router→Home→…→本文件)只在运行时访问 push,ESM 延迟绑定安全。
const SYS_ROUTE: Record<string, string> = {
  photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy',
}

// SP5-P8 回退 flag(与 Vue2 strangler.js 的 strangler:disabled:<from> 命名一致):
// == '1' 时磁贴退回 Vue2 /#/legacy 老弹窗,可逆 cutover。
function appsCutoverDisabled(): boolean {
  try { return localStorage.getItem('strangler:disabled:/apps') === '1' } catch { return false }
}

export function useOpenAction() {
  const apps = useAppsStore()
  const startApp = useStartApp()

  function openApp(key: string) {
    const a = apps.app(key)
    if (!a) return
    if (a.system) {
      if (key === 'files') { router.push('/files'); return }
      if (key === 'appstore' && !appsCutoverDisabled()) { router.push('/apps/store'); return }
      // SP6-P1:存储区磁贴直接进应用内 /storage。注意此处尚无 strangler 回退 flag
      // (应用区有 strangler:disabled:/apps),SP6-P6 cutover 时补齐。
      if (key === 'storage') { router.push('/storage'); return }
      window.location.href = SYS_ROUTE[key] || '/#/legacy'
      return
    }
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
    else if (it.kind === 'folder') router.push({ path: '/files', query: { path: it.path || '/DATA/' + it.key } })
    else if (it.kind === 'photo') window.location.href = '/#/photos'
    else if (it.kind === 'widget' && it.key === 'ai') window.location.href = '/#/ai/agent'
  }

  function sendToAI(text?: string) {
    const q = (text || '').trim()
    window.location.href = '/#/ai/agent' + (q ? '?message=' + encodeURIComponent(q) : '')
  }

  return { openApp, openItem, sendToAI }
}
