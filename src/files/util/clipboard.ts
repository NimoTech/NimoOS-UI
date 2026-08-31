// Copy text to clipboard.
// navigator.clipboard is only available in secure contexts (HTTPS or localhost). When the
// device is accessed via plaintext HTTP over a local network IP (e.g. http://192.168.x.x/)
// it is undefined and direct calls will throw. Fall back to document.execCommand('copy').
// If both paths fail, throw so the caller can decide how to notify the user.
// Feedback from an earlier review — where should the temporary textarea be attached.
//
// Originally always attached to document.body, but **all copies in dialogs fail**
// (user test: copy on the AI settings page works, but all three copies in the "Create Token"
// dialog fail). Root cause is reka's focus trap
// (reka-ui/dist/FocusScope/FocusScope.js:57-62): DialogContent attaches focusin to **document**,
// and whenever focus falls outside the dialog container it `focus(lastFocusedElement, { select: true })`
// to steal it back — the textarea on body is exactly outside, so our select() selection is
// destroyed before execCommand('copy'). Attach the textarea inside the dialog container, then
// `container.contains(target)` is true and the trap no longer interferes.
//
// Order to find the host: ① the currently focused dialog (most accurate, the copy button
// is already in the dialog) ② the last **open** dialog in the document (for nested dialogs
// take the innermost; `data-state="open"` is from reka DialogContentImpl.js:86) ③ if neither,
// still body — the page copy path that always worked remains completely unchanged.
function copyHost(): HTMLElement {
  const focused = document.activeElement as HTMLElement | null
  const nearest = focused?.closest?.('[role="dialog"][data-state="open"]')
  if (nearest) return nearest as HTMLElement
  const open = document.querySelectorAll('[role="dialog"][data-state="open"]')
  if (open.length) return open[open.length - 1] as HTMLElement
  return document.body
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // May still fail in secure context due to permissions/focus/etc., try fallback method
    }
  }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.opacity = '0'
  ta.style.pointerEvents = 'none'
  const host = copyHost()
  // Return focus after copy: otherwise focus stays on a node that's about to be deleted,
  // and the dialog's FocusScope will reset focus to the dialog container itself due to
  // MutationObserver seeing the node disappear (user's button focus is unexpectedly lost).
  const prevFocus = document.activeElement as HTMLElement | null
  host.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    if (!document.execCommand('copy')) throw new Error('execCommand copy failed')
  } finally {
    host.removeChild(ta)
    if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus()
  }
}
