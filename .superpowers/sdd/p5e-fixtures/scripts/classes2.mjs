import fs from 'node:fs'
const NU_SCSS = '/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/styles/knowledge.scss'
const bpScss = fs.readFileSync('knowledge.scss','utf8')
const nuScss = fs.readFileSync(NU_SCSS,'utf8')
const files = ['SearchView.vue','FileDetailDrawer.vue','KFileViewer.vue']

const used = new Map()
for (const p of files) {
  const src = fs.readFileSync(p,'utf8'); const tpl = src.slice(0, src.indexOf('<script'))
  for (const m of tpl.matchAll(/\bclass="([^"]*)"/g))
    for (const tok of m[1].split(/\s+/).filter(Boolean)) used.set(tok, (used.get(tok)||new Set()).add(p))
}
// selector-aware: .cls (exact token) appearing in the selector part of a line (before first '{')
function declaredIn(text, cls) {
  const re = new RegExp('\\.' + cls.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(?![\\w-])')
  const out = []
  text.split('\n').forEach((line,i)=>{
    // strip /* ... */ comment spans on the line
    const nc = line.replace(/\/\*.*?\*\//g,'').replace(/\/\*.*$/,'')
    const brace = nc.indexOf('{')
    const sel = brace >= 0 ? nc.slice(0, brace) : null
    if (sel !== null && re.test(sel)) out.push(i+1)
  })
  return out
}
const rows = []
for (const [cls, owners] of [...used].sort()) {
  const bpl = declaredIn(bpScss, cls), nul = declaredIn(nuScss, cls)
  rows.push({cls, owners:[...owners].map(f=>f.replace('.vue','')), bpLines:bpl, nuLines:nul,
    state: nul.length ? 'ALREADY-MOVED' : (bpl.length ? 'TO-MOVE' : 'NO-RULE-EITHER-SIDE')})
}
const w=(s,n)=>String(s).padEnd(n)
console.log(w('class',24)+w('state',22)+w('bp lines',26)+w('New-UI lines',16)+'used by')
for (const r of rows) console.log(w(r.cls,24)+w(r.state,22)+w(r.bpLines.join(','),26)+w(r.nuLines.join(','),16)+r.owners.join(','))
const by={}; for(const r of rows)(by[r.state]||=[]).push(r.cls)
console.log('\n--- summary (total '+rows.length+' tokens) ---')
for (const [k,v] of Object.entries(by)) console.log(`${k}: ${v.length}\n    ${v.join(' ')}`)
fs.writeFileSync('classes-used.json', JSON.stringify(rows,null,1))
