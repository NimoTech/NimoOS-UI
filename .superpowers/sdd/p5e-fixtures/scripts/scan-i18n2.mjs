#!/usr/bin/env node
/* 附录 A §A.0 的 i18n 规模复扫(E-53 相关)。T0b:自取蓝本,无需 argv 目录参数。
 * 🔴 结论口径见附录 A §A.0 与裁定 R4 的 E-53 结案:
 *    461 与 408 的差异**原因未查明**,但不影响本期 —— 本期依据是 63 distinct 终值。
 *    本脚本只是把「各种口径各是多少」摆出来,**不用于推翻上级设计**。 */
import { bpKnowledgeFiles } from './_inputs.mjs'

const files = bpKnowledgeFiles()
const VARIANTS = {
  "tight_single  \\$t('…') / i18n.t('…') 单引号": /(?:\$t|i18n\.t)\(\s*'((?:\\.|[^\\'])*)'/g,
  'tight_any     单/双/反引号三种                ': /(?:\$t|i18n\.t)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g,
}
for (const [name, re] of Object.entries(VARIANTS)) {
  const all = new Map()
  for (const f of files) {
    let m; re.lastIndex = 0
    while ((m = re.exec(f.text))) {
      const k = re.source.includes("(\\\\.|[^\\\\'])") ? m[1] : (m[2] ?? m[1])
      all.set(k, (all.get(k) || new Set()).add(f.path))
    }
  }
  const inVue = (pred) => { const s = new Set(); for (const [k, fs2] of all) if ([...fs2].some(pred)) s.add(k); return s.size }
  console.log(`### ${name}`)
  console.log(`  全部文件(.vue + .js)      : ${all.size}`)
  console.log(`  出现在任一 .vue            : ${inVue((f) => f.endsWith('.vue'))}`)
  console.log(`  Knowledge 顶层 .vue        : ${inVue((f) => f.endsWith('.vue') && /Knowledge\/[^/]+\.vue$/.test(f))}`)
  console.log(`  Knowledge 全部 .vue(含 components): ${inVue((f) => f.endsWith('.vue') && f.includes('/Knowledge/'))}`)
  console.log(`  Parser .vue                : ${inVue((f) => f.endsWith('.vue') && f.includes('/Parser/'))}`)
}
console.log(`\n扫了 ${files.length} 个文件(${files.filter((f) => f.path.endsWith('.vue')).length} 个 .vue)`)
console.log('🔴 没有任何口径给出 461 —— 见裁定 R4 的 E-53 结案:不判勘误、也不声称已解释。')
