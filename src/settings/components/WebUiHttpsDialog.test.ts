import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

// Verified via curl 2026-07-31: GET /v1/gateway/ssl
const SSL = {
  enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto',
  effective_time: '0001-01-01T00:00:00Z', expiration_time: '0001-01-01T00:00:00Z',
}
const state = { ssl: { ...SSL }, setCalls: [] as unknown[], uploadCalls: 0, setFail: false, uploadFail: false }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getSSLConfig: async () => ({ ...state.ssl }),
      setSSLConfig: async (c: unknown) => { state.setCalls.push(c); if (state.setFail) throw new Error('boom') },
      uploadSSLCert: async () => { state.uploadCalls++; if (state.uploadFail) throw new Error('boom') },
    },
  },
}))

import WebUiHttpsDialog from './WebUiHttpsDialog.vue'
import { formatSslDate } from '../util/sslDate'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// The task brief's original test did mount() then find(...) in place — but Dialog.vue
// (a shared file this task must not modify) teleports its content to <body> via reka-ui's
// DialogPortal, outside the mount() wrapper's own DOM subtree (same known pitfall recorded
// in DeviceInfoDialog.test.ts / UpdateDialog.test.ts). Here we add attachTo: document.body
// + query via a DOMWrapper over document.body.
let activeWrapper: ReturnType<typeof mount> | null = null
const mountIt = (open = true) => {
  activeWrapper = mount(WebUiHttpsDialog, { props: { open }, global: { plugins: [i18n] }, attachTo: document.body })
  return activeWrapper
}
const body = () => new DOMWrapper(document.body)

// In jsdom, <input type=file>.files is read-only; inject via defineProperty then trigger
// change — this exercises the component's real @change handler, so no test backdoor is
// needed in the production component.
async function pickFiles(pem: File | null, crt: File | null) {
  const inputs = body().findAll('.wh-file')
  const set = async (i: number, f: File) => {
    Object.defineProperty(inputs[i].element, 'files', { value: [f], configurable: true })
    await inputs[i].trigger('change')
  }
  if (pem) await set(0, pem)
  if (crt) await set(1, crt)
}

// Mirrors the interleaved-path pattern of TimezoneRow/DiskStandbyRow in rows.test.ts:
// suspend a controllable Promise so the server read "hangs", perform user actions in the
// meantime, and finally resolve with a snapshot taken IN ADVANCE — don't read shared state
// at resolve time, since by then it has already been mutated and wouldn't be a truly "late stale value".
function createDeferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  state.ssl = { ...SSL }; state.setCalls = []; state.uploadCalls = 0
  state.setFail = false; state.uploadFail = false
})
afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
  document.body.innerHTML = ''
})

describe('formatSslDate', () => {
  it('Go 零值时间 → ---(实测本机就是 0001-01-01)', () => {
    expect(formatSslDate('0001-01-01T00:00:00Z')).toBe('---')
  })
  it('空 / undefined → ---', () => {
    expect(formatSslDate('')).toBe('---')
    expect(formatSslDate(undefined)).toBe('---')
  })
  it('非法日期 → ---(Vue2 用 try/catch 但 new Date 不抛,会输出 NaN/NaN/NaN —— 不照抄)', () => {
    expect(formatSslDate('不是日期')).toBe('---')
  })
  it('正常日期 → DD/MM/YYYY(对位 Vue2 formatDate)', () => {
    expect(formatSslDate('2027-03-09T10:00:00Z')).toMatch(/^\d{2}\/\d{2}\/2027$/)
  })
})

