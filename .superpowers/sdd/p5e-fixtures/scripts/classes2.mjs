#!/usr/bin/env node
/* 附录 D §D.0/§D.1 —— 74 个模板 class token 的三态表(T0b:自取蓝本)。
 * 🔴 匹配口径:`\.<cls>(?![\w-])`,且只在「行内第一个 { 之前的选择器部分」匹配。
 *    不许用 \b —— k-hero 会被 k-hero-suggest 假命中(E-25 的坑)。 */
import { bp, BP_PATHS, nu, REPO } from './_inputs.mjs'

const bpScss = bp(BP_PATHS.scss)
const nuScss = nu('src/ai/styles/knowledge.scss')
const FILES = [['SearchView', BP_PATHS.searchView], ['FileDetailDrawer', BP_PATHS.fileDetailDrawer], ['KFileViewer', BP_PATHS.kFileViewer]]

const used = new Map()
for (const [label, p] of FILES) {
  const src = bp(p); const tpl = src.slice(0, src.indexOf('<script'))
  for (const m of tpl.matchAll(/\bclass="([^"]*)"/g))
    for (const tok of m[1].split(/\s+/).filter(Boolean)) used.set(tok, (used.get(tok) || new Set()).add(label))
}
function declaredIn(text, cls) {
  const re = new RegExp('\\.' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])')
  const out = []
  text.split('\n').forEach((line, i) => {
    const nc = line.replace(/\/\*.*?\*\//g, '').replace(/\/\*.*$/, '')
    const b = nc.indexOf('{')
    if (b >= 0 && re.test(nc.slice(0, b))) out.push(i + 1)
  })
  return out
}
const rows = [...used].sort().map(([cls, owners]) => {
  const bpl = declaredIn(bpScss, cls); const nul = declaredIn(nuScss, cls)
  return { cls, owners: [...owners], bpLines: bpl, nuLines: nul, state: nul.length ? 'ALREADY-MOVED' : (bpl.length ? 'TO-MOVE' : 'NO-RULE-EITHER-SIDE') }
})
const w = (s, n) => String(s).padEnd(n)
console.log(w('class', 24) + w('state', 22) + w('bp lines', 26) + w('New-UI lines', 16) + 'used by')
for (const r of rows) console.log(w(r.cls, 24) + w(r.state, 22) + w(r.bpLines.join(','), 26) + w(r.nuLines.join(','), 16) + r.owners.join(','))
const by = {}; for (const r of rows) (by[r.state] ||= []).push(r.cls)
console.log(`\n--- 合计 ${rows.length} 个 token ---`)
for (const [k, v] of Object.entries(by)) console.log(`${k}: ${v.length}\n    ${v.join(' ')}`)
console.log('\n🔴 注意:k-suggest-chip 会被判成 ALREADY-MOVED —— 本仓只有 :2198 那条后代覆盖、基类缺失,')
console.log('   实际是 HALF-MOVED(E-52)。选择器级的扫描器分不出这个,见附录 D §D.4。')
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1))
