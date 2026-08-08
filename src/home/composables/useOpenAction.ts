import type { LayoutItem } from '../grid/types'
import { useAppsStore } from '../stores/apps'
import { useStartApp, appUrl } from './useStartApp'
import { router } from '../../router'

// 文件区(/files,SP4-P8)、应用区(/apps,SP5-P8)、存储区(/storage,SP6-P1)、相册区
// (/photos,SP7-P8b)、系统设置(/settings)与 KVM(/kvm,两者 SP9-P8)、AI 区(/ai,SP8-P6)
// 已全部活在本应用;SP1-SP9 迁移至此收官。
// photos / ai / vm 这三条留在表里不是死键 —— cutover 回退时(flag 置 1)就跳它们,所以是"回退目标"
// 而不是"主路径";这也是它们与 appstore/storage/settings 的区别(那三个在 Vue2 侧是模态弹窗、
// 没有自己的路由,回退只能落 /#/legacy 老桌面 —— settings 因此也用 '/#/legacy' 作回退目标,
// 落到老桌面后再点「设置」磁贴,由 Vue2 侧的 resolveEntryTarget('/settings') 判定弹老模态)。
// router 模块环(router→Home→…→本文件)只在运行时访问 push,ESM 延迟绑定安全。
const SYS_ROUTE: Record<string, string> = {
  photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy',
}

// 回退 flag(与 Vue2 strangler.js 的 strangler:disabled:<from> 命名一致):
// == '1' 时磁贴退回 Vue2 老页面(见 SYS_ROUTE 各自的目标),可逆 cutover。
// /apps = SP5-P8;/storage = SP6-P6(Vue2 桌面那三个存储入口共用同一把键,
// 同源共享 localStorage,所以置一次即两侧同时回退);/photos = SP7-P8b(与 Vue2
// strangler.js 的 migratedRoutes 里那条 /photos 共用同一把键,同理置一次两侧同时回退);
// /kvm 与 /settings = SP9-P8,同理一把键管两侧(/kvm 在 Vue2 的 migratedRoutes、
// /settings 在 migratedEntries)。
// /ai = SP8-P6,同理一把键管两侧(Vue2 侧在 migratedRoutes)。
// ⚠️ 键名取的是**路由路径**,不是磁贴 key —— vm 磁贴对应的键是 '/kvm'。
function cutoverDisabled(from: string): boolean {
  try { return localStorage.getItem(`strangler:disabled:${from}`) === '1' } catch { return false }
}

export function useOpenAction() {
  const apps = useAppsStore()
  const startApp = useStartApp()

  function openApp(key: string) {
    const a = apps.app(key)
    if (!a) return
    if (a.system) {
      if (key === 'files') { router.push('/files'); return }
      if (key === 'appstore' && !cutoverDisabled('/apps')) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
      if (key === 'photos' && !cutoverDisabled('/photos')) { router.push('/photos'); return }
      if (key === 'settings' && !cutoverDisabled('/settings')) { router.push('/settings'); return }
      if (key === 'vm' && !cutoverDisabled('/kvm')) { router.push('/kvm'); return }
      if (key === 'ai' && !cutoverDisabled('/ai')) { router.push('/ai/agent'); return }
      // Knowledge: an in-app route built at SP8 (eleven routes, nine-item rail);
      // Vue 2 has no counterpart entry for it, so there is nowhere to fall back to
      // and no strangler:disabled flag is set here (unlike ai/photos/vm/settings above).
      if (key === 'knowledge') { router.push('/ai/knowledge'); return }
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
    // 桌面照片磁贴:cutover 后进应用内时间线。刻意不带 asset —— Vue2 这里也只是跳
    // /#/photos、不定位到具体某张(桌面磁贴的 key 是渐变色字符串,不是资产 id),
    // 界面 1:1 就该保持"点进相册首页"。flag 置 1 时退回 Vue2 老相册。
    else if (it.kind === 'photo') {
      if (cutoverDisabled('/photos')) window.location.href = '/#/photos'
      else router.push('/photos')
    }
    // 桌面 AI 小组件:cutover 后进应用内 Agent 页。flag 置 1 时退回 Vue2 老 Agent。
    else if (it.kind === 'widget' && it.key === 'ai') {
      if (cutoverDisabled('/ai')) window.location.href = '/#/ai/agent'
      else router.push('/ai/agent')
    }
  }

  function sendToAI(text?: string) {
    const q = (text || '').trim()
    // cutover 后走应用内路由:query 用对象形式交给 vue-router 编码,不手工拼串
    // (AgentPage.vue 的 onMounted 读 route.query.message,一次性消费后 router.replace 抹掉)。
    // flag 置 1 时退回 Vue2,那边只认拼好的 hash URL,所以保留 encodeURIComponent。
    if (cutoverDisabled('/ai')) {
      window.location.href = '/#/ai/agent' + (q ? '?message=' + encodeURIComponent(q) : '')
      return
    }
    router.push(q ? { path: '/ai/agent', query: { message: q } } : { path: '/ai/agent' })
  }

  return { openApp, openItem, sendToAI }
}
