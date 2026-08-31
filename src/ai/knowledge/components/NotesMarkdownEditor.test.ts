// NotesMarkdownEditor.vue unit test
//
// Test approach per Appendix D §D.6 (T0 on-device conclusion, review re-ran to confirm):
// jsdom can truly mount `new Editor({extensions:[StarterKit, Markdown]})`, this file uses
// **real Editor** throughout, does not mock `@tiptap/vue-3` / `tiptap-markdown`.
// Wait timing (§D.6 footer note): after building Editor in onMounted, `await nextTick()`
// then `await flushPromises()` (single nextTick not enough). Mount needs `attachTo: document.body`
// (jsdom's ProseMirror selection/getClientRects paths without real document will error).
//
// 🔴 Appendix D §D.6.1 "N29 tbTick false dependency" only proved premise, didn't
// mount parent — this file doesn't import it, counting as proved (N29 itself not in this
// component, goes to T7). But this file's own assertions on `transaction` event (§3③
// onTransaction → emit('transaction')) still requires mutation evidence per ruling — see
// report §mutation evidence (deleting `onTransaction` line makes corresponding test case fail).
//
// K38's two emits (removing either must fail) and §5.3 anti-loop (removing comparison must
// fail) mutation evidence also in report, not in this file (only GREEN cases that can be run
// once and pass).

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { Editor, SingleCommands } from '@tiptap/vue-3'
import NotesMarkdownEditor from './NotesMarkdownEditor.vue'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function mountEditor(modelValue = '# hello\n\nworld') {
  const w = mount(NotesMarkdownEditor, {
    props: { modelValue },
    attachTo: document.body,
  })
  await nextTick()
  await flushPromises()
  return w
}

function getEditor(w: Awaited<ReturnType<typeof mountEditor>>): Editor {
  const readyEmits = w.emitted<Editor[]>('ready')
  expect(readyEmits).toBeTruthy()
  return readyEmits![0][0]
}

/**
 * 🔴 Fix round 1 (approach provided by review, verified viable): `ed.commands` is a getter.
 * `@tiptap/vue-3`'s `Editor` inherits from `@tiptap/core`'s `Editor`. Getter is defined on
 * **parent class** prototype (`ed`'s direct prototype doesn't have it, must go up one level)
 * — each access to getter uses `Object.fromEntries(...)` to construct fresh bound function
 * object, so `vi.spyOn(ed.commands, 'setContent')` only spies on that one access's snapshot,
 * can't intercept next re-access to `.commands` yielding different object. Testing shows
 * constant 0 calls recorded, false negative — this path doesn't work. **Viable approach instead:**
 * use `Object.defineProperty(ed, 'commands', {...})` to shadow the getter on **instance**
 * (not prototype); getter inside calls original getter as-is to get real `SingleCommands`
 * object, wraps it in `Proxy` that only intercepts `setContent` for count, passes other
 * methods through. Since shadowing happens on instance, production code (`editor.value.commands.setContent(v)`,
 * `editor.value` same reference as `ed` here) thereafter every `.commands` access uses this
 * shadowed getter, count is accurate.
 */
function spySetContentCalls(ed: Editor): { count: () => number } {
  let proto: object | null = Object.getPrototypeOf(ed)
  let originalGetter: (() => SingleCommands) | undefined
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'commands')
    if (desc && typeof desc.get === 'function') {
      originalGetter = desc.get as () => SingleCommands
      break
    }
    proto = Object.getPrototypeOf(proto)
  }
  if (!originalGetter) throw new Error('commands getter not found on Editor prototype chain')
  const getter = originalGetter
  let calls = 0
  Object.defineProperty(ed, 'commands', {
    configurable: true,
    get(): SingleCommands {
      const real = getter.call(ed)
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop === 'setContent') {
            return (...args: Parameters<SingleCommands['setContent']>) => {
              calls += 1
              return Reflect.get(target, prop, receiver).apply(target, args)
            }
          }
          return Reflect.get(target, prop, receiver)
        },
      })
    },
  })
  return { count: () => calls }
}

describe('NotesMarkdownEditor — mount + ready contract', () => {
  it('truly mounts tiptap Editor, renders .nme-content .ProseMirror, content matches markdown', async () => {
    const w = await mountEditor('# hello\n\nworld')
    expect(w.find('.nme-content .ProseMirror').exists()).toBe(true)
    const ed = getEditor(w)
    expect(ed.storage.markdown.getMarkdown()).toBe('# hello\n\nworld')
    w.unmount()
  })

  it('at end of mounted emit("ready", editor): payload is real Editor instance', async () => {
    const w = await mountEditor('body text')
    const ed = getEditor(w)
    expect(typeof ed.storage.markdown.getMarkdown).toBe('function')
    expect(typeof ed.chain).toBe('function')
    w.unmount()
  })
})

