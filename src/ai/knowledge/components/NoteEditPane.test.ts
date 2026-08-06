// SP8-P5d Task 7 —— `NoteEditPane.vue` **上半**(顶栏 + 草稿横幅 + 主列编辑器)单测。
// 蓝本 `NimoOS-UI`(main@7a6ee6b7)`src/views/AI/Knowledge/NoteEditPane.vue`(338 行)。
// 本文件只测 T7 的范围(顶栏/草稿横幅/主列编辑器 + props/data/isNew/status/
// wordCount/created()等效/onEditorReady/tbActive/cmd/save/curateInPlace)。
// 侧栏 5 卡/标签编辑/冲突弹窗的渲染归 T8,不在本文件断言范围内 —— 但 save()
// 的 catch 分岔里"conflict state 被设上"这条本刀行为仍然要测(用
// `wrapper.vm` 技术读内部 ref,不新增 UI,理由见下方对应 describe 块)。
//
// ═══ mock 策略(治理 §4.1 / p5d-fixtures/README.md §2) ═══
// `service.notes.get/create/update/curate` 返回**单个已归一化 Note**(camelCase)。
// `service.notes.backlinks` 返回**数组**,空时 `[]`(不是 `{backlinks:[]}` 信封)。
// `NOTE_FIXTURE` 逐字段取自 `.superpowers/sdd/p5d-fixtures/notes-get-one.json`
// 的真实回包(camelCase 化;`source_refs`→`sourceRefs`,`created_by`→`createdBy`,
// `updated_at`→`updatedAt`;`user_id` 被包丢弃,`created_at` 未进 `Note` 类型)。
// 409 冲突体取自 `.superpowers/sdd/p5d-fixtures/notes-update-409-conflict.http`
// (`{"detail":"revision conflict","current_revision":1}`),axios 错误对象整形成
// `{response:{status:409,data:{current_revision:...}}}`。
//
// ═══ 属性态断言口径(治理 §9 / 附录 D §D.3) ═══
// `data-on`/`data-dirty` 一律 `toBe('true')`/`toBe('false')`,两侧都比,禁
// `toBeUndefined()`。
//
// ═══ `wrapper.vm` 直读 <script setup> 顶层 ref 的技术先例 ═══
// `IndexedFilesView.test.ts:618-621` 已确立:`<script setup>` 顶层 ref 即便未
// `defineExpose`,`@vue/test-utils` 的 `wrapper.vm` 在测试环境下仍可读写
// (instance.proxy 走 setupState 双向读写)——不是新增功能、也不是绕过组件公开
// 行为,只是本刀没有可点击的 UI 入口能到达"冲突态已设上"这类内部状态(侧栏/
// 弹窗归 T8)。本文件对 `conflict`/`dirty`/`tagInput` 三个 ref 的直读写沿用同一
// 手法,标注在各自用例里。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import type { Editor } from '@tiptap/vue-3'
import { i18n } from '../../../i18n'
import { useToast } from '../../../stores/toast'
import type { Note } from '@nimotech/nimoos-service'
import NoteEditPane from './NoteEditPane.vue'

const notes = vi.hoisted(() => ({
  get: vi.fn(),
  backlinks: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  curate: vi.fn(),
  list: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { notes } }))

// T8 —— openInApp 是 T5 的既有产出(全期零改动清单),这里只 spy `openFileInNewTab`/
// `openAgentSessionInNewTab` 是否被正确的参数调用,不重新实现它们的逻辑(那是 T5
// 的职责与既有测试范围,见 `openInApp.test.ts`)。手法与 `NotesView.test.ts` 对
// `openDirInNewTab` 的 spy 同一模具。
const openInAppMock = vi.hoisted(() => ({
  openFileInNewTab: vi.fn(),
  openAgentSessionInNewTab: vi.fn(),
}))
vi.mock('../../services/openInApp', () => openInAppMock)

// FIXTURE-COPY-BEGIN  p5d-fixtures/notes-get-one.json(camelCase 化,K1 归一)
// 逐字段取自该文件的真实回包(2026-08-04 抓取):id/title/description/type/
// status/createdBy(← created_by)/revision/updatedAt(← updated_at)/path/tags/
// sourceRefs(← source_refs)/body 全部原值,`user_id`/`created_at` 被
// `normalizeNote` 丢弃(不进 `Note` 类型)。
const NOTE_FIXTURE: Note = {
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
  body:
    'The widget is created at `/DATA/AppData/todo-list/`, locked to fixed 4×4 size via ' +
    '`minw=maxw=4, minh=maxh=4`, supports adding, deleting, toggling todo completion status, ' +
    'stores all data locally in browser localStorage. Project files:\n' +
    '- `Dockerfile`: Nginx alpine based static file serving configuration\n' +
    '- `html/index.html`: Full-page version of the todo list\n' +
    '- `html/icon.svg`: Widget icon\n' +
    '- `html/widget/index.html`: NimoOS compliant widget implementation\n',
}
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

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/ai/knowledge/notes', name: 'KnowledgeNotes', component: { template: '<div/>' } }],
  })
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

async function mountPane(noteId: string) {
  const router = makeRouter()
  router.push('/ai/knowledge/notes')
  await router.isReady()
  const w = mount(NoteEditPane, {
    props: { noteId },
    global: { plugins: [router, i18n] },
    attachTo: document.body,
  } as never)
  mountedWrappers.push(w)
  await flushPromises()
  await nextTick()
  return { w, router }
}

const flush = async () => {
  await flushPromises()
  await nextTick()
}

/** T8:按 `.kn-aside-title` 的文案精确定位某张侧栏卡(来源卡与被引用卡都用
 * `.kn-refbtn`,单靠类名区分不了两者,必须靠各自卡片的标题文案区分)。 */
