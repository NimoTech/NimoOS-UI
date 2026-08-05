import fs from 'node:fs'
const files = {
  'SearchView.vue': 'bp/src_views_AI_Knowledge_SearchView.vue',
  'FileDetailDrawer.vue': 'bp/src_views_AI_Knowledge_components_FileDetailDrawer.vue',
  'KFileViewer.vue': 'bp/src_views_AI_Knowledge_components_KFileViewer.vue',
  'searchAggregate.js': 'bp/src_views_AI_Knowledge_searchAggregate.js',
}
const re = /(?:\$t|i18n\.t)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
const owner = new Map()
for (const [label, p] of Object.entries(files)) {
  const src = fs.readFileSync(p, 'utf8'); let m; re.lastIndex = 0
  const seen = new Set()
  while ((m = re.exec(src))) { seen.add(m[2]) }
  console.log(`${label}: ${seen.size} static`)
  for (const k of seen) owner.set(k, (owner.get(k)||[]).concat(label))
}
const DYN_MTIME = ['Any','Last 1 week','Last 1 month','Last 1 year']
const DYN_SAMPLE = ['thyroid','Python async','contract from last year','iPhone setup','figure skating']
for (const k of DYN_MTIME) owner.set(k, (owner.get(k)||[]).concat('SearchView.vue(MTIMES dyn)'))
for (const k of DYN_SAMPLE) owner.set(k, (owner.get(k)||[]).concat('SearchView.vue(SAMPLE_QUERIES dyn)'))
console.log('--- distinct total (static+dynamic) =', owner.size)
const rows = [...owner].sort((a,b)=>a[0].localeCompare(b[0]))
rows.forEach(([k,v],i)=>console.log(String(i+1).padStart(3)+'  '+JSON.stringify(k)+'   <-- '+v.join(' , ')))
fs.writeFileSync('p5e-keys.json', JSON.stringify(rows,null,1))