describe('NotesMarkdownEditor — K38: v-model contract emits both update:modelValue and input', () => {
  it('after typing once, both emits fire once each, payload is current markdown', async () => {
    const w = await mountEditor('start')
    const ed = getEditor(w)
    ed.chain().focus().insertContent(' more').run()
    await nextTick()
    await flushPromises()

    const updateEmits = w.emitted<string[]>('update:modelValue')
    const inputEmits = w.emitted<string[]>('input')
    expect(updateEmits).toBeTruthy()
    expect(inputEmits).toBeTruthy()
    const md = ed.storage.markdown.getMarkdown()
    expect(updateEmits![updateEmits!.length - 1][0]).toBe(md)
    expect(inputEmits![inputEmits!.length - 1][0]).toBe(md)
    w.unmount()
  })
})

describe('NotesMarkdownEditor — §5.3 anti-loop', () => {
  // ⚠️ Three pitfall records (also logged in report):
  // ① `vi.spyOn(ed.commands, 'setContent')` ineffective because `commands` is getter that
  //    reconstructs bound function object on every access (defined on `@tiptap/core` `Editor`
  //    prototype, `ed`'s direct prototype doesn't have it, `@tiptap/vue-3` `Editor` inherits
  //    from it, must look one level up) — spy only catches that one access's snapshot,
  //    can't intercept watch's internal re-access to `.commands` yielding different object,
  //    testing shows constant 0 calls, false negative. **Viable approach is instance-level
  //    `Object.defineProperty(ed, 'commands', { get: return Proxy-wrapped original getter result })`
  //    to shadow getter** (see `spySetContentCalls` below, provided by review and verified viable).
  // ② Swapping to `onTransaction` emit count as signal equally unreliable — testing shows
  //    sporadic (about 1/5) extra transaction on "same-value write-back" branch regardless
  //    of setContent being called (jsdom's ProseMirror selection/focus events dispatch
  //    transactions not affecting document, timing races post-mount async cleanup, is noise
  //    not behavior under test).
  // ⇒ Swap to `editor.state.doc` (ProseMirror immutable document tree) reference equality:
  //   once setContent truly executes, regardless whether new and old content are textually
  //   same, ProseMirror produces new doc node object (verified with isolated script:
  //   after `ed.commands.setContent(sameMarkdown)`, `docBefore === docAfter` is `false`).
  // ③ 🔴 Direct `setProps({ modelValue: initial-mount-value })` can't detect this guard —
  //   Vue's `watch` source doesn't call callback when new/old values `Object.is` equal
  //   **at all** (regardless of whether we wrote `v !== …` comparison, Vue itself's
  //   pre-deduplication); verified: after deleting comparison from production, this test
  //   style still all-green, zero discriminatory power. Real scenario to prevent is
  //   "anti-loop" semantics itself — user types → `onUpdate` triggers `update:modelValue`
  //   → parent v-model writes back **same value** as-is — at this point prop **value truly
  //   changed** (from initial mount value to post-typing value), Vue calls watch callback,
  //   comparison inside callback has meaning. Test case below replicates this real loop.
  it('after user types, parent writes back same value via v-model, doesn\'t reset content (doc ref unchanged); only resets when writing truly different value', async () => {
    const w = await mountEditor('start')
    const ed = getEditor(w)

    // Type: editor content truly changed, triggers onUpdate → emit('update:modelValue', afterType).
    ed.chain().focus().insertContent(' more').run()
    await nextTick()
    await flushPromises()
    const afterType = ed.storage.markdown.getMarkdown()
    expect(afterType).not.toBe('start')
    const docBeforeEcho = ed.state.doc

    // Simulate parent v-model writing back update:modelValue value as-is (real loop scenario,
    // different from initial mount value, Vue's watch pre-deduplication won't block this call).
    await w.setProps({ modelValue: afterType })
    await nextTick()
    await flushPromises()
    expect(ed.state.doc).toBe(docBeforeEcho)
    expect(ed.storage.markdown.getMarkdown()).toBe(afterType)

    // Parent writes truly different value → must actually setContent.
    await w.setProps({ modelValue: '# totally different' })
    await nextTick()
    await flushPromises()
    expect(ed.state.doc).not.toBe(docBeforeEcho)
    expect(ed.storage.markdown.getMarkdown()).toBe('# totally different')
    w.unmount()
  })

  // 🔴 Fix round 1 (review requirement): spec §T4-3 / brief §3-② original criteria —
  // directly assert `setContent` call count, not just rely on `editor.state.doc` reference evidence.
  // Assert both sides (if only assert "0 times", bad implementation never calling setContent
  // also passes). ⚠️ **Cannot** directly `mountEditor(X)` then `setProps({ modelValue: X's
  // getMarkdown() })` — that value has same content as initial prop at mount, Vue's `watch`
  // source doesn't call callback when new/old values `Object.is` equal at all, watch callback
  // never executes, `spy.count()` forever 0, completely unrelated to whether production code
  // wrote comparison logic (verified with mutation: this approach still all-green after
  // deleting `:69` comparison, zero discriminatory power, same pitfall as lesson ③ above in
  // "reference unchanged" case). Must like above case type first for real, making write-back
  // value differ from mount initial value, so Vue triggers watch, comparison inside callback
  // has meaning.
  it('after user types, parent writes back same value via v-model, setContent called 0 times; called 1 time when writing truly different value', async () => {
    const w = await mountEditor('start')
    const ed = getEditor(w)
    const spy = spySetContentCalls(ed)

    ed.chain().focus().insertContent(' more').run()
    await nextTick()
    await flushPromises()
    const afterType = ed.storage.markdown.getMarkdown()
    expect(afterType).not.toBe('start')

    await w.setProps({ modelValue: afterType })
    await nextTick()
    await flushPromises()
    expect(spy.count()).toBe(0)

    await w.setProps({ modelValue: '# changed' })
    await nextTick()
    await flushPromises()
    expect(spy.count()).toBe(1)
    expect(ed.storage.markdown.getMarkdown()).toBe('# changed')
    w.unmount()
  })
})

