#!/usr/bin/env node
/* 附录 A —— 本期 63 个 distinct i18n 串的提取(T0b:改为自取蓝本,零手工准备)。
 * 用法:node scan-p5e.mjs           输出:63 行 `串 <-- 归属`
 *      node scan-p5e.mjs --json    输出 JSON,供 lookup/propose/collide 复用 */
import { bp, BP_PATHS } from './_inputs.mjs'
export const FILES = {
  'SearchView.vue': BP_PATHS.searchView,
  'FileDetailDrawer.vue': BP_PATHS.fileDetailDrawer,
  'KFileViewer.vue': BP_PATHS.kFileViewer,
  'searchAggregate.js': BP_PATHS.searchAggregate,
}
// 蓝本 SearchView.vue:210-215 MTIMES / :192 SAMPLE_QUERIES —— 过 $t(变量),静态正则扫不到
export const DYN_MTIME = ['Any', 'Last 1 week', 'Last 1 month', 'Last 1 year']
export const DYN_SAMPLE = ['thyroid', 'Python async', 'contract from last year', 'iPhone setup', 'figure skating']

export function scan() {
  const re = /(?:\$t|i18n\.t)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
  const owner = new Map(); const perFile = {}
  for (const [label, p] of Object.entries(FILES)) {
    const src = bp(p); const seen = new Set(); let m; re.lastIndex = 0
    while ((m = re.exec(src))) seen.add(m[2])
    perFile[label] = seen.size
    for (const k of seen) owner.set(k, (owner.get(k) || []).concat(label))
  }
  const staticUnion = owner.size
  for (const k of DYN_MTIME) owner.set(k, (owner.get(k) || []).concat('SearchView.vue(MTIMES dyn)'))
  for (const k of DYN_SAMPLE) owner.set(k, (owner.get(k) || []).concat('SearchView.vue(SAMPLE_QUERIES dyn)'))
  return { perFile, staticUnion, rows: [...owner].sort((a, b) => a[0].localeCompare(b[0])) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { perFile, staticUnion, rows } = scan()
  for (const [f, n] of Object.entries(perFile)) console.log(`${String(n).padStart(3)} static  ${f}`)
  console.log(`--- 静态并集 = ${staticUnion}(三个 .vue 53 + searchAggregate 1;7 处交叠)`)
  console.log(`--- 动态 = ${DYN_MTIME.length + DYN_SAMPLE.length}(MTIMES 4 + SAMPLE_QUERIES 5)`)
  console.log(`--- distinct 终值 = ${rows.length}`)
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1))
  else rows.forEach(([k, v], i) => console.log(`${String(i + 1).padStart(3)}  ${JSON.stringify(k)}   <-- ${v.join(' , ')}`))
}
