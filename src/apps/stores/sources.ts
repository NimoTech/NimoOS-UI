import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppStoreSource } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { useAppstoreStore } from './appstore'

/** 注册期间的兜底轮询间隔:MessageBus 订阅通道 buffer=1 可能丢事件(系统已知),
 *  register-end 丢失时靠轮询 listSources 看到新 URL 收敛,不永久转圈(Vue2 只靠事件,是旧 bug)。 */
const REGISTER_POLL_MS = 15_000

function errMsg(e: unknown): string {
  const r = (e as { response?: { data?: { message?: string } } })?.response
  if (r?.data?.message) return r.data.message
  return e instanceof Error ? e.message : String(e)
}

export const useSourcesStore = defineStore('appSources', () => {
  const t = i18n.global.t
  const toast = useToast()
  const appstore = useAppstoreStore()

  const sources = ref<AppStoreSource[]>([])
  const loading = ref(false)
  const error = ref(false)
  const loaded = ref(false)
  /** 正在注册的源 URL;null=空闲。一次只允许一个注册在途(对齐后端异步任务语义)。 */
  const registeringUrl = ref<string | null>(null)

  let seq = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function load() {
    const mySeq = ++seq
    loading.value = true
    error.value = false
    try {
      const list = await service.appstore.listSources()
      if (mySeq !== seq) return
      sources.value = list
      loaded.value = true
    } catch (e) {
      if (mySeq !== seq) return
      error.value = true
      console.warn('[sources] load', e)
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function settleRegister() {
    registeringUrl.value = null
    stopPoll()
  }

  /** 注册成功收敛(事件或轮询,谁先到谁生效):清 pending + toast + 重拉列表 + 失效商店目录缓存 */
  function convergeRegistered() {
    if (registeringUrl.value === null) return
    settleRegister()
    toast.show(t('appsSourcesRegisterOk'), 4000)
    void load()
    appstore.invalidate()
  }

  /** 注册第三方源。同步 HTTP 错误(409 重复/400 坏 URL)抛 Error(message) 给调用方就地展示;
   *  受理(200)后是后端异步任务,由 app-store:register-end/-error 事件或轮询收敛。 */
  async function register(url: string) {
    const target = url.trim()
    registeringUrl.value = target
    try {
      await service.appstore.registerSource(target)
    } catch (e) {
      settleRegister()
      throw new Error(errMsg(e))
    }
    const needle = target.toLowerCase() // 后端重复判定不区分大小写,轮询对齐
    stopPoll()
    pollTimer = setInterval(async () => {
      if (registeringUrl.value === null) return
      try {
        const list = await service.appstore.listSources()
        if (registeringUrl.value !== null && list.some((s) => s.url.toLowerCase() === needle)) {
          convergeRegistered()
        }
      } catch {
        /* 轮询失败静默,下个周期再试 */
      }
    }, REGISTER_POLL_MS)
  }

  /** 注销:后端无事件,同步等待(Vue2 同款)。错误(如删最后一个源的 400)toast 透出,不抛。 */
  async function unregister(id: number) {
    try {
      await service.appstore.unregisterSource(id)
      toast.show(t('appsSourcesRemoveOk'), 4000)
      await load()
      appstore.invalidate()
    } catch (e) {
      toast.show(t('appsSourcesRemoveFail', { msg: errMsg(e) }), 5000)
    }
  }

  // 订阅挂 store 生命周期(应用级单例):注册是慢任务(下载 tarball),
  // 用户切走页面也要能收敛 + toast(installProgress 同款模式)
  const bus = useMessageBus()
  bus.on('app-store:register-end', () => {
    if (registeringUrl.value !== null) {
      convergeRegistered()
    } else {
      // 别的客户端注册的源:静默同步(不 toast,不是本页发起的)
      if (loaded.value) void load()
      appstore.invalidate()
    }
  })
  bus.on('app-store:register-error', (props) => {
    if (registeringUrl.value === null) return
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const msg = typeof p['message'] === 'string' ? p['message'] : ''
    settleRegister()
    toast.show(t('appsSourcesRegisterFail', { msg }), 5000)
  })

  return { sources, loading, error, loaded, registeringUrl, load, register, unregister }
})
