// 移植自 Vue2 tests/resourcesTabBatch.test.js(164 行,DOM+emit 级 9 断言)+
// 新增 6 条(授权段/附件段 emit 与禁用态、下载链接、snapshot_missing 硬禁用、
// commit 按钮禁用条件、三段空态)。SP8-P1c2 Task 12。
//
// propsData → props / w.destroy() → w.unmount() / stubbed $t → 真 zh_cn i18n
// (createI18n),对应本仓库既有约定(见 ActivityTab.test.ts/SystemTab.test.ts)。
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return {
    ...mod,
    service: { ai: { attachmentRawUrl: vi.fn((sid: string, id: string | number) => `/v1/ai/agent/sessions/${sid}/attachments/${id}/raw?token=t`) } },
  }
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import ResourcesTab from './ResourcesTab.vue'
import { service } from '@nimotech/nimoos-service'
import type { StagedGroup } from '../../stores/agentStore'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountTab(props: Record<string, unknown> = {}) {
  return mount(ResourcesTab, {
    props: {
      visibleResources: [],
      attachments: [],
      sessionId: 'sess1',
      stagedChanges: [],
      busy: false,
      committing: false,
      reverting: {},
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

let _wrapper: VueWrapper | null = null
function track<T extends VueWrapper>(w: T): T { _wrapper = w; return w }

afterEach(() => {
  if (_wrapper) { _wrapper.unmount(); _wrapper = null }
  vi.clearAllMocks()
})

const BATCH_RUN: StagedGroup = {
  run_id: 'run1',
  created_at: Math.floor(Date.now() / 1000) - 30,
  items: [
    { seq: 1, op: 'mkdir', path: '/root/newdir', staged_id: 10, batch_id: 'bx' },
    { seq: 2, op: 'rename', path: '/root/a', dst_path: '/root/newdir/a', staged_id: 11, batch_id: 'bx' },
    { seq: 3, op: 'write', path: '/root/loose.txt', size_bytes: 128 },
  ],
}

describe('ResourcesTab — batch group rendering (ported)', () => {
  it('renders a .rt-batch container for a batch sub-group', () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN] }))
    expect(w.find('.rt-batch').exists()).toBe(true)
  })

  it('shows two items in the batch (batch_id bx has seq 1 and 2)', () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN] }))
    const batch = w.find('.rt-batch')
    expect(batch.exists()).toBe(true)
    expect(batch.text()).toContain('2')
  })

  it('clicking 整批撤销 emits revert-batch with the batchId', async () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN] }))
    const btn = w.find('.rt-batch-revert')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('revert-batch')).toBeTruthy()
    expect(w.emitted('revert-batch')![0]).toEqual(['bx'])
  })

  it('loose items (no batch_id) are rendered outside any .rt-batch', () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN] }))
    expect(w.html()).toContain('loose.txt')
    expect(w.find('.rt-batch').html()).not.toContain('loose.txt')
  })
})

describe('ResourcesTab — per-item revert (ported)', () => {
  it('renders per-item revert buttons when batch is expanded', async () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN] }))
    const toggle = w.find('.rt-batch-toggle')
    expect(toggle.exists()).toBe(true)
    await toggle.trigger('click')
    const itemReverts = w.findAll('.rt-item-revert')
    expect(itemReverts.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking per-item revert emits revert-item with staged_id', async () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN] }))
    await w.find('.rt-batch-toggle').trigger('click')
    const firstRevert = w.find('.rt-item-revert')
    await firstRevert.trigger('click')
    expect(w.emitted('revert-item')).toBeTruthy()
    expect(w.emitted('revert-item')![0]).toEqual([10])
  })
})

describe('ResourcesTab — batch summary delete counting (ported C1)', () => {
  const DELETE_BATCH_RUN: StagedGroup = {
    run_id: 'run2',
    created_at: Math.floor(Date.now() / 1000) - 60,
    items: [
      { seq: 1, op: 'delete_file', path: '/root/old.txt', staged_id: 20, batch_id: 'bd' },
      { seq: 2, op: 'delete_dir', path: '/root/emptydir', staged_id: 21, batch_id: 'bd' },
      { seq: 3, op: 'mkdir', path: '/root/newdir', staged_id: 22, batch_id: 'bd' },
    ],
  }

  it('counts delete_file and delete_dir as delete in the summary (not missed)', () => {
    const w = track(mountTab({ stagedChanges: [DELETE_BATCH_RUN] }))
    const summaryText = w.find('.rt-batch-summary').text()
    // zh_cn.aiResBatchSummary: '批量：新建 {mkdir} · 移动 {rename} · 删除 {delete}'
    expect(summaryText).toContain('新建 1')
    expect(summaryText).toContain('移动 0')
    expect(summaryText).toContain('删除 2')
  })

  it('items show DEL badge for delete_file and delete_dir ops', async () => {
    const w = track(mountTab({ stagedChanges: [DELETE_BATCH_RUN] }))
    await w.find('.rt-batch-toggle').trigger('click')
    const badges = w.findAll('.badge-DEL')
    expect(badges.length).toBe(2)
  })
})

