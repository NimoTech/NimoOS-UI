// SP8-P5d Task 6 —— `NotesView.vue`「笔记」页测试。
// 蓝本 `NimoOS-UI`(main@7a6ee6b7)`src/views/AI/Knowledge/NotesView.vue`(271 行)。
//
// ═══ mock 策略(治理 §4.1 要求显式说明) ═══
// 🔴 `service.notes.list(p?)` mock 成**已归一化的 `Note[]`**(camelCase),不是
//   `{notes:[]}` 信封 —— `NimoOS-Service/src/notes.ts:211-215` 已经在包内 map 过。
//   `getSettings()` mock 成 camelCase 且只有 `{notesRoot, autoExtract}` 两个字段
//   (`notes.ts:252-255`)。`remove(id)` mock 成 `{status:'deleted', id}`(治理 §4.1
//   写的「返回值不剥」是错的,以 `p5d-fixtures/README.md` §3.1 的实测为准 ——
//   本页也不读这个返回值,蓝本 `:261` 只 `await`)。
// 🔴 mock 数据取自 `.superpowers/sdd/p5d-fixtures/notes-list-200.json` 的真实条目
//   (id/title/description/type/createdBy/revision/updatedAt/path/tags/sourceRefs
//   逐字段照抄该 fixture 里的原值,camelCase 化)。真机 23 条笔记**状态全是
//   draft、类型全是 insight、来源全是 pipeline**(README §4)—— curated/archived
//   两档、note/summary 类型、human/agent 来源在真机验不到,下面两条 curated/
//   archived 用例是在真 fixture 条目基础上**手动改了 status/type/createdBy**
//   三个字段来覆盖 §9.9 清单(其余字段仍是 fixture 原值),已在各自声明处注明。
//
// ═══ 属性态断言口径(治理 §9 / 附录 D §D.3.1) ═══
// `data-on` / `data-s` / `data-open` 都是普通 `data-*` 属性,一律 `toBe('true')`/
// `toBe('false')`,两侧都比,禁 `toBeUndefined()`。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import { useToast } from '../../../stores/toast'
import type { Note } from '@nimotech/nimoos-service'
import NotesView from './NotesView.vue'

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const notes = vi.hoisted(() => ({
  list: vi.fn(),
  getSettings: vi.fn(),
  curate: vi.fn(),
  archive: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { notes } }))

