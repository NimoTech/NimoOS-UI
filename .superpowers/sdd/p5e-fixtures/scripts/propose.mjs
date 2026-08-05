#!/usr/bin/env node
/* 附录 A §A.1 的键名方案 + 名字撞车自检(T0b:自取输入)。
 * 🔴 复用只认 aiKb* 家族(A-1/A-6);其余同值键一律拒绝,理由见附录 A §A.1.2。 */
import { i18nTables } from './_inputs.mjs'
import { lookup } from './lookup.mjs'

export const REUSE = {
  'thyroid': 'aiKbSampleThyroid', 'Python async': 'aiKbSamplePythonAsync',
  'contract from last year': 'aiKbSampleContract', 'iPhone setup': 'aiKbSampleIphone',
  'figure skating': 'aiKbSampleSkating',
  'Try': 'aiKbTry', 'Search': 'aiKbSearch', 'Close': 'aiKbClose', 'Indexed': 'aiKbStatusIndexed',
}
export const NEW = {
  'Search your documents…': 'aiKbSrPlaceholder', 'Advanced': 'aiKbSrAdvanced', 'Enabled': 'aiKbSrAdvOn',
  'File type': 'aiKbSrFileType', 'Modified': 'aiKbSrModified',
  'Any': 'aiKbSrMtimeAny', 'Last 1 week': 'aiKbSrMtimeWeek', 'Last 1 month': 'aiKbSrMtimeMonth', 'Last 1 year': 'aiKbSrMtimeYear',
  'Ranking quality': 'aiKbSrQuality', 'Fast': 'aiKbSrQualityFast', 'Accurate': 'aiKbSrQualityAccurate',
  'Rerank unavailable, fell back to fast': 'aiKbSrRerankWarn', 'Top-K results': 'aiKbSrTopK',
  'Search anything in natural language': 'aiKbSrIdleTitle',
  'Type anything in plain language — Nimo finds the matching documents on your NAS. Semantic matching, not just keyword.': 'aiKbSrIdleSub',
  'No results found': 'aiKbSrEmptyTitle', 'A few things to try:': 'aiKbSrEmptySub',
  'Try a different keyword or shorter description': 'aiKbSrEmptyTipKeyword',
  'Check whether the file has been indexed': 'aiKbSrEmptyTipIndexed',
  'Review the Allowlist rules': 'aiKbSrEmptyTipAllowlist', 'Search failed': 'aiKbSrErrorTitle',
  'files': 'aiKbSrCountFiles', 'matches': 'aiKbSrCountMatches',
  '{n} matches': 'aiKbSrMatchPill', '{n} matching sections': 'aiKbSrMatchTitle',
  '{n} more matching sections — click to view': 'aiKbSrMoreHint',
  'Similarity': 'aiKbSrSimilarity', 'High': 'aiKbSrRelHigh', 'Mid': 'aiKbSrRelMid', 'Low': 'aiKbSrRelLow',
  'File path unavailable': 'aiKbSrNoPath', 'No preview for this format — please download': 'aiKbSrNoPreviewToast',
  'Popup blocked by browser': 'aiKbSrPopupBlocked', 'Open failed': 'aiKbSrOpenFailed', 'Download failed': 'aiKbSrDownloadFailed',
  'Back to results': 'aiKbFdBack', 'Results': 'aiKbFdResults', 'Download': 'aiKbFdDownload',
  'Distill into note': 'aiKbFdDistill', 'Open file': 'aiKbFdOpenFile',
  'Found {n} matching sections for "{query}", ranked by similarity': 'aiKbFdSummary',
  'Page {n}': 'aiKbFdPage', 'Section {n}': 'aiKbFdSection', 'Passage': 'aiKbFdPassage',
  'Previous section': 'aiKbFdPrevSection', 'Next section': 'aiKbFdNextSection',
  'Copy content': 'aiKbFdCopy', 'Copied': 'aiKbFdCopied', 'Copy failed — please select manually': 'aiKbFdCopyFailed',
  'Queued for note distillation': 'aiKbFdDistillQueued', 'Could not queue this file': 'aiKbFdDistillFailed',
  'Preview not supported for this format': 'aiKbFvUnsupported', '(Untitled)': 'aiKbSrUntitled',
}
/** 本批 63 个键名(复用 9 + 新增 54)—— collide.mjs 用它把「本批自己的键」排除掉。 */
export const BATCH_KEYS = new Set([...Object.values(REUSE), ...Object.values(NEW)])

export function propose() {
  const { out } = lookup()
  return out.map((r) => ({ key: REUSE[r.k] || NEW[r.k], reuse: !!REUSE[r.k], src: r.k, zh: r.zh, en: r.en, owners: r.owners }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = propose()
  const { zh } = await i18nTables()
  let bad = 0
  const nameCount = new Map()
  for (const r of rows) {
    if (!r.key) { console.log('!! 没给名字:' + JSON.stringify(r.src)); bad++; continue }
    nameCount.set(r.key, (nameCount.get(r.key) || 0) + 1)
  }
  for (const [n, c] of nameCount) if (c > 1) { console.log(`!! 名字重复:${n} ×${c}`); bad++ }
  console.log(`rows ${rows.length} | 复用 ${rows.filter((r) => r.reuse).length} | 新增 ${rows.filter((r) => !r.reuse).length}`)
  console.log(`词干:aiKbSr* ${rows.filter((r) => !r.reuse && r.key.startsWith('aiKbSr')).length} · aiKbFd* ${rows.filter((r) => !r.reuse && r.key.startsWith('aiKbFd')).length} · aiKbFv* ${rows.filter((r) => !r.reuse && r.key.startsWith('aiKbFv')).length}`)
  console.log(`名字问题:${bad}`)
  console.log(`\n当前全表 zh 键数 = ${Object.keys(zh).length}`)
  console.log(rows.every((r) => Object.prototype.hasOwnProperty.call(zh, r.key))
    ? '✅ 本批 63 个键名在当前语言包里全部存在(T1 已落地)'
    : `⏳ 尚有 ${rows.filter((r) => !Object.prototype.hasOwnProperty.call(zh, r.key)).length} 个键未落地(T1 未跑完时是正常的)`)
  process.exit(bad === 0 ? 0 : 1)
}
