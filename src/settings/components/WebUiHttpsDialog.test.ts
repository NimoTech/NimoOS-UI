import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

// curl 实证 2026-07-31 GET /v1/gateway/ssl
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
// 任务简报给的这份测试原文直接 mount() 后就地 find(...) —— 但 Dialog.vue(共享文件,
// 本任务不可改)经由 reka-ui 的 DialogPortal 把内容 Teleport 到 <body>,不在 mount()
// 返回的 wrapper 自己的 DOM 子树内(同 DeviceInfoDialog.test.ts / UpdateDialog.test.ts
// 记录的既有坑)。这里补 attachTo: document.body + 对 document.body 取 DOMWrapper 查询。
let activeWrapper: ReturnType<typeof mount> | null = null
const mountIt = (open = true) => {
  activeWrapper = mount(WebUiHttpsDialog, { props: { open }, global: { plugins: [i18n] }, attachTo: document.body })
  return activeWrapper
}
const body = () => new DOMWrapper(document.body)

// jsdom 里 <input type=file> 的 files 是只读的,用 defineProperty 塞进去再触发 change ——
// 走的是组件真实的 @change 处理器,不必在生产组件上开测试后门。
async function pickFiles(pem: File | null, crt: File | null) {
  const inputs = body().findAll('.wh-file')
  const set = async (i: number, f: File) => {
    Object.defineProperty(inputs[i].element, 'files', { value: [f], configurable: true })
    await inputs[i].trigger('change')
  }
  if (pem) await set(0, pem)
  if (crt) await set(1, crt)
}

// 对位 rows.test.ts 里 TimezoneRow/DiskStandbyRow 的交错路径写法:挂起一个可控 Promise,
// 让服务端读取"卡住",在此期间做用户操作,最后用一份**提前拍好**的旧快照 resolve ——
// 不能等 resolve 时刻再从共享 state 读,那时 state 早被别的东西改过,不算"迟到的旧值"。
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

  // 交错路径守卫(newui-async-stale-guard):弹窗打开后 getSSLConfig 还没返回时,
  // 用户已经手改了域名。迟到的加载结果不能把用户刚打的字覆盖掉。
  // 快照必须在用户输入**之前**拍下,且用这份旧快照 resolve —— 不能等 resolve 时刻
  // 再读 state.ssl(那时早被别的东西改过,不算真正的"迟到")。
  it('打开弹窗后加载还没返回,用户先改了域名,迟到的服务端值不能覆盖用户输入(交错路径守卫)', async () => {
    state.ssl = { ...SSL, domain: 'server-stale.local' }
    const staleSnapshot = { ...state.ssl }
    const svc = await import('@nimotech/nimoos-service')
    const deferred = createDeferred<typeof SSL>()
    vi.spyOn(svc.service.sys, 'getSSLConfig').mockReturnValueOnce(deferred.promise)

    mountIt()
    await flushPromises()
    // 此时 watch(open, immediate) 里的 getSSLConfig() 还卡在 deferred,用户已经手改了域名:
    await body().find('.wh-domain').setValue('user-typed.local')
    await flushPromises()
    // 加载才姗姗来迟地返回(用提前拍好的旧快照,而不是当下的 state.ssl):
    deferred.resolve(staleSnapshot)
    await flushPromises()

    expect((body().find('.wh-domain').element as HTMLInputElement).value).toBe('user-typed.local')
  })
})