describe('ResourcesTab — in-flight revert busy state (ported I1)', () => {
  it('disables batch revert button when reverting[batchId] is true', async () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN], reverting: { bx: true } }))
    const btn = w.find('.rt-batch-revert')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toBe(zh.aiResReverting)
  })

  it('disables per-item revert button when reverting["item:<stagedId>"] is true', async () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN], reverting: { 'item:10': true } }))
    await w.find('.rt-batch-toggle').trigger('click')
    const firstItemRevert = w.find('.rt-item-revert')
    expect(firstItemRevert.attributes('disabled')).toBeDefined()
  })
})

describe('ResourcesTab — authorized resources section (new)', () => {
  it('renders count, path, agent.md badge, and emits remove-resource on click', async () => {
    const w = track(mountTab({
      visibleResources: [
        { id: 'r1', path: '/DATA/Docs', kind: 'folder', has_agent_md: true },
        { id: 'r2', path: '/DATA/file.txt', kind: 'file' },
      ],
    }))
    expect(w.find('.rt-count').text()).toContain('2')
    expect(w.text()).toContain('/DATA/Docs')
    expect(w.text()).toContain('agent.md')
    const removeButtons = w.findAll('.rt-x')
    await removeButtons[0].trigger('click')
    expect(w.emitted('remove-resource')).toBeTruthy()
    expect(w.emitted('remove-resource')![0]).toEqual(['r1'])
  })

  it('disables the remove-authorization button while busy', () => {
    const w = track(mountTab({
      visibleResources: [{ id: 'r1', path: '/DATA/Docs', kind: 'folder' }],
      busy: true,
    }))
    const btn = w.find('.rt-x')
    expect(btn.attributes('disabled')).toBeDefined()
  })
})

describe('ResourcesTab — attachments section (new)', () => {
  it('sent attachment (has message_id) cannot be removed, shows "sent" tag', () => {
    const w = track(mountTab({
      attachments: [{ id: 'a1', filename: 'sent.png', size_bytes: 1024, kind: 'image', message_id: 'm1' }],
    }))
    expect(w.text()).toContain(zh.aiResSent)
    // Only a download link, no remove button, for a sent attachment
    const item = w.findAll('.rt-item').find((li) => li.text().includes('sent.png'))!
    expect(item.findAll('button.rt-x').length).toBe(0)
  })

  it('draft attachment (no message_id) can be removed, shows "draft" tag', async () => {
    const w = track(mountTab({
      attachments: [{ id: 'a2', filename: 'draft.png', size_bytes: 2048, kind: 'image' }],
    }))
    expect(w.text()).toContain(zh.aiResDraft)
    const item = w.findAll('.rt-item').find((li) => li.text().includes('draft.png'))!
    const removeBtn = item.find('button.rt-x')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    expect(w.emitted('remove-attachment')).toBeTruthy()
    expect(w.emitted('remove-attachment')![0]).toEqual(['a2'])
  })

  it('download link href comes from service.ai.attachmentRawUrl(sessionId, id)', () => {
    const w = track(mountTab({
      sessionId: 'sess42',
      attachments: [{ id: 'a3', filename: 'x.png', size_bytes: 10, kind: 'image' }],
    }))
    const link = w.find('a.rt-x')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/v1/ai/agent/sessions/sess42/attachments/a3/raw?token=t')
    expect(service.ai.attachmentRawUrl).toHaveBeenCalledWith('sess42', 'a3')
  })
})

describe('ResourcesTab — turn-level revert disabled by snapshot_missing (new)', () => {
  it('disables the whole-turn revert button when any item has snapshot_missing', () => {
    const g: StagedGroup = {
      run_id: 'run3',
      created_at: Math.floor(Date.now() / 1000) - 10,
      items: [
        { seq: 1, op: 'write', path: '/a', staged_id: 30, batch_id: 'b', snapshot_missing: true },
      ],
    }
    const w = track(mountTab({ stagedChanges: [g] }))
    const btn = w.find('.rt-turn-head .rt-revert')
    expect(btn.attributes('disabled')).toBeDefined()
  })
})

describe('ResourcesTab — commit-all button (new)', () => {
  it('disabled while busy or committing, shows N files, emits commit-all', async () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN], committing: false, busy: false }))
    const btn = w.find('.rt-commit')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.text()).toContain('3')
    await btn.trigger('click')
    expect(w.emitted('commit-all')).toBeTruthy()
  })

  it('disabled when committing is true, text switches to "Committing…" equivalent', () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN], committing: true }))
    const btn = w.find('.rt-commit')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toBe(zh.aiResCommitting)
  })

  it('disabled when busy is true', () => {
    const w = track(mountTab({ stagedChanges: [BATCH_RUN], busy: true }))
    const btn = w.find('.rt-commit')
    expect(btn.attributes('disabled')).toBeDefined()
  })
})

describe('ResourcesTab — three empty states (new)', () => {
  it('shows authorized + attachments empty states, and hides the pending section entirely', () => {
    const w = track(mountTab({ visibleResources: [], attachments: [], stagedChanges: [] }))
    expect(w.text()).toContain(zh.aiResEmptyAttachments)
    // authorized empty state uses <i18n-t> around the fragments; assert on the code tag + surrounding text
    expect(w.find('.rt-empty code').exists()).toBe(true)
    expect(w.find('.rt-empty code').text()).toBe('@')
    expect(w.find('.rt-turn').exists()).toBe(false)
    expect(w.find('.rt-commit').exists()).toBe(false)
  })
})
