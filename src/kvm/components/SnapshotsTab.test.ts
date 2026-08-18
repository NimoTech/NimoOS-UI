import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import SnapshotsTab from './SnapshotsTab.vue'
import { i18n } from '../../i18n'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

// Fields for non-empty list fixtures follow backend NimoOS-KVM/model/snapshot.go (specified in the brief, not hand-authored).
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
  // Coverage point 1: create section has two inputs + a "Create" button; title "Create Snapshot".
  it('Create section: title "Create Snapshot", name/description two inputs, "Create" button', () => {
    const wr = mk()
    expect(wr.text()).toContain('创建快照')
    expect(wr.find('input[name="snapshotName"]').exists()).toBe(true)
    expect(wr.find('input[name="snapshotName"]').attributes('placeholder')).toBe('输入快照名称')
    expect(wr.find('input[name="snapshotDescription"]').exists()).toBe(true)
    expect(wr.find('input[name="snapshotDescription"]').attributes('placeholder')).toBe('输入描述（可选）')
    expect(wr.find('.cv-primary-btn').text()).toBe('创建')
  })

  // Coverage point 2: clicking Create with a blank name → inline .cv-error shows "please enter a snapshot name", no create emit
  // (per Vue2 :1238-1240, changed to inline error instead of toast).
  it('Clicking Create with blank name → .cv-error shows "please enter snapshot name", no emit create', async () => {
    const wr = mk()
    await wr.find('.cv-primary-btn').trigger('click')
    expect(wr.find('.cv-error').text()).toBe('请输入快照名称')
    expect(wr.emitted('create')).toBeUndefined()
  })

  it('Pure whitespace name treated as empty, no emit create', async () => {
    const wr = mk()
    await setVal(wr, 'input[name="snapshotName"]', '   ')
    await wr.find('.cv-primary-btn').trigger('click')
    expect(wr.find('.cv-error').text()).toBe('请输入快照名称')
    expect(wr.emitted('create')).toBeUndefined()
  })

  // Coverage point 3: valid name → emit create: { name, description }.
  it('Valid name → emit create: { name, description }', async () => {
    const wr = mk()
    await setVal(wr, 'input[name="snapshotName"]', 'before-upgrade')
    await setVal(wr, 'input[name="snapshotDescription"]', '升级前备份')
    await wr.find('.cv-primary-btn').trigger('click')
    expect(wr.emitted('create')![0]).toEqual([{ name: 'before-upgrade', description: '升级前备份' }])
    expect(wr.find('.cv-error').exists()).toBe(false)
  })

  // Coverage point 4: with busy=true the create button is is-loading and unclickable. Two-stage approach
  // (same as the Task 9 VmSettingsDialog.test.ts "saving=true main button..." case, avoiding a confounded assertion):
  // first prove with a valid name + busy=false that a real click does submit, ruling out "the form itself is broken";
  // then with busy=true + dispatchEvent (bypassing native disabled) prove the JS-level guard `if (props.busy)
  // return` itself really blocks (not blocked by luck via the browser's native disabled).
  it('When busy=true, create button is-loading and unclickable (prevent double submit)', async () => {
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
    // Native disabled itself blocks `.trigger('click')` (actually a synthetic MouseEvent; jsdom
    // likewise doesn't dispatch to disabled elements) — use dispatchEvent to bypass the native block
    // so we can test the JS-level guard `if (props.busy) return` inside onCreateClick() itself.
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await busy.vm.$nextTick()
    expect(busy.emitted('create')).toBeUndefined()
  })

  // Coverage point 5: empty list → .cv-empty-state shows "no snapshots".
  it('Empty list → .cv-empty-state shows "no snapshots"', () => {
    const wr = mk({ snapshots: [] })
    expect(wr.find('.cv-empty-state').text()).toContain('暂无快照')
    expect(wr.find('.cv-snapshot-item').exists()).toBe(false)
  })

  // Coverage point 6: non-empty list → each item shows name/created-at, description only when present;
  // formatDate uses new Date(s).toLocaleString() (per Vue2 :1316-1320).
  it('Non-empty list: shows name/created-at, description row only when present', () => {
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

  it('When createdAt is empty, formatDate returns empty string (per Vue2 :1317)', () => {
    const wr = mk({ snapshots: [SNAP({ createdAt: '' })] })
    expect(wr.find('.cv-snapshot-date').text()).toBe('创建于:')
  })

  // Coverage point 7: restore button is disabled when vmState !== 'stopped' (per Vue2 :368).
  it('Restore button: disabled when vmState !== "stopped", clickable when ="stopped"', () => {
    const running = mk({ vmState: 'running', snapshots: [SNAP()] })
    expect((running.find('.cv-btn-restore').element as HTMLButtonElement).disabled).toBe(true)
    running.unmount()

    const stopped = mk({ vmState: 'stopped', snapshots: [SNAP()] })
    expect((stopped.find('.cv-btn-restore').element as HTMLButtonElement).disabled).toBe(false)
  })

  describe('Two-stage confirmation in-place (hard constraint 5, per Vue2 single pendingConfirmAction/pendingConfirmId semantics)', () => {
    // Coverage point 8: delete — first click only changes text + confirm-text-danger, no emit; only the second click emits.
    it('Delete first click: text changes to "are you sure?" + confirm-text-danger, no emit confirm-delete', async () => {
      const wr = mk({ snapshots: [SNAP()] })
      await wr.find('.cv-btn-delete').trigger('click')
      expect(wr.emitted('confirm-delete')).toBeUndefined()
      expect(wr.find('.cv-btn-delete').text()).toContain('你确定吗？')
      expect(wr.find('.cv-btn-delete .confirm-text-danger').exists()).toBe(true)
    })

    it('Delete second click (same item): emit confirm-delete with snapshot object', async () => {
      const wr = mk({ snapshots: [SNAP()] })
      await wr.find('.cv-btn-delete').trigger('click')
      await wr.find('.cv-btn-delete').trigger('click')
      expect(wr.emitted('confirm-delete')![0]).toEqual([SNAP()])
    })

    // Same for restore (second half of coverage point 8). Use the stopped state so the restore button is clickable.
    it('Restore first click: text changes to "are you sure?" + confirm-text-danger, no emit; second click emits confirm-restore', async () => {
      const wr = mk({ vmState: 'stopped', snapshots: [SNAP()] })
      await wr.find('.cv-btn-restore').trigger('click')
      expect(wr.emitted('confirm-restore')).toBeUndefined()
      expect(wr.find('.cv-btn-restore').text()).toContain('你确定吗？')
      expect(wr.find('.cv-btn-restore .confirm-text-danger').exists()).toBe(true)

      await wr.find('.cv-btn-restore').trigger('click')
      expect(wr.emitted('confirm-restore')![0]).toEqual([SNAP()])
    })

    // Coverage point 9: confirm state is mutually exclusive — with A's delete pending, clicking B's delete → A resets, B becomes pending.
    it('Confirm state is mutually exclusive: with A delete pending, clicking B delete → A resets, B enters pending', async () => {
      const A = SNAP({ id: 'snap-a', name: 'A' })
      const B = SNAP({ id: 'snap-b', name: 'B' })
      const wr = mk({ snapshots: [A, B] })
      const items = wr.findAll('.cv-snapshot-item')
      const delA = items[0].find('.cv-btn-delete')
      const delB = items[1].find('.cv-btn-delete')

      await delA.trigger('click') // A enters pending
      expect(delA.text()).toContain('你确定吗？')

      await delB.trigger('click') // Click B delete (first time)
      expect(wr.emitted('confirm-delete')).toBeUndefined() // B first click only enters pending, no real delete
      // A must reset (no longer "are you sure?"), B enters pending — re-fetch DOM reference,
      // avoid cached old wrapper reading stale text.
      const itemsAfter = wr.findAll('.cv-snapshot-item')
      expect(itemsAfter[0].find('.cv-btn-delete').text()).toContain('删除')
      expect(itemsAfter[0].find('.cv-btn-delete').text()).not.toContain('你确定吗？')
      expect(itemsAfter[1].find('.cv-btn-delete').text()).toContain('你确定吗？')

      // Click B delete again (second time, confirm state still on B) → really emit, only with B.
      await itemsAfter[1].find('.cv-btn-delete').trigger('click')
      expect(wr.emitted('confirm-delete')![0]).toEqual([B])
    })

    // Coverage point 10: switching action also resets — on same item first click delete (pending), then click restore
    // → becomes restore pending, delete text resets.
    it('Action switch resets: on same item delete pending, then click restore → restore pending, delete resets', async () => {
      const wr = mk({ vmState: 'stopped', snapshots: [SNAP()] })
      await wr.find('.cv-btn-delete').trigger('click') // Delete pending
      expect(wr.find('.cv-btn-delete').text()).toContain('你确定吗？')

      await wr.find('.cv-btn-restore').trigger('click') // Click restore on same item (first time)
      expect(wr.emitted('confirm-restore')).toBeUndefined() // First restore click only enters pending
      expect(wr.find('.cv-btn-delete').text()).toContain('删除') // Delete resets
      expect(wr.find('.cv-btn-delete').text()).not.toContain('你确定吗？')
      expect(wr.find('.cv-btn-restore').text()).toContain('你确定吗？') // Restore enters pending
    })
  })

  // Coverage point 11: submitError shown at same .cv-error location.
  it('submitError shown in .cv-error', () => {
    const wr = mk({ submitError: 'domain is not stopped' })
    expect(wr.find('.cv-error').text()).toBe('domain is not stopped')
  })

  // Full-branch review fix A1: localError (create validation failure) should not mask submitError from parent
  // when subsequent delete/restore fails — priority of `localError || props.submitError` lets stale local
  // validation message permanently block backend's real failure reason. Discriminative design: first create
  // localError and assert it really shows (exclude "confirmThenEmit never reads localError" confusion), then
  // trigger one confirm-emit (simulate parent then writing backend failure message into submitError), assert
  // displayed is backend message not that validation message.
  it('confirmThenEmit clears localError, no longer masks subsequent submitError (A1)', async () => {
    const wr = mk({ snapshots: [SNAP()] })
    // First create localError: leave name empty, click create.
    await wr.find('.cv-primary-btn').trigger('click')
    expect(wr.find('.cv-error').text()).toBe('请输入快照名称')

    // Switch to clicking delete (two confirmations), trigger emit — component should clear localError.
    await wr.find('.cv-btn-delete').trigger('click')
    await wr.find('.cv-btn-delete').trigger('click')
    expect(wr.emitted('confirm-delete')).toHaveLength(1)

    // Parent (KvmPage) after backend failure writes message into submitError — simulate this step.
    await wr.setProps({ submitError: 'snapshot is in use' })
    expect(wr.find('.cv-error').text()).toBe('snapshot is in use')
  })

  // Supplementary coverage (per Vue2 createSnapshot :1250, clear form after success): busy changes from true
  // to false and submitError still empty → form clears, convenient for continuous creation without carrying
  // previous name/description.
  it('busy changes from true to false and no submitError → form clears (per Vue2 clear after success)', async () => {
    const wr = mk({ busy: true })
    await setVal(wr, 'input[name="snapshotName"]', 'temp-name')
    await setVal(wr, 'input[name="snapshotDescription"]', 'temp-desc')
    await wr.setProps({ busy: false, submitError: '' })
    expect((wr.get('input[name="snapshotName"]').element as HTMLInputElement).value).toBe('')
    expect((wr.get('input[name="snapshotDescription"]').element as HTMLInputElement).value).toBe('')
  })

  it('busy changes from true to false but submitError non-empty (failure) → form retained, not cleared', async () => {
    const wr = mk({ busy: true })
    await setVal(wr, 'input[name="snapshotName"]', 'temp-name')
    await wr.setProps({ busy: false, submitError: 'disk quota exceeded' })
    expect((wr.get('input[name="snapshotName"]').element as HTMLInputElement).value).toBe('temp-name')
  })
})
