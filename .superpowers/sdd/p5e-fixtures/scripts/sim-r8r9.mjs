#!/usr/bin/env node
/* 附录 D §D.7 —— WHITELIST / NON_K_HELPER_CLASSES 的本期终值模拟(R8/R9)。
 * T0b:自取蓝本(git show 7a6ee6b7:),不再依赖 /tmp 里的副本。
 *
 * 方法:本仓 knowledge.scss 现状 -> stripComments -> 追加附录 D §D.2 的 6 段 + KFileViewer 净段
 *      -> 跑 knowledgeStyles.test.ts 里那两段**逐字复制**出来的逻辑。
 * 🔴 不用 p5d-gen-r8r9-sim.mjs(它硬编码旧常量名、跑起来会抛)。
 * 期望输出:292 -> 347(常量 293 -> 348)· NON_K 16 -> 19(+ chev / path / h-md)。 */
import fs from 'node:fs'
import path from 'node:path'
import { bp, BP_PATHS, nu, stripComments, REPO } from './_inputs.mjs'

const NU_REL = 'src/ai/styles/knowledge.scss'
const curRaw = nu(NU_REL)
const cur = stripComments(curRaw)

// 🔴 基线守卫:T2 一旦把本期段落搬进去,下面的「追加」就会双算。
const MOVED = ['k-rcard-tag', 'k-drawer-bg', 'k-search-sticky'].filter((c) => new RegExp(`\\.${c}(?![\\w-])`).test(cur))
if (MOVED.length) {
  console.log(`🔴 警告:本仓 ${NU_REL} 里已出现本期类(${MOVED.join(', ')})—— T2 已经搬过了。`)
  console.log('   下面的「追加后」数字会双算,无效。要复现 T0 的基线请对 T2 之前的版本跑:')
  console.log(`   git -C ${REPO} show <T2之前的sha>:${NU_REL} > /tmp/pre-t2.scss  然后 P5E_SCSS=/tmp/pre-t2.scss node sim-r8r9.mjs`)
}
const baseRaw = process.env.P5E_SCSS ? fs.readFileSync(process.env.P5E_SCSS, 'utf8') : curRaw
const base = stripComments(baseRaw)

const scss = bp(BP_PATHS.scss).split('\n')
const kfv = bp(BP_PATHS.kFileViewer).split('\n')
const seg = (a, b) => scss.slice(a - 1, b).join('\n')
// 🔴 Minor-3:KFileViewer 的 <style> 净段 = :71-76 + :102-119(:102 是 .k-fileviewer-host 的闭合 })
const kfvStyle = [...kfv.slice(70, 76), ...kfv.slice(101, 119)].join('\n')

export const MOVE = [
  ['S1  351-367   .k-hero-suggest + .k-suggest-chip 基类(E-52)', seg(351, 367)],
  ['S2  457-549   Search page: sticky/box/clear/adv-*', seg(457, 549)],
  ['S3  573-681   results: k-results … k-rerank-warn', seg(573, 681)],
  ['S4  726-732   .k-skel-rcard', seg(726, 732)],
  ['S5  1540-1563 keyframes + k-match-pill + k-more-hint', seg(1540, 1563)],
  ['S6  1571-1673 k-drawer* / k-chunk* / @media', seg(1571, 1673)],
  ['KF  KFileViewer.vue:71-76 + :102-119(K46 砍 :77-101)', kfvStyle],
]
const added = stripComments(MOVE.map(([, t]) => t).join('\n'))
const sim = base + '\n.knowledge-app {\n' + added + '\n}\n'

/* ---- 以下两段从 src/ai/styles/knowledgeStyles.test.ts 逐字复制 ---- */
const NEW_RE = /\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g
function nonKClassNames(text) {
  const found = new Set([...text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))
  return [...found].filter((c) =>
    !/^k(?:2|n)?-/.test(c) && !/^fb(?:-|$)/.test(c) &&
    c !== 'knowledge-app' && c !== 'parser-app' && c !== 'nme-content' && c !== 'ProseMirror').sort()
}
/* ---------------------------------------------------------------- */
const hits = (t) => [...new Set((t.match(NEW_RE) || []).map((s) => s.slice(1)))].sort()

console.log('\n段清单:'); MOVE.forEach(([n, t]) => console.log(`  ${n}   ${t.split('\n').length} 行`))
const before = hits(base); const after = hits(sim)
console.log('\n=== 「没有搬多」白名单正则 ===')
console.log(`现状        : ${before.length} 类`)
console.log(`追加 P5e 后 : ${after.length} 类`)
const added2 = after.filter((c) => !before.includes(c))
console.log(`新增 ${added2.length} 个:\n   ${added2.join(' ')}`)
const lost = before.filter((c) => !after.includes(c))
console.log(`丢失(必须为空): ${lost.length ? lost.join(' ') : '(none)'}`)

// 白名单常量长度
const tsrc = nu('src/ai/styles/knowledgeStyles.test.ts')
const m = tsrc.match(/const WHITELIST_(\d+) = \[([\s\S]*?)\n\]/)
const constName = m ? `WHITELIST_${m[1]}` : '(未找到)'
const items = m ? [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []
const addToConst = added2.filter((c) => !items.includes(c))
console.log(`\n常量 ${constName} 现长度 ${items.length};其中已含本期新类 ${added2.length - addToConst.length} 个`)
console.log(`=> 常量终值 = ${items.length} + ${addToConst.length} = ${items.length + addToConst.length}`)

const nkB = nonKClassNames(base); const nkA = nonKClassNames(sim)
console.log('\n=== NON_K_HELPER_CLASSES ===')
console.log(`现状 ${nkB.length}: ${JSON.stringify(nkB)}`)
console.log(`追加后 ${nkA.length}: ${JSON.stringify(nkA)}`)
console.log(`新增: ${JSON.stringify(nkA.filter((c) => !nkB.includes(c)))}`)
console.log(`=> NON_K_HELPER_CLASSES 终值 = ${nkA.length}`)
