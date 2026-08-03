import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SnapshotsTab from './SnapshotsTab.vue'
import { i18n } from '../../i18n'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

// 造非空列表时字段照后端 NimoOS-KVM/model/snapshot.go(brief 指定,不手编)。
const SNAP = (over: Partial<KvmSnapshot> = {}): KvmSnapshot => ({
  id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '升级前备份',
  state: 'complete', createdAt: '2026-08-03T10:00:00Z', ...over,
})

let w: VueWrapper | null = null
const mk = (props: Record<string, unknown> = {}) => {
  w = mount(SnapshotsTab, {
    props: {
      vmId: 'vm-1', vmState: 'stopped', snapshots: [], busy: false, submitError: '',
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  return w
}
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })

const setVal = async (wr: VueWrapper, sel: string, v: string) => {
  const el = wr.get(sel).element as HTMLInputElement
  el.value = v
  el.dispatchEvent(new Event('input'))
  await wr.vm.$nextTick()
}

describe('SnapshotsTab', () => {
  // 覆盖点 1:创建区两个输入 + 「创建」按钮;标题「创建快照」。
  it('创建区:标题「创建快照」,名称/描述两个输入,「创建」按钮', () => {
    const wr = mk()
    expect(wr.text()).toContain('创建快照')
    expect(wr.find('input[name="snapshotName"]').exists()).toBe(true)
    expect(wr.find('input[name="snapshotName"]').attributes('placeholder')).toBe('输入快照名称')
    expect(wr.find('input[name="snapshotDescription"]').exists()).toBe(true)
    expect(wr.find('input[name="snapshotDescription"]').attributes('placeholder')).toBe('输入描述（可选）')
    expect(wr.find('.cv-primary-btn').text()).toBe('创建')
  })

  // 覆盖点 2:名称空白点创建 → 内联 .cv-error 显示「请输入快照名称」,不 emit create
  // (照 Vue2 :1238-1240,改内联不用 toast)。
  it('名称空白时点创建 → .cv-error 显示「请输入快照名称」,不 emit create', async () => {
    const wr = mk()
    await wr.find('.cv-primary-btn').trigger('click')
    expect(wr.find('.cv-error').text()).toBe('请输入快照名称')
    expect(wr.emitted('create')).toBeUndefined()
  })

  it('纯空白(全是空格)名称同样判定为空,不 emit create', async () => {
    const wr = mk()
    await setVal(wr, 'input[name="snapshotName"]', '   ')
    await wr.find('.cv-primary-btn').trigger('click')
    expect(wr.find('.cv-error').text()).toBe('请输入快照名称')
    expect(wr.emitted('create')).toBeUndefined()
  })

  // 覆盖点 3:名称合法 → emit create:{ name, description }。
  it('名称合法 → emit create: { name, description }', async () => {
    const wr = mk()
    await setVal(wr, 'input[name="snapshotName"]', 'before-upgrade')
    await setVal(wr, 'input[name="snapshotDescription"]', '升级前备份')
    await wr.find('.cv-primary-btn').trigger('click')
    expect(wr.emitted('create')![0]).toEqual([{ name: 'before-upgrade', description: '升级前备份' }])
    expect(wr.find('.cv-error').exists()).toBe(false)
  })

  // 覆盖点 4:busy=true 时创建按钮 is-loading 且点不动。分段写法(同 Task 9
  // VmSettingsDialog.test.ts「saving=true 时主按钮…」那条,避免「被混淆的断言」):
  // 先用合法名称 + busy=false 证明真实点击能提交,排除“表单本身有问题”这个混淆因素;
  // 再用 busy=true + dispatchEvent(绕开原生 disabled)证明 JS 层守卫 `if (props.busy)
  // return` 本身真的挡住了(不是靠浏览器原生 disabled 侥幸挡住)。
  it('busy=true 时创建按钮 is-loading 且点不动(防重复提交)', async () => {
    const ok = mk({ busy: false })
    await setVal(ok, 'input[name="snapshotName"]', 'x')
    await ok.find('.cv-primary-btn').trigger('click')
    expect(ok.emitted('create')).toHaveLength(1)
    ok.unmount()

    const busy = mk({ busy: true })
    await setVal(busy, 'input[name="snapshotName"]', 'x')
    const btn = busy.get('.cv-primary-btn').element as HTMLButtonElement
    expect(btn.classList.contains('is-loading')).toBe(true)
    expect(btn.disabled).toBe(true)
    // 原生 disabled 本身会挡掉 `.trigger('click')`(实为合成的 MouseEvent,jsdom 对
    // disabled 元素同样不派发)——用 dispatchEvent 绕开原生拦截,才能测到 onCreateClick()
    // 内部 `if (props.busy) return` 这道 JS 层守卫本身。
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await busy.vm.$nextTick()
    expect(busy.emitted('create')).toBeUndefined()
  })

  // 覆盖点 5:空列表 → .cv-empty-state 显示「暂无快照」。
  it('空列表 → .cv-empty-state 显示「暂无快照」', () => {
    const wr = mk({ snapshots: [] })
    expect(wr.find('.cv-empty-state').text()).toContain('暂无快照')
    expect(wr.find('.cv-snapshot-item').exists()).toBe(false)
  })

  // 覆盖点 6:非空列表 → 每条显示名称/创建于,有描述才显示描述;formatDate 用
  // new Date(s).toLocaleString()(照 Vue2 :1316-1320)。
  it('非空列表:显示名称/创建于,有描述才显示描述行', () => {
    const withDesc = mk({ snapshots: [SNAP({ name: 'before-upgrade', description: '升级前备份' })] })
    const item = withDesc.find('.cv-snapshot-item')
    expect(item.find('.cv-snapshot-name').text()).toBe('名称: before-upgrade')
    expect(item.find('.cv-snapshot-desc').exists()).toBe(true)
    expect(item.find('.cv-snapshot-desc').text()).toBe('描述: 升级前备份')
    expect(item.find('.cv-snapshot-date').text())
      .toBe(`创建于: ${new Date('2026-08-03T10:00:00Z').toLocaleString()}`)
    withDesc.unmount()

    const noDesc = mk({ snapshots: [SNAP({ description: '' })] })
    expect(noDesc.find('.cv-snapshot-desc').exists()).toBe(false)
  })

  it('createdAt 为空时 formatDate 返回空字符串(照 Vue2 :1317)', () => {
    const wr = mk({ snapshots: [SNAP({ createdAt: '' })] })
    expect(wr.find('.cv-snapshot-date').text()).toBe('创建于:')
  })

  // 覆盖点 7:恢复按钮在 vmState !== 'stopped' 时 disabled(照 Vue2 :368)。
  it('恢复按钮:vmState !== "stopped" 时 disabled,="stopped" 时可点', () => {
    const running = mk({ vmState: 'running', snapshots: [SNAP()] })
    expect((running.find('.cv-btn-restore').element as HTMLButtonElement).disabled).toBe(true)
    running.unmount()

    const stopped = mk({ vmState: 'stopped', snapshots: [SNAP()] })
    expect((stopped.find('.cv-btn-restore').element as HTMLButtonElement).disabled).toBe(false)
  })

  describe('就地二次确认(硬约束 5,照 Vue2 单一 pendingConfirmAction/pendingConfirmId 语义)', () => {
    // 覆盖点 8:删除——第一次点只变文字 + confirm-text-danger,不 emit;第二次点才 emit。
    it('删除第一次点:文字变「你确定吗?」+ confirm-text-danger,不 emit confirm-delete', async () => {
      const wr = mk({ snapshots: [SNAP()] })
      await wr.find('.cv-btn-delete').trigger('click')
      expect(wr.emitted('confirm-delete')).toBeUndefined()
      expect(wr.find('.cv-btn-delete').text()).toContain('你确定吗？')
      expect(wr.find('.cv-btn-delete .confirm-text-danger').exists()).toBe(true)
    })

    it('删除第二次点(同一条):emit confirm-delete 并携带该快照对象', async () => {
      const wr = mk({ snapshots: [SNAP()] })
      await wr.find('.cv-btn-delete').trigger('click')
      await wr.find('.cv-btn-delete').trigger('click')
      expect(wr.emitted('confirm-delete')![0]).toEqual([SNAP()])
    })

    // 恢复同理(覆盖点 8 后半)。用 stopped 状态让恢复按钮可点。
    it('恢复第一次点:文字变「你确定吗?」+ confirm-text-danger,不 emit;第二次点才 emit confirm-restore', async () => {
      const wr = mk({ vmState: 'stopped', snapshots: [SNAP()] })
      await wr.find('.cv-btn-restore').trigger('click')
      expect(wr.emitted('confirm-restore')).toBeUndefined()
      expect(wr.find('.cv-btn-restore').text()).toContain('你确定吗？')
      expect(wr.find('.cv-btn-restore .confirm-text-danger').exists()).toBe(true)

      await wr.find('.cv-btn-restore').trigger('click')
      expect(wr.emitted('confirm-restore')![0]).toEqual([SNAP()])
    })

    // 覆盖点 9:确认态互斥——对 A 点了删除待确认,再点 B 的删除 → A 复位、B 进入待确认。
    it('确认态互斥:A 删除待确认时点 B 的删除 → A 复位、B 进入待确认', async () => {
      const A = SNAP({ id: 'snap-a', name: 'A' })
      const B = SNAP({ id: 'snap-b', name: 'B' })
      const wr = mk({ snapshots: [A, B] })
      const items = wr.findAll('.cv-snapshot-item')
      const delA = items[0].find('.cv-btn-delete')
      const delB = items[1].find('.cv-btn-delete')

      await delA.trigger('click') // A 进入待确认
      expect(delA.text()).toContain('你确定吗？')

      await delB.trigger('click') // 点 B 的删除(第一次)
      expect(wr.emitted('confirm-delete')).toBeUndefined() // B 第一次点只是进入待确认,没真删
      // A 必须复位(不再是"你确定吗?"),B 进入待确认——重新取一次 DOM 引用,
      // 避免 findAll 缓存的旧包装器读到过期文本。
      const itemsAfter = wr.findAll('.cv-snapshot-item')
      expect(itemsAfter[0].find('.cv-btn-delete').text()).toContain('删除')
      expect(itemsAfter[0].find('.cv-btn-delete').text()).not.toContain('你确定吗？')
      expect(itemsAfter[1].find('.cv-btn-delete').text()).toContain('你确定吗？')

      // 再点一次 B 的删除(第二次,确认态仍在 B 上)→ 真正 emit,且只携带 B。
      await itemsAfter[1].find('.cv-btn-delete').trigger('click')
      expect(wr.emitted('confirm-delete')![0]).toEqual([B])
    })

    // 覆盖点 10:切换动作也复位——同一条上先点删除(待确认)再点恢复 → 变成恢复待确认,
    // 删除文字复位。
    it('切换动作复位:同一条上先删除待确认,再点恢复 → 变恢复待确认,删除复位', async () => {
      const wr = mk({ vmState: 'stopped', snapshots: [SNAP()] })
      await wr.find('.cv-btn-delete').trigger('click') // 删除待确认
      expect(wr.find('.cv-btn-delete').text()).toContain('你确定吗？')

      await wr.find('.cv-btn-restore').trigger('click') // 点了同一条的恢复(第一次)
      expect(wr.emitted('confirm-restore')).toBeUndefined() // 第一次点恢复只是进入待确认
      expect(wr.find('.cv-btn-delete').text()).toContain('删除') // 删除复位
      expect(wr.find('.cv-btn-delete').text()).not.toContain('你确定吗？')
      expect(wr.find('.cv-btn-restore').text()).toContain('你确定吗？') // 恢复进入待确认
    })
  })

  // 覆盖点 11:submitError 显示在同一个 .cv-error 位。
  it('submitError 显示在 .cv-error', () => {
    const wr = mk({ submitError: 'domain is not stopped' })
    expect(wr.find('.cv-error').text()).toBe('domain is not stopped')
  })

  // 补充覆盖(照 Vue2 createSnapshot :1250,成功后清空表单):busy 从 true 变回 false
  // 且 submitError 仍为空 → 表单清空,方便连续创建时不会带着上一次的名称/描述。
  it('busy 从 true 变回 false 且无 submitError → 表单清空(照 Vue2 成功后清空)', async () => {
    const wr = mk({ busy: true })
    await setVal(wr, 'input[name="snapshotName"]', 'temp-name')
    await setVal(wr, 'input[name="snapshotDescription"]', 'temp-desc')
    await wr.setProps({ busy: false, submitError: '' })
    expect((wr.get('input[name="snapshotName"]').element as HTMLInputElement).value).toBe('')
    expect((wr.get('input[name="snapshotDescription"]').element as HTMLInputElement).value).toBe('')
  })

  it('busy 从 true 变回 false 但 submitError 非空(失败)→ 表单保留,不清空', async () => {
    const wr = mk({ busy: true })
    await setVal(wr, 'input[name="snapshotName"]', 'temp-name')
    await wr.setProps({ busy: false, submitError: 'disk quota exceeded' })
    expect((wr.get('input[name="snapshotName"]').element as HTMLInputElement).value).toBe('temp-name')
  })
})
