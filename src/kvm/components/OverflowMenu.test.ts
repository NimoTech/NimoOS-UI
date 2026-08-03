import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OverflowMenu from './OverflowMenu.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

// brief 草稿的中文断言按 zh_cn.sp9.ts 实际值订正(开工前 grep 核对,见 task-5-report.md):
// kvmAreYouSure 草稿"确定吗?" → 实际"你确定吗？"(全角问号,多一个"你")
// kvmAutoStart  草稿"开机自启" → 实际"自动启动"
// kvmResume     草稿"继续"   → 实际"恢复"
// 其余(强制关机/强制重启/暂停/唤醒/开机/删除)核对后与草稿一致,未改动。

const VM = (state: string, over: Partial<KvmVM> = {}) =>
  ({ id: 'vm-1', name: 'x', state, autostart: false, ...over } as KvmVM)
const mk = (vm: KvmVM, processing = false) =>
  mount(OverflowMenu, { props: { vm, processing }, global: { plugins: [i18n] } })
const labels = (w: ReturnType<typeof mk>) => w.findAll('.dropdown-item').map((b) => b.text())

describe('菜单项按状态显隐(对 Vue2 :97-135)', () => {
  it('running:关机/重启/暂停/自启,无开机、无删除', () => {
    const t = labels(mk(VM('running')))
    expect(t.some((x) => x.includes('强制关机'))).toBe(true)
    expect(t.some((x) => x.includes('强制重启'))).toBe(true)
    expect(t.some((x) => x.includes('暂停'))).toBe(true)
    expect(t.some((x) => x.includes('自动启动'))).toBe(true)
    expect(t.some((x) => x === '开机')).toBe(false)
    expect(t.some((x) => x.includes('删除'))).toBe(false)
  })
  it('stopped:开机/自启/删除,且删除上方有分隔线', () => {
    const w = mk(VM('stopped'))
    const t = labels(w)
    expect(t.some((x) => x.includes('开机'))).toBe(true)
    expect(t.some((x) => x.includes('删除'))).toBe(true)
    expect(w.find('.dropdown-divider').exists()).toBe(true)
  })
  it('paused:重启/继续(恢复),无暂停', () => {
    const t = labels(mk(VM('paused')))
    expect(t.some((x) => x.includes('恢复'))).toBe(true)
    expect(t.some((x) => x.includes('强制重启'))).toBe(true)
    expect(t.some((x) => x === '暂停')).toBe(false)
  })
  it('suspended:只有唤醒(+自启)', () => {
    const t = labels(mk(VM('suspended')))
    expect(t.some((x) => x.includes('唤醒'))).toBe(true)
    expect(t.some((x) => x.includes('开机'))).toBe(false)
  })
  it('missing:只能删除,且不画分隔线', () => {
    const w = mk(VM('missing'))
    expect(labels(w).some((x) => x.includes('删除'))).toBe(true)
    expect(w.find('.dropdown-divider').exists()).toBe(false)
  })
  it('autostart 开关的指示点按 vm.autostart 亮灭', () => {
    expect(mk(VM('running', { autostart: true })).get('.toggle-indicator').classes()).toContain('on')
    expect(mk(VM('running')).get('.toggle-indicator').classes()).not.toContain('on')
  })
  it('processing 时自启项禁用(Vue2 :127 的 :disabled="_processing")', () => {
    const item = mk(VM('running'), true).findAll('.dropdown-item').find((b) => b.text().includes('自动启动'))!
    expect(item.attributes('disabled')).toBeDefined()
  })
})

describe('就地二次确认', () => {
  const clickByText = async (w: ReturnType<typeof mk>, txt: string) => {
    const b = w.findAll('.dropdown-item').find((x) => x.text().includes(txt))!
    await b.trigger('click')
    return b
  }

  it('关机第一次点只变文字,不 emit', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    expect(w.emitted('action')).toBeUndefined()
    expect(w.text()).toContain('你确定吗？')
    expect(w.find('.confirm-text-danger').exists()).toBe(true)
  })

  it('第二次点才 emit action("stop")', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    await clickByText(w, '你确定吗？')
    expect(w.emitted('action')![0]).toEqual(['stop'])
  })

  it('重启与删除同样是两次点', async () => {
    const w1 = mk(VM('running'))
    await clickByText(w1, '强制重启'); expect(w1.emitted('action')).toBeUndefined()
    await clickByText(w1, '你确定吗？'); expect(w1.emitted('action')![0]).toEqual(['restart'])

    const w2 = mk(VM('stopped'))
    await clickByText(w2, '删除'); expect(w2.emitted('action')).toBeUndefined()
    await clickByText(w2, '你确定吗？'); expect(w2.emitted('action')![0]).toEqual(['delete'])
  })

  it('开机/暂停/恢复/唤醒/自启是一次点,不需要确认', async () => {
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

  it('确认态挂在 stop 上时,点 restart 会把确认态转移过去而不是误触发 stop', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')          // stop 进入待确认
    const restart = w.findAll('.dropdown-item').find((x) => x.text().includes('强制重启'))!
    await restart.trigger('click')            // 点了另一项
    expect(w.emitted('action')).toBeUndefined()
    expect(restart.text()).toContain('你确定吗？')
  })
})
