// Line-level LCS diff, aligned for a git-style side-by-side view.
// Ported 1:1 from Vue2 src/views/AI/Tasks/promptDiff.js.
//
// Each row is one visual line pair; `left`/`right` are strings, or null for
// the empty half of an unpaired del/add row. A run of deletions followed by
// a run of additions is zipped into 'change' rows (old left, new right),
// which is what makes the view read like a two-column git diff instead of
// two stacked blocks.

export interface DiffRow {
  left: string | null
  right: string | null
  type: 'same' | 'del' | 'add' | 'change'
}

export function diffLines(oldText: unknown, newText: unknown): DiffRow[] {
  const a = String(oldText == null ? '' : oldText).split('\n')
  const b = String(newText == null ? '' : newText).split('\n')
  const n = a.length
  const m = b.length

  // Prompts are capped server-side at 8000 chars, so the table stays tiny;
  // the guard only protects against a caller feeding something else in.
  if (n * m > 1_000_000) return [{ left: a.join('\n'), right: b.join('\n'), type: 'change' }]

  // dp[i][j] = LCS length of a[i:] vs b[j:]
  const dp: Uint16Array[] = []
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let dels: string[] = []
  let adds: string[] = []
  const flush = () => {
    const k = Math.max(dels.length, adds.length)
    for (let x = 0; x < k; x++) {
      const left = x < dels.length ? dels[x] : null
      const right = x < adds.length ? adds[x] : null
      rows.push({
        left,
        right,
        type: left !== null && right !== null ? 'change' : left !== null ? 'del' : 'add',
      })
    }
    dels = []
    adds = []
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush()
      rows.push({ left: a[i], right: b[j], type: 'same' })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      dels.push(a[i])
      i++
    } else {
      adds.push(b[j])
      j++
    }
  }
  while (i < n) {
    dels.push(a[i])
    i++
  }
  while (j < m) {
    adds.push(b[j])
    j++
  }
  flush()
  return rows
}
