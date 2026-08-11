import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FileConflictDialog from './FileConflictDialog.vue'
import { i18n } from '../../i18n'

// reka-ui teleports DialogContent to <body> asynchronously (Presence); one
// tick is enough for it to land in jsdom (same pattern as Dialog.test.ts /
// NewItemDialog.test.ts). `open()` awaits that tick so every caller sees the
// teleported markup, and each mount (attachTo: document.body) leaves its
// markup behind rather than tearing it down, so clear <body> between tests.
async function open(props: Record<string, unknown> = {}) {
  const w = mount(FileConflictDialog, {
    props: { open: true, name: 'a.txt', targetPath: '/DATA/Documents', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await nextTick()
  return w
}
const btn = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

afterEach(() => { document.body.innerHTML = '' })

describe('FileConflictDialog', () => {
  it('shows the conflicting name and its target directory', async () => {
    await open()
    expect(document.body.textContent).toContain('a.txt')
    expect(document.body.textContent).toContain('/DATA/Documents')
  })

  it('emits the chosen action', async () => {
    const w = await open()
    btn('覆盖')!.click()
    await w.vm.$nextTick()
    expect(w.emitted('choose')![0]).toEqual([{ action: 'overwrite', applyToAll: false }])
  })

  it('offers keep both and skip for a plain file conflict, and no merge', async () => {
    await open()
    expect(btn('保留两者')).toBeTruthy()
    expect(btn('跳过')).toBeTruthy()
    expect(btn('合并')).toBeFalsy()
  })

  it('disables Overwrite for a directory conflict and explains why', async () => {
    await open({ isDir: true })
    expect((btn('覆盖') as HTMLButtonElement).disabled).toBe(true)
    expect(document.body.textContent).toContain('文件夹不支持覆盖')
  })

  // The why-disabled hint must be a CSS tooltip that shows the instant the
  // pointer arrives: the native title needs a ~1s motionless hover (and never
  // shows on touch), which read as "no tooltip at all" during acceptance. The
  // hint rides a wrapper span because a disabled button swallows its own
  // pointer interactions.
  it('carries the instant why-disabled tip for a directory conflict', async () => {
    await open({ isDir: true, allowMerge: true })
    const wrap = document.body.querySelector('.fc-tip-wrap')
    expect(wrap?.getAttribute('data-tip')).toBe('文件夹不支持覆盖')
    expect(btn('覆盖')!.getAttribute('title')).toBeNull()
  })

  it('carries no tip when Overwrite is enabled (plain file conflict)', async () => {
    await open()
    expect(document.body.querySelector('.fc-tip-wrap')?.getAttribute('data-tip') ?? null).toBeNull()
  })

  it('a programmatic overwrite on a directory conflict emits nothing', async () => {
    const w = await open({ isDir: true })
    ;(w.vm as unknown as { choose: (a: string) => void }).choose('overwrite')
    await w.vm.$nextTick()
    expect(w.emitted('choose')).toBeUndefined()
  })

  it('shows Merge only when allowMerge AND isDir are both true', async () => {
    await open({ isDir: true, allowMerge: true })
    expect(btn('合并')).toBeTruthy()
    document.body.innerHTML = ''
    await open({ isDir: false, allowMerge: true })
    expect(btn('合并')).toBeFalsy()
  })

  it('a programmatic merge without allowMerge emits nothing', async () => {
    const w = await open({ isDir: true, allowMerge: false })
    ;(w.vm as unknown as { choose: (a: string) => void }).choose('merge')
    await w.vm.$nextTick()
    expect(w.emitted('choose')).toBeUndefined()
  })

  it('hides the queue position and apply-to-all for a single conflict', async () => {
    await open({ queueIndex: 0, queueTotal: 1 })
    expect(document.body.textContent).not.toContain('共 1 项')
    expect(document.body.querySelector('input[type="checkbox"]')).toBeFalsy()
  })

  it('shows a 1-based queue position for a multi-conflict queue', async () => {
    await open({ queueIndex: 1, queueTotal: 3 })
    expect(document.body.textContent).toContain('第 2 项，共 3 项')
  })

  it('carries applyToAll through with the chosen action', async () => {
    const w = await open({ queueTotal: 2 })
    const cb = document.body.querySelector('input[type="checkbox"]') as HTMLInputElement
    cb.click()
    await w.vm.$nextTick()
    btn('跳过')!.click()
    await w.vm.$nextTick()
    expect(w.emitted('choose')![0]).toEqual([{ action: 'skip', applyToAll: true }])
  })

  it('resets applyToAll every time it reopens', async () => {
    const w = await open({ queueTotal: 2 })
    ;(document.body.querySelector('input[type="checkbox"]') as HTMLInputElement).click()
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    btn('跳过')!.click()
    await w.vm.$nextTick()
    // tsconfig `lib` is ES2020 (no Array.prototype.at) — index from the end manually.
    const chooseEvents = w.emitted('choose')
    expect(chooseEvents?.[(chooseEvents?.length ?? 1) - 1]).toEqual([{ action: 'skip', applyToAll: false }])
  })

  it('closing the dialog emits cancel', async () => {
    const w = await open()
    await w.findComponent({ name: 'Dialog' }).vm.$emit('update:open', false)
    expect(w.emitted('cancel')).toBeTruthy()
  })
})
