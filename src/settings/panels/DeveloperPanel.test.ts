import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import { useToast } from '../../stores/toast'

const state = { ssl: { enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto', effective_time: '', expiration_time: '' }, setCalls: [] as unknown[], setFail: false }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getSSLConfig: async () => ({ ...state.ssl }),
      setSSLConfig: async (c: unknown) => { state.setCalls.push(c); if (state.setFail) throw new Error('boom') },
      uploadSSLCert: async () => {},
    },
  },
}))

import DeveloperPanel from './DeveloperPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(DeveloperPanel, { global: { plugins: [i18n] } })

// Same as WebUiHttpsDialog.test.ts: the interleaved-path guard needs a controllable
// Promise to stall the server read, and resolves with a stale snapshot captured
// ahead of time, rather than reading shared state at resolve time.
function createDeferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  state.ssl = { ...state.ssl, enabled: false, cert_type: 'auto' }
  state.setCalls = []; state.setFail = false
})

describe('DeveloperPanel', () => {
  it('uses a back button instead of a title; clicking it emits open-tab general (P0 behavior unchanged)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-section-title').exists()).toBe(false)
    await w.find('.set-back').trigger('click')
    expect(w.emitted('open-tab')).toEqual([['general']])
  })

  it('P0\'s empty-state placeholder has been removed', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
  })

  it('renders the HTTPS toggle, with state coming from the server', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('does not show the config entry row when off (parity with Vue2 v-if="sslEnabled")', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.dp-config').exists()).toBe(false)
  })

  it('shows the config entry row when on', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    expect(w.find('.dp-config').exists()).toBe(true)
  })

  it('flips HTTPS on: sends enabled:true and fills in the fallback domain/port/cert_type values', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([{ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' }])
  })

  it('uses Vue2\'s fallback values (nimoos.local / 443 / auto) when server fields are empty', async () => {
    state.ssl = { ...state.ssl, domain: '', port: '', cert_type: '' }
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(state.setCalls[0]).toEqual({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
  })

  it('the toggle bounces back when sending fails (parity with Vue2 sslEnabled = !val)', async () => {
    state.setFail = true
    const toast = useToast()
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    // Review fix round 2 · Important: previously this only verified the toggle bounced
    // back, not that the user was actually notified.
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('clicking the config entry opens the dialog', async () => {
    // .dp-config, passed as a class to SettingsRow, lands on its root wrapper
    // (.set-row-wrap), not on the clickable inner <button> (.set-list-item) — clicking
    // the wrapper doesn't trigger click.
    // The test targets the inner button rather than changing the shared SettingsRow
    // (brief's call: go with the former).
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    await w.find('.dp-config .set-list-item').trigger('click')
    expect(w.findComponent({ name: 'WebUiHttpsDialog' }).props('open')).toBe(true)
  })

  it('re-fetches config after the dialog emits saved (parity with Vue2 modal close → getSSLConfig)', async () => {
    state.ssl.enabled = true
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.sys, 'getSSLConfig')
    const w = mountIt(); await flushPromises()
    const before = spy.mock.calls.length
    w.findComponent({ name: 'WebUiHttpsDialog' }).vm.$emit('saved')
    await flushPromises()
    expect(spy.mock.calls.length).toBeGreaterThan(before)
  })

  // Interleaved-path guard (newui-async-stale-guard): getSSLConfig hasn't returned yet
  // at mount time, and the user has already flipped the toggle (and it sent
  // successfully). The late-arriving load result (the old enabled:false) must not
  // bounce the toggle back — that would make the UI lie, claiming the user's action
  // didn't take effect.
  it('the late-arriving load result must not bounce the toggle back when the user already flipped it (with a successful send) before load returned (interleaved-path guard)', async () => {
    const staleSnapshot = { ...state.ssl } // enabled: false, a stale snapshot captured before mount/the action
    const svc = await import('@nimotech/nimoos-service')
    const deferred = createDeferred<typeof state.ssl>()
    vi.spyOn(svc.service.sys, 'getSSLConfig').mockReturnValueOnce(deferred.promise)

    const w = mountIt()
    // At this point onMounted's load() is still stuck on deferred, and the user has
    // already clicked the toggle (setSSLConfig goes through a different mock, unaffected
    // by deferred, which resolves normally):
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    // Only now does the load belatedly return (using the stale snapshot captured ahead
    // of time, not the current state.ssl):
    deferred.resolve(staleSnapshot)
    await flushPromises()

    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })
})
