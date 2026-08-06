// 复现 knowledgeStyles.test.ts 的真实守卫逻辑(stripComments / nonKClassNames / 「没有搬多」扫描)
// 输入 = 现状 knowledge.scss + 本期 10 段 + K45 的 2 行,输出 = R8 / R9 的实测终值。
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const NEWUI = '/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/styles/knowledge.scss'
const TEST  = '/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/styles/knowledgeStyles.test.ts'
const bpRaw = execFileSync('git', ['-C', '/home/nimo/NimoTech/NimoOS-UI', 'show',
  '7a6ee6b7:src/views/AI/Knowledge/styles/knowledge.scss'], { encoding: 'utf8' }).split('\n')
const nmeRaw = execFileSync('git', ['-C', '/home/nimo/NimoTech/NimoOS-UI', 'show',
  '7a6ee6b7:src/views/AI/Knowledge/NotesMarkdownEditor.vue'], { encoding: 'utf8' }).split('\n')

// ---- 逐字复刻 knowledgeStyles.test.ts:23-27 ----
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
// ---- 逐字复刻 :244-256 ----
const nonKClassNames = (text) => {
  const found = new Set([...text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))
  return [...found].filter((c) =>
    !/^k(?:2|n)?-/.test(c) && !/^fb(?:-|$)/.test(c) && c !== 'knowledge-app' && c !== 'parser-app').sort()
}
const REGISTRY_NOW = ['ghost','outline','primary','danger','right','suffix','second','spin','mono','warn']
const WL_NOW = new Set([...readFileSync(TEST,'utf8')
  .match(/const WHITELIST_226 = \[([\s\S]*?)\n\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]))

const SEGS = [[2023,2046],[2047,2056],[2057,2085],[2086,2121],[2122,2194],[2195,2241],[2242,2249],[2265,2281],[551,571]]
const segText = SEGS.map(([a,b]) => bpRaw.slice(a-1,b).join('\n')).join('\n')
const k44Text = nmeRaw.slice(39,46).join('\n')                       // NotesMarkdownEditor.vue:40-46
// K45:按 R1 插在 .k-btn 的 &.danger 之后 / &:disabled 之前,即嵌套 `&.text` 写法
const k45Text = `    &.text { background: transparent; color: var(--accent); }\n    &.text:hover { background: var(--accent-soft); }`

const current = readFileSync(NEWUI, 'utf8')
const merged  = [current, segText, k44Text, k45Text].join('\n')
const cssNow  = stripComments(current)
const cssAfter= stripComments(merged)

console.log('=== R8:NON_K_HELPER_CLASSES 终值 ===')
const now = nonKClassNames(cssNow), after = nonKClassNames(cssAfter)
console.log('现状实测          :', now.length, JSON.stringify(now))
console.log('现状 == 登记表     :', JSON.stringify(now) === JSON.stringify([...REGISTRY_NOW].sort()))
console.log('拼入后实测        :', after.length, JSON.stringify(after))
const brandNew = after.filter(c => !now.includes(c))
console.log('新扫出            :', brandNew.length, JSON.stringify(brandNew))
console.log('其中走排除条件     :', JSON.stringify(brandNew.filter(c=>['nme-content','ProseMirror'].includes(c))))
console.log('其中进登记表       :', JSON.stringify(brandNew.filter(c=>!['nme-content','ProseMirror'].includes(c))))
console.log('🔴 R8 终值(10 + 进登记表的) =', REGISTRY_NOW.length + brandNew.filter(c=>!['nme-content','ProseMirror'].includes(c)).length)
console.log("   'text' 是否被 nonKClassNames 扫到 :", after.includes('text'), '  ← R8 裁定「若扫不到则实测优先」的判据')
console.log("   'nme' 是否被扫到                  :", after.includes('nme'), ' (预期 false:蓝本零选择器)')

console.log('\n=== R9:「没有搬多」白名单终值 ===')
const OLD_RE = /\.(?:k(?:2|n)?-[a-z0-9-]+|fb(?:-[a-z0-9-]+)?)/g
const NEW_RE = /\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g
const hit = (re, t) => [...new Set(t.match(re) || [])].map(s => s.slice(1)).sort()
const oldNow = hit(OLD_RE, cssNow), newNow = hit(NEW_RE, cssNow)
console.log('严格超集自证(现状):old ⊆ new =', oldNow.every(c => newNow.includes(c)),
            ` (old ${oldNow.length} / new ${newNow.length})`)
const afterHits = hit(NEW_RE, cssAfter)
const extra = afterHits.filter(c => !WL_NOW.has(c))
console.log('拼入后扫出          :', afterHits.length)
console.log('白名单外(= 要新增) :', extra.length)
console.log('  其中 k*/fb*       :', extra.filter(c => /^(k(2|n)?-|fb($|-))/.test(c)).length)
console.log('  其中非 k*         :', JSON.stringify(extra.filter(c => !/^(k(2|n)?-|fb($|-))/.test(c))))
console.log("  'text' 是否被这条扫到 :", afterHits.includes('text'), ' (预期 false → text 只归 R8 一侧)')
console.log('🔴 R9 终值(226 +) =', WL_NOW.size + extra.length)
