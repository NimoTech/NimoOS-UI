#!/usr/bin/env node
// SP8-P5c Task 9 —— fixture 抄本的**程序化逐字节等价校验**(治理 §4.4:不许肉眼比)。
// 用法:node .superpowers/sdd/p5c-task-9-fixture-verify.mjs [--mutate]
//
// T9 与 T6/T7/T8 的不同点:本刀的三份 fixture **都要过一层降层**(§4.1),抄本不是
// HTTP 原文本身,所以校验分两层:
//   ① **原文层**:测试文件每个 FIXTURE-COPY 块里那行 `// HTTP 原文(逐字节):…`
//      必须与 `.superpowers/sdd/p5c-fixtures/<file>` 的内容**逐字节相等**
//      —— 这一层证明「抄进来的原始响应体没抄错」。
//   ② **降层层**:把原文按共享包里那个归一函数(逐字重写在下面 `LOWER` 里,附出处行号)
//      算一遍,结果必须与抄本里那个 `const` 字面量**深度相等**
//      —— 这一层证明「降层动作与包内实现一致」,即 mock 的层次是对的。
// `--mutate`:变异验证 —— 把抄本的 `autoExtract` 由 true 改 false,证明本脚本真会报
//   MISMATCH(不是空转)。
import { readFileSync } from 'node:fs'

const TEST = 'src/ai/knowledge/views/SettingsView.test.ts'
const MUTATE = process.argv.includes('--mutate')

/** 三个块 → fixture 文件 + 降层函数(逐字重写自共享包,注明出处)。 */
const MAP = [
  {
    marker: 'notes-settings.json',
    file: '.superpowers/sdd/p5c-fixtures/notes-settings.json',
    constName: 'NOTES_SETTINGS',
    // NimoOS-Service/src/notes.ts:131-137 `normalizeSettings`
    lower: (r) => ({
      notesRoot: r.notes_root || '',
      autoExtract: r.auto_extract !== false,
    }),
  },
  {
    marker: 'notes-dir-info-notes.json',
    file: '.superpowers/sdd/p5c-fixtures/notes-dir-info-notes.json',
    constName: 'DIR_INFO_NOTES',
    // NimoOS-Service/src/notes.ts:264-267 `dirInfo`
    lower: (r) => ({ exists: !!r.exists, empty: !!r.empty }),
  },
  {
    marker: 'wiki-candidates.json',
    file: '.superpowers/sdd/p5c-fixtures/wiki-candidates.json',
    constName: 'WIKI_CANDIDATES',
    // NimoOS-Service/src/wiki.ts:154-156 `getCandidates`
    lower: (r) => r || [],
  },
]

let src = readFileSync(TEST, 'utf8')
if (MUTATE) {
  const before = src
  src = src.replace(
    "const NOTES_SETTINGS: NotesSettings = { notesRoot: '/DATA/Notes', autoExtract: true }",
    "const NOTES_SETTINGS: NotesSettings = { notesRoot: '/DATA/Notes', autoExtract: false }",
  )
  if (src === before) {
    console.error('变异目标没命中 —— 脚本自身失效,停')
    process.exit(3)
  }
  console.log('*** 变异模式:抄本 NOTES_SETTINGS.autoExtract true → false ***\n')
}

/** 取出所有 FIXTURE-COPY 块(块头 + 块体)。 */
function blocks(text) {
  const out = []
  const re = /\/\/ FIXTURE-COPY-BEGIN([^\n]*)\n([\s\S]*?)\n\/\/ FIXTURE-COPY-END/g
  let m
  while ((m = re.exec(text))) out.push({ head: m[1].trim(), body: m[2] })
  return out
}

/** 把块体里 `const NAME<: T> = <字面量>` 的字面量求值(TS 字面量,用 Function 求值)。 */
function constLiteral(body, name) {
  const re = new RegExp('const\\s+' + name + '\\s*(?::[^=]*)?=\\s*([\\s\\S]*)$')
  const m = re.exec(body)
  if (!m) return { err: '找不到 const ' + name }
  // 去掉尾部可能的 `as unknown as X` / 注释行
  let lit = m[1].split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').trim()
  lit = lit.replace(/\s+as\s+[A-Za-z_$][\w$<>|[\]\s.]*$/, '').trim()
  try {
    // eslint-disable-next-line no-new-func
    return { val: new Function(`'use strict'; return (${lit})`)() }
  } catch (e) {
    return { err: '字面量求值失败: ' + e.message }
  }
}

function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep)
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]))
  }
  return v
}

const found = blocks(src)
const t9 = MAP.map((m) => found.find((b) => b.head.includes(m.marker)))
console.log(`FIXTURE-COPY 块总数 = ${found.length}(T8 的 2 个 + T9 的 ${MAP.length} 个 = ${2 + MAP.length})`)
let fail = found.length === 2 + MAP.length ? 0 : 1
if (fail) console.error('块数不符')

for (let i = 0; i < MAP.length; i++) {
  const { marker, file, constName, lower } = MAP[i]
  const blk = t9[i]
  if (!blk) {
    console.error(`MISSING  找不到 ${marker} 的抄本块`)
    fail++
    continue
  }

  // ── ① 原文层:块里那行 `HTTP 原文(逐字节):…` vs fixture 文件 ──
  const rawLine = blk.body.split('\n').find((l) => l.includes('HTTP 原文(逐字节):'))
  const quoted = rawLine ? rawLine.slice(rawLine.indexOf('):') + 2).trim() : null
  const realRaw = readFileSync(file, 'utf8')
  // 🔴 唯一容许的差别是 fixture 文件**末尾的换行**(`wiki-candidates.json` 有、另两份没有)——
  //   那是落盘时 shell 加的,不是响应体的一部分。除此之外逐字节相等。
  const real = realRaw.replace(/\n$/, '')
  const rawEq =
    quoted !== null &&
    Buffer.compare(Buffer.from(quoted, 'utf8'), Buffer.from(real, 'utf8')) === 0
  console.log(
    `${rawEq ? 'MATCH   ' : 'MISMATCH'} ①原文层 ${marker}  bytes=${quoted === null ? '-' : Buffer.byteLength(quoted)}/${Buffer.byteLength(real)}(文件 ${Buffer.byteLength(realRaw)},剥尾换行 ${realRaw.endsWith('\n') ? 1 : 0})`,
  )
  if (!rawEq) {
    fail++
    console.log(`   抄本: ${JSON.stringify(quoted)}`)
    console.log(`   原文: ${JSON.stringify(real)}`)
  }

  // ── ② 降层层:原文过归一函数 vs 抄本 const ──
  const { val, err } = constLiteral(blk.body, constName)
  if (err) {
    console.error(`MISMATCH ②降层层 ${marker}: ${err}`)
    fail++
    continue
  }
  const expected = lower(JSON.parse(real))
  const eq = JSON.stringify(sortDeep(val)) === JSON.stringify(sortDeep(expected))
  console.log(
    `${eq ? 'MATCH   ' : 'MISMATCH'} ②降层层 ${marker} → ${constName}  ` +
      `抄本=${JSON.stringify(val)}  归一后=${JSON.stringify(expected)}`,
  )
  if (!eq) fail++
}

console.log(`\n结果:${fail === 0 ? 'ALL MATCH' : fail + ' 处不符'}`)
process.exit(fail === 0 ? 0 : 1)
