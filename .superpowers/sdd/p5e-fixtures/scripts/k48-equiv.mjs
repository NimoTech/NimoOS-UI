/* K48 equivalence proof.
 * A = verbatim transliteration of SearchView.vue:317-345   (7a6ee6b7)
 * B = verbatim transliteration of FileDetailDrawer.vue:199-217 (7a6ee6b7)
 * $t is replaced by an identity stub in BOTH so the comparison isolates logic.
 */
const $t = (s) => `T<${s}>`

// ---------- A : SearchView.vue :317-345 ----------
const A = {
  relLevel(s) {
    if (s >= 0.65) return 'high'
    if (s >= 0.50) return 'mid'
    return 'low'
  },
  relLabel(s) {
    if (s >= 0.65) return $t('High')
    if (s >= 0.50) return $t('Mid')
    return $t('Low')
  },
  highlight(text, query) {
    if (!text) return ''
    const esc = String(text).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
    const terms = String(query).trim().split(/\s+/).filter(s => s.length >= 1)
    if (!terms.length) return esc
    let out = esc
    for (const term of terms) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      out = out.replace(new RegExp(safe, 'gi'), m => `<mark>${m}</mark>`)
    }
    return out
  },
  fmtMtime(ms) {
    if (!ms) return '—'
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },
}

// ---------- B : FileDetailDrawer.vue :199-217 ----------
const B = {
  relLevel(s) { return s >= 0.65 ? 'high' : s >= 0.5 ? 'mid' : 'low' },
  relLabel(s) { return s >= 0.65 ? $t('High') : s >= 0.5 ? $t('Mid') : $t('Low') },
  fmtMtime(ms) {
    if (!ms) return '—'
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  },
  highlight(text, query) {
    if (!text) return ''
    const esc = String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    const terms = String(query).trim().split(/\s+/).filter(s => s.length >= 1)
    if (!terms.length) return esc
    let out = esc
    for (const term of terms) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      out = out.replace(new RegExp(safe, 'gi'), m => `<mark>${m}</mark>`)
    }
    return out
  },
}

let fails = 0, checks = 0
function eq(fn, args) {
  checks++
  let ra, rb
  try { ra = JSON.stringify(A[fn](...args)) } catch (e) { ra = 'THROW:' + e.message }
  try { rb = JSON.stringify(B[fn](...args)) } catch (e) { rb = 'THROW:' + e.message }
  if (ra !== rb) { fails++; console.log(`  MISMATCH ${fn}(${JSON.stringify(args)}) A=${ra} B=${rb}`) }
  return ra
}

// --- relLevel / relLabel : threshold boundaries both sides ---
const scores = [ -1, -0.0001, 0, 0.0001, 0.1, 0.4999, 0.5-Number.EPSILON, 0.5, 0.5000001, 0.6, 0.6499, 0.65-Number.EPSILON, 0.65, 0.6500001, 0.7, 1, 1.5,
                 NaN, Infinity, -Infinity, null, undefined, '0.7', '0.4', '', true, false ]
console.log('# relLevel / relLabel over %d inputs (incl. NaN/Infinity/null/undefined/string/bool)', scores.length)
for (const s of scores) { eq('relLevel', [s]); eq('relLabel', [s]) }

// --- fmtMtime ---
const mss = [ 0, null, undefined, NaN, '', false, 1, 1784404128499, 1785413747017, 1000000000000,
              -1, 1.5, Date.UTC(2026,0,1), Date.UTC(1999,11,31,23,59,59), 8.64e15, '1784404128499' ]
console.log('# fmtMtime over %d inputs', mss.length)
for (const m of mss) eq('fmtMtime', [m])

// --- highlight : escaping / multi-term / empty / regex metachars / XSS / unicode ---
const texts = [ '', null, undefined, 0, false,
  'plain text',
  'a & b < c > d " e',
  '<script>alert(1)</script>',
  '<img src=x onerror=1>',
  'Cost is $5 (approx.) [see 1+1=2]',
  'MiXeD CaSe match Match MATCH',
  '甲状腺 结节 报告',
  'aaa', 'abcabcabc',
  'mark <mark>already</mark> here',
  'tab\tand\nnewline',
]
const queries = [ '', '   ', null, undefined, 'a', 'A', 'match', 'a b', '  a   b  ', '&', '<', '"',
  '$5', '(approx.)', '[see', '1+1', '.*', '\\', '^a', 'a$', 'a|b', 'a?', 'a{1}', '甲状腺',
  'script', 'onerror', 'mark', 'aaa', 'abc' ]
console.log('# highlight over %d × %d = %d combos', texts.length, queries.length, texts.length*queries.length)
for (const t of texts) for (const q of queries) eq('highlight', [t, q])

console.log(`\nRESULT: ${checks} comparisons, ${fails} mismatches → ${fails===0 ? 'EQUIVALENT ✅' : 'NOT EQUIVALENT ❌'}`)

// spot-check that the XSS escape really happens (K49 premise)
console.log('\nK49 premise spot-check:')
console.log('  highlight("<script>alert(1)</script>", "script") =', A.highlight('<script>alert(1)</script>','script'))
console.log('  highlight("<img src=x onerror=1>", "img")        =', A.highlight('<img src=x onerror=1>','img'))
console.log('\nrelLevel/relLabel on real device score range:')
for (const s of [0.738, 0.734, 0.60, 0.4824, 0.4666]) console.log(`  score=${s} -> ${A.relLevel(s)} / ${A.relLabel(s)}`)
