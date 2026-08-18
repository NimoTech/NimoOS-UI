// SP8-P5e Task 4 — `KFileViewer.vue` unit test. Blueprint `NimoOS-UI@7a6ee6b7`
// `src/views/AI/Knowledge/components/KFileViewer.vue` (120 lines, template+script :1-68 ported this round).
//
// ═══ mock boundary (governance §9.12 / Appendix D §D.9, T0 on-device conclusion) ═══
// `@vue-office/excel`'s internal x-spreadsheet on mount unconditionally calls
// `HTMLCanvasElement.getContext('2d')`, jsdom returns `null` → immediately reads `null.scale` →
// unhandled rejection → **entire `pnpm test` process exit 1 (0 tests failed)** (Appendix D
// §D.9.2 on-device evidence). So stub both `DocViewer`/`ExcelViewer` to unchanged contract shape —
// both must be handled consistently (stubbing only one introduces two mount semantics in same
// test batch, Appendix D §D.9.3 mandates). Stub preserves `item`/`list` two props + `close`/
// `download` two emits (basis `DocViewer.vue:9-10` / `ExcelViewer.vue:9-10` `defineProps`/
// `defineEmits`).
//
// After stub route, §2.4/§2.6/§2.7 test discriminatory power falls on "route mapping +
// contract shape" (Appendix D §D.9.4), so each assertion pairs with mutation evidence (report
// posts two RED probe outputs).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import KFileViewer from './KFileViewer.vue'
import type { FileVM } from '../util/searchAggregate'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

// ─── D.9.3 stub (both must handle consistently) ───
vi.mock('../../../files/viewers/DocViewer.vue', () => ({
  default: {
    name: 'DocViewer',
    props: { item: { type: Object, required: true }, list: { type: Array, required: true } },
    emits: ['close', 'download'],
    template: '<div data-stub="doc-viewer" />',
  },
}))
vi.mock('../../../files/viewers/ExcelViewer.vue', () => ({
  default: {
    name: 'ExcelViewer',
    props: { item: { type: Object, required: true }, list: { type: Array, required: true } },
    emits: ['close', 'download'],
    template: '<div data-stub="excel-viewer" />',
  },
}))

function makeFile(name: string): FileVM {
  return {
    id: 'fx',
    name,
    path: '/x/',
    fullPath: `/x/${name}`,
    kind: 'body',
    mime: 'application/octet-stream',
    mtimeMs: 1700000000000,
    score: 0.8,
    chunks: [],
  }
}

describe('KFileViewer — root element class (§2.2 K46 self-proof ③)', () => {
  it('root <div> applies .k-fileviewer-host class', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.docx') } })
    expect(w.classes()).toContain('k-fileviewer-host')
  })
})

describe('KFileViewer — VIEWER_MAP five extensions (§2.4, blueprint :37-43 / :55-58)', () => {
  const cases: Array<[string, string]> = [
    ['a.docx', 'doc-viewer'],
    ['a.wps', 'doc-viewer'],
    ['a.xls', 'excel-viewer'],
    ['a.xlsx', 'excel-viewer'],
    ['a.csv', 'excel-viewer'],
  ]
  it.each(cases)('%s → data-stub=%s', (name, stub) => {
    const w = mount(KFileViewer, { props: { file: makeFile(name) } })
    expect(w.find('[data-stub]').attributes('data-stub')).toBe(stub)
  })

  it('🔴 case-insensitive (blueprint .toLowerCase()): A.DOCX → doc-viewer', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('A.DOCX') } })
    expect(w.find('[data-stub]').attributes('data-stub')).toBe('doc-viewer')
  })

  it('item shape passed to child = { path, name, is_dir:false } (not entire file)', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.docx') } })
    const stub = w.findComponent({ name: 'DocViewer' })
    expect(stub.props('item')).toStrictEqual({ path: '/x/a.docx', name: 'a.docx', is_dir: false })
    expect(stub.props('list')).toStrictEqual([{ path: '/x/a.docx', name: 'a.docx', is_dir: false }])
  })
})

describe('KFileViewer — fallback branch (§2.4, unknown extension → .k-fileviewer-fallback)', () => {
  it.each(['a.pdf', 'a.png', 'a.zip', 'noextension', ''])('extension %s (or no extension/empty name) not in VIEWER_MAP → renders fallback', (name) => {
    const w = mount(KFileViewer, { props: { file: makeFile(name) } })
    expect(w.find('[data-stub]').exists()).toBe(false)
    expect(w.find('.k-fileviewer-fallback').exists()).toBe(true)
    expect(w.find('.k-fileviewer-empty').exists()).toBe(true)
  })

  it('fallback text: "Preview not supported" message + Download button both render (i18n keys aiKbFvUnsupported / aiKbFdDownload)', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })
    expect(w.find('.k-fileviewer-empty p').text()).toBe('此格式暂不支持在线预览')
    expect(w.find('.k-fileviewer-empty button.k-btn.primary').text()).toContain('下载')
  })

  it('fallback header filename title = item.name (i.e. file.name)', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })
    expect(w.find('.k-drawer-filename').attributes('title')).toBe('a.pdf')
    expect(w.find('.k-drawer-filename').text()).toBe('a.pdf')
  })

  it('fallback header close button (.k-modal-x) click → emit close', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })
    w.find('.k-modal-x').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})

