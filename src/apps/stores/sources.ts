import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppStoreSource } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { useAppstoreStore } from './appstore'

/** Fallback polling interval during registration: the MessageBus subscriber channel buffer=1 can drop
 *  events (known system issue); if register-end is lost, polling listSources until the new URL appears
 *  converges instead of spinning forever (Vue2 relied on events only — an old bug). */
const REGISTER_POLL_MS = 15_000

/** Persist the registering state: restore the "adding" row after page refresh and keep converging
 *  (user acceptance feedback — the pending row disappeared after refresh). Carries a timestamp;
 *  on restore, entries older than the TTL are discarded as stale (prevents pending from being
 *  revived forever when registration failed long ago and the error event was missed). */
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
  /** URL of the source being registered; null = idle. Only one registration in flight at a time (matches the backend async-task semantics). */
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
      /* silent when storage is unavailable — persistence is only an enhancement for refresh recovery */
    }
  }

  /** Fallback polling: converge once the target URL appears in the source list (needle is already lowercased; the backend's duplicate check is case-insensitive) */
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
        /* polling failure is silent; retry next cycle */
      }
    }, REGISTER_POLL_MS)
  }

  /** Successful registration convergence (event or polling, whichever arrives first wins): clear pending + toast + reload list + invalidate the store catalog cache */
  function convergeRegistered() {
    if (registeringUrl.value === null) return
    settleRegister()
    toast.show(t('appsSourcesRegisterOk'), 4000)
    void load()
    appstore.invalidate()
  }

  /** Register a third-party source. Synchronous HTTP errors (409 duplicate / 400 bad URL) throw
   *  Error(message) for the caller to display in place; after acceptance (200) it becomes a backend
   *  async task, converged by app-store:register-end/-error events or polling.
   *  Only one registration in flight at a time (store-level constraint): registeringUrl is a single
   *  ref, and the polling needle is captured in a closure at initiation — if a concurrent second
   *  register() overwrote registeringUrl, the first one's convergence would set the ref to null,
   *  permanently disabling both the second one's polling guard (see the null check in setInterval
   *  below) and the event handlers' null guards, silently swallowing the second registration's
   *  result. Hence the up-front guard that rejects here. */
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
      /* silent when storage is unavailable */
    }
    startPoll(target.toLowerCase())
  }

  /** Unregister: no backend event, wait synchronously (same as Vue2). Errors (e.g. 400 when deleting the last source) surface via toast, not thrown. */
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

  // Refresh recovery: a registration started in the previous page lifecycle is still running on the
  // backend; restore the pending row and re-arm polling. Completion converges via polling or the
  // event subscription below (events carry no URL; single-flight semantics guarantee unambiguous ownership)
  const persisted = readPersistedRegistering()
  if (persisted !== null) {
    registeringUrl.value = persisted
    startPoll(persisted.toLowerCase())
  }

  // Subscription tied to store lifecycle (app-level singleton): registration is a slow task
  // (downloads a tarball), and it must still converge + toast after the user navigates away
  // (same pattern as installProgress)
  const bus = useMessageBus()
  bus.on('app-store:register-end', () => {
    if (registeringUrl.value !== null) {
      convergeRegistered()
    } else {
      // Source registered by another client: sync silently (no toast — not initiated by this page)
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
