import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const state = {
  port: '80',
  editCalls: [] as unknown[],
  editFail: false,
  // 交错测试专用(下方"挂载期间用户已编辑"用例):非 null 时 getServerPort 返回它而不是
  // state.port,用来手动控制 onMounted 的 await 何时 resolve。其余用例不设置,行为不变。
  portPromise: null as Promise<string> | null,
}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getServerPort: async () => (state.portPromise ? state.portPromise : state.port),
      editServerPort: async (p: { port: string }) => {
        state.editCalls.push(p)
        if (state.editFail) throw new Error('boom')
      },
    },
  },
}))

import WebUiPortRow from './WebUiPortRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// navigate 是可选 prop(生产环境不传 → 真跳转);测试传 spy。
// 不用 defineExpose 开测试后门 —— 那是只为测试存在的生产接口。
const mountRow = (navigate?: (url: string) => void) =>
  mount(WebUiPortRow, { props: navigate ? { navigate } : {}, global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  state.port = '80'
  state.editCalls = []
  state.editFail = false
  state.portPromise = null
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('WebUiPortRow', () => {
  it('挂载后填入当前端口', async () => {
    const w = mountRow()
    await flushPromises()
    expect((w.find('input').element as HTMLInputElement).value).toBe('80')
  })

  // 交错防护回归测试(移植纪律 #4 之外的第 4 项行为:初始异步加载不能压过用户编辑)。
  // 关键:必须走"编辑在前、resolve 在后"的交错路径,且 resolve 用的快照要在编辑*之前*捕获
  // ——否则"陈旧值"其实等于用户刚输入的值,测试即便没有防护也会通过,验证不了任何东西。
  it('挂载期间用户已编辑:onMounted 的旧端口不能覆盖用户输入(交错防护)', async () => {
    let resolveLoad!: (v: string) => void
    state.portPromise = new Promise<string>((resolve) => { resolveLoad = resolve })
    const w = mountRow()
    await flushPromises()
    // 加载仍未 resolve 时,用户先编辑了输入框
    await w.find('input').setValue('9999')
    // 现在才放行 onMounted 的 await —— 用编辑前捕获的快照 '80'
    resolveLoad('80')
    await flushPromises()
    expect((w.find('input').element as HTMLInputElement).value).toBe('9999')
  })

  it('端口未改动时不显示提交按钮(对位 Vue2 portChanged)', async () => {
    const w = mountRow()
    await flushPromises()
    expect(w.find('.wpr-submit').exists()).toBe(false)
  })

  it('改动后出现提交按钮', async () => {
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    expect(w.find('.wpr-submit').exists()).toBe(true)
  })

  it('越界端口:提示错误且不发请求', async () => {
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('79')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(state.editCalls).toEqual([])
    expect(w.text()).toContain('端口范围为 80-65535')
  })

  it('合法端口:下发字符串形态的 port', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(state.editCalls).toEqual([{ port: '8080' }])
  })

  it('保存配置失败:停在原地并提示,不进入探活', async () => {
    state.editFail = true
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('探活成功后跳转到新端口的当前页(移植纪律 #5)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 200, data: '8080' }) })))
    const assign = vi.fn()
    const w = mountRow(assign)
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign.mock.calls[0][0]).toContain(':8080')
  })

  it('探活到上限仍不通:停表 + 提示手动访问,不无限探(移植纪律 #4)', async () => {
    const fetchSpy = vi.fn(async () => { throw new TypeError('down') })
    vi.stubGlobal('fetch', fetchSpy)
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500 * 45)
    await flushPromises()
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(40)
    expect(w.text()).toContain('新端口没有响应')
  })

  it('组件卸载后停表(不留定时器)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    w.unmount()
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await vi.advanceTimersByTimeAsync(1500 * 5)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })
})
