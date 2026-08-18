import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { EditorView } from '@codemirror/view'
import YamlEditor from './YamlEditor.vue'

// CM6 in jsdom: mounting, doc content and dispatch→updateListener all actually run (verified with
// a manual probe, not mocked). The only thing jsdom cannot reliably simulate is real keyboard typing
// (it depends on native browser contenteditable/IME events), so the "document change → emit" path uses
// EditorView.findFromDOM (a public CM6 API, not a hack) to get the real view instance and
// view.dispatch() to produce a genuine document-change transaction -- a faithful simulation of the
// component's external contract (modify document → emit), just entering through a different door
// than "typing", not a bypass of component logic.
function mountEditor(modelValue: string) {
  return mount(YamlEditor, { props: { modelValue }, attachTo: document.body })
}

describe('YamlEditor', () => {
  it('initializes CM6 document content with modelValue on mount', () => {
    const w = mountEditor('services:\n  a:\n    image: foo\n')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)
    expect(view).not.toBeNull()
    expect(view!.state.doc.toString()).toBe('services:\n  a:\n    image: foo\n')
    w.unmount()
  })

  it('document changes (real transactions created by view.dispatch) → emit update:modelValue', async () => {
    const w = mountEditor('a: 1')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)!
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'b: 2' } })
    await nextTick()
    const emitted = w.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1]).toEqual(['b: 2'])
    w.unmount()
  })

  it('external modelValue changes (e.g. tab2 conversion writes) sync into editor', async () => {
    const w = mountEditor('a: 1')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    await w.setProps({ modelValue: 'name: converted\nservices: {}\n' })
    await nextTick()
    const view = EditorView.findFromDOM(host)!
    expect(view.state.doc.toString()).toBe('name: converted\nservices: {}\n')
    w.unmount()
  })

  it('refilling identical content does not trigger feedback loop (setProps with current doc value does not dispatch, no excess emit)', async () => {
    const w = mountEditor('a: 1')
    await w.setProps({ modelValue: 'a: 1' }) // Same as the current document
    await nextTick()
    expect(w.emitted('update:modelValue')).toBeFalsy()
    w.unmount()
  })

  it('cleans up EditorView on destruction (cannot get instance via findFromDOM after unmount)', () => {
    const w = mountEditor('a: 1')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    w.unmount()
    expect(EditorView.findFromDOM(host)).toBeNull()
  })
})
