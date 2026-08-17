import { describe, it, expect, afterEach, vi } from 'vitest'
import { copyText } from './clipboard'

describe('copyText', () => {
  const origClipboard = (navigator as unknown as { clipboard: unknown }).clipboard
  const origExec = document.execCommand

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, configurable: true, writable: true })
    document.execCommand = origExec
    vi.restoreAllMocks()
  })

  it('uses navigator.clipboard.writeText in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await copyText('/NimoOS-HD/a')
    expect(writeText).toHaveBeenCalledWith('/NimoOS-HD/a')
  })

  it('falls back to execCommand when navigator.clipboard is undefined (insecure HTTP context)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    let copied = ''
    document.execCommand = vi.fn(() => {
      copied = document.querySelector('textarea')?.value ?? ''
      return true
    }) as typeof document.execCommand
    await copyText('/NimoOS-HD/Gallery/x.jpg')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(copied).toBe('/NimoOS-HD/Gallery/x.jpg')
    // temporary textarea is cleaned up afterwards
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back to execCommand when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    document.execCommand = vi.fn(() => true) as typeof document.execCommand
    await copyText('abc')
    expect(writeText).toHaveBeenCalled()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('throws when both clipboard API and execCommand fail (so the caller can surface an error)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => false) as typeof document.execCommand
    await expect(copyText('x')).rejects.toThrow()
  })
})

// SP8-P2b round 4 acceptance, 2026-07-30 — user test: copy on the AI settings **page**
// works, but all three copy buttons in the **"Create Token" dialog** fail
// (clipboard is empty).
//
// Root cause is hardcoded in reka source (reka-ui/dist/FocusScope/FocusScope.js:57-62):
// DialogContent's FocusScope (trapped) has a focusin listener on **document** —
//     if (container.contains(target)) lastFocusedElementRef.value = target
//     else focus(lastFocusedElementRef.value, { select: true })
// Fallback workaround: append temporary <textarea> to document.body and focus() it, but
// this textarea is NOT inside the dialog container → focus is **immediately stolen back**
// by the previous focused element in the dialog, and `{select: true}` also selects that
// element's text → the selection we just did with ta.select() is destroyed before
// execCommand('copy') → nothing to copy.
// Copy on the page works because there is no dialog and no FocusScope, so it's always
// been fine — matches user's observation perfectly.
//
// Fix: append temporary textarea **inside the currently open dialog container**
// (role="dialog"), so that `container.contains(target)` is true and the focus trap
// no longer interferes.
describe('copyText — fallback path inside dialog (focus trap)', () => {
  const origClipboard = (navigator as unknown as { clipboard: unknown }).clipboard
  const origExec = document.execCommand

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, configurable: true, writable: true })
    document.execCommand = origExec
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('when dialog is open and focus is inside, append temporary textarea into dialog container (not body)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    const btn = document.createElement('button')
    dialog.appendChild(btn)
    document.body.appendChild(dialog)
    btn.focus()

    let parentAtCopyTime: Element | null = null
    let copied = ''
    document.execCommand = vi.fn(() => {
      const ta = document.querySelector('textarea')
      parentAtCopyTime = ta?.parentElement ?? null
      copied = ta?.value ?? ''
      return true
    }) as typeof document.execCommand

    await copyText('mcp-token-abc')
    expect(copied).toBe('mcp-token-abc')
    expect(parentAtCopyTime).toBe(dialog) // key: inside dialog, not body
    expect(document.querySelector('textarea')).toBeNull() // clean up after use
  })

  it('when focus is not inside dialog (e.g., button didn\'t get focus from click), still find the open dialog, take the last one (nested dialogs)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const outer = document.createElement('div')
    outer.setAttribute('role', 'dialog')
    outer.setAttribute('data-state', 'open')
    const inner = document.createElement('div')
    inner.setAttribute('role', 'dialog')
    inner.setAttribute('data-state', 'open')
    document.body.append(outer, inner)

    let parentAtCopyTime: Element | null = null
    document.execCommand = vi.fn(() => {
      parentAtCopyTime = document.querySelector('textarea')?.parentElement ?? null
      return true
    }) as typeof document.execCommand

    await copyText('x')
    expect(parentAtCopyTime).toBe(inner)
  })

  it('closed dialogs don\'t count (when data-state=closed, still append to body)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'closed')
    document.body.appendChild(dialog)

    let parentAtCopyTime: Element | null = null
    document.execCommand = vi.fn(() => {
      parentAtCopyTime = document.querySelector('textarea')?.parentElement ?? null
      return true
    }) as typeof document.execCommand

    await copyText('x')
    expect(parentAtCopyTime).toBe(document.body)
  })

  it('when no dialog: behavior unchanged, still append to body (copy on page path unaffected)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    let parentAtCopyTime: Element | null = null
    document.execCommand = vi.fn(() => {
      parentAtCopyTime = document.querySelector('textarea')?.parentElement ?? null
      return true
    }) as typeof document.execCommand

    await copyText('x')
    expect(parentAtCopyTime).toBe(document.body)
  })

  it('after copy, return focus to original element (do not leave user focus on a deleted node)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    const btn = document.createElement('button')
    dialog.appendChild(btn)
    document.body.appendChild(dialog)
    btn.focus()
    document.execCommand = vi.fn(() => true) as typeof document.execCommand

    await copyText('x')
    expect(document.activeElement).toBe(btn)
  })
})
