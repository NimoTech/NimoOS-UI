// SP8-P5d Task 6 — `NotesView.vue` Notes View test.
// Blueprint from the Vue 2 panel(main@7a6ee6b7)`src/views/AI/Knowledge/NotesView.vue`
// (271 lines).
//
// ═══ mock strategy (governance §4.1 requires explicit documentation) ═══
// 🔴 `service.notes.list(p?)` mocked to **normalized `Note[]`** (camelCase), not
//   `{notes:[]}` envelope — `the shared service package's src/notes.ts:211-215` already maps it
//   inside the package. `getSettings()` mocked to camelCase with only
//   `{notesRoot, autoExtract}` two fields (`notes.ts:252-255`). `remove(id)`
//   mocked to `{status:'deleted', id}` (governance §4.1's "do not strip return
//   value" is wrong; refer to `p5d-fixtures/README.md` §3.1 empirical results
//   — this page also does not read this return value, blueprint `:261` only
//   `await`).
// 🔴 mock data sourced from true entries in
// a captured device response
//   (id/title/description/type/createdBy/revision/updatedAt/path/tags/sourceRefs
//   each field copied verbatim from the fixture, converted to camelCase). Real
//   device has 23 notes **all with status draft, type insight, source pipeline**
//   (README §4) — curated/archived states, note/summary types, human/agent
//   sources cannot be tested on real device; the two curated/archived cases
//   below **manually changed status/type/createdBy** of true fixture entries to
//   cover §9.9 checklist (other fields remain fixture original), noted at each
//   declaration point.
//
// ═══ attribute state assertion scope (governance §9 / appendix D §D.3.1) ═══
// `data-on` / `data-s` / `data-open` are all regular `data-*` attributes, all
// use `toBe('true')`/`toBe('false')`, compare both sides, forbid
// `toBeUndefined()`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import { useToast } from '../../../stores/toast'
import type { Note } from '@nimotech/nimoos-service'
import NotesView from './NotesView.vue'
// Fix round 1 (code review Important): auto-load guard must read `NotesView.vue`
// source code itself and detect whether `NoteEditPane.vue` exists — iron rule
// for this file: "when reading files in tests, always use node:fs, not Vite's
// ?raw" (vitest's CSSEnablerPlugin replaces style source with empty string,
// assertion false-passes; precedent in knowledgeStyles.test.ts header comment
// ③). Type declarations for node: prefix modules are provided by `@types/node`,
// already installed in this repo (SP8-P6 merged from master), vue-tsc passes
// directly, **no need for** @ts-expect-error suppression (the suppression line
// that existed on sp8-ai branch was deleted during merge; see
// knowledgeStyles.test.ts / QueueView.test.ts header comments ①②).
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NOTES_VIEW_SRC_PATH = resolve(__dirname, './NotesView.vue')
const NOTE_EDIT_PANE_PATH = resolve(__dirname, '../components/NoteEditPane.vue')

// ── vi.hoisted mock skeleton (governance §9: avoid ESM hoisting TDZ) ──
const notes = vi.hoisted(() => ({
  list: vi.fn(),
  getSettings: vi.fn(),
  curate: vi.fn(),
  archive: vi.fn(),
  remove: vi.fn(),
  // T7 addition: after NoteEditPane.vue lands, it is a real component (no
  // longer T6's zero-logic placeholder). When `?id=` is non-empty, it will
  // truly mount and call `service.notes.get`/`backlinks` — if these two
  // methods are not mocked, routing test cases in this file (N30/deep link)
  // will crash with `notes.get is not a function` outside real device.
  // NoteEditPane's own behavior (form/editor/save) is covered independently
  // by NoteEditPane.test.ts; this file only needs it to mount silently.
  get: vi.fn(),
  backlinks: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { notes } }))

