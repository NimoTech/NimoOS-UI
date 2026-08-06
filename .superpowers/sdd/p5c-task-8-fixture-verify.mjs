#!/usr/bin/env node
// SP8-P5c Task 8 —— fixture 抄本的**程序化逐字节等价校验**(治理 §4.4:不许肉眼比)。
// 用法:node .superpowers/sdd/p5c-task-8-fixture-verify.mjs   [--mutate]
//   默认:把 `SettingsView.test.ts` 里 FIXTURE-COPY-BEGIN/END 两个块解析出来,
//         与 `.superpowers/sdd/p5c-fixtures/*.json` 原文做 ① 规范化 JSON 逐字节比对
//         ② 深度结构等价 两道校验。
//   --mutate:变异验证 —— 把抄本里一个数值改掉,证明本脚本真的会报 MISMATCH(不是空转)。
// 写法承 T6 `p5c-task-6-fixture-verify.mjs` / T7 同名脚本。
import { readFileSync } from 'node:fs'

const TEST = 'src/ai/knowledge/views/SettingsView.test.ts'
const MUTATE = process.argv.includes('--mutate')

// 块 → fixture 文件的映射(块头注释里写的出处)
const MAP = [
  { file: '.superpowers/sdd/p5c-fixtures/parser-control-state.json', marker: 'parser-control-state.json' },
  { file: '.superpowers/sdd/p5c-fixtures/parser-stats.json', marker: 'parser-stats.json' },
]

let src = readFileSync(TEST, 'utf8')
if (MUTATE) {
  // 变异:并发档 2 → 3(只改抄本,不动 fixture)
  const before = src
  src = src.replace('"concurrency": 2,', '"concurrency": 3,')
  if (src === before) {
    console.error('变异目标没命中 —— 脚本自身失效,停')
    process.exit(3)
  }
  console.log('*** 变异模式:抄本里 "concurrency": 2 → 3 ***\n')
}

/** 取出第 n 个 FIXTURE-COPY 块里的对象字面量文本。 */
function blocks(text) {
  const out = []
  const re = /\/\/ FIXTURE-COPY-BEGIN([^\n]*)\n([\s\S]*?)\n\/\/ FIXTURE-COPY-END/g
  let m
  while ((m = re.exec(text))) out.push({ head: m[1].trim(), body: m[2] })
  return out
}

let fail = 0
const found = blocks(src)
console.log(`FIXTURE-COPY 块数 = ${found.length}(期望 ${MAP.length})`)
if (found.length !== MAP.length) {
  console.error('块数不符')
  fail++
}

for (const { file, marker } of MAP) {
  const blk = found.find((b) => b.head.includes(marker))
  if (!blk) {
    console.error(`MISSING  找不到 ${marker} 的抄本块`)
    fail++
    continue
  }
  // 抄本块形如: [注释若干行]  const NAME<: T> = { … }<空白/as 断言>
  const objStart = blk.body.indexOf('{')
  const objEnd = blk.body.lastIndexOf('}')
  const literal = blk.body.slice(objStart, objEnd + 1)
  let copy
  try {
    copy = JSON.parse(literal)
  } catch (e) {
    console.error(`PARSE-FAIL ${marker}: ${e.message}`)
    fail++
    continue
  }
  const real = JSON.parse(readFileSync(file, 'utf8'))
  // ① 规范化 JSON 逐字节比对(键序也一并比 —— JSON.stringify 保留插入序)
  const a = JSON.stringify(copy)
  const b = JSON.stringify(real)
  const byteEq = Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0
  // ② 深度结构等价(顺带兜住「同值不同键序」这种 ① 会报、② 不会报的情形,便于定位)
  const deepEq = JSON.stringify(sortDeep(copy)) === JSON.stringify(sortDeep(real))
  console.log(
    `${byteEq && deepEq ? 'MATCH   ' : 'MISMATCH'} ${marker}  ` +
      `bytes=${a.length}/${b.length} byteEq=${byteEq} deepEq=${deepEq}`,
  )
  if (!byteEq || !deepEq) {
    fail++
    console.log(`   抄本: ${a}`)
    console.log(`   原文: ${b}`)
  }
}

function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep)
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]))
  }
  return v
}

console.log(`\n结果:${fail === 0 ? 'ALL MATCH' : fail + ' 处不符'}`)
process.exit(fail === 0 ? 0 : 1)
