import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useAppsStore, type AppMeta } from '../stores/apps'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'

/** 容器应用的网页地址;没有可打开的页面时返回 null */
export function appUrl(a: AppMeta): string | null {
  if (!a.port && !a.index) return null
  const scheme = a.scheme || 'http'
  const host = a.hostname || window.location.hostname
  const port = a.port ? ':' + a.port : ''
  return `${scheme}://${host}${port}${a.index || '/'}`
}

export interface StartState { key: string; phase: 'confirm' | 'starting' }
export interface ConfirmOpts {
  pollMs?: number
  timeoutMs?: number
  /** 注入以便测试;默认当前页跳转 */
  navigate?: (url: string) => void
}

// 模块级单例:弹窗状态由所有调用方共享(同 useDock/useAddPanel 模式),
// 视图是 Home.vue 里的 StartAppDialog。
const state = ref<StartState | null>(null)
// 启动态中用户收起弹窗 → 启动继续但完成后不再自动跳转(spec §2.5)
let navigateOnSuccess = true

/** Reset singleton state — call in test beforeEach */
export function __resetStartAppForTest() {
  state.value = null
  navigateOnSuccess = true
}

export function useStartApp() {
  const apps = useAppsStore()
  const toast = useToast()
  const t = i18n.global.t

  function prompt(key: string) {
    if (state.value) return // 已有确认框/启动流程,不叠加
    state.value = { key, phase: 'confirm' }
  }

  /** 关闭弹窗(取消按钮 / Esc / 点遮罩)。启动态下只是"收起",流程继续。 */
  function dismiss() {
    if (!state.value) return
    if (state.value.phase === 'starting') navigateOnSuccess = false
    state.value = null
  }

  async function confirm(opts: ConfirmOpts = {}): Promise<boolean> {
    if (state.value?.phase !== 'confirm') return false
    const key = state.value.key
    const meta = apps.app(key)
    if (!meta) { state.value = null; return false }
    state.value = { key, phase: 'starting' }
    navigateOnSuccess = true
    const navigate = opts.navigate ?? ((url: string) => { window.location.href = url })
    try {
      await service.apps.start({ name: key, app_type: meta.app_type })
      const pollMs = opts.pollMs ?? 1000
      const deadline = Date.now() + (opts.timeoutMs ?? 30_000)
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollMs))
        await apps.loadGrid().catch(() => {})
        const cur = apps.app(key)
        if (cur?.status === 'running') {
          const url = appUrl(cur)
          const shouldNavigate = navigateOnSuccess && url
          state.value = null
          if (shouldNavigate) navigate(url)
          else toast.show(t('startAppStarted', { name: cur.name }))
          return true
        }
      }
      throw new Error('timeout')
    } catch (e) {
      console.warn('[home] start app', key, e)
      state.value = null
      toast.show(t('startAppFailed', { name: meta.name }), 4000)
      return false
    }
  }

  return { state, prompt, dismiss, confirm }
}
