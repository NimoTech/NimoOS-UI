import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OverflowMenu from './OverflowMenu.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

// Brief draft Chinese assertions corrected against actual zh_cn.sp9.ts values (grep checked before work start,
// see task-5-report.md): kvmAreYouSure draft "确定吗?" → actual "你确定吗？" (full-width punctuation, added "你")
// kvmAutoStart draft "开机自启" → actual "自动启动"
// kvmResume draft "继续" → actual "恢复"
// Others (force shutdown/force restart/pause/wakeup/start/delete) verified to match draft, no changes made.

const VM = (state: string, over: Partial<KvmVM> = {}) =>
  ({ id: 'vm-1', name: 'x', state, autostart: false, ...over } as KvmVM)
const mk = (vm: KvmVM, processing = false) =>
  mount(OverflowMenu, { props: { vm, processing }, global: { plugins: [i18n] } })
const labels = (w: ReturnType<typeof mk>) => w.findAll('.dropdown-item').map((b) => b.text())

describe('menu items show/hide based on state (mirrors Vue2 :97-135)', () => {
  it('running: shows shutdown/restart/pause/autostart, no start or delete', () => {
    const t = labels(mk(VM('running')))
    expect(t.some((x) => x.includes('强制关机'))).toBe(true)
    expect(t.some((x) => x.includes('强制重启'))).toBe(true)
    expect(t.some((x) => x.includes('暂停'))).toBe(true)
    expect(t.some((x) => x.includes('自动启动'))).toBe(true)
    expect(t.some((x) => x === '开机')).toBe(false)
    expect(t.some((x) => x.includes('删除'))).toBe(false)
  })
  it('stopped: shows start/autostart/delete with divider above delete', () => {
    const w = mk(VM('stopped'))
    const t = labels(w)
    expect(t.some((x) => x.includes('开机'))).toBe(true)
    expect(t.some((x) => x.includes('删除'))).toBe(true)
    expect(w.find('.dropdown-divider').exists()).toBe(true)
  })
  it('paused: shows restart/resume, no pause', () => {
    const t = labels(mk(VM('paused')))
    expect(t.some((x) => x.includes('恢复'))).toBe(true)
    expect(t.some((x) => x.includes('强制重启'))).toBe(true)
    expect(t.some((x) => x === '暂停')).toBe(false)
  })
  it('suspended: shows only wakeup (+autostart)', () => {
    const t = labels(mk(VM('suspended')))
    expect(t.some((x) => x.includes('唤醒'))).toBe(true)
    expect(t.some((x) => x.includes('开机'))).toBe(false)
  })
  it('missing: shows only delete, no divider', () => {
    const w = mk(VM('missing'))
    expect(labels(w).some((x) => x.includes('删除'))).toBe(true)
    expect(w.find('.dropdown-divider').exists()).toBe(false)
  })
  it('autostart toggle indicator lights based on vm.autostart', () => {
    expect(mk(VM('running', { autostart: true })).get('.toggle-indicator').classes()).toContain('on')
    expect(mk(VM('running')).get('.toggle-indicator').classes()).not.toContain('on')
  })
  it('autostart item disabled when processing (Vue2 :127 :disabled="_processing")', () => {
    const item = mk(VM('running'), true).findAll('.dropdown-item').find((b) => b.text().includes('自动启动'))!
    expect(item.attributes('disabled')).toBeDefined()
  })
})

describe('inline double-confirmation', () => {
  const clickByText = async (w: ReturnType<typeof mk>, txt: string) => {
    const b = w.findAll('.dropdown-item').find((x) => x.text().includes(txt))!
    await b.trigger('click')
    return b
  }

  it('shutdown first click changes text only, does not emit', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    expect(w.emitted('action')).toBeUndefined()
    expect(w.text()).toContain('你确定吗？')
    expect(w.find('.confirm-text-danger').exists()).toBe(true)
  })

  it('second click emits action("stop")', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    await clickByText(w, '你确定吗？')
    expect(w.emitted('action')![0]).toEqual(['stop'])
  })

  it('restart and delete also require two clicks', async () => {
    const w1 = mk(VM('running'))
    await clickByText(w1, '强制重启'); expect(w1.emitted('action')).toBeUndefined()
    await clickByText(w1, '你确定吗？'); expect(w1.emitted('action')![0]).toEqual(['restart'])

    const w2 = mk(VM('stopped'))
    await clickByText(w2, '删除'); expect(w2.emitted('action')).toBeUndefined()
    await clickByText(w2, '你确定吗？'); expect(w2.emitted('action')![0]).toEqual(['delete'])
  })

  it('start/pause/resume/wakeup/autostart require single click, no confirmation', async () => {
    const a = mk(VM('stopped')); await clickByText(a, '开机')
    expect(a.emitted('action')![0]).toEqual(['start'])
    const b = mk(VM('running')); await clickByText(b, '暂停')
    expect(b.emitted('action')![0]).toEqual(['pause'])
    const c = mk(VM('paused')); await clickByText(c, '恢复')
    expect(c.emitted('action')![0]).toEqual(['resume'])
    const d = mk(VM('suspended')); await clickByText(d, '唤醒')
    expect(d.emitted('action')![0]).toEqual(['wakeup'])
    const e = mk(VM('running')); await clickByText(e, '自动启动')
    expect(e.emitted('action')![0]).toEqual(['autostart'])
  })

  it('confirmation state on stop transfers to restart when clicked, does not accidentally trigger stop', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')          // stop 进入待确认
    const restart = w.findAll('.dropdown-item').find((x) => x.text().includes('强制重启'))!
    await restart.trigger('click')            // 点了另一项
    expect(w.emitted('action')).toBeUndefined()
    expect(restart.text()).toContain('你确定吗？')
  })
})
