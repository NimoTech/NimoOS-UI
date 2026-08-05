import fs from 'node:fs'
import path from 'node:path'
const dir = process.argv[2]
const files = fs.readdirSync(dir).filter(f => /\.(vue|js)$/.test(f)).sort()
const variants = {
  tight_single: /(?:\$t|i18n\.t)\(\s*'((?:\\.|[^\\'])*)'/g,
  tight_any:    /(?:\$t|i18n\.t)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g,
}
for (const [name, re] of Object.entries(variants)) {
  const all = new Map(); const knowledgeVue = new Set(); const perFile = {}
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8')
    const s = new Set(); let m; re.lastIndex = 0
    while ((m = re.exec(src))) { const k = name==='tight_single'? m[1] : m[2]; s.add(k); all.set(k, (all.get(k)||new Set()).add(f)) }
    perFile[f] = s.size
    if (f.endsWith('.vue') && f.includes('_Knowledge')) for (const k of s) knowledgeVue.add(k)
  }
  const parserVue = new Set()
  for (const [k, fs2] of all) if ([...fs2].some(f=>f.includes('_Parser') && f.endsWith('.vue'))) parserVue.add(k)
  const allVue = new Set()
  for (const [k, fs2] of all) if ([...fs2].some(f=>f.endsWith('.vue'))) allVue.add(k)
  console.log(`### ${name}`)
  console.log('  distinct all files      :', all.size)
  console.log('  distinct in any .vue    :', allVue.size)
  console.log('  distinct in Knowledge.vue:', knowledgeVue.size)
  console.log('  distinct in Parser.vue  :', parserVue.size)
  if (name==='tight_single') fs.writeFileSync(path.join(dir,'..','i18n-tight.json'), JSON.stringify([...all].map(([k,v])=>[k,[...v]]),null,1))
}
