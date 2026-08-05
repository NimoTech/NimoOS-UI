import fs from 'node:fs'
const zh = JSON.parse(fs.readFileSync('zh_CN.json','utf8'))
const en = JSON.parse(fs.readFileSync('en_US.json','utf8'))
const rows = JSON.parse(fs.readFileSync('p5e-keys.json','utf8'))
console.log('zh_CN.json leaf count:', Object.keys(zh).length, ' nested?', Object.values(zh).some(v=>typeof v==='object'))
console.log('en_US.json leaf count:', Object.keys(en).length, ' nested?', Object.values(en).some(v=>typeof v==='object'))
let zhHit=0, enHit=0, enDiff=0
const out=[]
for (const [k, owners] of rows) {
  const zv = Object.prototype.hasOwnProperty.call(zh,k) ? zh[k] : null
  const ev = Object.prototype.hasOwnProperty.call(en,k) ? en[k] : null
  if (zv!==null) zhHit++
  if (ev!==null) { enHit++; if (ev!==k) enDiff++ }
  out.push({k, zh: zv, en: ev, enOverrideDiffers: ev!==null && ev!==k, owners})
}
console.log(`zh hit ${zhHit}/${rows.length} | en override present ${enHit}/${rows.length} | en override != key: ${enDiff}`)
console.log('--- rows ---')
for (const r of out) {
  console.log(JSON.stringify(r.k))
  console.log('   zh: ' + (r.zh===null? '*** MISSING ***' : JSON.stringify(r.zh)))
  console.log('   en: ' + (r.en===null? '(no override → renders key)' : JSON.stringify(r.en)) + (r.enOverrideDiffers?'  <<< DIFFERS FROM KEY':''))
}
fs.writeFileSync('p5e-values.json', JSON.stringify(out,null,1))
