import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import AddSkillModal from './AddSkillModal.vue'
import { SKILL_COLOR_IDS } from './SkillTile.vue'

// SP8-P3b Task 5 — tests for AddSkillModal.vue. Mounting technique matches
// ChannelsSection.test.ts / SkModal.test.ts: SkModal's DialogPortal defaults to portaling into
// '.set-app', and the target element must already exist in the DOM before the component mounts.
//
// File.prototype.text doesn't exist in jsdom (verified, see the task report); the brief allows
// "mock it if unavailable" — instead of constructing a real File here, we directly feed the
// <input type="file"> element's files property a "good-enough fake FileList" (a plain array of
// objects with name/size/text(); the array itself is iterable, and Array.from() is all the
// component needs), overriding the read-only .files via Object.defineProperty.

function withHost() {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountModal(props: Partial<{ open: boolean; saving: boolean; serverError: string }> = {}) {
  return mount(AddSkillModal, {
    props: { open: true, saving: false, serverError: '', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
// The component's open-state focus uses setTimeout(fn, 0) (a macrotask) to override reka's
// default mount-auto-focus (see the component header comment "reka initial focus test finding"),
// a purely microtask-level flush() can't catch up to it — a real macrotask actually needs to run.
const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }

function nameInput() {
  return document.querySelector('.sk-modal .sk-field:nth-of-type(1) input') as HTMLInputElement
}
function descInput() {
  return document.querySelector('.sk-modal .sk-field:nth-of-type(2) textarea') as HTMLTextAreaElement
}
function submitBtn() {
  return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement
}
function fileInput() {
  return document.querySelector('.sk-modal input[type="file"]') as HTMLInputElement
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  el.value = v
  el.dispatchEvent(new Event('input'))
}

function pickFiles(files: Array<{ name: string; size: number; text: () => Promise<string> }>) {
  Object.defineProperty(fileInput(), 'files', { value: files, configurable: true })
  fileInput().dispatchEvent(new Event('change'))
}

beforeEach(() => { withHost() })
afterEach(() => { document.body.innerHTML = '' })

describe('AddSkillModal', () => {
  it('create button only enables once both fields are non-empty', async () => {
    mountModal()
    await macroFlush()
    expect(submitBtn().disabled).toBe(true) // both fields empty

    setValue(nameInput(), 'invoice-tagger')
    await flush()
    expect(submitBtn().disabled).toBe(true) // only name filled in

    setValue(descInput(), '标记发票')
    await flush()
    expect(submitBtn().disabled).toBe(false) // both fields non-empty

    setValue(nameInput(), '   ')
    await flush()
    expect(submitBtn().disabled).toBe(true) // name reverted to pure whitespace
  })

  it('submitted payload is field-by-field correct: title===name, scripts path prefixed with scripts/, examples: []', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), 'invoice-tagger')
    setValue(descInput(), 'Tags invoices automatically')
    await flush()

    pickFiles([{ name: 'run.py', size: 100, text: async () => 'print(1)' }])
    await flush()

    submitBtn().click()
    await flush()

    expect(w.emitted('save')).toHaveLength(1)
    expect(w.emitted('save')![0][0]).toEqual({
      name: 'invoice-tagger',
      title: 'invoice-tagger',
      description: 'Tags invoices automatically',
      trigger: 'auto',
      color: 'blue',
      md: '',
      examples: [],
      scripts: [{ path: 'scripts/run.py', content: 'print(1)' }],
    })
  })

  // [P3b final review C1] This case previously used 'Invoice_Tagger' as the "invalid name"
  // example — but the backend runs `slugify(name)` before validating (skills_store.go:221), and
  // 'Invoice_Tagger' slugs to the valid 'invoice-tagger', so both the backend and Vue2 can create
  // it successfully — it's not actually an invalid example (pinning this case as "invalid" would
  // encode the C1 regression right back into the assertion). Swapped in a genuinely invalid input
  // that is still empty after slugify (pure Chinese, with no [a-z0-9] characters that could survive).
  it('name invalid (still no legal characters after slugify, e.g. pure Chinese) → inline error (aiSkErrNameNoAlnum) and no save emitted (pins deviation 2)', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), '仅中文技能名')
    setValue(descInput(), '合法描述')
    await flush()
    // valid only checks that both fields are non-empty, no format validation — the button should be clickable at this point
    expect(submitBtn().disabled).toBe(false)

    submitBtn().click()
    await flush()

    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.getAttribute('role')).toBe('alert')
    expect(err.textContent).toBe(zh.aiSkErrNameNoAlnum)
    expect(w.emitted('save')).toBeUndefined()
  })

  // [P3b final review C1, supplementary case] A name like 'Invoice_Tagger' — "looks invalid but
  // legal after slugify" — must be able to create successfully: the name/title in the payload
  // are still the original trimmed input (the backend slugifies again itself to generate the
  // id), the frontend does not rewrite the user's input.
  it('name contains uppercase/underscore but is legal after slugify (e.g. "Invoice_Tagger") → validation passes, save emitted normally', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), 'Invoice_Tagger')
    setValue(descInput(), '合法描述')
    await flush()

    submitBtn().click()
    await flush()

    expect(document.querySelector('.sk-modal .sk-field-err')).toBeNull()
    expect(w.emitted('save')).toHaveLength(1)
    expect(w.emitted('save')![0][0]).toMatchObject({ name: 'Invoice_Tagger', title: 'Invoice_Tagger' })
  })

  it('description over 256 Unicode code points → inline error (aiSkErrDescTooLong) and no save emitted', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), 'invoice-tagger')
    setValue(descInput(), 'a'.repeat(257))
    await flush()

    submitBtn().click()
    await flush()

    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
    expect(err.textContent).toBe(zh.aiSkErrDescTooLong)
    expect(w.emitted('save')).toBeUndefined()
  })

  it('7 color dots render, data-color order matches SKILL_COLOR_IDS; click toggles data-active; zero inline colors (pins deviation 1)', async () => {
    mountModal()
    await macroFlush()
    const dots = Array.from(document.querySelectorAll('.sk-modal .sk-color-dot')) as HTMLElement[]
    expect(dots).toHaveLength(7)
    expect(dots.map((d) => d.dataset.color)).toEqual([...SKILL_COLOR_IDS])
    expect(dots[0].dataset.active).toBe('true') // default color: 'blue' = the first id
    // Pins deviation 1: no color dot may carry an inline style (Vue2 :61 is :style="{ background: c.bg }")
    dots.forEach((d) => expect(d.getAttribute('style')).toBeNull())

    dots[3].click()
    await nextTick()
    expect(dots[3].dataset.active).toBe('true')
    expect(dots[0].dataset.active).toBe('false')
  })

  it('the three trigger options toggle mutually exclusively', async () => {
    mountModal()
    await macroFlush()
    const opts = Array.from(document.querySelectorAll('.sk-modal .sk-trig-option')) as HTMLElement[]
    expect(opts).toHaveLength(3)
    expect(opts[0].dataset.active).toBe('true') // default trigger: 'auto'

    opts[1].click()
    await nextTick()
    expect(opts[1].dataset.active).toBe('true')
    expect(opts[0].dataset.active).toBe('false')
    expect(opts[2].dataset.active).toBe('false')

    opts[2].click()
    await nextTick()
    expect(opts[2].dataset.active).toBe('true')
    expect(opts[1].dataset.active).toBe('false')
  })

  it('files >1 MiB are skipped with an inline hint shown; files ≤1 MiB are read in normally (pins deviation 3)', async () => {
    mountModal()
    await macroFlush()
    pickFiles([
      { name: 'small.py', size: 100, text: async () => 'print(1)' },
      { name: 'big.bin', size: 1024 * 1024 + 1, text: async () => 'should-not-be-read' },
    ])
    await flush()

    expect(document.body.textContent).toContain('small.py')
    expect(document.body.textContent).not.toContain('big.bin')
    const expectedHint = zh.aiSkFilesSkippedTooBig.replace('{n}', '1')
    expect(document.body.textContent).toContain(expectedHint)
  })

  it('a file exactly 1 MiB in size does not count as over the limit (boundary: only skipped when size > 1024*1024)', async () => {
    mountModal()
    await macroFlush()
    pickFiles([{ name: 'exact.bin', size: 1024 * 1024, text: async () => 'ok' }])
    await flush()
    expect(document.body.textContent).toContain('exact.bin')
    expect(document.body.textContent).not.toContain(zh.aiSkFilesSkippedTooBig.replace('{n}', '1'))
  })

  it('when saving is true, the button text changes to "Creating…" and is disabled', async () => {
    mountModal({ saving: true })
    await macroFlush()
    setValue(nameInput(), 'foo')
    setValue(descInput(), 'bar')
    await flush()
    expect(submitBtn().disabled).toBe(true)
    expect(submitBtn().textContent).toContain(zh.aiSkCreating)
  })

  it('when serverError is non-empty, it displays in the inline error slot', async () => {
    mountModal({ serverError: zh.aiSkErrDuplicate })
    await macroFlush()
    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.textContent).toBe(zh.aiSkErrDuplicate)
  })

  // Regression guard for the reka initial-focus test finding: see the component header comment —
  // by default FocusScope grabs .sk-x, this pins down that the explicit override really does
  // land focus on the name input.
  it('on open, focus ends up on the name input (overrides reka\'s default focus on the .sk-x close button)', async () => {
    mountModal()
    await macroFlush()
    expect(document.activeElement).toBe(nameInput())
  })

  it('reopening after close: form resets to initial values (component is persistent, unlike Vue2 where every open is a fresh instance)', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), 'foo')
    setValue(descInput(), 'bar')
    await flush()

    await w.setProps({ open: false })
    await flush()
    await w.setProps({ open: true })
    await macroFlush()

    expect(nameInput().value).toBe('')
    expect(descInput().value).toBe('')
  })

  it('cancel button emits update:open(false), no save emitted', async () => {
    const w = mountModal()
    await macroFlush()
    const cancelBtn = Array.from(document.querySelectorAll('.sk-modal-foot .sk-btn.ghost'))
      .find((b) => b.textContent?.trim() === zh.aiCancel) as HTMLButtonElement
    expect(cancelBtn).toBeTruthy()
    cancelBtn.click()
    await flush()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('save')).toBeUndefined()
  })
})
