/* P5e T0 simulation of the T2 whitelist / NON_K_HELPER_CLASSES terminal values.
 * Method: current New-UI knowledge.scss  +  the P5e blueprint move-set (raw),
 * then run the REAL scanning logic copied verbatim from knowledgeStyles.test.ts. */
import fs from 'node:fs'
const NU = '/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/styles/knowledge.scss'
const stripComments=(c)=>c.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^[ \t]*\/\/.*$/gm,'')
const cur = stripComments(fs.readFileSync(NU, 'utf8'))
const bp = fs.readFileSync('knowledge.scss', 'utf8').split('\n')
const seg = (a, b) => bp.slice(a - 1, b).join('\n')
// KFileViewer <style scoped> minus K46's ::v-deep block (:77-101)
const kfv = fs.readFileSync('KFileViewer.vue','utf8').split('\n')
const kfvStyle = [...kfv.slice(70, 76), ...kfv.slice(101, 119)].join('\n')   // :71-76 + :102-119

const MOVE = [
  ['351-367  .k-hero-suggest + .k-suggest-chip (base, E-52)', seg(351, 367)],
  ['457-549  Search page: sticky / box / clear / adv-*',        seg(457, 549)],
  ['573-681  results: k-results … k-rerank-warn',              seg(573, 681)],
  ['726-732  .k-skel-rcard',                                    seg(726, 732)],
  ['1540-1563 keyframes + k-match-pill + k-more-hint',          seg(1540, 1563)],
  ['1571-1673 k-drawer* / k-chunk* / media query',              seg(1571, 1673)],
  ['KFileViewer <style> minus K46 :77-101',                     kfvStyle],
]
const added = stripComments(MOVE.map(([, t]) => t).join('\n'))
const sim = cur + '\n.knowledge-app {\n' + added + '\n}\n'
fs.writeFileSync('sim-knowledge.scss', sim)

// ---- verbatim from knowledgeStyles.test.ts ----
const NEW_RE = /\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g
function nonKClassNames(text) {
  const found = new Set([...text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))
  return [...found].filter((c) =>
    !/^k(?:2|n)?-/.test(c) && !/^fb(?:-|$)/.test(c) &&
    c !== 'knowledge-app' && c !== 'parser-app' && c !== 'nme-content' && c !== 'ProseMirror').sort()
}
const hits = (t) => [...new Set((t.match(NEW_RE) || []).map(s => s.slice(1)))].sort()

const before = hits(cur), after = hits(sim)
console.log('=== "没有搬多" whitelist regex ===')
console.log('current file  :', before.length, 'classes  (WHITELIST_293 constant asserts 293)')
console.log('after P5e sim :', after.length, 'classes')
const newOnes = after.filter(c => !before.includes(c))
console.log('newly matched by P5e ('+newOnes.length+'):\n   ' + newOnes.join(' '))
console.log('lost (must be empty):', after.length? before.filter(c=>!after.includes(c)).join(' ')||'(none)' : '?')
console.log('\n→ WHITELIST terminal value = ' + after.length + '   (i.e. WHITELIST_293 → WHITELIST_' + after.length + ')')

const nkBefore = nonKClassNames(cur), nkAfter = nonKClassNames(sim)
console.log('\n=== NON_K_HELPER_CLASSES (real nonKClassNames logic) ===')
console.log('current :', nkBefore.length, JSON.stringify(nkBefore))
console.log('after   :', nkAfter.length, JSON.stringify(nkAfter))
console.log('added   :', JSON.stringify(nkAfter.filter(c=>!nkBefore.includes(c))))
console.log('→ NON_K_HELPER_CLASSES terminal value = ' + nkAfter.length)
