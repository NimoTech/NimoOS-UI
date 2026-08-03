import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotBanner from './SnapshotBanner.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const INFO = { mount: '/DATA', snapshotName: '20260713T061900Z_manual_改版前', relPath: 'Photos' }
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(SnapshotBanner, {
    props: { info: INFO, restoring: false, canRestore: true, ...props },
    global: { plugins: [i18n] },
  })

describe('SnapshotBanner', () => {
  it('info 为 null 时整条不渲染', () => {
    expect(mountIt({ info: null }).find('.snap-banner').exists()).toBe(false)
  })
  it('显示解析出的人话时间,而不是原始快照名', () => {
    const text = mountIt().text()
    expect(text).not.toContain('20260713T061900Z')
    expect(text).toContain('只读')
  })
  it('快照名解析不出来时回退显示原始名字(不留空)', () => {
    const w = mountIt({ info: { ...INFO, snapshotName: 'weird' } })
    expect(w.text()).toContain('weird')
  })
  it('常驻提示行一直在(不是一次性 toast)', () => {
    expect(mountIt().find('.snap-banner-hint').text()).toContain('恢复')
  })
  it('点退出 emit exit', async () => {
    const w = mountIt()
    await w.find('.snap-banner-exit').trigger('click')
    expect(w.emitted('exit')).toHaveLength(1)
  })
  it('点恢复 emit restore', async () => {
    const w = mountIt()
    await w.find('.snap-banner-restore').trigger('click')
    expect(w.emitted('restore')).toHaveLength(1)
  })
  it('没有可恢复的选中项时恢复按钮禁用且不 emit', async () => {
    const w = mountIt({ canRestore: false })
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeDefined()
    await w.find('.snap-banner-restore').trigger('click')
    expect(w.emitted('restore')).toBeUndefined()
  })
  it('恢复在途时按钮禁用并显示忙态', async () => {
    const w = mountIt({ restoring: true })
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeDefined()
    expect(w.find('.snap-banner-restore').classes()).toContain('is-busy')
  })

  // 评审修复(Critical 1 加分项):`.snapshots` 容器目录本身没有具体快照名,info 恒为
  // null,原实现下横幅整条不渲染——只读锁生效却没有任何提示,像是"锁了但没人告诉你"。
  describe('.snapshots 容器目录(info 为 null,isContainer 为 true)', () => {
    it('显示无时间的引导文案,没有恢复/退出按钮', () => {
      const w = mountIt({ info: null, isContainer: true })
      expect(w.find('.snap-banner').exists()).toBe(true)
      expect(w.text()).toContain('请选择一个快照')
      expect(w.find('.snap-banner-restore').exists()).toBe(false)
      expect(w.find('.snap-banner-exit').exists()).toBe(false)
    })
    it('isContainer 为 false 且 info 为 null 时整条仍不渲染(不是每次 info 为 null 都露出容器提示)', () => {
      expect(mountIt({ info: null, isContainer: false }).find('.snap-banner').exists()).toBe(false)
    })
  })
})
