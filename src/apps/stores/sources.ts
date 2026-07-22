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

/** 注册中状态落盘:刷新页面后恢复"添加中"行并继续收敛(用户验收反馈——刷新后 pending 行消失)。
 *  带时间戳,恢复时超过 TTL 视为陈旧丢弃(防注册早已失败、error 事件错过后 pending 永久复活)。 */
const REGISTER_PERSIST_KEY = 'nimoos:sources-registering'
const REGISTER_PERSIST_TTL_MS = 10 * 60_000

function readPersistedRegistering(): string | null {
  try {
    const raw = localStorage.getItem(REGISTER_PERSIST_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { url?: unknown; at?: unknown }
    if (typeof v.url !== 'string' || typeof v.at !== 'number') return null
    if (Date.now() - v.at > REGISTER_PERSIST_TTL_MS) return null
    return v.url
  } catch {
    return null
  }
}

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
    try {
      localStorage.removeItem(REGISTER_PERSIST_KEY)
    } catch {
      /* 存储不可用时静默——落盘只是刷新恢复的增强 */
    }
  }

  /** 兜底轮询:看到目标 URL 出现在源列表即收敛(needle 已小写,后端重复判定不区分大小写) */
  function startPoll(needle: string) {
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

  /** 注册成功收敛(事件或轮询,谁先到谁生效):清 pending + toast + 重拉列表 + 失效商店目录缓存 */
  function convergeRegistered() {
    if (registeringUrl.value === null) return
    settleRegister()
    toast.show(t('appsSourcesRegisterOk'), 4000)
    void load()
    appstore.invalidate()
  }

  /** 注册第三方源。同步 HTTP 错误(409 重复/400 坏 URL)抛 Error(message) 给调用方就地展示;
   *  受理(200)后是后端异步任务,由 app-store:register-end/-error 事件或轮询收敛。
   *  一次只允许一个注册在途(店级约束):registeringUrl 是单一 ref,轮询的 needle 在
   *  发起时闭包捕获——若并发第二个 register() 覆盖 registeringUrl,前一个的收敛会把
   *  ref 置 null,导致后一个的轮询守卫(见下方 setInterval 里的 null 检查)和事件处理器
   *  的 null 守卫都永久失效,后一个注册的结果被无声吞掉。因此在这里前置守卫拒绝。 */
  async function register(url: string) {
    if (registeringUrl.value !== null) throw new Error(t('appsSourcesBusy'))
    const target = url.trim()
    registeringUrl.value = target
    try {
      await service.appstore.registerSource(target)
    } catch (e) {
      settleRegister()
      throw new Error(errMsg(e))
    }
    try {
      localStorage.setItem(REGISTER_PERSIST_KEY, JSON.stringify({ url: target, at: Date.now() }))
    } catch {
      /* 存储不可用时静默 */
    }
    startPoll(target.toLowerCase())
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

  // 刷新恢复:上个页面生命周期里发起的注册还在后端跑,恢复 pending 行并重新武装轮询;
  // 完成收敛走轮询或下面的事件订阅(事件不带 URL,单飞语义保证归属无歧义)
  const persisted = readPersistedRegistering()
  if (persisted !== null) {
    registeringUrl.value = persisted
    startPoll(persisted.toLowerCase())
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