// openInApp 是 T5 的既有产出(全期零改动清单),这里只 spy `openDirInNewTab` 是否
// 被正确的参数调用,不重新实现它的逻辑(那是 T5 的职责与既有测试范围)。
const openDirInNewTab = vi.fn()
vi.mock('../../services/openInApp', () => ({ openDirInNewTab: (...args: unknown[]) => openDirInNewTab(...args) }))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5d-fixtures/notes-list-200.json(节选 3 条,camelCase 化)
// 逐字段取自该文件里的真实条目(2026-08-04 18:05 抓取)。真机 23 条全是
// draft/insight/pipeline —— NOTE_CURATED / NOTE_ARCHIVED 两条的 status/type/
// createdBy 是为覆盖 §9.9 清单手动改的(下方各自注明),其余字段(id/title/
// description/revision/updatedAt/path/tags/sourceRefs)仍是 fixture 原值。
const NOTE_DRAFT: Note = {
  id: 'ba20c0ec-0275-497b-9124-58042e1b7336',
  title: '4×4 fixed size NimoOS todo list widget',
  description: 'Completed todo list widget for NimoOS locked to 4*4 size with localStorage storage',
  type: 'insight',
  status: 'draft',
  createdBy: 'pipeline',
  revision: 24522,
  updatedAt: 1785837654,
  path: '1/4-4-fixed-size-nimoos-todo-list-widget-ba20c0ec.md',
  tags: ['nimoos', 'todo-list', 'widget'],
  sourceRefs: [{ session_id: '6fe14460-9892-4d7e-b104-db1098c749af' }],
}
// 🔴 status/type/createdBy 手动改成 curated/note/human 覆盖真机验不到的分支
// (fixture 原条目是 draft/insight/pipeline),其余字段仍是该条目原值。
const NOTE_CURATED: Note = {
  id: '4a0de838-0bbb-40e6-890d-0a49002e0826',
  title: '4×4 Fixed-Size NimoOS Todo List Widget Project',
  description: 'Completed full project files for a localStorage-backed todo list app with fixed 4×4 widget for NimoOS',
  type: 'note',
  status: 'curated',
  createdBy: 'human',
  revision: 24528,
  updatedAt: 1785837654,
  path: '1/4-4-fixed-size-nimoos-todo-list-widget-p-4a0de838.md',
  tags: ['docker', 'frontend', 'nimoos', 'todo-list', 'widget'],
  sourceRefs: [{ session_id: 'bc2e5964-f1c7-4050-b292-9a6c497990fa' }],
}
// 🔴 同上,手动改成 archived/summary/agent。
const NOTE_ARCHIVED: Note = {
  id: 'bb23c647-eae0-48d9-b60a-576c047ebf2e',
  title: '4×4 NimoOS Todo List Widget Created',
  description: 'Successfully created a fixed-size 4×4 NimoOS desktop todo list widget with full working functionality',
  type: 'summary',
  status: 'archived',
  createdBy: 'agent',
  revision: 24509,
  updatedAt: 1785837654,
  path: '1/4-4-nimoos-todo-list-widget-created-bb23c647.md',
  tags: ['nimoos', 'project-deployment', 'todo-list', 'widget'],
  sourceRefs: [{ session_id: 'd291ebb9-e293-452a-9282-75231c2e97ad' }],
}
const NOTES_3 = [NOTE_DRAFT, NOTE_CURATED, NOTE_ARCHIVED]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5d-fixtures/notes-settings.json(camelCase 化,包内归一)
// 原文 `{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],
// "distill_daily_cap":50,"background_model":""}` —— `normalizeSettings` 只留
// `notesRoot`/`autoExtract` 两个字段,后三个被包丢弃(治理 §4.1)。
const SETTINGS = { notesRoot: '/DATA/Notes', autoExtract: true }
// FIXTURE-COPY-END

function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// K7:弹窗 portal 目标 —— NotesView 独立挂载时不在 .knowledge-app 子树里(生产
// 环境由 KnowledgeLayout.vue 提供),测试须先在 body 里放一个同名宿主(先例
// QueueView.test.ts::withHost())。
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

function makeRouter(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/ai/knowledge/notes', name: 'KnowledgeNotes', component: NotesView }],
  })
  router.push({ path: '/ai/knowledge/notes', query })
  return router
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

async function mountNotesView(query: Record<string, string> = {}) {
  const router = makeRouter(query)
  await router.isReady()
  const w = mount(NotesView, { global: { plugins: [router, i18n] }, attachTo: document.body } as never)
  mountedWrappers.push(w)
  await flushPromises()
  await nextTick()
  return { w, router }
}

const flush = async () => {
  await flushPromises()
  await nextTick()
}

function rowTitles(w: VueWrapper): string[] {
  return w.findAll('.kn-note-row .kn-note-title').map((x) => x.text())
}
function skeletonVisible(w: VueWrapper): boolean {
  return w.find('.kn-list .k-skel').exists()
}