describe('KFileViewer — §2.7 download emit forwarding (blueprint :18 known inconsistency, copied as-is)', () => {
  it('🔴 fallback download button emits file (entire prop), not item — copies blueprint this inconsistency', () => {
    const file = makeFile('a.pdf')
    const w = mount(KFileViewer, { props: { file } })
    w.find('.k-fileviewer-empty button.k-btn.primary').trigger('click')
    const emitted = w.emitted('download')
    expect(emitted).toHaveLength(1)
    // Is complete FileVM (has id/kind/mime/score/chunks etc. fields item lacks), not
    // item's trimmed object
    expect(emitted![0][0]).toStrictEqual(file)
    expect(emitted![0][0]).toHaveProperty('id', 'fx')
    expect(emitted![0][0]).not.toEqual({ path: '/x/a.pdf', name: 'a.pdf', is_dir: false })
  })

  it('blueprint <component :is> branch only binds @close, not @download — stub internal emit(\'download\') not forwarded by KFileViewer', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.docx') } })
    const stub = w.findComponent({ name: 'DocViewer' })
    stub.vm.$emit('download', { name: 'inner.docx' })
    expect(w.emitted('download')).toBeUndefined()
  })
})

describe('KFileViewer — N41 Esc listener (§2.6, mounted/beforeDestroy → onMounted/onBeforeUnmount)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ⚠️ Testing record (debugging note, not this round's change): after `wrapper.unmount()`
  // Vue's emit itself stops passing events to parent listeners (`@vue/test-utils` v4 `wrapper.emitted()`
  // becomes `undefined` after unmount; even swapping to `onClose` prop count or bypassing dispatchEvent
  // to directly call captured handler reference, `onClose` call count stops growing after
  // unmount — this layer is Vue's own unmount lifecycle built-in protection, unrelated to whether
  // this component called `removeEventListener`). That is, "after unmount press Esc, assert close
  // count stops growing" criterion is **forever green** in this environment, zero discriminatory
  // power (tested: temporarily deleting onBeforeUnmount line, this type of assertion still passes).
  // 🔴 Real discriminatory, RED-provable criterion falls on "unregistration call itself"
  // (see T4 report RED probe): whether `window.removeEventListener('keydown', same handler reference)`
  // was called. Criterion: delete onBeforeUnmount line → `removeCall` becomes `undefined` →
  // following assertion must fail.
  it('on mount registers keydown; Esc emits close; on unmount unregisters with same function reference (criterion: delete onBeforeUnmount → must fail)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })

    const addCall = addSpy.mock.calls.find((c) => c[0] === 'keydown')
    expect(addCall, 'keydown addEventListener call not found').toBeDefined()
    const handler = addCall![1]

    // Press Esc → emit close
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)

    // Press other key → don't emit
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('close')).toHaveLength(1)

    w.unmount()

    const removeCall = removeSpy.mock.calls.find((c) => c[0] === 'keydown')
    expect(removeCall, 'keydown removeEventListener call not found (listener still on window after unmount)').toBeDefined()
    // 🔴 Core criterion: unregistration uses same function reference (not newly created
    // equivalent function — otherwise browser won't truly unbind original listener)
    expect(removeCall![1]).toBe(handler)
  })
})

describe('KFileViewer — K46 three self-proofs (§2.2, review checks one by one)', () => {
  it('① DocViewer.vue / ExcelViewer.vue own templates zero .overlay / .v-container / .doc-container', () => {
    const doc: string = read('../../../files/viewers/DocViewer.vue')
    const excel: string = read('../../../files/viewers/ExcelViewer.vue')
    for (const cls of ['overlay', 'v-container', 'doc-container']) {
      const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"|class=\\"[^\\"]*${cls}`)
      expect(re.test(doc), `DocViewer.vue template has .${cls}`).toBe(false)
      expect(re.test(excel), `ExcelViewer.vue template has .${cls}`).toBe(false)
    }
    // They render ViewerShell, self-has .office-body / .office-scroll (not blueprint's
    // .overlay family)
    expect(doc).toMatch(/class="office-body"/)
    expect(doc).toMatch(/class="office-scroll"/)
    expect(excel).toMatch(/class="office-body"/)
  })

  it('② ViewerShell.vue:24 provides viewport-filling positioning ancestor (position:absolute;inset:0;z-index:200)', () => {
    const shell: string = read('../../../files/viewers/ViewerShell.vue')
    expect(shell).toMatch(/position:\s*absolute;\s*inset:\s*0;\s*z-index:\s*200;/)
  })
})
