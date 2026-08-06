#!/usr/bin/env node
/* 附录 A §A.1 的**双向**撞车扫描(zh 撞车看 en 是否不同 + en 撞车看 zh 是否不同)。
 * T0b:自取输入 + 🔴 把「本批自己的 63 个键」排除掉 —— 否则 T1 落地后每条都会跟自己撞车,
 * 复现不出 T0 当时的测量。用真实模块导入计键数(治理 §9.3-2)。 */
import { i18nTables } from './_inputs.mjs'
import { propose, BATCH_KEYS } from './propose.mjs'

const { zh: zhTab, en: enTab } = await i18nTables()
const rows = propose()
const EXCLUDE = process.argv.includes('--include-batch') ? new Set() : BATCH_KEYS
const rev = (tab) => {
  const m = new Map()
  for (const [k, v] of Object.entries(tab)) { if (EXCLUDE.has(k)) continue; if (!m.has(v)) m.set(v, []); m.get(v).push(k) }
  return m
}
const zhByVal = rev(zhTab); const enByVal = rev(enTab)
console.log(`全表 zh ${Object.keys(zhTab).length} / en ${Object.keys(enTab).length};排除本批 ${EXCLUDE.size} 个键`)
console.log('=== 双向撞车扫描(本批 63 值 × 全表)===')
let n = 0
for (const r of rows) {
  const zhHits = zhByVal.get(r.zh) || []; const enHits = enByVal.get(r.en) || []
  if (!zhHits.length && !enHits.length) continue
  n++
  console.log(`\n[${JSON.stringify(r.src)}] -> 拟用 ${r.key}${r.reuse ? '(复用)' : '(新建)'}`)
  for (const k of zhHits) console.log(`   zh 同值 == ${k} ; 该键 en = ${JSON.stringify(enTab[k])} ${enTab[k] === r.en ? '*** 双同 ***' : '(en 不同 -> 不可复用)'}`)
  for (const k of enHits) if (!zhHits.includes(k)) console.log(`   en 同值 == ${k} ; 该键 zh = ${JSON.stringify(zhTab[k])} ${zhTab[k] === r.zh ? '*** 双同 ***' : '(zh 不同 -> 不可复用)'}`)
}
console.log(`\n有撞车的值:${n} / ${rows.length}`)
