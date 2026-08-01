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

  it('接口失败时仍渲染入口卡(概览显示空态)', async () => {
    list.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-store-entry').exists()).toBe(true)
    expect(w.text()).toContain('未找到存储')
  })

  // 过期守卫(全局约束 #2,brief 未列出具体 UI 触发点,评审要求就地实现 + 交错测试证明):
  //
  // 这个组件天生只有 onMounted 一次取数、无 props、无定时器——单看 brief 给的两块 UI
  // (概览卡 + 入口卡)确实构不出真实的"两次并发请求"场景。但约束#2 明确要求"必须
  // 就地写守卫"且要写交错测试,而本项目明确反对只为测试开后门(见
  // src/settings/panels/general/WebUiPortRow.vue 的注释:"用 prop 而不是 defineExpose
  // 的测试后门 —— 后者是只为测试存在的生产接口")。
  //
  // 权衡后加了一个真实的手动刷新按钮(.set-store-refresh,复用既有 settingsStatusRefresh
  // 文案,同 SystemStatusPanel 的刷新入口):它本身也是合理功能(用户可能想不跳页就刷新
  // 容量读数),同时给了"第二次取数"一个真实触发点,而不是伪造后门。
  it('旧请求晚于新请求落定时不覆盖新结果(过期守卫)', async () => {
    let resolveFirst!: (v: typeof RAW) => void
    const first = new Promise<typeof RAW>((resolve) => { resolveFirst = resolve })
    // STALE:总量明显不同(93.13 GB vs 476.94 GB),便于跟新结果区分
    const STALE = [{
      disk_name: 'System', size: 100000000000, path: '/dev/nvme0n1', type: 'nvme',
      children: [{
        uuid: 'stale', mount_point: '/', size: '100000000000', avail: '90000000000',
        used: '10000000000', type: 'ext4', path: '/dev/nvme0n1p7', drive_name: 'nvme0n1p7',
        label: 'STALE', persisted_in: 'none',
      }],
    }]

    list.mockReturnValueOnce(first) // 挂载发起的第一次取数被挂住
    const w = mountPanel()
    await flushPromises() // 让 onMounted 的 load() 跑到 await 处并挂住

    // 手动点刷新,第二次(更新的)请求立刻落定
    list.mockResolvedValueOnce(RAW)
    await w.find('.set-store-refresh').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('476.94 GB')

    // 现在才放行第一次的旧结果——不许把新结果冲掉
    resolveFirst(STALE)
    await flushPromises()

    expect(w.text()).toContain('476.94 GB') // 仍是新结果
    expect(w.text()).not.toContain('93.13 GB') // 旧结果没有覆盖它
  })
})
