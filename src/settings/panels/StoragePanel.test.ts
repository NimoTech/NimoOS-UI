import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StoragePanel from './StoragePanel.vue'
import { i18n } from '../../i18n'

const list = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { storage: { list: (...a: unknown[]) => list(...a) }, raid: { list: () => Promise.resolve([]) } },
}))
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

// 真机 fixture(2026-08-01 curl GET /v1/storage?system=show,逐字)
const RAW = [{
  disk_name: 'System', size: 512110190592, path: '/dev/nvme0n1', type: 'nvme',
  children: [{
    uuid: 'da0e4da3-4a51-4655-8d89-d0f761d08c0a', mount_point: '/', size: '512110190592',
    avail: '333092294144', used: '179017896448', type: 'ext4', path: '/dev/nvme0n1p7',
    drive_name: 'nvme0n1p7', label: 'NimoOS-HD', persisted_in: 'none',
  }],
}]

const mountPanel = () => mount(StoragePanel, { global: { plugins: [i18n] } })

describe('StoragePanel(入口卡)', () => {
  beforeEach(() => { list.mockReset(); push.mockReset(); list.mockResolvedValue(RAW) })

  it('渲染容量概览:总量与可用量取真实值', async () => {
    const w = mountPanel()
    await flushPromises()
    // 512110190592 B → renderSize 真实输出 476.94 GB(brief 写的 476.95 GB 是计算误差,
    // 以 renderSize 实际输出为准改了断言,renderSize 本身未改)。
    // 333092294144 B → 310.22 GB(与 brief 一致)。
    expect(w.text()).toContain('476.94 GB')
    expect(w.text()).toContain('310.22 GB')
  })

  it('系统盘用量按 8% 启发式拆成"系统"与"文件"两段,两段宽度加起来不超过 100%', async () => {
    const w = mountPanel()
    await flushPromises()
    // 判别力:size*0.08(40968815247.36)< usedSize(179017896448),所以 os 命中
    // min() 的前一支,osPct 恒等于 8%——若公式被改坏(比如误用 usedSize 而非
    // size*0.08,或 min/max 写反),os 就不会是 8,这条断言会翻红。
    const os = parseFloat((w.find('.set-store-seg-os').attributes('style') || '').replace(/\D+([\d.]+).*/, '$1'))
    const data = parseFloat((w.find('.set-store-seg-data').attributes('style') || '').replace(/\D+([\d.]+).*/, '$1'))
    expect(os).toBeCloseTo(8, 1)
    expect(os + data).toBeLessThanOrEqual(100)
  })

  it('点入口卡跳 /storage', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-store-entry').trigger('click')
    expect(push).toHaveBeenCalledWith('/storage')
  })

  // 评审 Important #3:取数在途时不能落到 v-else 分支渲染概览卡——那样会显示一段
  // 错误读数(0 Bytes 可用 + 空进度条),不是中性空态。这里用手动 resolve 的挂起
  // promise 钉住:落定前渲染骨架,落定后才渲染真实概览。
  it('取数在途渲染加载骨架,不渲染 0 值假读数;落定后才渲染真实概览', async () => {
    let resolve!: (v: typeof RAW) => void
    const pending = new Promise<typeof RAW>((res) => { resolve = res })
    list.mockReturnValueOnce(pending)
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(true)
    expect(w.find('.set-store-overview').exists()).toBe(false)

    resolve(RAW)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.find('.set-store-overview').exists()).toBe(true)
    expect(w.text()).toContain('476.94 GB')
  })

  it('接口失败时仍渲染入口卡(概览显示空态)', async () => {
    list.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-store-entry').exists()).toBe(true)
    expect(w.text()).toContain('未找到存储')
  })

  // 没有「过期守卫」的交错测试:实测过(mount → unmount → 挂住的请求这时才 resolve),
  // jsdom 下即使把组件里的 alive 守卫整个删掉,这条用例依然全绿——组件卸载后
  // Vue 的响应式副作用已经停止,回写一个没人再读的 ref 既不抛错也无可观察差异,
  // 断言翻不了红,是空转用例。守卫代码本身保留(见 StoragePanel.vue 里 alive 那行
  // 注释:防的是「请求在途时组件被卸载,迟到的结果回写已卸载组件的 ref」),但不为它
  // 强行凑一条测不出问题的用例。
})