describe('WebUiHttpsDialog', () => {
  it('打开时拉配置并填入表单', async () => {
    mountIt(); await flushPromises()
    expect((body().find('.wh-domain').element as HTMLInputElement).value).toBe('nimoos.local')
    expect((body().find('.wh-port').element as HTMLInputElement).value).toBe('443')
  })

  it('open=false 不拉配置', async () => {
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.sys, 'getSSLConfig')
    mountIt(false); await flushPromises()
    expect(spy).not.toHaveBeenCalled()
  })

  it('零值时间显示 ---', async () => {
    mountIt(); await flushPromises()
    expect(body().findAll('.wh-date').map((e) => e.text())).toEqual(['---', '---'])
  })

  it('cert_type=auto 时显示「下载 CA 证书」,不显示上传位', async () => {
    mountIt(); await flushPromises()
    expect(body().find('.wh-ca').exists()).toBe(true)
    expect(body().find('.wh-upload').exists()).toBe(false)
  })

  it('切到 custom 显示上传位,隐藏 CA 下载', async () => {
    mountIt(); await flushPromises()
    await body().find('.wh-cert').setValue('custom')
    expect(body().find('.wh-upload').exists()).toBe(true)
    expect(body().find('.wh-ca').exists()).toBe(false)
  })

  it('auto 保存:只下发 4 个字段,不回传只读时间', async () => {
    mountIt(); await flushPromises()
    await body().find('.wh-save').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([{ enabled: false, domain: 'nimoos.local', port: '443', cert_type: 'auto' }])
    expect(state.uploadCalls).toBe(0)
  })

  it('保存成功后 emit saved 并关窗', async () => {
    const w = mountIt(); await flushPromises()
    await body().find('.wh-save').trigger('click'); await flushPromises()
    expect(w.emitted('saved')).toBeTruthy()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('保存配置失败不关窗(让用户能改了再试)', async () => {
    state.setFail = true
    const w = mountIt(); await flushPromises()
    await body().find('.wh-save').trigger('click'); await flushPromises()
    expect(w.emitted('update:open')).toBeFalsy()
  })

  it('custom 但只选了一个文件:提示要两个,不发上传也不发保存', async () => {
    mountIt(); await flushPromises()
    await body().find('.wh-cert').setValue('custom')
    await pickFiles(new File(['x'], 'a.pem'), null)
    await body().find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(0)
    expect(state.setCalls).toEqual([])
    expect(body().text()).toContain('请同时上传')
  })

  it('custom 且两个文件都选了:先上传再保存', async () => {
    mountIt(); await flushPromises()
    await body().find('.wh-cert').setValue('custom')
    await pickFiles(new File(['x'], 'a.pem'), new File(['y'], 'b.crt'))
    await body().find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(1)
    expect(state.setCalls).toHaveLength(1)
  })

  it('上传失败就不再保存配置(避免配置说 custom 而证书没上去)', async () => {
    state.uploadFail = true
    mountIt(); await flushPromises()
    await body().find('.wh-cert').setValue('custom')
    await pickFiles(new File(['x'], 'a.pem'), new File(['y'], 'b.crt'))
    await body().find('.wh-save').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([])
  })

  it('custom 但一个文件都没选:直接保存(沿用服务端已有证书)', async () => {
    state.ssl = { ...SSL, cert_type: 'custom' }
    mountIt(); await flushPromises()
    await body().find('.wh-save').trigger('click'); await flushPromises()
    expect(state.uploadCalls).toBe(0)
    expect(state.setCalls).toHaveLength(1)
  })

  // Interleaved-path guard (newui-async-stale-guard): the user has already hand-edited the
  // domain while getSSLConfig is still pending after the dialog opened. The late load result
  // must not overwrite what the user just typed.
  // The snapshot must be taken BEFORE the user input, and resolve with that stale snapshot —
  // don't read state.ssl at resolve time (it would already be mutated; not a true "late arrival").
  it('打开弹窗后加载还没返回,用户先改了域名,迟到的服务端值不能覆盖用户输入(交错路径守卫)', async () => {
    state.ssl = { ...SSL, domain: 'server-stale.local' }
    const staleSnapshot = { ...state.ssl }
    const svc = await import('@nimotech/nimoos-service')
    const deferred = createDeferred<typeof SSL>()
    vi.spyOn(svc.service.sys, 'getSSLConfig').mockReturnValueOnce(deferred.promise)

    mountIt()
    await flushPromises()
    // At this point getSSLConfig() inside watch(open, immediate) is still stuck on the deferred; the user has already edited the domain:
    await body().find('.wh-domain').setValue('user-typed.local')
    await flushPromises()
    // Only now does the load belatedly return (with the pre-taken stale snapshot, not the current state.ssl):
    deferred.resolve(staleSnapshot)
    await flushPromises()

    expect((body().find('.wh-domain').element as HTMLInputElement).value).toBe('user-typed.local')
  })
})
