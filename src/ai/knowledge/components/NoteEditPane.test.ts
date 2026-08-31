// `NoteEditPane.vue` **top half**(top bar + draft banner + main column editor) unit tests.
// Blueprint: the Vue 2 panel's `src/views/AI/Knowledge/NoteEditPane.vue`(338 lines).
// This file only tests T7 scope(top bar/draft banner/main column editor + props/data/isNew/status/
// wordCount/created() equivalent/onEditorReady/tbActive/cmd/save/curateInPlace).
// 5 aside cards/tag editing/conflict modal rendering belong to T8, not in this file assertion scope —
// but `save()` catch branch "conflict state being set" behavior this pass must test(use
// `wrapper.vm` technique to read internal ref, no new UI, reason see corresponding describe block below).
//
// ═══ mock strategy(governance §4.1) ═══
// `service.notes.get/create/update/curate` return **single normalized Note**(camelCase).
// `service.notes.backlinks` return **array**, empty is `[]`(not `{backlinks:[]}` envelope).
// `NOTE_FIXTURE` each field from a real captured response
// (camelCased; `source_refs`→`sourceRefs`, `created_by`→`createdBy`,
// `updated_at`→`updatedAt`; `user_id` discarded by package, `created_at` not in `Note` type).
// 409 conflict body from a captured HTTP response
// (`{"detail":"revision conflict","current_revision":1}`), axios error object reshaped to
// `{response:{status:409,data:{current_revision:...}}}`.
//
// ═══ Attribute state assertion caliber(governance §9 / appendix D §D.3) ═══
// `data-on`/`data-dirty` all use `toBe('true')`/`toBe('false')`, compare both sides, forbid
// `toBeUndefined()`.
//
// ═══ `wrapper.vm` technique for directly reading <script setup> top-level ref ═══
// `IndexedFilesView.test.ts:618-621` established: <script setup> top-level ref even without
// `defineExpose`, `@vue/test-utils` `wrapper.vm` still readable/writable in test environment
// (instance.proxy accesses setupState bidirectionally)—not new feature, not bypassing component public
// behavior, just this pass has no clickable UI entry reaching "conflict state set"  internal states(aside/
// modal belong to T8). This file's direct read/write of three `conflict`/`dirty`/`tagInput` refs
// uses same technique, annotated in respective test cases.
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

// T8 — openInApp is T5's existing output(zero-change list for full period),
// here only spy whether `openFileInNewTab`/`openAgentSessionInNewTab` called with correct params,
// don't re-implement their logic(that's T5's responsibility and existing test scope, see `openInApp.test.ts`).
// Technique matches `NotesView.test.ts`'s spy on `openDirInNewTab`.
const openInAppMock = vi.hoisted(() => ({
  openFileInNewTab: vi.fn(),
  openAgentSessionInNewTab: vi.fn(),
}))
vi.mock('../../services/openInApp', () => openInAppMock)

// FIXTURE-COPY-BEGIN — notes-get-one fixture (camelCased, K1 normalized)
// Each field from real response in that file(captured 2026-08-04): id/title/description/type/
// status/createdBy(← created_by)/revision/updatedAt(← updated_at)/path/tags/
// sourceRefs(← source_refs)/body all original values, `user_id`/`created_at` discarded by
// `normalizeNote`(not in `Note` type).
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
    history: createWebHashHistory('/'),
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

/** T8: precisely locate aside card by `.kn-aside-title` text(sources and backlinks cards both use
 * `.kn-refbtn`, can't distinguish by class name alone, must use each card's title text). */
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

