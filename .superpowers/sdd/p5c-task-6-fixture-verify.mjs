// SP8-P5c Task 6 —— FIXTURE 抄本等价校验(治理 §4.4:抄完必须**程序化**逐字节校验,
// 不许肉眼比)。
//
// 做法:从 `ParserStatus.test.ts` 里按 `FIXTURE-COPY-BEGIN/END` 标记切出每个字面量块,
// 剥掉 `const X: T = ` 前缀 → `JSON.parse` → 再 `JSON.stringify`(**保持键序**),
// 与对应 fixture 文件走同一条 `JSON.parse → JSON.stringify` 管道的结果**逐字节比对**
// (`===` + sha256)。键序、数值精度、null、Unicode 一律参与比对。
//
// 跑法:node .superpowers/sdd/p5c-task-6-fixture-verify.mjs
// DoD:5/5 MATCH,exit 0。
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const ROOT = new URL('../../', import.meta.url).pathname // 仓库根
const TEST = `${ROOT}src/ai/knowledge/parser/ParserStatus.test.ts`
const SDD = `${ROOT}.superpowers/sdd`

/** 抄本常量名 → [fixture 路径, 从 fixture 里取哪一块] */
const CASES = [
  ['STATS', `${SDD}/p5c-fixtures/parser-stats.json`, (v) => v],
  ['STATE', `${SDD}/p5c-fixtures/parser-control-state.json`, (v) => v],
  ['FOLDERS', `${SDD}/p5c-fixtures/parser-folders-pending-20.json`, (v) => v],
  ['FAILED_EMPTY', `${SDD}/p5c-fixtures/parser-jobs-failed-5.json`, (v) => v],
  ['FAILED_ROW', `${SDD}/p5b-fixtures/jobs-pending.json`, (v) => v.jobs[0]],
]

const src = readFileSync(TEST, 'utf8')
const sha = (s) => createHash('sha256').update(s).digest('hex')

/** 切出 `const <NAME>: <T> = { … }` 的字面量(限定在 FIXTURE-COPY 块内)。 */
function extractCopy(name) {
  const blocks = src.split('// FIXTURE-COPY-BEGIN').slice(1)
  for (const b of blocks) {
    const body = b.split('// FIXTURE-COPY-END')[0]
    const re = new RegExp(`^const ${name}: [^=]+= ([\\s\\S]*)$`, 'm')
    const m = re.exec(body)
    if (m) return m[1].trim()
  }
  throw new Error(`FIXTURE-COPY 块里找不到 const ${name}`)
}

let ok = 0
for (const [name, fixturePath, pick] of CASES) {
  const copyText = extractCopy(name)
  const copyCanon = JSON.stringify(JSON.parse(copyText))
  const fixCanon = JSON.stringify(pick(JSON.parse(readFileSync(fixturePath, 'utf8'))))
  const match = copyCanon === fixCanon
  if (match) ok++
  console.log(`${match ? 'MATCH  ' : 'DIFF   '} ${name}`)
  console.log(`         fixture: ${fixturePath.replace(ROOT, '')}`)
  console.log(`         bytes  : copy=${Buffer.byteLength(copyCanon)}  fixture=${Buffer.byteLength(fixCanon)}`)
  console.log(`         sha256 : copy=${sha(copyCanon).slice(0, 16)}…  fixture=${sha(fixCanon).slice(0, 16)}…`)
  if (!match) {
    console.log(`         copy   : ${copyCanon.slice(0, 400)}`)
    console.log(`         fixture: ${fixCanon.slice(0, 400)}`)
  }
}

console.log(`\n${ok}/${CASES.length} MATCH`)
process.exit(ok === CASES.length ? 0 : 1)
