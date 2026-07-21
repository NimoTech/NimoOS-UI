import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useInstallProgressStore } from '../stores/installProgress'
import { useToast } from '../../stores/toast'
import { resolveAppText } from '../util/appTitle'

export interface InstallCandidate {
  id: string
  title: string
  icon?: string
  tips?: unknown // StoreAppInfo.tips 原样传入
}

/** tips.before_install 的本语言文案(无则 '') */
export function beforeInstallText(tips: unknown, lang: string): string {
  const t = (tips && typeof tips === 'object' ? tips : {}) as Record<string, unknown>
  const bi = t.before_install
  if (!bi || typeof bi !== 'object') return ''
  return resolveAppText(bi as Record<string, string>, lang, '')
}

/** 安装 400 归一化:{message, data:{ports_in_use}} 容忍解析(Vue2 兼容 tcp/TCP,AppPanel.vue:733-741) */
export function parseInstallError(e: unknown): { message: string; ports: string[] } {
  const resp = (e as { response?: { data?: unknown } })?.response?.data
  const body = (resp && typeof resp === 'object' ? resp : {}) as Record<string, unknown>
  const message = typeof body.message === 'string' ? body.message : ''
  const data = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, unknown>
  const raw = data.ports_in_use
  const ports: string[] = []
  if (Array.isArray(raw)) {
    raw.forEach((p) => ports.push(String(p)))
  } else if (raw && typeof raw === 'object') {
    for (const [proto, arr] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(arr)) arr.forEach((p) => ports.push(`${p}/${proto.toLowerCase()}`))
    }
  }
  return { message, ports }
}

export function useInstallFlow() {
  const { locale, t } = useI18n()
  const toast = useToast()
  const progress = useInstallProgressStore()
  const tipsDlg: Ref<{ open: boolean; app: InstallCandidate | null; text: string }> =
    ref({ open: false, app: null, text: '' })
  const submitting = ref<Record<string, boolean>>({})

  async function doInstall(app: InstallCandidate) {
    const cur = progress.tasks[app.id]
    if ((cur && cur.state === 'installing') || submitting.value[app.id]) return
    submitting.value = { ...submitting.value, [app.id]: true }
    try {
      const yaml = await service.appstore.getAppCompose(app.id)
      // D2:dry_run 预检——校验错/端口冲突在真装前就地拦下(400 reject,响应仅 {message})
      await service.compose.install(yaml, { dryRun: true, checkPortConflict: true })
      await service.compose.install(yaml, { checkPortConflict: true })
      progress.track(app.id, app.title, app.icon)
    } catch (e) {
      console.warn('[apps] install', app.id, e)
      const { message, ports } = parseInstallError(e)
      toast.show(
        ports.length
          ? t('appsInstallPortConflict', { ports: ports.join(', ') })
          : message || t('appsInstallFailed', { name: app.title }),
        5000,
      )
    } finally {
      const next = { ...submitting.value }; delete next[app.id]; submitting.value = next
    }
  }

  /** 入口:有 before_install 提示先弹确认(D3),无则直装 */
  function requestInstall(app: InstallCandidate) {
    const text = beforeInstallText(app.tips, locale.value)
    if (text) tipsDlg.value = { open: true, app, text }
    else void doInstall(app)
  }

  /** 先读 app 再关弹窗(P1 reka AlertDialogAction 教训:update:open 先于 click) */
  function confirmTips() {
    const app = tipsDlg.value.app
    tipsDlg.value = { open: false, app: null, text: '' }
    if (app) void doInstall(app)
  }

  return { tipsDlg, requestInstall, confirmTips, submitting }
}