// ═════════════════════════════════════════════════════════════════════════════
describe('NoteEditPane — created() equivalent (isNew both sides, K1/K41 data contract)', () => {
  it('isNew=false: send get()+backlinks() twice, form filled with real data(K41: tags/body narrowing)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    expect(notes.get).toHaveBeenCalledWith(NOTE_FIXTURE.id)
    expect(notes.backlinks).toHaveBeenCalledWith(NOTE_FIXTURE.id)
    expect((w.find('.kn-title-input').element as HTMLInputElement).value).toBe(NOTE_FIXTURE.title)
    expect((w.find('.kn-desc-input').element as HTMLInputElement).value).toBe(NOTE_FIXTURE.description)
    // status==='draft' → top bar badge + draft banner both render
    // RED T8 reinforcement(brief §3 / DoD-11, forced change, "reinforce not weaken" evidence in task report):
    // T8 inserts second `.kn-badge[data-s="draft"]` with same structure/text in aside(status card,
    // blueprint :82). Bare `.kn-badge[data-s="draft"]` degrades from "unique match" to "match two,
    // .find() happens to get doc order first i.e. top bar" — test still passes but discrimination power degrades.
    // Pin `.kn-edit-top` ancestor, restore "assert to specific element" not "assert to doc order first".
    expect(w.find('.kn-edit-top .kn-badge[data-s="draft"]').exists()).toBe(true)
    expect(w.find('.kn-draftbar').exists()).toBe(true)
  })

  it('isNew=true: don\'t send get()/backlinks(), status is null (no badge, no draft banner)', async () => {
    const { w } = await mountPane('new')
    expect(notes.get).not.toHaveBeenCalled()
    expect(notes.backlinks).not.toHaveBeenCalled()
    expect(w.find('.kn-badge').exists()).toBe(false)
    expect(w.find('.kn-draftbar').exists()).toBe(false)
    expect((w.find('.kn-title-input').element as HTMLInputElement).value).toBe('')
  })

  it('when status==="archived" top bar shows only "archived" badge, no draft banner', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, status: 'archived' })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    // 🔴 T8 hardening, same rationale as the previous case: pin the `.kn-edit-top` ancestor, no longer rely on document order.
    expect(w.find('.kn-edit-top .kn-badge[data-s="archived"]').text()).toBe('已归档')
    expect(w.find('.kn-draftbar').exists()).toBe(false)
  })

  it('get() fails: K5 fixed text toast, don\'t echo back end message', async () => {
    notes.get.mockRejectedValue(new Error('agent offline: super-secret-stack-trace'))
    await mountPane(NOTE_FIXTURE.id)
    const texts = useToast().toasts.map((x) => x.text)
    expect(texts).toContain('操作失败')
    expect(texts.join(' | ')).not.toContain('super-secret-stack-trace')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// RED §5.2 stale guard(K15 family 9th) — two instance interleaving.
// RED probe in task report(move `let loadEpoch` into separate `<script lang="ts">` block,
// remove setup, share across instances — this case must fail red).
describe('NoteEditPane — stale guard (§5.2): two instance interleaving', () => {
  it('RED two instances\' loadEpoch don\'t interfere(guard variable must be component-local, not module-level)', async () => {
    const d1 = makeDeferred<Note>()
    const d2 = makeDeferred<Note>()
    notes.get.mockReturnValueOnce(d1.promise) // instance 1's first call (also its only call)
    const { w: w1 } = await mountPane('note-a')
    notes.get.mockReturnValueOnce(d2.promise) // instance 2's first call (also its only call)
    const { w: w2 } = await mountPane('note-b')

    // instance 1's response arrives last: if guard variable is module-level,
    // instance2 mount time `++loadEpoch` already advanced shared counter,
    // instance1 check `epoch !== loadEpoch` wrongly judges itself "stale" and discards
    // its only response that belongs to it.
    d1.resolve({ ...NOTE_FIXTURE, id: 'note-a', title: 'Title A', revision: 1 })
    await flush()
    d2.resolve({ ...NOTE_FIXTURE, id: 'note-b', title: 'Title B', revision: 2 })
    await flush()

    expect((w1.find('.kn-title-input').element as HTMLInputElement).value).toBe('Title A')
    expect((w2.find('.kn-title-input').element as HTMLInputElement).value).toBe('Title B')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// RED N29: `tbTick.value >= 0 &&` in `tbActive()` is intentional fake dependency, must not delete.
// Criterion: trigger transaction directly on **real Editor instance**(bypass `cmd()`, so don't change
// `dirty`—if use `cmd()`, `dirty` change itself forces whole component re-render, can't show
// tbTick this fake dependency single discrimination power, see file header R5 explanation).
// RED ruling R5: appendix D §D.6.1 probe not mounted on parent component, this chain path T0 not empirically proven,
// this pass must provide mutation evidence itself(report §mutation evidence: deleting `tbTick.value >= 0 &&` makes this case fail red).
describe('NoteEditPane — N29(tbActive fake dependency, toolbar data-on refreshes with transaction)', () => {
  it('after triggering transaction directly on real Editor bypassing cmd(), .kn-tb-btn[data-on] refreshes; dirty unchanged throughout', async () => {
    const { w } = await mountPane('new')
    const boldBtn = w.find('.kn-editor-toolbar .kn-tb-btn[title="加粗"]')
    expect(boldBtn.attributes('data-on')).toBe('false')

    // RED wrapper.vm directly read <script setup> top-level ref(see file header explanation)—bypass
    // cmd(), don't change dirty, only let real Editor generate one transaction.
    const ed = (w.vm as unknown as { editor?: Editor }).editor
    expect(ed).toBeTruthy()
    ed!.chain().focus().toggleBold().run()
    await nextTick()
    await flushPromises()

    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false)
    expect(boldBtn.attributes('data-on')).toBe('true')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// N27: four-level nested ternary copy as-is(blueprint `:17`), all four levels need test cases.
describe('NoteEditPane — N27(save hint four-level nested ternary copy as-is)', () => {
  it('saving=true → "Saving…"(highest priority, ignore dirty/isNew)', async () => {
    const d = makeDeferred<Note>()
    notes.create.mockReturnValue(d.promise)
    const { w } = await mountPane('new')
    await w.find('.kn-title-input').setValue('draft title')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await nextTick() // no flushPromises: catch intermediate state where saving=true but request not yet back
    expect(w.find('.kn-savehint').text()).toContain('保存中…')
    d.resolve({ ...NOTE_FIXTURE, id: 'x' })
    await flush()
  })

  it('saving=false, dirty=true → "Unsaved changes"', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await w.find('.kn-title-input').setValue(NOTE_FIXTURE.title + ' edited')
    expect(w.find('.kn-savehint').text()).toContain('有未保存更改')
  })

  it('saving=false, dirty=false, isNew=true → "Not saved yet"', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-savehint').text()).toContain('尚未保存')
  })

  it('saving=false, dirty=false, isNew=false → "Saved · rev {n}"', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    expect(w.find('.kn-savehint').text()).toContain(`已保存 · rev ${NOTE_FIXTURE.revision}`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// N26: copy the three-segment splice as-is (middle segment bold), don't compose an HTML-bearing key.
describe('NoteEditPane — N26(draft banner three-segment splice)', () => {
  it('three segments render independently, middle segment is <b> bold', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // NOTE_FIXTURE.status === 'draft'
    const txt = w.find('.kn-draftbar-txt')
    const b = txt.find('b')
    expect(b.exists()).toBe(true)
    expect(b.text()).toBe('AI 自动沉淀的草稿')
    // The three segments concatenate into a complete sentence (no leaked HTML tags, proving it's not composed via v-html)
    expect(txt.text()).toContain('这是一条')
    expect(txt.text()).toContain(',还不是正式知识')
    expect(txt.html()).not.toContain('&lt;b&gt;') // not outputting <b> as a literal text string
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// N28: copy the wordCount regex /[#|\-*`>\s]/g as-is, don't "fix" it into markdown-aware counting.
// The expected values for the three boundary cases were computed offline in node (see the task report), not derived backward from the implementation.
describe('NoteEditPane — N28 (wordCount regex boundaries, controlling form.body directly in md mode)', () => {
  async function setMdBody(w: Awaited<ReturnType<typeof mountPane>>['w'], body: string) {
    // Switch to md mode: the textarea binds directly to form.body via v-model, more precise and
    // controllable than relying on tiptap's markdown serialization in rich mode (boundary strings must match byte-for-byte).
    await w.find('.kn-editor-toolbar .k-seg button:nth-child(2)').trigger('click') // "Markdown" button
    await w.find('.kn-editor-src').setValue(body)
    await nextTick()
  }

  it('empty body → 0 characters', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-editor-status span').text()).toBe('0 字')
  })

  it('all stripped characters (# | - * ` > whitespace) → 0 characters', async () => {
    const { w } = await mountPane('new')
    await setMdBody(w, '# ** -- ``` >>> \n\t  |||')
    expect(w.find('.kn-editor-status span').text()).toBe('0 字')
  })

  it('mixed characters → 24 characters (computed offline in node: after stripping Hello#World!`code`>quote a-b*c|d, 24 characters remain)', async () => {
    const { w } = await mountPane('new')
    await setMdBody(w, 'Hello #World! `code` >quote a-b*c|d')
    expect(w.find('.kn-editor-status span').text()).toBe('24 字')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Attribute-state String() copied as-is (P5b E-9), data-on/data-dirty both sides compare against 'true'/'false'.
// Appendix D §D.3 M-3: .kn-tb-btn is ×8, not ×7 — the count assertion pins it at 8.
describe('NoteEditPane — attribute-state String() copied as-is + M-3 (kn-tb-btn ×8)', () => {
  it('kn-tb-btn is exactly 8 (blueprint :43/44/45/47/48/50/51/52)', async () => {
    const { w } = await mountPane('new')
    expect(w.findAll('.kn-editor-toolbar .kn-tb-btn')).toHaveLength(8)
  })

  it('data-dirty starts "false", becomes "true" after input (both sides compare strings, toBeUndefined forbidden)', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-savehint').attributes('data-dirty')).toBe('false')
    await w.find('.kn-title-input').setValue('x')
    expect(w.find('.kn-savehint').attributes('data-dirty')).toBe('true')
  })

  it('k-seg dual-mode button data-on is the string "true"/"false" on both sides', async () => {
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
// Save button disabled — three combinations (§9.9).
describe('NoteEditPane — save button disabled (saving || (isNew && !title.trim()))', () => {
  it('isNew=true, title empty/all-whitespace → disabled', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeDefined()
    await w.find('.kn-title-input').setValue('   ')
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeDefined()
  })

  it('isNew=true, title non-empty → not disabled', async () => {
    const { w } = await mountPane('new')
    await w.find('.kn-title-input').setValue('a title')
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeUndefined()
  })

  it('isNew=false → not disabled even if title is cleared (isNew threshold doesn\'t apply)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    await w.find('.kn-title-input').setValue('')
    expect(w.find('.kn-edit-top .k-btn.primary').attributes('disabled')).toBeUndefined()
  })

  it('saving=true → disabled (even if title is non-empty / isNew=false)', async () => {
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

// ═════════════════════════════════════════════════════════════════════════════
// save() two paths + addTag() called at start(unprompted tags in input also saved).
describe('NoteEditPane — save(): isNew two paths + addTag() pre-call', () => {
  it('isNew=true → create() + router with ?id=, addTag() brings unprompted tags along', async () => {
    const { w, router } = await mountPane('new')
    await w.find('.kn-title-input').setValue('brand new note')
    // RED wrapper.vm directly read tagInput(file header technique explanation)—tag input UI
    // belongs to T8, this pass only needs to prove save() start call to addTag() truly
    // parses "unprompted text in input" into form.tags and brings it to create() payload.
    ;(w.vm as unknown as { tagInput: string }).tagInput = 'foo, bar'
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()
    expect(notes.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'brand new note', tags: ['foo', 'bar'] }),
    )
    expect(router.currentRoute.value.fullPath).toContain('?id=new-note-id')
  })

  it('isNew=false → update({expectedRevision, ...}), toast "Saved" after success', async () => {
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

// ═════════════════════════════════════════════════════════════════════════════
// save() catch branch: 409+!isNew → openConflict()(this pass only to conflict state
// being set, modal render goes to T8); otherwise(including 409+isNew) → K5 fixed text,
// exclusion assertion no back end text.
describe('NoteEditPane — save() catch branch(K5 + conflict state)', () => {
  it('RED 409 + !isNew → conflictMessage true, conflict state set(latest/baseRevision), don\'t show "operation failed"', async () => {
    notes.update.mockRejectedValue({ response: { status: 409, data: { current_revision: 999 } } })
    notes.get.mockImplementation((id: string) => Promise.resolve({ ...NOTE_FIXTURE, id, revision: 999 }))
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    notes.get.mockClear()
    await w.find('.kn-title-input').setValue(NOTE_FIXTURE.title + ' conflict-edit')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()

    // openConflict() internally sends another get() to fetch latest version.
    expect(notes.get).toHaveBeenCalledWith(NOTE_FIXTURE.id)
    // RED wrapper.vm directly read conflict ref(file header technique)—conflict modal render goes to T8,
    // this pass only verifies "state being set" observable result.
    const conflict = (w.vm as unknown as { conflict: { latest: Note; baseRevision: number } | null }).conflict
    expect(conflict).not.toBeNull()
    expect(conflict!.latest.revision).toBe(999)
    // baseRevision = note.value.revision(in this pass mock get() returns revision:999 for any id,
    // i.e. mount time first get() already set note.value.revision to 999, not NOTE_FIXTURE original value)
    expect(conflict!.baseRevision).toBe(999)
    expect(useToast().toasts.map((x) => x.text)).not.toContain('操作失败')
  })

  it('409 but isNew=true → skip the conflict branch, use K5 fixed copy', async () => {
    notes.create.mockRejectedValue({ response: { status: 409, data: { current_revision: 1 } } })
    const { w } = await mountPane('new')
    await w.find('.kn-title-input').setValue('brand new')
    await w.find('.kn-edit-top .k-btn.primary').trigger('click')
    await flush()
    expect(useToast().toasts.map((x) => x.text)).toContain('操作失败')
    const conflict = (w.vm as unknown as { conflict: unknown }).conflict
    expect(conflict).toBeNull()
  })

  it('non-409 error → K5 fixed copy, exclusion assertion: no backend message', async () => {
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
describe('NoteEditPane — curateInPlace() (draft banner "confirm as formal note")', () => {
  it('success: toast "note confirmed", also triggers refreshNotesDraftCount (→ service.notes.list is called)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // status: draft
    await flush()
    await w.find('.kn-draftbar .k-btn.primary').trigger('click')
    await flush()
    expect(notes.curate).toHaveBeenCalledWith(NOTE_FIXTURE.id)
    expect(useToast().toasts.map((x) => x.text)).toContain('笔记已确认')
    expect(notes.list).toHaveBeenCalled()
  })

  it('failure: K5 fixed copy, does not echo back the backend message', async () => {
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
// Locator strategy self-check (brief §4): the case below just confirms that every locator this file
// uses is scoped to T7's own containers (`.kn-edit-top`/`.kn-editor-toolbar`/`.kn-draftbar` etc.),
// so that after T8 inserts `.kn-edit-aside` (the aside, with its own `.k-btn`) and the conflict modal
// (with its own `.k-btn.primary`/`.k-modal-title` etc.), these scoped selectors won't get a false
// match — this case should keep passing once T8's content is inserted, with no changes needed.
describe('NoteEditPane — locator boundary self-check (preparing for T8\'s insertion)', () => {
  it('top-bar save button locator .kn-edit-top .k-btn.primary matches exactly 1 after mount', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    expect(w.findAll('.kn-edit-top .k-btn.primary')).toHaveLength(1)
  })

  it('draft banner confirm button locator .kn-draftbar .k-btn.primary matches exactly 1 after mount', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // status: draft
    expect(w.findAll('.kn-draftbar .k-btn.primary')).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════ everything below is new in T8 (5 aside cards + tag editing + conflict modal) ═══
// ═══════════════════════════════════════════════════════════════════════════

// 🔴 DoD-11 hardening evidence: prove that the "latent fragility T7 flagged" is real — the bare
// `.kn-badge[data-s="draft"/"archived"]` really does match 2 after the aside status card is inserted,
// not just a theoretical claim. See the hardening comments on the two T7 assertions above (pinning the
// `.kn-edit-top` ancestor).
describe('NoteEditPane — locator hardening (DoD-11, proving the pre-hardening risk was real)', () => {
  it('draft: bare selector matches 2 (top bar + aside status card); hardened .kn-edit-top/.kn-edit-aside locators each match exactly 1', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // status: draft
    expect(w.findAll('.kn-badge[data-s="draft"]')).toHaveLength(2)
    expect(w.findAll('.kn-edit-top .kn-badge[data-s="draft"]')).toHaveLength(1)
    expect(w.findAll('.kn-edit-aside .kn-badge[data-s="draft"]')).toHaveLength(1)
  })

  it('archived: same story, bare selector matches 2, hardened .kn-edit-top locator matches exactly 1', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, status: 'archived' })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    expect(w.findAll('.kn-badge[data-s="archived"]')).toHaveLength(2)
    expect(w.findAll('.kn-edit-top .kn-badge[data-s="archived"]')).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Aside card 1: status (§9.9 both isNew sides + three-state badge + Source/Last modified).
describe('NoteEditPane — aside status card', () => {
  it('isNew=true → shows the "becomes a confirmed formal note once saved" hint, no three-state badge', async () => {
    const { w } = await mountPane('new')
    const card = w.findAll('.kn-aside-card')[0]
    expect(card.text()).toContain('保存后成为「已确认」的正式笔记')
    expect(card.find('.kn-badge').exists()).toBe(false)
  })

  it('isNew=false, status=draft → the aside also shows the "AI draft" badge + Source (sourceMeta) + Last modified (non-empty)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // status: draft, createdBy: pipeline
    const card = w.findAll('.kn-aside-card')[0]
    expect(card.find('.kn-badge[data-s="draft"]').exists()).toBe(true)
    const kvs = card.findAll('.kn-kv')
    // sourceMeta('pipeline') = { labelKey: 'aiKbNoteSrcPipeline' → 'AI 沉淀', icon: 'sparkle' }
    expect(kvs[1].find('b').text()).toBe('AI 沉淀')
    expect(kvs[2].find('b').text().length).toBeGreaterThan(0) // relativeTime boundary is covered separately by notesViewHelpers.test.ts (§9.8)
  })

  it('status="curated" (neither draft nor archived) → aside badge data-s="curated", copy "confirmed"', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, status: 'curated' })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const card = w.findAll('.kn-aside-card')[0]
    expect(card.find('.kn-badge[data-s="curated"]').text()).toContain('已确认')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Aside card 2: disk file (§9.9 both isNew sides + revealFile/copyPath).
describe('NoteEditPane — aside disk file card', () => {
  it('isNew=true → shows the "an .md file will be created in the notes directory once saved" hint, no path/no buttons', async () => {
    const { w } = await mountPane('new')
    const card = w.findAll('.kn-aside-card')[1]
    expect(card.text()).toContain('保存后在笔记目录创建 .md 文件')
    expect(card.find('.kn-filepath').exists()).toBe(false)
    expect(card.find('.kn-file-acts').exists()).toBe(false)
  })

  it('isNew=false → path + "syncs back within 60 seconds" hint + "File manager"/"Copy path" buttons', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const card = w.findAll('.kn-aside-card')[1]
    expect(card.find('.kn-filepath').text()).toBe(NOTE_FIXTURE.path)
    expect(card.text()).toContain('60 秒内同步回来')
    expect(card.find('.kn-file-acts').exists()).toBe(true)
  })

  it('clicking "File manager" calls openFileInNewTab(note.path)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.findAll('.kn-file-acts .k-btn')[0]
    await btn.trigger('click')
    expect(openInAppMock.openFileInNewTab).toHaveBeenCalledWith(NOTE_FIXTURE.path)
  })

  it('copyPath succeeds (navigator.clipboard exists) → toast "Path copied"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.findAll('.kn-file-acts .k-btn')[1]
    await btn.trigger('click')
    await flush()
    expect(writeText).toHaveBeenCalledWith(NOTE_FIXTURE.path)
    expect(useToast().toasts.map((x) => x.text)).toContain('路径已复制')
  })

  // 🔴 Governance §9.9 / memory newui-clipboard-insecure-reka: over real-device HTTP-IP access,
  // navigator.clipboard doesn't exist (jsdom also doesn't have it by default, so no explicit clearing
  // is needed to reproduce this); this is blueprint behavior (blueprint `:259-264` is also a bare
  // try/catch), copied as-is per the N series, with no execCommand fallback added (that's an existing
  // enhancement scoped to the Files area). See the frontend ticket in the file header "═══ T8 ═══".
  it('🔴 copyPath: navigator.clipboard doesn\'t exist under HTTP-IP → falls into catch, toasts "Operation failed" (expected, not a defect)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.findAll('.kn-file-acts .k-btn')[1]
    await btn.trigger('click')
    await flush()
    expect(useToast().toasts.map((x) => x.text)).toContain('操作失败')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Aside card 3: attributes (type dropdown + tag editing: chip/delete/onTagKey three branches + counter-example /
// focusTagInput/addTag dedup DoD-4).
describe('NoteEditPane — aside attributes card: type dropdown', () => {
  it('switching the type dropdown triggers dirty = true, form.type changes accordingly', async () => {
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

describe('NoteEditPane — aside attributes card: tag editing', () => {
  it('each tag in form.tags renders as one .kn-tagchip', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // tags: ['nimoos','todo-list','widget']
    const chips = w.findAll('.kn-tagchip')
    expect(chips.map((c) => c.text().replace('移除', '').trim())).toEqual(NOTE_FIXTURE.tags)
  })

  it('removeTag: clicking a chip\'s remove button deletes that tag + dirty = true', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    await w.findAll('.kn-tagchip button')[0].trigger('click')
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(['todo-list', 'widget'])
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(true)
  })

  it('focusTagInput: clicking the .kn-tagedit container focuses the tag input (blueprint :237 $refs.tagInput.focus())', async () => {
    const { w } = await mountPane('new')
    const input = w.find('.kn-tagedit input').element as HTMLInputElement
    expect(document.activeElement).not.toBe(input)
    await w.find('.kn-tagedit').trigger('click')
    expect(document.activeElement).toBe(input)
  })

  // onTagKey's three branches + one counter-example (DoD-3).
  it('Enter → preventDefault + addTag()', async () => {
    const { w } = await mountPane('new')
    const input = w.find('.kn-tagedit input')
    await input.setValue('foo')
    await input.trigger('keydown', { key: 'Enter' })
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(['foo'])
    expect((w.find('.kn-tagedit input').element as HTMLInputElement).value).toBe('')
  })

  it('comma "," → preventDefault + addTag()', async () => {
    const { w } = await mountPane('new')
    const input = w.find('.kn-tagedit input')
    await input.setValue('bar')
    await input.trigger('keydown', { key: ',' })
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(['bar'])
  })

  it('Backspace with an empty input and existing tags → pops the last one + dirty = true', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // tags: ['nimoos','todo-list','widget']
    await flush()
    const input = w.find('.kn-tagedit input')
    await input.trigger('keydown', { key: 'Backspace' })
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(['nimoos', 'todo-list'])
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(true)
  })

  it('🔴 counter-example: Backspace with a non-empty input → doesn\'t pop a tag (neither branch holds)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    const input = w.find('.kn-tagedit input')
    await input.setValue('typing')
    await input.trigger('keydown', { key: 'Backspace' })
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(NOTE_FIXTURE.tags)
  })

  // DoD-4: addTag() dedup, not covered by T7, filled in by this pass (verified: T7 only tested the
  // "new tag not yet committed from the input" path, never the "typing an already-existing tag" path,
  // see the §2 verification note).
  it('🔴 addTag() dedup: typing an already-existing tag → dirty unchanged, tags unchanged (only asserts the dedup logic, doesn\'t reimplement it)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // tags: ['nimoos','todo-list','widget']
    await flush()
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false)
    const input = w.find('.kn-tagedit input')
    await input.setValue('nimoos') // an already-existing tag
    await input.trigger('blur')
    expect((w.vm as unknown as { form: { tags: string[] } }).form.tags).toEqual(NOTE_FIXTURE.tags)
    expect((w.vm as unknown as { dirty: boolean }).dirty).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Aside card 4: source (§9.9 both sides + openRef/openSessionRef + refLabel's three tiers DoD-9).
describe('NoteEditPane — aside source card', () => {
  it('!isNew && sourceRefs.length → renders (fixture-verified: pipeline notes\' source_refs is always non-empty, README §4)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // sourceRefs: [{ session_id: '...' }]
    expect(w.find('.kn-aside-card .kn-refbtn').exists()).toBe(true)
  })

  it('sourceRefs is an empty array → doesn\'t render (the inverse of that condition, fixture: one of the notes-backlinks-sourced scenarios in README §4)', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, sourceRefs: [] })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    expect(w.find('.kn-refbtn').exists()).toBe(false)
  })

  it('isNew=true → doesn\'t render (even if sourceRefs is force-supplied, the isNew threshold takes priority)', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-aside-card .kn-refbtn').exists()).toBe(false)
  })

  it('r.session_id branch: clicking calls openSessionRef(r.session_id) → openAgentSessionInNewTab, label takes the first 8 chars of session_id (refLabel tier ②)', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.find('.kn-refbtn')
    expect(btn.text()).toContain('6fe14460') // first 8 chars of session_id, refLabel's fallback when there's no label
    await btn.trigger('click')
    expect(openInAppMock.openAgentSessionInNewTab).toHaveBeenCalledWith('6fe14460-9892-4d7e-b104-db1098c749af')
  })

  // 🔴 mock shape note: the on-device fixture (README §4) records that pipeline notes' source_refs is
  // always the `[{session_id}]` shape, with no real captured sample of the `path` shape — the case
  // below constructs a minimal example per K41's `SourceRef` interface definition (`path?: string`,
  // per blueprint `:128`), with field names/shape taken from the interface definition and the
  // blueprint's read line, not a hand-crafted envelope (the envelope layer is still the normalized
  // `Note.sourceRefs` array — it's just that this device has no real sample for this branch's array
  // element content).
  it('r.path branch (no real sample on this device, constructed per the K41 interface): clicking calls openRef(r.path) → openFileInNewTab', async () => {
    notes.get.mockResolvedValue({ ...NOTE_FIXTURE, sourceRefs: [{ path: '/DATA/Notes/1/other.md' }] })
    const { w } = await mountPane(NOTE_FIXTURE.id)
    const btn = w.find('.kn-refbtn')
    expect(btn.text()).toContain('/DATA/Notes/1/other.md')
    await btn.trigger('click')
    expect(openInAppMock.openFileInNewTab).toHaveBeenCalledWith('/DATA/Notes/1/other.md')
  })

  // refLabel(r)'s three tiers (DoD-9), called directly via wrapper.vm (an established technique per
  // FolderBrowser.test.ts:390 / IndexedFilesView.test.ts:1670/1960: a top-level <script setup> function
  // can be called directly through wrapper.vm in the test environment — not a new feature, not bypassing
  // public behavior) — tier ③ (neither label nor session_id) has no button in the template that renders
  // that ref (neither `v-if="r.path"` nor `v-else-if="r.session_id"` holds), so the UI can't reach it.
  it('refLabel\'s three tiers: ① has label, use it directly; ② no label but has session_id, take the first 8 chars; ③ neither → empty string', async () => {
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
// Aside card 5: backlinks (§9.9 both sides).
describe('NoteEditPane — aside backlinks card', () => {
  it('backlinks is empty (fixture-verified: always [] on this device, README §4) → doesn\'t render', async () => {
    const { w } = await mountPane(NOTE_FIXTURE.id) // notes.backlinks defaults to a [] mock
    expect(findAsideCardByTitle(w, '被引用')).toBeUndefined()
  })

  // 🔴 mock shape note: README §4 records that this device's backlinks endpoint always returns `[]`, with
  // no real captured non-empty sample — the case below constructs a minimal example per K41's
  // `Backlink` interface (`{id: string; title: string}`, per blueprint `:139`/`:141`), with field names
  // taken from the interface definition; the envelope layer is still the array already normalized by
  // `service.notes.backlinks()` (not `{backlinks:[]}`).
  it('backlinks non-empty (no real sample on this device, constructed per the K41 interface) → renders, clicking pushes to ?id=b.id', async () => {
    notes.backlinks.mockResolvedValue([{ id: 'other-note-id', title: 'Referencing Note' }])
    const { w, router } = await mountPane(NOTE_FIXTURE.id)
    await flush()
    const btn = w.findAll('.kn-refbtn').find((b) => b.text().includes('Referencing Note'))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')
    await flush()
    expect(router.currentRoute.value.fullPath).toContain('?id=other-note-id')
  })

  it('isNew=true → doesn\'t render', async () => {
    const { w } = await mountPane('new')
    expect(w.find('.kn-aside-card .kn-refbtn').exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Conflict modal (DoD-5/6/7): reka conversion + K36 a11y + three actions' dirty assertions + clipboard.
describe('NoteEditPane — conflict modal (reka-ified + three actions)', () => {
  // K7: the modal's portal target — when mounted standalone it's not inside the .knowledge-app subtree
  // (in production that's provided by KnowledgeLayout.vue), precedent: QueueView.test.ts::withHost() /
  // NotesView.test.ts::withHost().
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

  it('once conflict state is set, the modal portals to .knowledge-app, title/diff panels render correctly', async () => {
    const { host } = await openConflictModal()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    expect(modal!.querySelector('.k-modal-title')!.textContent).toBe('有人先保存了这条笔记')
    // theirs panel: latest.revision (openConflict()'s internal get() defaults to returning the same revision as NOTE_FIXTURE)
    expect(modal!.querySelector('[data-side="theirs"]')!.textContent).toContain(`rev ${NOTE_FIXTURE.revision}`)
    // mine panel: shows form.body (the uncommitted title edit "conflict-edit" isn't here — blueprint
    // `:169` is `{{ form.body }}`, not `form.title`); baseRevision is likewise NOTE_FIXTURE.revision
    // (loadNote()'s first call already set note.value.revision to it).
    expect(modal!.querySelector('[data-side="mine"]')!.textContent).toContain(`基于 rev ${NOTE_FIXTURE.revision}`)
    expect(modal!.querySelector('[data-side="mine"] .kn-diff-body')!.textContent).toContain('Dockerfile')
  })

  it('clicking × doesn\'t close it (counter-example: only clicking the overlay closes it); clicking the overlay closes the modal (conflict = null)', async () => {
    const { host } = await openConflictModal()
    expect(host.querySelector('.k-modal')).not.toBeNull()
    // reka's usePointerDownOutside defers attaching the document listener with setTimeout(0) (precedent
    // in the matching comment in QueueView.test.ts/NotesView.test.ts), so add one extra macrotask tick.
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

  it('🔴 K36 a11y — aria-labelledby matches .k-modal-title\'s id on the same element, exactly one id-bearing element in the modal', async () => {
    const { host } = await openConflictModal()
    const modal = host.querySelector('.k-modal')!
    expect(modal.getAttribute('role')).toBe('dialog')
    const labelId = modal.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const titleEl = modal.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.id).toBe(labelId)
    expect(titleEl.textContent).toBe('有人先保存了这条笔记')
    // as-child doesn't insert an extra VisuallyHidden node — the modal should have exactly 1 id-bearing element.
    expect(modal.querySelectorAll('[id]')).toHaveLength(1)
  })

  it('adoptDisk: note=latest + form.body=latest.body + conflict cleared + dirty=true + toast', async () => {
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
    expect(vm.form.body).toBe(NOTE_FIXTURE.body) // latest.body (get() defaults to returning the same body as NOTE_FIXTURE)
    expect(useToast().toasts.map((x) => x.text)).toContain('已加载最新版本,你的正文已被替换')
  })

  it('keepMine: only rebases revision (note.revision becomes latest.revision), body untouched, conflict cleared, dirty=true, toast includes {n}', async () => {
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
    expect(vm.form.body).toBe(bodyBefore) // body untouched
    expect(vm.note.revision).toBe(NOTE_FIXTURE.revision) // rebases to latest.revision
    expect(useToast().toasts.map((x) => x.text)).toContain(`保留了你的编辑,保存将覆盖 rev ${NOTE_FIXTURE.revision}`)
  })

  it('copyMine succeeds (navigator.clipboard exists) → writeText(form.body), toast "Your text has been copied", modal stays open', async () => {
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
    expect(host.querySelector('.k-modal')).not.toBeNull() // copyMine doesn't touch conflict
  })

  // 🔴 Governance §9.9 / memory newui-clipboard-insecure-reka (see file header "═══ T8 ═══").
  it('🔴 copyMine: navigator.clipboard doesn\'t exist under HTTP-IP → falls into catch, toasts "Operation failed" (expected, not a defect)', async () => {
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
