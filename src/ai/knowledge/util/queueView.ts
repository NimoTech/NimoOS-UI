// SP8-P5b Task 4 —— 1:1 ported from Vue2
// `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/QueueView.vue:393-404`.
//
// These three functions (`distillIconState`/`basename`/`dirname`) from methods are pure
// display helpers, extracted early and tested thoroughly before T5 (which moves `QueueView.vue`
// wholesale), so T5's component tests don't re-cover these branches. Same-section `fmtAgo`
// (`:405-414`) doesn't extract here —— T5 directly `import { fmtAgo } from '../stores/knowledgeStore'`
// (equivalent implementation already in store, from P5a, K11).
//
// Below are three original "quirky behaviors"; K12 explicitly requires verbatim copying,
// no "while fixing that":
//   1. distillIconState: failed and skipped share same 'failed' return
//      (original comment verbatim `// failed + skipped share the same danger tone`),
//      unknown/default status also lands 'failed' (not 'pending').
//   2. basename: empty values (including falsy '', null, undefined) return U+2014 em dash '—',
//      not hyphen '-'.
//   3. dirname: returns '/' + parts.join('/') + '/', so single-segment path (no '/')
//      after parts = [] becomes '//'; empty path takes !p branch returning ''.
//      These are original `:399-404` behavior, copy verbatim.

/** Original :393-397 —— failed and skipped share danger color, unknown status also lands 'failed'. */
export function distillIconState(
  row: { status?: string },
): 'pending' | 'running' | 'failed' {
  if (row.status === 'pending') return 'pending'
  if (row.status === 'running') return 'running'
  return 'failed' // failed + skipped share the same danger tone —— original :396 verbatim comment, copied
}

/** Original :398 —— empty (falsy) returns U+2014 em dash '—', not hyphen '-'. */
export function basename(p: string | null | undefined): string {
  return p ? p.split('/').filter(Boolean).pop() || p : '—'
}

/**
 * Original :399-404 —— empty path returns ''; single-segment path (no '/') after
 * filter(Boolean) has empty parts array, concatenation yields '//'. Both are original
 * behavior, copy verbatim.
 */
export function dirname(p: string | null | undefined): string {
  if (!p) return ''
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/') + '/'
}