function findAsideCardByTitle(w: { findAll: (s: string) => Array<{ find: (s: string) => { text: () => string } }> }, title: string) {
  return w.findAll('.kn-aside-card').find((c) => c.find('.kn-aside-title').text() === title)
}

function setupDefaultMocks(): void {
  notes.get.mockImplementation((id: string) => Promise.resolve({ ...NOTE_FIXTURE, id }))
  notes.backlinks.mockResolvedValue([])
  notes.create.mockImplementation((f: { title: string; tags?: unknown[] }) =>
    Promise.resolve({ ...NOTE_FIXTURE, id: 'new-note-id', status: 'curated', title: f.title, tags: f.tags || [] }),
  )
  notes.update.mockImplementation((id: string) =>
    Promise.resolve({ ...NOTE_FIXTURE, id, revision: (NOTE_FIXTURE.revision as number) + 1 }),
  )
  notes.curate.mockImplementation((id: string) => Promise.resolve({ ...NOTE_FIXTURE, id, status: 'curated' }))
  notes.list.mockResolvedValue([])
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
describe('NoteEditPane — created() 等效(isNew 两侧,K1/K41 数据契约)', () => {
  it('isNew=false:发 get()+backlinks() 两发,表单被真实数据填充(K41:tags/body 收窄)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    expect(notes.get).toHaveBeenCalledWith(NOTE_FIXTURE.id)
    expect(notes.backlinks).toHaveBeenCalledWith(NOTE_FIXTURE.id)
    expect((w.find('.kn-title-input').element as HTMLInputElement).value).toBe(NOTE_FIXTURE.title)
    expect((w.find('.kn-desc-input').element as HTMLInputElement).value).toBe(NOTE_FIXTURE.description)
    // status==='draft' → 顶栏徽标 + 草稿横幅都渲染
    // 🔴 T8 加固(brief §3 / DoD-11,被迫改动,「加固而非改弱」对照见任务报告):
    // T8 在侧栏插入了结构/文案都相同的第二个 `.kn-badge[data-s="draft"]`(状态卡,
    // 蓝本 :82)。裸 `.kn-badge[data-s="draft"]` 会从「唯一命中」退化成「命中两个,
    // .find() 巧合仍取到文档序第一个即顶栏那个」——测试仍绿但判别力已经退化。
    // 钉 `.kn-edit-top` 祖先,恢复「断言到确定元素」而不是「断言到文档序第一个」。
    expect(w.find('.kn-edit-top .kn-badge[data-s="draft"]').exists()).toBe(true)
    expect(w.find('.kn-draftbar').exists()).toBe(true)
  })

  it('isNew=true:不发 get()/backlinks(),status 为 null(无徽标、无草稿横幅)', async () => {
    const { w } = await mountPane('new')
    expect(notes.get).not.toHaveBeenCalled()
    expect(notes.backlinks).not.toHaveBeenCalled()
    expect(w.find('.kn-badge').exists()).toBe(false)
    expect(w.find('.kn-draftbar').exists()).toBe(false)
    expect((w.find('.kn-title-input').element as HTMLInputElement).value).toBe('')
  })

  it('status==="archived" 时顶栏只出「已归档」徽标,不出草稿横幅', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, status: 'archived' })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    // 🔴 T8 加固,同上一条理由:钉 `.kn-edit-top` 祖先,不再依赖文档序。
    expect(w.find('.kn-edit-top .kn-badge[data-s="archived"]').text()).toBe('已归档')
    expect(w.find('.kn-draftbar').exists()).toBe(false)
  })

  it('get() 失败:K5 固定文案 toast,不回显后端 message', async () => {
    notes.get.mockRejectedValue(new Error('agent offline: super-secret-stack-trace'))
    await mountPane(NOTE_FIXTURE.id)
    const texts = useToast().toasts.map((x) => x.text)
    expect(texts).toContain('操作失败')
    expect(texts.join(' | ')).not.toContain('super-secret-stack-trace')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 §5.2 过期守卫(K15 同族第 9 次)—— 两实例交错。
// RED 探针见任务报告(把 `let loadEpoch` 挪进独立 `<script lang="ts">` 块、
// 去 setup 化、跨实例共享 —— 本用例必须报红)。
describe('NoteEditPane — 过期守卫(§5.2):两实例交错', () => {
  it('🔴 两个实例各自的 loadEpoch 互不干扰(守卫变量必须是组件本地,不是模块级)', async () => {
    const d1 = makeDeferred<Note>()
    const d2 = makeDeferred<Note>()
    notes.get.mockReturnValueOnce(d1.promise) // instance 1 的首发(也是唯一一发)
    const { w: w1 } = await mountPane('note-a')
    notes.get.mockReturnValueOnce(d2.promise) // instance 2 的首发(也是唯一一发)
    const { w: w2 } = await mountPane('note-b')

    // instance 1 的响应最后才到:若守卫变量是模块级,instance2 挂载时的
    // `++loadEpoch` 已经把共享计数器往前推,instance1 检查
    // `epoch !== loadEpoch` 会误判自己"过期"而丢弃这个本该属于它的、
    // 唯一一次响应。
    d1.resolve({ ...NOTE_FIXTURE, id: 'note-a', title: 'Title A', revision: 1 })
    await flush()
    d2.resolve({ ...NOTE_FIXTURE, id: 'note-b', title: 'Title B', revision: 2 })
    await flush()

    expect((w1.find('.kn-title-input').element as HTMLInputElement).value).toBe('Title A')
    expect((w2.find('.kn-title-input').element as HTMLInputElement).value).toBe('Title B')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N29:`tbActive()` 里 `tbTick.value >= 0 &&` 是故意的假依赖,不许删。
// 判据:直接对**真实 Editor 实例**触发 transaction(绕开 `cmd()`,因此不改
// `dirty`——若走 `cmd()`,`dirty` 的变化本身也会强制整个组件重渲染,测不出
// tbTick 这一项假依赖单独的判别力,见文件头 R5 说明)。
// 🔴 裁定 R5:附录 D §D.6.1 的探针没挂父组件,这条链路 T0 没实证过,本刀必须
// 自己附变异证据(报告 §变异证据:删掉 `tbTick.value >= 0 &&` 后本用例报红)。
describe('NoteEditPane — N29(tbActive 假依赖,工具栏 data-on 跟着 transaction 刷新)', () => {
  it('绕开 cmd() 直接对真实 Editor 触发 transaction 后,.kn-tb-btn[data-on] 才刷新;dirty 全程未变', async () => {
    const { w } = await mountPane('new')
    const boldBtn = w.find('.kn-editor-toolbar .kn-tb-btn[title="加粗"]')
    expect(boldBtn.attributes('data-on')).toBe('false')

    // 🔴 wrapper.vm 直读 <script setup> 顶层 ref(见文件头说明)——绕开
    // cmd(),不改 dirty,只让真实 Editor 产生一次 transaction。
    const ed = (w.vm as unknown as { editor?: Editor }).editor
    expect(ed).toBeTruthy()
    ed!.chain().focus().toggleBold().run()
    await nextTick()
    await flushPromises()

    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false)
    expect(boldBtn.attributes('data-on')).toBe('true')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// N27:四档三元嵌套照抄(蓝本 `:17`),四档都要用例。
describe('NoteEditPane — N27(保存提示四档三元嵌套照抄)', () => {
  it('saving=true → "保存中…"(优先级最高,不看 dirty/isNew)', async () => {
    const d = makeDeferred<Note>()
    notes.create.mockReturnValue(d.promise)
    const { w } = await mountPane('new')
    await w.find('.kn-title-input').setValue('draft title')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await nextTick() // 不 flushPromises:抓住 saving=true 但请求尚未回来的中间态
    expect(w.find('.kn-savehint').text()).toContain('保存中…')
    d.resolve({ ...NOTE_FIXTURE, id: 'x' })
    await flush()
  })

  it('saving=false, dirty=true → "有未保存更改"', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await w.find('.kn-title-input').setValue(NOTE_FIXTURE.title + ' edited')
    expect(w.find('.kn-savehint').text()).toContain('有未保存更改')
  })

  it('saving=false, dirty=false, isNew=true → "尚未保存"', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-savehint').text()).toContain('尚未保存')
  })

  it('saving=false, dirty=false, isNew=false → "已保存 · rev {n}"', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    expect(w.find('.kn-savehint').text()).toContain(`已保存 · rev ${NOTE_FIXTURE.revision}`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// N26:三段式拼接照抄(中间加粗),不合成带 HTML 的键。
describe('NoteEditPane — N26(草稿横幅三段式拼接)', () => {
  it('三段各自独立渲染,中间段是 <b> 加粗', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // NOTE_FIXTURE.status === 'draft'
    const txt = w.find('.kn-draftbar-txt')
    const b = txt.find('b')
    expect(b.exists()).toBe(true)
    expect(b.text()).toBe('AI 自动沉淀的草稿')
    // 三段拼起来是完整句子(不含 HTML 标签泄露,证明不是靠 v-html 合成)
    expect(txt.text()).toContain('这是一条')
    expect(txt.text()).toContain(',还不是正式知识')
    expect(txt.html()).not.toContain('&lt;b&gt;') // 不是把 <b> 当纯文本字面量输出
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// N28:wordCount 正则 /[#|\-*`>\s]/g 照抄,不"修正"成 markdown 感知的计数。
// 三个边界用例的期望值用 node 离线核算(见任务报告),不是从实现里反推。
describe('NoteEditPane — N28(wordCount 正则边界,md 模式下直接控制 form.body)', () => {
  async function setMdBody(w: Awaited<ReturnType<typeof mountPane>>['w'], body: string) {
    // 切到 md 模式:textarea 直接 v-model="form.body",比 rich 模式下靠 tiptap
    // markdown 序列化更精确可控(边界字符串要逐字节对得上)。
    await w.find('.kn-editor-toolbar .k-seg button:nth-child(2)').trigger('click') // "Markdown" 按钮
    await w.find('.kn-editor-src').setValue(body)
    await nextTick()
  }

  it('空 body → 0 字', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-editor-status span').text()).toBe('0 字')
  })

  it('全是被剥字符(# | - * ` > 空白)→ 0 字', async () => {
    const { w } = await mountPane('new')
    await setMdBody(w, '# ** -- ``` >>> \n\t  |||')
    expect(w.find('.kn-editor-status span').text()).toBe('0 字')
  })

  it('混合字符 → 24 字(node 离线核算:Hello#World!`code`>quote a-b*c|d 剥完剩 24 个字符)', async () => {
    const { w } = await mountPane('new')
    await setMdBody(w, 'Hello #World! `code` >quote a-b*c|d')
    expect(w.find('.kn-editor-status span').text()).toBe('24 字')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 属性态 String() 照抄(P5b E-9),data-on/data-dirty 两侧都比 'true'/'false'。
// 附录 D §D.3 M-3:.kn-tb-btn 是 ×8,不是 ×7 —— 计数断言钉死 8。
describe('NoteEditPane — 属性态 String() 照抄 + M-3(kn-tb-btn ×8)', () => {
  it('kn-tb-btn 恰好 8 个(蓝本 :43/44/45/47/48/50/51/52)', async () => {
    const { w } = await mountPane('new')
    expect(w.findAll('.kn-editor-toolbar .kn-tb-btn')).toHaveLength(8)
  })

  it('data-dirty 初始 "false",输入后变 "true"(两侧都比字符串,禁 toBeUndefined)', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-savehint').attributes('data-dirty')).toBe('false')
    await w.find('.kn-title-input').setValue('x')
    expect(w.find('.kn-savehint').attributes('data-dirty')).toBe('true')
  })

  it('k-seg 双模式按钮 data-on 两侧都是字符串 "true"/"false"', async () => {
    const { w } = await mountPane('new')
    const [richBtn, mdBtn] = w.findAll('.kn-editor-toolbar .k-seg button')
    expect(richBtn.attributes('data-on')).toBe('true')
    expect(mdBtn.attributes('data-on')).toBe('false')
    await mdBtn.trigger('click')
    expect(richBtn.attributes('data-on')).toBe('false')
    expect(mdBtn.attributes('data-on')).toBe('true')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 保存按钮 disabled 三种组合(§9.9)。
describe('NoteEditPane — 保存按钮 disabled(saving || (isNew && !title.trim()))', () => {
  it('isNew=true, title 为空/全空白 → disabled', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeDefined()
    await w.find('.kn-title-input').setValue('   ')
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeDefined()
  })

  it('isNew=true, title 非空 → 不 disabled', async () => {
    const { w } = await mountPane('new')
    await w.find('.kn-title-input').setValue('a title')
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeUndefined()
  })

  it('isNew=false → 即使标题被清空也不 disabled(isNew 门槛不适用)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    await w.find('.kn-title-input').setValue('')
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeUndefined()
  })

  it('saving=true → disabled(即使标题非空/isNew=false)', async () => {
    const d = makeDeferred<Note>()
    notes.update.mockReturnValue(d.promise)
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await nextTick()
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeDefined()
    d.resolve({ ...NOTE_FIXTURE })
    await flush()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// save() 两条路 + addTag() 在开头被调用(输入框未提交的标签会被带上)。
describe('NoteEditPane — save():isNew 两条路 + addTag() 前置调用', () => {
  it('isNew=true → create() + router 带 ?id=,addTag() 把未提交的标签一并带上', async () => {
    const { w, router } = await mountPane('new')
    await w.find('.kn-title-input').setValue('brand new note')
    // 🔴 wrapper.vm 直读 tagInput(文件头技术先例说明)——标签输入框的 UI
    // 归 T8,本刀只需证明 save() 开头调用的 addTag() 真的把"输入框里还没提交
    // 的文本"解析进 form.tags 并带进 create() 的 payload。
    ;(w.vm as unknown as { tagInput: string }).tagInput = 'foo, bar'
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()
    expect(notes.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'brand new note', tags: ['foo', 'bar'] }),
    )
    expect(router.currentRoute.value.fullPath).toContain('?id=new-note-id')
  })

  it('isNew=false → update({expectedRevision, ...}),保存成功后 toast「已保存」', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    await w.find('.kn-title-input').setValue(NOTE_FIXTURE.title + ' v2')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()
    expect(notes.update).toHaveBeenCalledWith(
      NOTE_FIXTURE.id,
      expect.objectContaining({ expectedRevision: NOTE_FIXTURE.revision, title: NOTE_FIXTURE.title + ' v2' }),
    )
    expect(useToast().toasts.map((x) => x.text)).toContain('已保存')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// save() 的 catch 分岔:409+!isNew → openConflict()(本刀只到 conflict state
// 被设上,弹窗渲染归 T8);否则(含 409+isNew)→ K5 固定文案,排除式断言不含
// 后端文本。
describe('NoteEditPane — save() catch 分岔(K5 + conflict state)', () => {
  it('🔴 409 + !isNew → conflictMessage 判真,conflict state 被设上(latest/baseRevision),不弹「操作失败」', async () => {
    notes.update.mockRejectedValue({ response: { status: 409, data: { current_revision: 999 } } })
    notes.get.mockImplementation((id: string) => Promise.resolve({ ...NOTE_FIXTURE, id, revision: 999 }))
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    notes.get.mockClear()
    await w.find('.kn-title-input').setValue(NOTE_FIXTURE.title + ' conflict-edit')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()

    // openConflict() 内部会再发一次 get() 拿最新版本。
    expect(notes.get).toHaveBeenCalledWith(NOTE_FIXTURE.id)
    // 🔴 wrapper.vm 直读 conflict ref(文件头技术先例)——冲突弹窗渲染归 T8,
    // 本刀只验证"状态被设上"这个可观察结果。
    const conflict = (w.vm as unknown as { conflict: { latest: Note; baseRevision: number } | null }).conflict
    expect(conflict).not.toBeNull()
    expect(conflict!.latest.revision).toBe(999)
    // baseRevision = note.value.revision(本刀 mock 里 get() 对任何 id 都回 revision:999,
    // 即挂载时首发 get() 已经把 note.value.revision 设成 999 了,不是 NOTE_FIXTURE 原值)
    expect(conflict!.baseRevision).toBe(999)
    expect(useToast().toasts.map((x) => x.text)).not.toContain('操作失败')
  })

  it('409 但 isNew=true → 不走 conflict 分支,走 K5 固定文案', async () => {
    notes.create.mockRejectedValue({ response: { status: 409, data: { current_revision: 1 } } })
    const { w } = await mountPane('new')
    await w.find('.kn-title-input').setValue('brand new')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()
    expect(useToast().toasts.map((x) => x.text)).toContain('操作失败')
    const conflict = (w.vm as unknown as { conflict: unknown }).conflict
    expect(conflict).toBeNull()
  })

  it('非 409 错误 → K5 固定文案,排除式断言:不含后端消息', async () => {
    notes.update.mockRejectedValue(new Error('backend exploded: disk full super-secret'))
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    await w.find('.kn-title-input').setValue(NOTE_FIXTURE.title + ' x')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()
    const texts = useToast().toasts.map((x) => x.text)
    expect(texts).toContain('操作失败')
    expect(texts.join(' | ')).not.toContain('disk full super-secret')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NoteEditPane — curateInPlace()(草稿横幅「确认为正式笔记」)', () => {
  it('成功:toast「笔记已确认」,顺带触发 refreshNotesDraftCount(→ service.notes.list 被调用)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // status: draft
    await flush()
    await w.find('.kn-draftbar .k-btn.primary').trigger('click')
    await flush()
    expect(notes.curate).toHaveBeenCalledWith(NOTE_FIXTURE.id)
    expect(useToast().toasts.map((x) => x.text)).toContain('笔记已确认')
    expect(notes.list).toHaveBeenCalled()
  })

  it('失败:K5 固定文案,不回显后端 message', async () => {
    notes.curate.mockRejectedValue(new Error('curate failed: leaked-internal-detail'))
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    await w.find('.kn-draftbar .k-btn.primary').trigger('click')
    await flush()
    const texts = useToast().toasts.map((x) => x.text)
    expect(texts).toContain('操作失败')
    expect(texts.join(' | ')).not.toContain('leaked-internal-detail')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 定位器策略自证(brief §4):下面这条只是确认本文件用到的定位器都限定在
// `.kn-edit-top`/`.kn-editor-toolbar`/`.kn-draftbar` 等 T7 自己的容器内,
// T8 插入 `.kn-edit-aside`(侧栏,含自己的 `.k-btn`)与冲突弹窗(含自己的
// `.k-btn.primary`/`.k-modal-title` 等)之后,不会被这些限定选择器误命中——
// T8 插入内容后本条应保持通过,不需要改动。
describe('NoteEditPane — 定位器边界自查(为 T8 插入做准备)', () => {
  it('顶栏保存按钮定位器 .kn-edit-top .k-btn.primary 在挂载后恰好命中 1 个', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    expect(w.findAll('.kn-edit-top .k-btn.primary')).toHaveLength(1)
  })

  it('草稿横幅确认按钮定位器 .kn-draftbar .k-btn.primary 在挂载后恰好命中 1 个', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // status: draft
    expect(w.findAll('.kn-draftbar .k-btn.primary')).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════ 以下全部为 T8 新增(侧栏 5 卡 + 标签编辑 + 冲突弹窗) ═══
// ═══════════════════════════════════════════════════════════════════════════

// 🔴 DoD-11 加固证据:证明「T7 预警的隐性脆弱点」真实存在 —— 裸
// `.kn-badge[data-s="draft"/"archived"]` 在插入侧栏状态卡后确实命中 2 个,
// 而不是理论假设。见上方 T7 两条断言的加固注释(钉 `.kn-edit-top` 祖先)。
describe('NoteEditPane — 定位器加固(DoD-11,证明加固前的隐患真实存在)', () => {
  it('draft:裸选择器命中 2 个(顶栏 + 侧栏状态卡);加固后的 .kn-edit-top/.kn-edit-aside 定位器各精确命中 1 个', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // status: draft
    expect(w.findAll('.kn-badge[data-s="draft"]')).toHaveLength(2)
    expect(w.findAll('.kn-edit-top .kn-badge[data-s="draft"]')).toHaveLength(1)
    expect(w.findAll('.kn-edit-aside .kn-badge[data-s="draft"]')).toHaveLength(1)
  })

  it('archived:同理,裸选择器命中 2 个,加固后的 .kn-edit-top 定位器精确命中 1 个', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, status: 'archived' })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    expect(w.findAll('.kn-badge[data-s="archived"]')).toHaveLength(2)
    expect(w.findAll('.kn-edit-top .kn-badge[data-s="archived"]')).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 侧栏第 1 卡:状态(§9.9 isNew 两侧 + 三态徽标 + Source/Last modified)。
describe('NoteEditPane — 侧栏状态卡', () => {
  it('isNew=true → 「保存后成为已确认的正式笔记」提示,无三态徽标', async () => {
    const { w } = await mountPane('new')
    const card = w.findAll('.kn-aside-card')[0]
    expect(card.text()).toContain('保存后成为「已确认」的正式笔记')
    expect(card.find('.kn-badge').exists()).toBe(false)
  })

  it('isNew=false, status=draft → 侧栏也出「AI 草稿」徽标 + Source(sourceMeta)+ Last modified(非空)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // status: draft, createdBy: pipeline
    const card = w.findAll('.kn-aside-card')[0]
    expect(card.find('.kn-badge[data-s="draft"]').exists()).toBe(true)
    const kvs = card.findAll('.kn-kv')
    // sourceMeta('pipeline') = { labelKey: 'aiKbNoteSrcPipeline' → 'AI 沉淀', icon: 'sparkle' }
    expect(kvs[1].find('b').text()).toBe('AI 沉淀')
    expect(kvs[2].find('b').text().length).toBeGreaterThan(0) // relativeTime 边界由 notesViewHelpers.test.ts 单独覆盖(§9.8)
  })

  it('status="curated"(非 draft 非 archived)→ 侧栏徽标 data-s="curated",文案「已确认」', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, status: 'curated' })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const card = w.findAll('.kn-aside-card')[0]
    expect(card.find('.kn-badge[data-s="curated"]').text()).toContain('已确认')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 侧栏第 2 卡:磁盘文件(§9.9 isNew 两侧 + revealFile/copyPath)。
describe('NoteEditPane — 侧栏磁盘文件卡', () => {
  it('isNew=true → 「保存后在笔记目录创建 .md 文件」提示,无路径/无按钮', async () => {
    const { w } = await mountPane('new')
    const card = w.findAll('.kn-aside-card')[1]
    expect(card.text()).toContain('保存后在笔记目录创建 .md 文件')
    expect(card.find('.kn-filepath').exists()).toBe(false)
    expect(card.find('.kn-file-acts').exists()).toBe(false)
  })

  it('isNew=false → 路径 + 60 秒同步提示 + 「文件管理器」/「复制路径」按钮', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const card = w.findAll('.kn-aside-card')[1]
    expect(card.find('.kn-filepath').text()).toBe(NOTE_FIXTURE.path)
    expect(card.text()).toContain('60 秒内同步回来')
    expect(card.find('.kn-file-acts').exists()).toBe(true)
  })

  it('点「文件管理器」调用 openFileInNewTab(note.path)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.findAll('.kn-file-acts .k-btn')[0]
    await btn.trigger('click')
    expect(openInAppMock.openFileInNewTab).toHaveBeenCalledWith(NOTE_FIXTURE.path)
  })

  it('copyPath 成功(navigator.clipboard 存在)→ toast「路径已复制」', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.findAll('.kn-file-acts .k-btn')[1]
    await btn.trigger('click')
    await flush()
    expect(writeText).toHaveBeenCalledWith(NOTE_FIXTURE.path)
    expect(useToast().toasts.map((x) => x.text)).toContain('路径已复制')
  })

  // 🔴 治理 §9.9 / 记忆 newui-clipboard-insecure-reka:HTTP-IP 真机访问下
  // navigator.clipboard 不存在(jsdom 默认同样不存在,不需要显式清空即可复现);
  // 这是蓝本行为(蓝本 `:259-264` 也只有裸 try/catch),按 N 系列照抄,不加
  // execCommand 兜底(那是 Files 区的既有增强)。前端票见文件头「═══ T8 ═══」。
  it('🔴 copyPath:navigator.clipboard 在 HTTP-IP 下不存在 → 走 catch,弹「操作失败」(预期,非缺陷)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.findAll('.kn-file-acts .k-btn')[1]
    await btn.trigger('click')
    await flush()
    expect(useToast().toasts.map((x) => x.text)).toContain('操作失败')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 侧栏第 3 卡:属性(类型下拉 + 标签编辑:chip/删除/onTagKey 三分支+反例/
// focusTagInput/addTag 去重 DoD-4)。
describe('NoteEditPane — 侧栏属性卡:类型下拉', () => {
  it('切换类型下拉触发 dirty = true,form.type 跟着变', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // type: insight
    await flush()
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false)
    const select = w.find('.kn-aside-select')
    await select.setValue('summary')
    await select.trigger('change')
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(true)
    expect((w.vm as unknown as { form: { type: string } }).form.type).toBe('summary')
  })
})

describe('NoteEditPane — 侧栏属性卡:标签编辑', () => {
  it('form.tags 的每个标签渲染成一个 .kn-tagchip', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // tags: ['nimoos','todo-list','widget']
    const chips = w.findAll('.kn-tagchip')
    expect(chips.map((c) => c.text().replace('移除', '').trim())).toEqual(NOTE_FIXTURE.tags)
  })

  it('removeTag:点 chip 的移除按钮删掉该标签 + dirty = true', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    await w.findAll('.kn-tagchip button')[0].trigger('click')
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(['todo-list', 'widget'])
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(true)
  })

  it('focusTagInput:点击 .kn-tagedit 容器,标签输入框获得焦点(蓝本 :237 $refs.tagInput.focus())', async () => {
    const { w } = await mountPane('new')
    const input = w.find('.kn-tagedit input').element as HTMLInputElement
    expect(document.activeElement).not.toBe(input)
    await w.find('.kn-tagedit').trigger('click')
    expect(document.activeElement).toBe(input)
  })

  // onTagKey 三条分支 + 一条反例(DoD-3)。
  it('Enter → preventDefault + addTag()', async () => {
    const { w } = await mountPane('new')
    const input = w.find('.kn-tagedit input')
    await input.setValue('foo')
    await input.trigger('keydown', { key: 'Enter' })
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(['foo'])
    expect((w.find('.kn-tagedit input').element as HTMLInputElement).value).toBe('')
  })

  it('逗号 "," → preventDefault + addTag()', async () => {
    const { w } = await mountPane('new')
    const input = w.find('.kn-tagedit input')
    await input.setValue('bar')
    await input.trigger('keydown', { key: ',' })
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(['bar'])
  })

  it('Backspace 且输入框为空且已有标签 → 弹掉最后一个 + dirty = true', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // tags: ['nimoos','todo-list','widget']
    await flush()
    const input = w.find('.kn-tagedit input')
    await input.trigger('keydown', { key: 'Backspace' })
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(['nimoos', 'todo-list'])
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(true)
  })

  it('🔴 反例:Backspace 但输入框非空 → 不弹标签(两条分支都不成立)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    const input = w.find('.kn-tagedit input')
    await input.setValue('typing')
    await input.trigger('keydown', { key: 'Backspace' })
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(NOTE_FIXTURE.tags)
  })

  // DoD-4:addTag() 去重,T7 未覆盖这条,本刀补齐(核实:T7 只测过"输入框未提交
  // 的新标签"路径,未测过"输入已存在的标签"路径,见 §2 核实说明)。
  it('🔴 addTag() 去重:输入一个已存在的标签 → dirty 不变、tags 不变(仅去重逻辑判别,不重写实现)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // tags: ['nimoos','todo-list','widget']
    await flush()
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false)
    const input = w.find('.kn-tagedit input')
    await input.setValue('nimoos') // 已存在的标签
    await input.trigger('blur')
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(NOTE_FIXTURE.tags)
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 侧栏第 4 卡:来源(§9.9 两侧 + openRef/openSessionRef + refLabel 三档 DoD-9)。
describe('NoteEditPane — 侧栏来源卡', () => {
  it('!isNew && sourceRefs.length → 渲染(fixture 实测:pipeline 笔记 source_refs 恒非空,README §4)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // sourceRefs: [{ session_id: '...' }]
    expect(w.find('.kn-aside-card .kn-refbtn').exists()).toBe(true)
  })

  it('sourceRefs 为空数组 → 不渲染(该条件的反面,fixture: notes-backlinks 同源 README §4 场景之一)', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, sourceRefs: [] })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    expect(w.find('.kn-refbtn').exists()).toBe(false)
  })

  it('isNew=true → 不渲染(即使强行给 sourceRefs,isNew 门槛优先)', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-aside-card .kn-refbtn').exists()).toBe(false)
  })

  it('r.session_id 分支:点击调用 openSessionRef(r.session_id) → openAgentSessionInNewTab,label 取 session_id 前 8 位(refLabel 第②档)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.find('.kn-refbtn')
    expect(btn.text()).toContain('6fe14460') // session_id 前 8 位,refLabel 无 label 时的兜底
    await btn.trigger('click')
    expect(openInAppMock.openAgentSessionInNewTab).toHaveBeenCalledWith('6fe14460-9892-4d7e-b104-db1098c749af')
  })

  // 🔴 mock 形状说明:本机 fixture(README §4)记录 pipeline 笔记的 source_refs
  // 恒为 `[{session_id}]` 形态,无 `path` 形态的真实抓取样本 —— 下面这条按 K41
  // 的 `SourceRef` 接口定义(`path?: string`,依据蓝本 `:128`)构造最小示例,
  // 字段名/形状取自接口定义与蓝本读取行,不是手编信封(信封层次仍是已归一化
  // 的 `Note.sourceRefs` 数组,只是数组元素内容本机没有该分支的真实样本)。
  it('r.path 分支(本机无真实样本,按 K41 接口构造):点击调用 openRef(r.path) → openFileInNewTab', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, sourceRefs: [{ path: '/DATA/Notes/1/other.md' }] })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.find('.kn-refbtn')
    expect(btn.text()).toContain('/DATA/Notes/1/other.md')
    await btn.trigger('click')
    expect(openInAppMock.openFileInNewTab).toHaveBeenCalledWith('/DATA/Notes/1/other.md')
  })

  // refLabel(r) 三档(DoD-9),经 wrapper.vm 直调(FolderBrowser.test.ts:390 /
  // IndexedFilesView.test.ts:1670/1960 已确立的技术先例:<script setup> 顶层
  // 函数可经 wrapper.vm 直接调用,不是新增功能/不是绕过公开行为——第③档
  // (label 与 session_id 都没有)在模板里没有任何按钮会渲染那个 ref
  // (v-if="r.path" / v-else-if="r.session_id" 两条都不成立),UI 摸不到)。
  it('refLabel 三档:① 有 label 直接用;② 无 label 有 session_id 取前 8 位;③ 都没有 → 空串', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const refLabel = (
      w.vm as unknown as {
        refLabel: (r: { path?: string; session_id?: string; label?: string }) => string
      }
    ).refLabel
    expect(refLabel({ label: 'my-label', session_id: 'abcdefgh12345' })).toBe('my-label')
    expect(refLabel({ session_id: '6fe14460-9892-4d7e-b104-db1098c749af' })).toBe('6fe14460')
    expect(refLabel({})).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 侧栏第 5 卡:被引用(§9.9 两侧)。
describe('NoteEditPane — 侧栏被引用卡', () => {
  it('backlinks 为空(fixture 实测:本机恒 []，README §4)→ 不渲染', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // notes.backlinks 默认 mock 为 []
    expect(findAsideCardByTitle(w, '被引用')).toBeUndefined()
  })

  // 🔴 mock 形状说明:README §4 记录本机 backlinks 端点恒回 `[]`,无非空真实
  // 抓取样本——下面这条按 K41 的 `Backlink` 接口(`{id: string; title: string}`,
  // 依据蓝本 `:139`/`:141`)构造最小示例,字段名取自接口定义,信封层次仍是
  // `service.notes.backlinks()` 已归一化的数组(不是 `{backlinks:[]}`)。
  it('backlinks 非空(本机无真实样本,按 K41 接口构造)→ 渲染,点击 push 到 ?id=b.id', async () => {
    notes.backlinks.mockResolvedValue([{ id: 'other-note-id', title: 'Referencing Note' }])
    const { w, router } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    const btn = w.findAll('.kn-refbtn').find((b) => b.text().includes('Referencing Note'))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    await flush()
    expect(router.currentRoute.value.fullPath).toContain('?id=other-note-id')
  })

  it('isNew=true → 不渲染', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-aside-card .kn-refbtn').exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 冲突弹窗(DoD-5/6/7):转 reka + K36 a11y + 三个动作 dirty 断言 + clipboard。
describe('NoteEditPane — 冲突弹窗(reka 化 + 三个动作)', () => {
  // K7:弹窗 portal 目标 —— 独立挂载时不在 .knowledge-app 子树里(生产环境由
  // KnowledgeLayout.vue 提供),先例 QueueView.test.ts::withHost() /
  // NotesView.test.ts::withHost()。
  function withHost(): HTMLElement {
    const host = document.createElement('div')
    host.className = 'knowledge-app'
    document.body.appendChild(host)
    return host
  }

  async function openConflictModal() {
    const host = withHost()
    const { w, router } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    notes.update.mockRejectedValueOnce({ response: { status: 409, data: { current_revision: 999 } } })
    await w.find('.kn-title-input').setValue(NOTE_FIXTURE.title + ' conflict-edit')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()
    return { host, w, router }
  }

  it('冲突态被设上后,弹窗 portal 到 .knowledge-app,标题/diff 面板正确渲染', async () => {
    const { host } = await openConflictModal()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    expect(modal!.querySelector('.k-modal-title')!.textContent).toBe('有人先保存了这条笔记')
    // theirs 面板:latest.revision(openConflict() 内部 get() 默认回 NOTE_FIXTURE 同 revision)
    expect(modal!.querySelector('[data-side="theirs"]')!.textContent).toContain(`rev ${NOTE_FIXTURE.revision}`)
    // mine 面板:显示 form.body(未提交的标题改动"conflict-edit"不在这里 —— 蓝本
    // `:169` 就是 `{{ form.body }}`,不是 `form.title`),baseRevision 同样是
    // NOTE_FIXTURE.revision(loadNote() 首发已把 note.value.revision 设成它)。
    expect(modal!.querySelector('[data-side="mine"]')!.textContent).toContain(`基于 rev ${NOTE_FIXTURE.revision}`)
    expect(modal!.querySelector('[data-side="mine"] .kn-diff-body')!.textContent).toContain('Dockerfile')
  })

  it('点 × 不关闭(反例:只有点遮罩才关闭);点遮罩关闭弹窗(conflict = null)', async () => {
    const { host } = await openConflictModal()
    expect(host.querySelector('.k-modal')).not.toBeNull()
    // reka usePointerDownOutside 用 setTimeout(0) 延后挂 document 监听(先例
    // QueueView.test.ts/NotesView.test.ts 同款注释),补一次宏任务 tick。
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

  it('🔴 K36 a11y —— aria-labelledby 与 .k-modal-title 的 id 同值同元素,弹窗内恰好一个带 id 元素', async () => {
    const { host } = await openConflictModal()
    const modal = host.querySelector('.k-modal')!
    expect(modal.getAttribute('role')).toBe('dialog')
    const labelId = modal.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const titleEl = modal.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.id).toBe(labelId)
    expect(titleEl.textContent).toBe('有人先保存了这条笔记')
    // as-child 不额外插入 VisuallyHidden 节点 —— 弹窗内带 id 的元素应恰好 1 个。
    expect(modal.querySelectorAll('[id]')).toHaveLength(1)
  })

  it('adoptDisk:note=latest + form.body=latest.body + conflict 清空 + dirty=true + toast', async () => {
    const { host, w } = await openConflictModal()
    const modal = host.querySelector('.k-modal')!
    const useDiskBtn = Array.from(modal.querySelectorAll('.k-modal-foot button')).find(
      (b) => b.textContent === '采用磁盘版本',
    ) as HTMLElement
    useDiskBtn.click()
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
    const vm = w.vm as unknown as { dirty: boolean; form: { body: string } }
    expect(vm.dirty).toBe(true)
    expect(vm.form.body).toBe(NOTE_FIXTURE.body) // latest.body(get() 默认回 NOTE_FIXTURE 同 body)
    expect(useToast().toasts.map((x) => x.text)).toContain('已加载最新版本,你的正文已被替换')
  })

  it('keepMine:只 rebase revision(note.revision 变成 latest.revision),body 不动,conflict 清空,dirty=true,toast 带 {n}', async () => {
    const { host, w } = await openConflictModal()
    const vmBefore = w.vm as unknown as { form: { body: string } }
    const bodyBefore = vmBefore.form.body
    const modal = host.querySelector('.k-modal')!
    const keepBtn = Array.from(modal.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('保留我的编辑'),
    ) as HTMLElement
    keepBtn.click()
    await flush()
    expect(host.querySelector('.k-modal')).toBeNull()
    const vm = w.vm as unknown as { dirty: boolean; form: { body: string }; note: { revision?: number } }
    expect(vm.dirty).toBe(true)
    expect(vm.form.body).toBe(bodyBefore) // body 不动
    expect(vm.note.revision).toBe(NOTE_FIXTURE.revision) // rebase 到 latest.revision
    expect(useToast().toasts.map((x) => x.text)).toContain(`保留了你的编辑,保存将覆盖 rev ${NOTE_FIXTURE.revision}`)
  })

  it('copyMine 成功(navigator.clipboard 存在)→ writeText(form.body),toast「已复制你的正文」,弹窗不关闭', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { host } = await openConflictModal()
    const modal = host.querySelector('.k-modal')!
    const copyBtn = Array.from(modal.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('复制我的正文'),
    ) as HTMLElement
    copyBtn.click()
    await flush()
    expect(writeText).toHaveBeenCalledWith(NOTE_FIXTURE.body)
    expect(useToast().toasts.map((x) => x.text)).toContain('已复制你的正文')
    expect(host.querySelector('.k-modal')).not.toBeNull() // copyMine 不碰 conflict
  })

  // 🔴 治理 §9.9 / 记忆 newui-clipboard-insecure-reka(见文件头「═══ T8 ═══」)。
  it('🔴 copyMine:navigator.clipboard 在 HTTP-IP 下不存在 → 走 catch,弹「操作失败」(预期,非缺陷)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const { host } = await openConflictModal()
    const modal = host.querySelector('.k-modal')!
    const copyBtn = Array.from(modal.querySelectorAll('.k-modal-foot button')).find((b) =>
      b.textContent!.includes('复制我的正文'),
    ) as HTMLElement
    copyBtn.click()
    await flush()
    expect(useToast().toasts.map((x) => x.text)).toContain('操作失败')
  })
})
