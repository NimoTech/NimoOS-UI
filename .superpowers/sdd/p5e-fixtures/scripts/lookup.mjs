#!/usr/bin/env node
/* 附录 A §A.1 表格的 zh/en 权威值查询(T0b:自取蓝本 JSON,零手工准备)。
 * zh 权威 = 7a6ee6b7:src/assets/lang/zh_CN.json · en 权威 = …/en_US.json 的**覆盖值**(R10/E-31)。 */
import { bp, BP_PATHS } from './_inputs.mjs'
import { scan } from './scan-p5e.mjs'

export function lookup() {
  const zh = JSON.parse(bp(BP_PATHS.zhJson)); const en = JSON.parse(bp(BP_PATHS.enJson))
  const { rows } = scan()
  const out = rows.map(([k, owners]) => ({
    k, owners,
    zh: Object.prototype.hasOwnProperty.call(zh, k) ? zh[k] : null,
    en: Object.prototype.hasOwnProperty.call(en, k) ? en[k] : null,
  }))
  return { out, zhLeafTop: Object.keys(zh).length, enLeafTop: Object.keys(en).length }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { out } = lookup()
  const zhHit = out.filter((r) => r.zh !== null).length
  const enHit = out.filter((r) => r.en !== null).length
  const enDiff = out.filter((r) => r.en !== null && r.en !== r.k).length
  console.log(`zh 命中 ${zhHit}/${out.length}  |  en 覆盖条目 ${enHit}/${out.length}  |  en 覆盖值 != key 的:${enDiff}`)
  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0) }
  for (const r of out) {
    console.log(JSON.stringify(r.k))
    console.log('   zh: ' + (r.zh === null ? '*** MISSING ***' : JSON.stringify(r.zh)))
    console.log('   en: ' + (r.en === null ? '(no override -> renders key)' : JSON.stringify(r.en)) + (r.en !== null && r.en !== r.k ? '  <<< DIFFERS' : ''))
  }
}