function setupDefaultMocks(): void {
  notes.list.mockResolvedValue([...NOTES_3])
  notes.getSettings.mockResolvedValue({ ...SETTINGS })
  notes.curate.mockImplementation((id: string) => Promise.resolve({ ...NOTE_DRAFT, id, status: 'curated' }))
  notes.archive.mockImplementation((id: string) => Promise.resolve({ ...NOTE_DRAFT, id, status: 'archived' }))
  notes.remove.mockImplementation((id: string) => Promise.resolve({ status: 'deleted', id }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  setupDefaultMocks()
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — pathstrip + notesRoot 探测(蓝本 :8-16 / :212-216)', () => {
  it('notesRoot 尚未回包时用占位 "/DATA/Notes"，回包后显示真实值', async () => {
    const d = makeDeferred<{ notesRoot: string; autoExtract: boolean }>()
    notes.getSettings.mockReturnValue(d.promise)
    const { w } = await mountNotesView()
    expect(w.find('.kn-pathstrip code').text()).toBe('/DATA/Notes/')
    d.resolve({ notesRoot: '/DATA/CustomNotes', autoExtract: true })
    await flush()
    expect(w.find('.kn-pathstrip code').text()).toBe('/DATA/CustomNotes/')
  })

  it('K6 —— getSettings 失败静默兜底：占位保留、不 toast、不打 console.error（蓝本 :215 空 catch）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    notes.getSettings.mockRejectedValue(new Error('agent offline'))
    const { w } = await mountNotesView()
    expect(w.find('.kn-pathstrip code').text()).toBe('/DATA/Notes/')
    expect(useToast().toasts).toEqual([])
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('点击「在文件管理器中打开」调用 openDirInNewTab(notesRoot)', async () => {
    notes.getSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: true })
    const { w } = await mountNotesView()
    await w.find('.kn-pathstrip a').trigger('click')
    expect(openDirInNewTab).toHaveBeenCalledWith('/DATA/Notes')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — 骨架屏（N24 算术内联样式照抄，蓝本 :19-28）', () => {
  it('list() 未回包期间渲染 4 行骨架，宽度是 (52-i*8)% / (72-i*6)%，cursor:default', async () => {
    const d = makeDeferred<Note[]>()
    notes.list.mockReturnValue(d.promise)
    const { w } = await mountNotesView()
    const rows = w.findAll('.kn-list > .kn-note-row')
    expect(rows).toHaveLength(4)
    rows.forEach((row, idx) => {
      const i = idx + 1
      expect(row.attributes('style')).toContain('cursor: default')
      const skels = row.findAll('.k-skel')
      // 第 2/3 个 .k-skel 是宽度递减的两条(第 1、4 个是固定尺寸的头像/时间占位)
      expect(skels[1].attributes('style')).toContain(`width: ${52 - i * 8}%`)
      expect(skels[2].attributes('style')).toContain(`width: ${72 - i * 6}%`)
    })
    d.resolve([])
    await flush()
    expect(w.findAll('.kn-list > .kn-note-row')).toHaveLength(0) // 骨架消失,走空态
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — 空态 vs 有笔记（notes.length 两侧，§9.9）', () => {
  it('notes.length === 0 → 渲染 k-empty，工具栏/列表/收件箱都不渲染', async () => {
    notes.list.mockResolvedValue([])
    const { w } = await mountNotesView()
    expect(w.find('.k-empty').exists()).toBe(true)
    expect(w.find('.kn-toolbar').exists()).toBe(false)
    expect(w.find('.kn-inbox').exists()).toBe(false)
  })

  it('notes.length > 0 → k-empty 不渲染，工具栏渲染', async () => {
    const { w } = await mountNotesView()
    expect(w.find('.k-empty').exists()).toBe(false)
    expect(w.find('.kn-toolbar').exists()).toBe(true)
  })

  it('空态点「新建笔记」→ router 带 ?id=new', async () => {
    notes.list.mockResolvedValue([])
    const { w, router } = await mountNotesView()
    await w.find('.k-empty button').trigger('click')
    await flush()
    expect(router.currentRoute.value.query.id).toBe('new')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — 草稿收件箱（drafts.length 两侧，§9.9）', () => {
  it('drafts.length > 0 → kn-inbox 渲染，标题带草稿数，「全部确认」按钮可点', async () => {
    const { w } = await mountNotesView()
    const inbox = w.find('.kn-inbox')
    expect(inbox.exists()).toBe(true)
    expect(inbox.find('.kn-inbox-title b').text()).toBe('1') // NOTES_3 里只有 1 条 draft
    expect(inbox.find('.k-btn.primary').attributes('disabled')).toBeUndefined()
  })

  it('drafts.length === 0（全部 curated/archived）→ kn-inbox 不渲染', async () => {
    notes.list.mockResolvedValue([NOTE_CURATED, NOTE_ARCHIVED])
    const { w } = await mountNotesView()
    expect(w.find('.kn-inbox').exists()).toBe(false)
  })

  it('点收件箱头部折叠/展开（data-open 两侧），点「全部确认」聚合 curate 全部草稿', async () => {
    const { w } = await mountNotesView()
    expect(w.find('.kn-inbox').attributes('data-open')).toBe('true')
    await w.find('.kn-inbox-head').trigger('click')
    expect(w.find('.kn-inbox').attributes('data-open')).toBe('false')
    await w.find('.kn-inbox-head').trigger('click')
    expect(w.find('.kn-inbox').attributes('data-open')).toBe('true')

    await w.find('.kn-inbox-head .k-btn.primary').trigger('click')
    await flush()
    expect(notes.curate).toHaveBeenCalledWith(NOTE_DRAFT.id)
    expect(useToast().toasts.map((x) => x.text)).toContain('已确认 1 条草稿')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — 筛选（filtered.length 两侧，§9.9）', () => {
  it('选一个本机没有笔记的类型 → kn-empty-filtered 渲染；点「清空筛选」恢复', async () => {
    const { w } = await mountNotesView()
    await w.find('.k-filt-select').setValue('digest') // NOTES_3 里没有 digest
    await flush()
    expect(w.find('.kn-empty-filtered').exists()).toBe(true)
    await w.find('.kn-empty-filtered button').trigger('click')
    await flush()
    expect(w.find('.kn-empty-filtered').exists()).toBe(false)
  })

  it('filtered.length > 0 → 列表渲染行，kn-empty-filtered 不渲染', async () => {
    const { w } = await mountNotesView()
    expect(w.find('.kn-empty-filtered').exists()).toBe(false)
    expect(rowTitles(w).length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — 列表行状态按钮（status===draft / !==archived 两侧，§9.9）', () => {
  it('draft 行：有「确认」按钮 + 有「归档」按钮（status !== archived 也成立）', async () => {
    const { w } = await mountNotesView()
    const row = w.find('.kn-note-row[data-s="draft"]')
    expect(row.find('.kn-act[data-tone="confirm"]').exists()).toBe(true)
    expect(row.findAll('.kn-act').some((b) => b.text() === '归档')).toBe(true)
  })

  it('curated 行：没有「确认」按钮(status !== draft)，有「归档」按钮(status !== archived)', async () => {
    const { w } = await mountNotesView()
    const row = w.find('.kn-note-row[data-s="curated"]')
    expect(row.find('.kn-act[data-tone="confirm"]').exists()).toBe(false)
    expect(row.findAll('.kn-act').some((b) => b.text() === '归档')).toBe(true)
  })

  it('archived 行：没有「确认」按钮，也没有「归档」按钮(两个条件都到反面)', async () => {
    const { w } = await mountNotesView()
    // 直接切到 archived 状态 pill(第 4 个,蓝本顺序:全部/AI草稿/已确认/已归档)
    const pills = w.findAll('.k-filter-pill')
    await pills[3].trigger('click')
    await flush()
    const row = w.find('.kn-note-row[data-s="archived"]')
    expect(row.exists()).toBe(true)
    expect(row.find('.kn-act[data-tone="confirm"]').exists()).toBe(false)
    expect(row.findAll('.kn-act').some((b) => b.text() === '归档')).toBe(false)
    // 只剩删除按钮
    expect(row.findAll('.kn-act')).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 §5.2 过期守卫(K15 同族第 8 次)—— reload() 的两条判据用例。
// RED 探针见任务报告(拿掉 epoch 检查 / 把 reloadEpoch 挪到模块级两种破坏各一次)。
describe('NotesView — reload() 过期守卫（§5.2）', () => {
  it('① 交错:先发(A)后至,不许覆盖后发先至(B)的结果;loading 不被 A 的迟到响应重新拨动', async () => {
    const dA = makeDeferred<Note[]>()
    const dB = makeDeferred<Note[]>()
    notes.list.mockReturnValueOnce(dA.promise) // 首发(A),来自 mount 时的初始 reload()
    const { w, router } = await mountNotesView()
    expect(skeletonVisible(w)).toBe(true)

    // 触发第二发(B):id 从非空变空,走 watch(editingId) → reload()
    notes.list.mockReturnValueOnce(dB.promise)
    await router.push({ query: { id: 'some-note' } })
    await flush()
    await router.push({ query: { id: '' } })
    await flush()
    expect(notes.list).toHaveBeenCalledTimes(2)

    // B 先回
    dB.resolve([NOTE_CURATED])
    await flush()
    expect(rowTitles(w)).toEqual([NOTE_CURATED.title])
    expect(skeletonVisible(w)).toBe(false)

    // A 后到 —— 必须被守卫挡住,不许把 B 的结果覆盖成 A 的,也不许把 loading 拨回去
    dA.resolve([NOTE_DRAFT])
    await flush()
    expect(rowTitles(w)).toEqual([NOTE_CURATED.title])
    expect(skeletonVisible(w)).toBe(false)
  })

  it('🔴 ② 两实例交错:各自拿到自己的结果,互不覆盖(守卫变量必须是组件本地,不是模块级)', async () => {
    const dA = makeDeferred<Note[]>()
    const dB = makeDeferred<Note[]>()
    notes.list.mockReturnValueOnce(dA.promise) // instance 1 的首发 reload()
    const { w: w1 } = await mountNotesView()
    notes.list.mockReturnValueOnce(dB.promise) // instance 2 的首发 reload()
    const { w: w2 } = await mountNotesView()
    expect(skeletonVisible(w1)).toBe(true)
    expect(skeletonVisible(w2)).toBe(true)

    // 交错回:instance 2(B)先回,instance 1(A)后回
    dB.resolve([NOTE_CURATED])
    await flush()
    dA.resolve([NOTE_DRAFT])
    await flush()

    expect(rowTitles(w1)).toEqual([NOTE_DRAFT.title])
    expect(rowTitles(w2)).toEqual([NOTE_CURATED.title])
    expect(skeletonVisible(w1)).toBe(false)
    expect(skeletonVisible(w2)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// N30 两条一起:watch editingId 只在变空时 reload;:key="editingId" 不许删。
describe('NotesView — N30（watch editingId 只在变空时 reload + :key 触发重建）', () => {
  it('切到另一条笔记(非空 id → 另一个非空 id)不触发 reload,但 :key 变化会重建子组件', async () => {
    const { w, router } = await mountNotesView()
    expect(notes.list).toHaveBeenCalledTimes(1)

    await router.push({ query: { id: 'note-a' } })
    await flush()
    const el1 = w.find('.kn-edit-pane-stub').element
    expect(el1.getAttribute('data-note-id')).toBe('note-a')

    notes.list.mockClear()
    await router.push({ query: { id: 'note-b' } }) // 非空 → 非空,watch 守卫应拦住 reload
    await flush()
    const el2 = w.find('.kn-edit-pane-stub').element
    expect(el2.getAttribute('data-note-id')).toBe('note-b')
    expect(el2).not.toBe(el1) // :key 变化 → 新 DOM 节点(重建)
    expect(notes.list).not.toHaveBeenCalled() // 判据:拿掉 `if (!v)` 这层会让这里报红
  })

  it('id 变空(回到列表)→ 触发 reload()', async () => {
    const { w, router } = await mountNotesView()
    await router.push({ query: { id: 'note-a' } })
    await flush()
    notes.list.mockClear()
    await router.push({ query: { id: '' } })
    await flush()
    expect(notes.list).toHaveBeenCalledTimes(1)
    expect(w.find('.kn-edit-pane-stub').exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 深链:editingId 来自 route.query.id,直接改地址栏(不经点击)也要生效
// (记忆 newui-router-query-only-no-remount)。
describe('NotesView — 深链 ?id= 响应式（记忆 newui-router-query-only-no-remount）', () => {
  it('挂载后直接改路由 query(模拟用户手改地址栏)也能切到编辑态,不需要重新挂载整个视图', async () => {
    const { w, router } = await mountNotesView() // 初始 ?id= 缺省(空)
    expect(w.find('.kn-edit-pane-stub').exists()).toBe(false)
    await router.push({ query: { id: 'from-address-bar' } })
    await flush()
    expect(w.find('.kn-edit-pane-stub').attributes('data-note-id')).toBe('from-address-bar')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — 单条操作 + K5(不回显后端 message)', () => {
  it('curate 成功:toast「笔记已确认」+ reload', async () => {
    const { w } = await mountNotesView()
    notes.list.mockClear()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="confirm"]').trigger('click')
    await flush()
    expect(notes.curate).toHaveBeenCalledWith(NOTE_DRAFT.id)
    expect(useToast().toasts.map((x) => x.text)).toContain('笔记已确认')
    expect(notes.list).toHaveBeenCalledTimes(1)
  })

  it('curate 失败:toast 固定文案「操作失败」,不含后端 message(K5)', async () => {
    notes.curate.mockRejectedValue(new Error('backend exploded: disk full'))
    const { w } = await mountNotesView()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="confirm"]').trigger('click')
    await flush()
    const texts = useToast().toasts.map((x) => x.text)
    expect(texts).toContain('操作失败')
    expect(texts.join(' | ')).not.toContain('disk full')
  })

  it('archive 成功:toast「笔记已归档」+ reload;archive 失败:toast 固定文案', async () => {
    const { w } = await mountNotesView()
    notes.list.mockClear()
    await w.find('.kn-note-row[data-s="curated"] .kn-act:not([data-tone])').trigger('click')
    await flush()
    expect(notes.archive).toHaveBeenCalledWith(NOTE_CURATED.id)
    expect(useToast().toasts.map((x) => x.text)).toContain('笔记已归档')
    expect(notes.list).toHaveBeenCalledTimes(1)

    notes.archive.mockRejectedValue(new Error('boom'))
    await w.find('.kn-note-row[data-s="draft"] .kn-act:not([data-tone])').trigger('click')
    await flush()
    const texts = useToast().toasts.map((x) => x.text)
    expect(texts).toContain('操作失败')
    expect(texts.join(' | ')).not.toContain('boom')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — confirmAll（N31 照抄:并发 + 无 finally + 失败也 reload）', () => {
  it('全部成功:toast 带数量,reload 被调用', async () => {
    notes.list.mockResolvedValue([NOTE_DRAFT, { ...NOTE_DRAFT, id: 'd2' }])
    const { w } = await mountNotesView()
    notes.list.mockClear()
    await w.find('.kn-inbox-head .k-btn.primary').trigger('click')
    await flush()
    expect(notes.curate).toHaveBeenCalledTimes(2)
    expect(useToast().toasts.map((x) => x.text)).toContain('已确认 2 条草稿')
    expect(notes.list).toHaveBeenCalledTimes(1)
  })

  it('部分成功(其中一条 curate 拒绝):Promise.all 整体失败只弹一条失败 toast,但 reload 仍执行(把已成功的刷出来)', async () => {
    notes.list.mockResolvedValue([NOTE_DRAFT, { ...NOTE_DRAFT, id: 'd2' }])
    notes.curate.mockImplementation((id: string) =>
      id === 'd2' ? Promise.reject(new Error('one failed')) : Promise.resolve({ ...NOTE_DRAFT, id, status: 'curated' }),
    )
    const { w } = await mountNotesView()
    notes.list.mockClear()
    await w.find('.kn-inbox-head .k-btn.primary').trigger('click')
    await flush()
    const texts = useToast().toasts.map((x) => x.text)
    expect(texts).toContain('操作失败')
    expect(texts.join(' | ')).not.toContain('one failed')
    expect(notes.list).toHaveBeenCalledTimes(1) // 🔴 N31:失败也 reload
  })

  it('确认全部按钮在 bulkConfirming 期间禁用', async () => {
    const d = makeDeferred<Note>()
    notes.curate.mockReturnValue(d.promise)
    const { w } = await mountNotesView()
    const btn = w.find('.kn-inbox-head .k-btn.primary')
    await btn.trigger('click')
    await flush()
    expect(w.find('.kn-inbox-head .k-btn.primary').attributes('disabled')).toBe('')
    d.resolve(NOTE_DRAFT)
    await flush()
    expect(w.find('.kn-inbox-head .k-btn.primary').attributes('disabled')).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — 删除确认弹窗（K7/K29/K36 reka 化）', () => {
  it('点行内删除按钮打开弹窗(portal 到 .knowledge-app),标题/正文/按钮正确', async () => {
    const host = withHost()
    const { w } = await mountNotesView()
    expect(host.querySelector('.k-modal')).toBeNull()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="danger"]').trigger('click')
    await flush()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    expect(modal!.querySelector('.k-modal-title')!.textContent).toBe('删除该笔记？')
    expect(modal!.textContent).toContain(NOTE_DRAFT.title)
    expect(modal!.textContent).toContain(NOTE_DRAFT.path)
  })

  it('点「取消」关闭弹窗,不调用 remove', async () => {
    const host = withHost()
    const { w } = await mountNotesView()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="danger"]').trigger('click')
    await flush()
    const cancelBtn = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) => b.textContent === '取消') as HTMLElement
    cancelBtn.click()
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(notes.remove).not.toHaveBeenCalled()
  })

  it('点「改为归档」调用 archive,不调用 remove,弹窗关闭', async () => {
    const host = withHost()
    const { w } = await mountNotesView()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="danger"]').trigger('click')
    await flush()
    const archiveBtn = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) => b.textContent!.includes('改为归档')) as HTMLElement
    archiveBtn.click()
    await flush()
    expect(notes.archive).toHaveBeenCalledWith(NOTE_DRAFT.id)
    expect(notes.remove).not.toHaveBeenCalled()
    expect(host.querySelector('.k-modal')).toBeNull()
  })

  it('点「删除」调用 remove(id),toast「笔记已删除」,reload,弹窗关闭', async () => {
    const host = withHost()
    const { w } = await mountNotesView()
    notes.list.mockClear()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="danger"]').trigger('click')
    await flush()
    const deleteBtn = Array.from(host.querySelectorAll('.k-modal-foot button')).find((b) => b.textContent!.includes('删除')) as HTMLElement
    deleteBtn.click()
    await flush()
    expect(notes.remove).toHaveBeenCalledWith(NOTE_DRAFT.id)
    expect(useToast().toasts.map((x) => x.text)).toContain('笔记已删除')
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(notes.list).toHaveBeenCalledTimes(1)
  })

  // reka pointerDownOutside 等价蓝本「点遮罩关闭 / 点弹窗内不关闭」(先例 QueueView.test.ts)。
  it('点遮罩(弹窗外部)关闭;点弹窗内部不关闭', async () => {
    const host = withHost()
    const { w } = await mountNotesView()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="danger"]').trigger('click')
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()
    // reka usePointerDownOutside 用 setTimeout(0) 延后挂 document 监听(见
    // QueueView.test.ts 同款注释),flushPromises/nextTick 刷不到,补一次宏任务 tick。
    await new Promise((resolve) => setTimeout(resolve, 0))

    const titleEl = host.querySelector('.k-modal-title') as HTMLElement
    titleEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()

    const overlayEl = host.querySelector('.k-modal-bg') as HTMLElement
    overlayEl.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
  })
})