// openInApp is existing output from T5 (unchanged throughout period checklist);
// here we only spy on whether `openDirInNewTab` is called with correct
// arguments, not re-implement its logic (that is T5's responsibility and
// existing test scope).
const openDirInNewTab = vi.fn()
vi.mock('../../services/openInApp', () => ({ openDirInNewTab: (...args: unknown[]) => openDirInNewTab(...args) }))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5d-fixtures/notes-list-200.json (excerpt 3 entries,
// converted to camelCase)
// Each field taken from real entries in that file (fetched 2026-08-04 18:05).
// Real device: all 23 entries are draft/insight/pipeline — NOTE_CURATED /
// NOTE_ARCHIVED two entries' status/type/createdBy were manually changed to
// cover §9.9 checklist (noted respectively below), other fields
// (id/title/description/revision/updatedAt/path/tags/sourceRefs) remain
// fixture original.
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
// 🔴 status/type/createdBy manually changed to curated/note/human to cover
// branches untestable on real device (fixture original entry is
// draft/insight/pipeline), other fields remain that entry's original values.
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
// 🔴 Same as above, manually changed to archived/summary/agent.
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

// FIXTURE-COPY-BEGIN  p5d-fixtures/notes-settings.json (converted to camelCase,
// normalized in package)
// Original `{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],
// "distill_daily_cap":50,"background_model":""}` — `normalizeSettings` keeps
// only `notesRoot`/`autoExtract` two fields, latter three discarded by package
// (governance §4.1).
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

// K7: dialog portal target — when NotesView is mounted independently, it is
// not in the .knowledge-app subtree (in production provided by
// KnowledgeLayout.vue); test must first place a same-named host in body
// (precedent QueueView.test.ts::withHost()).
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

function makeRouter(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createWebHashHistory('/'),
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
  // T7 addition (see comment at notes declaration above): two requests when
  // NoteEditPane mounts, silently succeed by default, no toast — this file does
  // not test NoteEditPane's own behavior.
  notes.get.mockImplementation((id: string) => Promise.resolve({ ...NOTE_DRAFT, id }))
  notes.backlinks.mockResolvedValue([])
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
describe('NotesView — pathstrip + notesRoot detection (blueprint :8-16 / :212-216)', () => {
  it('when notesRoot has not returned, use placeholder "/DATA/Notes"; after return show true value', async () => {
    const d = makeDeferred<{ notesRoot: string; autoExtract: boolean }>()
    notes.getSettings.mockReturnValue(d.promise)
    const { w } = await mountNotesView()
    expect(w.find('.kn-pathstrip code').text()).toBe('/DATA/Notes/')
    d.resolve({ notesRoot: '/DATA/CustomNotes', autoExtract: true })
    await flush()
    expect(w.find('.kn-pathstrip code').text()).toBe('/DATA/CustomNotes/')
  })

  it('K6 — getSettings failure silently falls back: placeholder retained, no toast, no console.error (blueprint :215 empty catch)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    notes.getSettings.mockRejectedValue(new Error('agent offline'))
    const { w } = await mountNotesView()
    expect(w.find('.kn-pathstrip code').text()).toBe('/DATA/Notes/')
    expect(useToast().toasts).toEqual([])
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('clicking "open in file manager" calls openDirInNewTab(notesRoot)', async () => {
    notes.getSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: true })
    const { w } = await mountNotesView()
    await w.find('.kn-pathstrip a').trigger('click')
    expect(openDirInNewTab).toHaveBeenCalledWith('/DATA/Notes')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — skeleton screen (N24 arithmetic inline styles copied, blueprint :19-28)', () => {
  it('while list() is pending, render 4 skeleton rows with widths (52-i*8)% / (72-i*6)%, cursor:default', async () => {
    const d = makeDeferred<Note[]>()
    notes.list.mockReturnValue(d.promise)
    const { w } = await mountNotesView()
    const rows = w.findAll('.kn-list > .kn-note-row')
    expect(rows).toHaveLength(4)
    rows.forEach((row, idx) => {
      const i = idx + 1
      expect(row.attributes('style')).toContain('cursor: default')
      const skels = row.findAll('.k-skel')
      // 2nd/3rd .k-skel are two with decreasing widths (1st, 4th are fixed-size avatar/time placeholders)
      expect(skels[1].attributes('style')).toContain(`width: ${52 - i * 8}%`)
      expect(skels[2].attributes('style')).toContain(`width: ${72 - i * 6}%`)
    })
    d.resolve([])
    await flush()
    expect(w.findAll('.kn-list > .kn-note-row')).toHaveLength(0) // skeleton disappears, enter empty state
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — empty state vs has notes (notes.length both sides, §9.9)', () => {
  it('notes.length === 0 → render k-empty, toolbar/list/inbox not rendered', async () => {
    notes.list.mockResolvedValue([])
    const { w } = await mountNotesView()
    expect(w.find('.k-empty').exists()).toBe(true)
    expect(w.find('.kn-toolbar').exists()).toBe(false)
    expect(w.find('.kn-inbox').exists()).toBe(false)
  })

  it('notes.length > 0 → k-empty not rendered, toolbar rendered', async () => {
    const { w } = await mountNotesView()
    expect(w.find('.k-empty').exists()).toBe(false)
    expect(w.find('.kn-toolbar').exists()).toBe(true)
  })

  it('empty state: clicking "new note" → router carries ?id=new', async () => {
    notes.list.mockResolvedValue([])
    const { w, router } = await mountNotesView()
    await w.find('.k-empty button').trigger('click')
    await flush()
    expect(router.currentRoute.value.query.id).toBe('new')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — draft inbox (drafts.length both sides, §9.9)', () => {
  it('drafts.length > 0 → kn-inbox rendered, title has draft count, "confirm all" button clickable', async () => {
    const { w } = await mountNotesView()
    const inbox = w.find('.kn-inbox')
    expect(inbox.exists()).toBe(true)
    expect(inbox.find('.kn-inbox-title b').text()).toBe('1') // NOTES_3 has only 1 draft
    expect(inbox.find('.k-btn.primary').attributes('disabled')).toBeUndefined()
  })

  it('drafts.length === 0 (all curated/archived) → kn-inbox not rendered', async () => {
    notes.list.mockResolvedValue([NOTE_CURATED, NOTE_ARCHIVED])
    const { w } = await mountNotesView()
    expect(w.find('.kn-inbox').exists()).toBe(false)
  })

  it('click inbox header to collapse/expand (data-open both sides), click "confirm all" to aggregate curate all drafts', async () => {
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
describe('NotesView — filter (filtered.length both sides, §9.9)', () => {
  it('select a type with no notes on device → kn-empty-filtered rendered; click "clear filter" to restore', async () => {
    const { w } = await mountNotesView()
    await w.find('.k-filt-select').setValue('digest') // NOTES_3 has no digest
    await flush()
    expect(w.find('.kn-empty-filtered').exists()).toBe(true)
    await w.find('.kn-empty-filtered button').trigger('click')
    await flush()
    expect(w.find('.kn-empty-filtered').exists()).toBe(false)
  })

  it('filtered.length > 0 → list renders rows, kn-empty-filtered not rendered', async () => {
    const { w } = await mountNotesView()
    expect(w.find('.kn-empty-filtered').exists()).toBe(false)
    expect(rowTitles(w).length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — list row status buttons (status===draft / !==archived both sides, §9.9)', () => {
  it('draft row: has "confirm" button + has "archive" button (status !== archived also holds)', async () => {
    const { w } = await mountNotesView()
    const row = w.find('.kn-note-row[data-s="draft"]')
    expect(row.find('.kn-act[data-tone="confirm"]').exists()).toBe(true)
    expect(row.findAll('.kn-act').some((b) => b.text() === '归档')).toBe(true)
  })

  it('curated row: no "confirm" button (status !== draft), has "archive" button (status !== archived)', async () => {
    const { w } = await mountNotesView()
    const row = w.find('.kn-note-row[data-s="curated"]')
    expect(row.find('.kn-act[data-tone="confirm"]').exists()).toBe(false)
    expect(row.findAll('.kn-act').some((b) => b.text() === '归档')).toBe(true)
  })

  it('archived row: no "confirm" button, no "archive" button (both conditions reversed)', async () => {
    const { w } = await mountNotesView()
    // directly switch to archived state pill (4th, blueprint order: all/AI drafts/confirmed/archived)
    const pills = w.findAll('.k-filter-pill')
    await pills[3].trigger('click')
    await flush()
    const row = w.find('.kn-note-row[data-s="archived"]')
    expect(row.exists()).toBe(true)
    expect(row.find('.kn-act[data-tone="confirm"]').exists()).toBe(false)
    expect(row.findAll('.kn-act').some((b) => b.text() === '归档')).toBe(false)
    // only delete button remains
    expect(row.findAll('.kn-act')).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 §5.2 stale guard (K15 same family 8th time) — two test cases for reload()
// criteria. RED probes in task report (remove epoch check / move reloadEpoch to
// module level, each destruction tested once).
describe('NotesView — reload() stale guard (§5.2)', () => {
  it('① interleaved: first sent (A) arrives late, must not overwrite result of later sent arrives first (B); loading not re-triggered by A\'s late response', async () => {
    const dA = makeDeferred<Note[]>()
    const dB = makeDeferred<Note[]>()
    notes.list.mockReturnValueOnce(dA.promise) // first send (A), from initial reload() at mount time
    const { w, router } = await mountNotesView()
    expect(skeletonVisible(w)).toBe(true)

    // trigger second send (B): id changes from non-empty to empty, enters watch(editingId) → reload()
    notes.list.mockReturnValueOnce(dB.promise)
    await router.push({ query: { id: 'some-note' } })
    await flush()
    await router.push({ query: { id: '' } })
    await flush()
    expect(notes.list).toHaveBeenCalledTimes(2)

    // B resolves first
    dB.resolve([NOTE_CURATED])
    await flush()
    expect(rowTitles(w)).toEqual([NOTE_CURATED.title])
    expect(skeletonVisible(w)).toBe(false)

    // A arrives late — must be blocked by guard, must not overwrite B's result with A's, must not toggle loading back
    dA.resolve([NOTE_DRAFT])
    await flush()
    expect(rowTitles(w)).toEqual([NOTE_CURATED.title])
    expect(skeletonVisible(w)).toBe(false)
  })

  it('🔴 ② two instances interleaved: each gets its own result, no mutual overwrite (guard variable must be component-local, not module-level)', async () => {
    const dA = makeDeferred<Note[]>()
    const dB = makeDeferred<Note[]>()
    notes.list.mockReturnValueOnce(dA.promise) // instance 1's first send reload()
    const { w: w1 } = await mountNotesView()
    notes.list.mockReturnValueOnce(dB.promise) // instance 2's first send reload()
    const { w: w2 } = await mountNotesView()
    expect(skeletonVisible(w1)).toBe(true)
    expect(skeletonVisible(w2)).toBe(true)

    // interleaved resolves: instance 2 (B) resolves first, instance 1 (A) later
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
// N30 two together: watch editingId only reloads when emptied; :key="editingId"
// must not be deleted.
// 🔴 T7 addition note: when T6 was submitted, `NoteEditPane` was still T6's own
// zero-logic placeholder component; these two test cases originally directly read
// `.kn-edit-pane-stub[data-note-id]` rendered by the placeholder to verify
// "whether rebuilt". After T7 lands the real component, placeholder removed (see
// NotesView.vue header comment "NoteEditPane.vue landed in T7"), real component
// lacks this marker — switched to using `.kn-edit-top` (header bar, any note has
// one) as element identity witness, and use `notes.get` call arguments to verify
// the causal chain "`:key` changes → new instance → new get(id) call"; the
// criterion itself (removing `if (!v)` causes reload to run extra times) unchanged.
describe('NotesView — N30 (watch editingId reload only when empty + :key triggers rebuild)', () => {
  it('switch to another note (non-empty id → different non-empty id) does not trigger reload, but :key change rebuilds subcomponent', async () => {
    const { w, router } = await mountNotesView()
    expect(notes.list).toHaveBeenCalledTimes(1)

    await router.push({ query: { id: 'note-a' } })
    await flush()
    expect(notes.get).toHaveBeenCalledWith('note-a')
    const el1 = w.find('.kn-edit-top').element

    notes.list.mockClear()
    notes.get.mockClear()
    await router.push({ query: { id: 'note-b' } }) // non-empty → non-empty, watch guard should block reload
    await flush()
    expect(notes.get).toHaveBeenCalledWith('note-b') // :key change → new instance → new get() call
    const el2 = w.find('.kn-edit-top').element
    expect(el2).not.toBe(el1) // :key change → new DOM node (rebuild)
    expect(notes.list).not.toHaveBeenCalled() // criterion: removing `if (!v)` layer will make this fail
  })

  it('id empties (return to list) → trigger reload()', async () => {
    const { w, router } = await mountNotesView()
    await router.push({ query: { id: 'note-a' } })
    await flush()
    notes.list.mockClear()
    await router.push({ query: { id: '' } })
    await flush()
    expect(notes.list).toHaveBeenCalledTimes(1)
    expect(w.find('.kn-edit-top').exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// deep link: editingId comes from route.query.id, directly changing address bar
// (without clicking) should also work (memory newui-router-query-only-no-remount).
// 🔴 T7 addition note (same as N30 section): real component lacks
// `.kn-edit-pane-stub` marker, switched to existence/absence of `.kn-edit-top`
// (header) + `notes.get` call arguments to witness "switch to edit state".
describe('NotesView — deep link ?id= reactivity (memory newui-router-query-only-no-remount)', () => {
  it('after mount, directly change router query (simulate user manually editing address bar) can also switch to edit state, no need to remount entire view', async () => {
    const { w, router } = await mountNotesView() // initial ?id= default (empty)
    expect(w.find('.kn-edit-top').exists()).toBe(false)
    await router.push({ query: { id: 'from-address-bar' } })
    await flush()
    expect(w.find('.kn-edit-top').exists()).toBe(true)
    expect(notes.get).toHaveBeenCalledWith('from-address-bar')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('NotesView — single operation + K5 (do not echo backend message)', () => {
  it('curate success: toast + reload', async () => {
    const { w } = await mountNotesView()
    notes.list.mockClear()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="confirm"]').trigger('click')
    await flush()
    expect(notes.curate).toHaveBeenCalledWith(NOTE_DRAFT.id)
    expect(useToast().toasts.map((x) => x.text)).toContain('笔记已确认')
    expect(notes.list).toHaveBeenCalledTimes(1)
  })

  it('curate failure: toast fixed copy, no backend message (K5)', async () => {
    notes.curate.mockRejectedValue(new Error('backend exploded: disk full'))
    const { w } = await mountNotesView()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="confirm"]').trigger('click')
    await flush()
    const texts = useToast().toasts.map((x) => x.text)
    expect(texts).toContain('操作失败')
    expect(texts.join(' | ')).not.toContain('disk full')
  })

  it('archive success: toast + reload; archive failure: toast fixed copy', async () => {
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
describe('NotesView — confirmAll (N31 copied: concurrent + no finally + reload on failure)', () => {
  it('all succeed: toast with count, reload invoked', async () => {
    notes.list.mockResolvedValue([NOTE_DRAFT, { ...NOTE_DRAFT, id: 'd2' }])
    const { w } = await mountNotesView()
    notes.list.mockClear()
    await w.find('.kn-inbox-head .k-btn.primary').trigger('click')
    await flush()
    expect(notes.curate).toHaveBeenCalledTimes(2)
    expect(useToast().toasts.map((x) => x.text)).toContain('已确认 2 条草稿')
    expect(notes.list).toHaveBeenCalledTimes(1)
  })

  it('partial success (one curate rejected): Promise.all overall fails shows one failure toast, but reload still executes (flush successful ones)', async () => {
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
    expect(notes.list).toHaveBeenCalledTimes(1) // 🔴 N31: reload even on failure
  })

  it('confirm all button disabled during bulkConfirming', async () => {
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
describe('NotesView — delete confirm dialog (K7/K29/K36 reka)', () => {
  it('clicking inline delete button opens dialog (portal to .knowledge-app), title/body/buttons correct', async () => {
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

  it('clicking "cancel" closes dialog, does not call remove', async () => {
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

  it('clicking "archive instead" calls archive, does not call remove, dialog closes', async () => {
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

  it('clicking "delete" calls remove(id), toast, reload, dialog closes', async () => {
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

  // reka pointerDownOutside equivalent to blueprint "clicking overlay closes / clicking inside dialog does not close" (precedent QueueView.test.ts).
  it('clicking overlay (outside dialog) closes; clicking inside dialog does not close', async () => {
    const host = withHost()
    const { w } = await mountNotesView()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="danger"]').trigger('click')
    await flush()
    expect(host.querySelector('.k-modal')).not.toBeNull()
    // reka usePointerDownOutside uses setTimeout(0) to defer attaching document
    // listener (see same comment in QueueView.test.ts), flushPromises/nextTick
    // cannot flush it, add one macrotask tick.
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

  // Fix round 1 (code review Important, cross-task consistency, aligns with
  // established practice in T8/IndexedFilesView.test.ts:1947) — K36 a11y
  // permanent assertion: DialogContent's aria-labelledby must match .k-modal-title
  // element's id (same value, same element). This page uses <DialogTitle as-child>
  // (K36 established choice, blueprint has visible title, see file header comment)
  // — unlike IndexedFilesView wrapping an extra hidden node in VisuallyHidden,
  // as-child does not produce a second node with id, so additionally verify
  // reverse "dialog contains exactly one element with id" to prove no extra
  // hidden node.
  it('🔴 K36 a11y — aria-labelledby and .k-modal-title id same value same element, no extra hidden DialogTitle node', async () => {
    const host = withHost()
    const { w } = await mountNotesView()
    await w.find('.kn-note-row[data-s="draft"] .kn-act[data-tone="danger"]').trigger('click')
    await flush()
    const modal = host.querySelector('.k-modal')!
    expect(modal.getAttribute('role')).toBe('dialog')
    const labelId = modal.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    const titleEl = modal.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.id).toBe(labelId)
    expect(titleEl.textContent).toBe('删除该笔记？')
    // as-child does not additionally insert VisuallyHidden node — dialog should have exactly 1 element with id.
    expect(modal.querySelectorAll('[id]')).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Fix round 1 (code review Important) — auto-load guard for T6's placeholder
// component.
//
// [Background] NoteEditPane.vue (T7/T8) does not yet exist in this commit;
// NotesView.vue inline a zero-logic placeholder component to replace import
// (see file header comment). Bare `TODO(T7)` comment can be silently ignored —
// real risk is T7 lands NoteEditPane.vue but forgets to change NotesView.vue's
// mount point, then no test fails and edit panel silently renders blank.
//
// [Design of this assertion] Use filesystem-conditional assertion: read whether
// NoteEditPane.vue exists, read NotesView.vue source itself, branch into two
// paths by existence, both are strong assertions that "will truly fail" (not
// empty-pass-through that returns immediately if condition fails):
//   · does not exist (now) — assert NotesView.vue still retains local
//     placeholder marker and contains no import pointing to true file (if both
//     fail, placeholder was touched but true file not yet landed, also report
//     red).
//   · exists (after T7) — assert NotesView.vue must already import real
//     component, local placeholder marker must be cleared.
// Evidence for lazy/loaded criteria in task report "Fix round 1" section (RED
// probe: temporarily place placeholder .vue file under components/, confirm
// this condition precisely fails on "exists" branch).
describe('NotesView — T6 placeholder component auto-load guard (NoteEditPane.vue must force-wire when landed)', () => {
  it('🔴 auto-load: when NoteEditPane.vue missing verify placeholder still present and no real import; once exists verify reverse real import + placeholder cleared', () => {
    const exists = existsSync(NOTE_EDIT_PANE_PATH)
    const src = readFileSync(NOTES_VIEW_SRC_PATH, 'utf8')
    const hasRealImport = src.includes("from '../components/NoteEditPane.vue'")
    const hasLocalPlaceholder = src.includes('kn-edit-pane-stub') || src.includes('NoteEditPanePlaceholder')

    if (exists) {
      // loaded state: T7 already placed true file in position.
      expect(
        hasRealImport,
        'NoteEditPane.vue exists: please change NotesView.vue to `import NoteEditPane from ' +
          "'../components/NoteEditPane.vue'` (T6\'s local placeholder needs replacement, see T6 report)",
      ).toBe(true)
      expect(
        hasLocalPlaceholder,
        'NoteEditPane.vue exists: please delete T6\'s local placeholder component ' +
          'in NotesView.vue (marker string kn-edit-pane-stub / NoteEditPanePlaceholder), ' +
          'it should no longer appear',
      ).toBe(false)
    } else {
      // lazy state (now): true file not yet landed, product code should still be
      // T6's placeholder implementation — these two assertions truly execute (not
      // skipped), and if someone mistakenly deleted placeholder without connecting
      // true component, will also fail here ("mount point lost content" type
      // regression).
      expect(
        hasLocalPlaceholder,
        'NoteEditPane.vue does not yet exist, but T6\'s local placeholder component ' +
          'in NotesView.vue is also gone — mount point will lose content, please ' +
          'restore placeholder or add NoteEditPane.vue',
      ).toBe(true)
      expect(
        hasRealImport,
        'NoteEditPane.vue does not yet exist, NotesView.vue should not have import ' +
          'pointing to it (will make vue-tsc/vite build fail before T7 lands)',
      ).toBe(false)
    }
  })
})