describe('NotesMarkdownEditor — onTransaction → emit("transaction")', () => {
  it('typing content triggers at least one "transaction" emit', async () => {
    const w = await mountEditor('x')
    const ed = getEditor(w)
    ed.chain().focus().insertContent('y').run()
    await nextTick()
    await flushPromises()
    const txEmits = w.emitted('transaction')
    expect(txEmits).toBeTruthy()
    expect(txEmits!.length).toBeGreaterThan(0)
    w.unmount()
  })
})

describe('NotesMarkdownEditor — onBeforeUnmount cleanup', () => {
  it('component unmount calls editor.destroy() exactly once', async () => {
    const w = await mountEditor('bye')
    const ed = getEditor(w)
    const spy = vi.spyOn(ed, 'destroy')
    w.unmount()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('NotesMarkdownEditor — K44: zero <style> block + gap ③ template zero bare color', () => {
  // Governance §9 gap ③ technique reuses FolderBrowser.test.ts / QueueView.test.ts current
  // style: read source via node:fs (not Vite `?raw`, CSSEnablerPlugin would turn style source
  // to empty string causing false pass).
  it('this file has no <style> block (style block blueprint :40-46, moved to knowledge.scss K44 top-level exception by T2)', () => {
    const src: string = readFileSync(resolve(__dirname, './NotesMarkdownEditor.vue'), 'utf8')
    expect(src).not.toMatch(/^<style/m)
  })

  it('<template> block (stripped of var()) contains no bare hex / rgb / hsl literals', () => {
    const src: string = readFileSync(resolve(__dirname, './NotesMarkdownEditor.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]
    // Coverage self-check: extracted segment must contain template start/end signatures
    expect(tmpl).toContain('class="nme"')
    expect(tmpl).toContain('nme-content')

    // Strip insides of var(...) (same technique as color-guard.test.ts stripVar: scan
    // character-by-character tracking paired bracket depth, support nested fallback) —
    // this template has no var()/color-mix() calls, function is no-op here, but keep
    // for convention matching other component tests' structure.
    function stripCalls(s: string, prefixes: string[]): string {
      let out = ''
      let i = 0
      while (i < s.length) {
        const hit = prefixes.find((p) => s.startsWith(p, i))
        if (hit) {
          let depth = 0
          let j = i + hit.length - 1
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') {
              depth--
              if (depth === 0) {
                j++
                break
              }
            }
          }
          i = j
        } else {
          out += s[i]
          i++
        }
      }
      return out
    }
    const scrubbed = stripCalls(tmpl, ['var(', 'color-mix('])
    expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })
})
