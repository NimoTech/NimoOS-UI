// OSC 52 ("set clipboard") payload decoding.
//
// The terminal runs inside tmux with `mouse on`, so a mouse drag is tmux's
// selection, not xterm's: on release tmux copies into its buffer and — with
// `set-clipboard on` and the outer TERM advertising the clipboard feature
// (tmux ≥3.2 grants it to xterm* by default) — emits `ESC ] 52 ; c ; <base64> BEL`
// to the outer terminal. xterm.js ignores that sequence unless someone
// registers a handler, which TerminalView does via `term.parser.registerOscHandler(52, …)`.
// The handler receives everything after "52;" — i.e. "c;<base64>".

/** Decode an OSC 52 payload ("<sel>;<base64>") into text; null when it is a
 *  query ("?"), empty, or not valid base64 — callers then do nothing. */
export function decodeOsc52(data: string): string | null {
  const sep = data.indexOf(';')
  const b64 = sep === -1 ? '' : data.slice(sep + 1)
  if (!b64 || b64 === '?') return null
  let bin: string
  try { bin = atob(b64) } catch { return null }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  const text = new TextDecoder('utf-8').decode(bytes)
  return text || null
}

export interface XtermLike {
  getSelection(): string
  focus(): void
  parser?: { registerOscHandler(ident: number, cb: (data: string) => boolean | Promise<boolean>): { dispose(): void } }
}

/** Write text to the clipboard from inside the terminal iframe's document.
 *  navigator.clipboard only exists in secure contexts; NimoOS is served over
 *  plaintext HTTP on the LAN, so fall back to execCommand('copy') on a
 *  temporary textarea in `doc` — the document that holds the user's
 *  activation (the mouseup happened there), which execCommand requires. */
export async function writeClipboard(text: string, doc: Document): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return } catch { /* fall through to execCommand */ }
  }
  const ta = doc.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  const host = doc.body ?? doc.documentElement
  host.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    if (!doc.execCommand('copy')) throw new Error('execCommand copy failed')
  } finally {
    host.removeChild(ta)
  }
}
