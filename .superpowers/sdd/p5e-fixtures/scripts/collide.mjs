import fs from 'node:fs'
const zhTab = JSON.parse(fs.readFileSync('/tmp/p5e-zh.json','utf8'))
const enTab = JSON.parse(fs.readFileSync('/tmp/p5e-en.json','utf8'))
const rows = JSON.parse(fs.readFileSync('p5e-values.json','utf8'))
// reverse index by value
const zhByVal = new Map(); const enByVal = new Map()
for (const [k,v] of Object.entries(zhTab)) { if(!zhByVal.has(v)) zhByVal.set(v,[]); zhByVal.get(v).push(k) }
for (const [k,v] of Object.entries(enTab)) { if(!enByVal.has(v)) enByVal.set(v,[]); enByVal.get(v).push(k) }
console.log('=== BIDIRECTIONAL COLLISION SCAN (this batch × full table) ===')
for (const r of rows) {
  const zhHits = zhByVal.get(r.zh) || []
  const enHits = enByVal.get(r.en) || []
  if (!zhHits.length && !enHits.length) continue
  const lines = []
  for (const k of zhHits) lines.push(`   zh-same "${r.zh}" == key ${k} ; that key's en = ${JSON.stringify(enTab[k])} ${enTab[k]===r.en?'*** BOTH SAME → true reuse candidate ***':'(en differs → NOT reusable)'}`)
  for (const k of enHits) if (!zhHits.includes(k)) lines.push(`   en-same "${r.en}" == key ${k} ; that key's zh = ${JSON.stringify(zhTab[k])} ${zhTab[k]===r.zh?'*** BOTH SAME ***':'(zh differs → NOT reusable)'}`)
  console.log(`\n[${JSON.stringify(r.k)}]  owners=${r.owners.join(',')}`)
  lines.forEach(l=>console.log(l))
}
