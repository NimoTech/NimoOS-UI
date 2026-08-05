import fs from 'node:fs'
const zhTab = JSON.parse(fs.readFileSync('/tmp/p5e-zh.json','utf8'))
const rows = JSON.parse(fs.readFileSync('p5e-values.json','utf8'))
// reuse map (aiKb* family only)
const REUSE = {
  'thyroid':'aiKbSampleThyroid','Python async':'aiKbSamplePythonAsync','contract from last year':'aiKbSampleContract',
  'iPhone setup':'aiKbSampleIphone','figure skating':'aiKbSampleSkating',
  'Try':'aiKbTry','Search':'aiKbSearch','Close':'aiKbClose','Indexed':'aiKbStatusIndexed',
}
const NEW = {
  'Search your documents…':'aiKbSrPlaceholder',
  'Advanced':'aiKbSrAdvanced',
  'Enabled':'aiKbSrAdvOn',
  'File type':'aiKbSrFileType',
  'Modified':'aiKbSrModified',
  'Any':'aiKbSrMtimeAny',
  'Last 1 week':'aiKbSrMtimeWeek',
  'Last 1 month':'aiKbSrMtimeMonth',
  'Last 1 year':'aiKbSrMtimeYear',
  'Ranking quality':'aiKbSrQuality',
  'Fast':'aiKbSrQualityFast',
  'Accurate':'aiKbSrQualityAccurate',
  'Rerank unavailable, fell back to fast':'aiKbSrRerankWarn',
  'Top-K results':'aiKbSrTopK',
  'Search anything in natural language':'aiKbSrIdleTitle',
  'Type anything in plain language — Nimo finds the matching documents on your NAS. Semantic matching, not just keyword.':'aiKbSrIdleSub',
  'No results found':'aiKbSrEmptyTitle',
  'A few things to try:':'aiKbSrEmptySub',
  'Try a different keyword or shorter description':'aiKbSrEmptyTipKeyword',
  'Check whether the file has been indexed':'aiKbSrEmptyTipIndexed',
  'Review the Allowlist rules':'aiKbSrEmptyTipAllowlist',
  'Search failed':'aiKbSrErrorTitle',
  'files':'aiKbSrCountFiles',
  'matches':'aiKbSrCountMatches',
  '{n} matches':'aiKbSrMatchPill',
  '{n} matching sections':'aiKbSrMatchTitle',
  '{n} more matching sections — click to view':'aiKbSrMoreHint',
  'Similarity':'aiKbSrSimilarity',
  'High':'aiKbSrRelHigh',
  'Mid':'aiKbSrRelMid',
  'Low':'aiKbSrRelLow',
  'File path unavailable':'aiKbSrNoPath',
  'No preview for this format — please download':'aiKbSrNoPreviewToast',
  'Popup blocked by browser':'aiKbSrPopupBlocked',
  'Open failed':'aiKbSrOpenFailed',
  'Download failed':'aiKbSrDownloadFailed',
  'Back to results':'aiKbFdBack',
  'Results':'aiKbFdResults',
  'Download':'aiKbFdDownload',
  'Distill into note':'aiKbFdDistill',
  'Open file':'aiKbFdOpenFile',
  'Found {n} matching sections for "{query}", ranked by similarity':'aiKbFdSummary',
  'Page {n}':'aiKbFdPage',
  'Section {n}':'aiKbFdSection',
  'Passage':'aiKbFdPassage',
  'Previous section':'aiKbFdPrevSection',
  'Next section':'aiKbFdNextSection',
  'Copy content':'aiKbFdCopy',
  'Copied':'aiKbFdCopied',
  'Copy failed — please select manually':'aiKbFdCopyFailed',
  'Queued for note distillation':'aiKbFdDistillQueued',
  'Could not queue this file':'aiKbFdDistillFailed',
  'Preview not supported for this format':'aiKbFvUnsupported',
  '(Untitled)':'aiKbSrUntitled',
}
const existing = new Set(Object.keys(zhTab))
let bad = 0
const out = []
for (const r of rows) {
  const reuse = REUSE[r.k], key = reuse || NEW[r.k]
  if (!key) { console.log('!! NO NAME for ' + JSON.stringify(r.k)); bad++; continue }
  if (!reuse && existing.has(key)) { console.log('!! NAME COLLISION: ' + key + ' already exists (zh=' + JSON.stringify(zhTab[key]) + ')'); bad++ }
  out.push({ key, reuse: !!reuse, src: r.k, zh: r.zh, en: r.en, owners: r.owners })
}
const names = out.map(o=>o.key)
const dup = names.filter((n,i)=>names.indexOf(n)!==i)
console.log('rows:', out.length, ' reused:', out.filter(o=>o.reuse).length, ' new:', out.filter(o=>!o.reuse).length)
console.log('duplicate proposed names:', dup.length ? dup.join(' ') : '(none)')
console.log('name collisions / missing:', bad)
fs.writeFileSync('p5e-final.json', JSON.stringify(out,null,1))
