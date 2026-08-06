#!/usr/bin/env node
// P5e Task 1 — codepoint-by-codepoint verification of the i18n keys this task landed.
//
// Why this script exists (P5a Task 8 blood lesson, restated in every p5*-common-constraints.md
// §7 since, and in p5e §5-1 of this task's brief): the appendix value table itself diffed clean
// against the Vue2 authoritative source, but *hand-copying* it into TS introduced 5 full-width
// punctuation typos that all three test gates missed. So the shipped values are never trusted
// from the appendix markdown, and never from eyeballing — they are re-derived here directly from
// `git show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json` and compared codepoint by codepoint
// against what actually landed in src/i18n/{zh_cn,en_us}.ts.
//
// 🔴 R10 / E-31 / E-44 — the en side NEVER assumes "en === the $t() key". P5a/P5b/P5c all
// measured zero en_US.json overrides and their scripts therefore compared the shipped en value
// against the literal English source string; P5d measured 2 real overrides and proved that
// assumption wrong (= E-44, the bug in the P5c template). Vue2's default AND fallback locale are
// both en_us (src/plugins/i18n.js:9-10), so the English UI renders `en_US.json`'s value, not the
// `$t()` key. This batch happens to measure `en === key` for all 63 entries — that is a
// *measured result*, printed below as such, NOT a premise: every en comparison below still reads
// `enPack[english]` out of en_US.json. PART 4 proves that the read really comes from the JSON.
//
// Four independent checks, all required to pass:
//
//   PART 1 — the 54 NEW keys (Appendix A §A.1 "新增(54)"). All 54 have a Vue2-authoritative zh
//            value; this task created zero new copy and left zero dead keys. DoD = 54/54 MATCH.
//
//   PART 2 — the 9 REUSED keys (Appendix A §A.1 "复用(9)"). These were NOT written by this task
//            (P5a Task 8 shipped them); the check is "still untouched and still equal to the Vue2
//            language pack", so a stray edit in this batch cannot silently redefine copy that
//            P5a already shipped. DoD = 9/9 MATCH.
//
//   PART 3 — the shipped values vs the *appendix markdown's own zh/en columns*, parsed out of
//            `git show <APPENDIX_SHA>:.superpowers/sdd/p5e-appendix-A-i18n.md`. PART 1/2 would
//            still pass if the NEW_KEYS map below named the wrong English source string and that
//            wrong string happened to exist in zh_CN.json — PART 3 is the independent artifact
//            that catches it. The appendix is read at a PINNED sha (not the working tree) because
//            a concurrent session is editing files under .superpowers/sdd/.
//
//   PART 4 — the en-authority provenance probe (Appendix A §A.4-3). Because this batch has zero
//            en_US.json overrides there is no natural "en ≠ key" material for a reverse
//            assertion, so instead: mutate one entry of the in-memory en_US.json and prove the
//            en comparison goes red. If it stayed green, the script would be reading the key
//            instead of the JSON (= E-44) and PART 1's en column would be worthless.
//
// Usage: node .superpowers/sdd/p5e-task-1-i18n-verify.mjs
// Run from anywhere; paths are resolved relative to this file.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NEW_UI_ROOT = path.resolve(__dirname, '../../') // .superpowers/sdd/ -> repo root
const VUE2_REPO = '/home/nimo/NimoTech/NimoOS-UI'
const BLUEPRINT_SHA = '7a6ee6b7'
// Pinned: the commit that shipped the reviewed Appendix A (T0 review = 63 values, 0 mismatch).
const APPENDIX_SHA = 'a3f5187'
const APPENDIX_PATH = '.superpowers/sdd/p5e-appendix-A-i18n.md'

// ---------------------------------------------------------------------------
// PART 1 map: New-UI key -> Vue2 English original string (= the JSON key in both zh_CN.json and
// en_US.json). 54 entries, taken 1:1 from p5e-appendix-A-i18n.md §A.1's "新增(54)" table
// ("蓝本 $t 串" column), alphabetical by New-UI key name to match the marked block order in
// zh_cn.ts / en_us.ts.
// ---------------------------------------------------------------------------
export const NEW_KEYS = {
  aiKbFdBack: 'Back to results',
  aiKbFdCopied: 'Copied',
  aiKbFdCopy: 'Copy content',
  aiKbFdCopyFailed: 'Copy failed — please select manually',
  aiKbFdDistill: 'Distill into note',
  aiKbFdDistillFailed: 'Could not queue this file',
  aiKbFdDistillQueued: 'Queued for note distillation',
  aiKbFdDownload: 'Download',
  aiKbFdNextSection: 'Next section',
  aiKbFdOpenFile: 'Open file',
  aiKbFdPage: 'Page {n}',
  aiKbFdPassage: 'Passage',
  aiKbFdPrevSection: 'Previous section',
  aiKbFdResults: 'Results',
  aiKbFdSection: 'Section {n}',
  aiKbFdSummary: 'Found {n} matching sections for "{query}", ranked by similarity',
  aiKbFvUnsupported: 'Preview not supported for this format',
  aiKbSrAdvOn: 'Enabled',
  aiKbSrAdvanced: 'Advanced',
  aiKbSrCountFiles: 'files',
  aiKbSrCountMatches: 'matches',
  aiKbSrDownloadFailed: 'Download failed',
  aiKbSrEmptySub: 'A few things to try:',
  aiKbSrEmptyTipAllowlist: 'Review the Allowlist rules',
  aiKbSrEmptyTipIndexed: 'Check whether the file has been indexed',
  aiKbSrEmptyTipKeyword: 'Try a different keyword or shorter description',
  aiKbSrEmptyTitle: 'No results found',
  aiKbSrErrorTitle: 'Search failed',
  aiKbSrFileType: 'File type',
  aiKbSrIdleSub:
    'Type anything in plain language — Nimo finds the matching documents on your NAS. Semantic matching, not just keyword.',
  aiKbSrIdleTitle: 'Search anything in natural language',
  aiKbSrMatchPill: '{n} matches',
  aiKbSrMatchTitle: '{n} matching sections',
  aiKbSrModified: 'Modified',
  aiKbSrMoreHint: '{n} more matching sections — click to view',
  aiKbSrMtimeAny: 'Any',
  aiKbSrMtimeMonth: 'Last 1 month',
  aiKbSrMtimeWeek: 'Last 1 week',
  aiKbSrMtimeYear: 'Last 1 year',
  aiKbSrNoPath: 'File path unavailable',
  aiKbSrNoPreviewToast: 'No preview for this format — please download',
  aiKbSrOpenFailed: 'Open failed',
  aiKbSrPlaceholder: 'Search your documents…',
  aiKbSrPopupBlocked: 'Popup blocked by browser',
  aiKbSrQuality: 'Ranking quality',
  aiKbSrQualityAccurate: 'Accurate',
  aiKbSrQualityFast: 'Fast',
  aiKbSrRelHigh: 'High',
  aiKbSrRelLow: 'Low',
  aiKbSrRelMid: 'Mid',
  aiKbSrRerankWarn: 'Rerank unavailable, fell back to fast',
  aiKbSrSimilarity: 'Similarity',
  aiKbSrTopK: 'Top-K results',
  aiKbSrUntitled: '(Untitled)',
}

// ---------------------------------------------------------------------------
// PART 2 map: the 9 keys this batch REUSES without redefining (Appendix A §A.1 "复用(9)" +
// §A.1.1's per-key justification). All 9 are aiKb* family keys shipped by P5a Task 8.
// ---------------------------------------------------------------------------
export const REUSED_KEYS = {
  aiKbClose: 'Close',
  aiKbSampleContract: 'contract from last year',
  aiKbSampleIphone: 'iPhone setup',
  aiKbSamplePythonAsync: 'Python async',
  aiKbSampleSkating: 'figure skating',
  aiKbSampleThyroid: 'thyroid',
  aiKbSearch: 'Search',
  aiKbStatusIndexed: 'Indexed',
  aiKbTry: 'Try',
}

export const BLOCK_MARKER = 'SP8-P5e Task 1'

function codePoints(str) {
  return Array.from(str).map((ch) => ch.codePointAt(0))
}

function fmt(cp) {
  return cp === undefined
    ? '<end of string>'
    : `U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${String.fromCodePoint(cp)})`
}

function diffCodePoints(actual, expected) {
  const ap = codePoints(actual)
  const bp = codePoints(expected)
  const max = Math.max(ap.length, bp.length)
  const diffs = []
  for (let i = 0; i < max; i++) {
    if (ap[i] !== bp[i]) diffs.push({ index: i, actual: fmt(ap[i]), expected: fmt(bp[i]) })
  }
  return diffs
}

// Read the Vue2 authoritative language packs via `git show 7a6ee6b7:...` — never `cat` the shared
// working tree (it sits on an older branch with other sessions' uncommitted changes; governance
// §1 hard rule: NimoOS-UI is read-only, `git show` only).
export function vue2Json(file) {
  const raw = execFileSync('git', ['show', `${BLUEPRINT_SHA}:src/assets/lang/${file}`], {
    cwd: VUE2_REPO,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  return JSON.parse(raw)
}

// Load a New-UI locale module. It's TS (`export default {...}`) rather than JSON, so pull out the
// object literal and evaluate it in an isolated Function scope — good enough for a flat object of
// string literals, and it deliberately reads the shipped file rather than any build artifact.
export function loadLocale(name) {
  const src = readFileSync(path.join(NEW_UI_ROOT, 'src/i18n', name), 'utf8')
  const objSource = src.slice(src.indexOf('{'))
  // eslint-disable-next-line no-new-func
  return new Function(`'use strict'; return (${objSource.replace(/;\s*$/, '')})`)()
}

function runPart(title, keyMap, zhPack, enPack, zhLocale, enLocale, mutatedEnKeys = new Set()) {
  console.log(`===== ${title} =====`)
  const keys = Object.keys(keyMap)
  let matched = 0

  for (const key of keys) {
    const english = keyMap[key]
    const vue2Zh = zhPack[english]
    const vue2En = enPack[english] // R10: this — NOT `english` — is the en authority.
    const gotZh = zhLocale[key]
    const gotEn = enLocale[key]
    const problems = []

    if (vue2Zh === undefined) problems.push(`no zh_CN.json entry for English source "${english}"`)
    if (vue2En === undefined) problems.push(`no en_US.json entry for English source "${english}"`)
    if (typeof gotZh !== 'string') problems.push('key missing (or non-string) in zh_cn.ts')
    if (typeof gotEn !== 'string') problems.push('key missing (or non-string) in en_us.ts')

    if (problems.length === 0) {
      const zhDiffs = diffCodePoints(gotZh, vue2Zh)
      const enDiffs = diffCodePoints(gotEn, vue2En)
      const overrideNote =
        vue2En !== english ? `  [R10: en_US.json overrides "${english}" -> "${vue2En}"]` : ''
      const probeNote = mutatedEnKeys.has(key) ? '  [PART 4 probe: en_US.json entry mutated]' : ''
      if (zhDiffs.length === 0 && enDiffs.length === 0) {
        matched++
        console.log(`MATCH     ${key}${overrideNote}${probeNote}`)
        continue
      }
      console.log(
        `MISMATCH  ${key}  —  codepoint diff vs Vue2 source "${english}"${overrideNote}${probeNote}`
      )
      for (const d of zhDiffs) {
        console.log(`            zh [codepoint ${d.index}] new-ui=${d.actual}  vue2=${d.expected}`)
      }
      for (const d of enDiffs) {
        console.log(
          `            en [codepoint ${d.index}] new-ui=${d.actual}  vue2(en_US.json)=${d.expected}`
        )
      }
      console.log(`            new-ui zh: ${JSON.stringify(gotZh)}`)
      console.log(`            vue2   zh: ${JSON.stringify(vue2Zh)}`)
      console.log(`            new-ui en: ${JSON.stringify(gotEn)}`)
      console.log(`            vue2   en: ${JSON.stringify(vue2En)}`)
      continue
    }

    console.log(`MISMATCH  ${key}  —  ${problems.join('; ')}`)
  }

  console.log('')
  console.log(`SUMMARY (${title}): ${matched}/${keys.length} MATCH`)
  console.log('')
  return matched === keys.length
}

// Read back the keys actually present inside the `>>> SP8-P5e Task 1` ... `<<< SP8-P5e Task 1`
// marked block of a locale file. NEW_KEYS above is hand-written, so a *missing* entry there would
// otherwise go unnoticed (a mistyped English source self-detects — the zh_CN.json lookup fails —
// but an omission does not). This closes that gap by comparing the map's key set against what the
// shipped file's marked block really contains.
function markedBlockKeys(name) {
  const src = readFileSync(path.join(NEW_UI_ROOT, 'src/i18n', name), 'utf8')
  const start = src.indexOf(`// >>> ${BLOCK_MARKER}`)
  const end = src.indexOf(`// <<< ${BLOCK_MARKER}`)
  if (start < 0 || end < 0) throw new Error(`marked block not found in ${name}`)
  return src
    .slice(start, end)
    .split('\n')
    .map((l) => l.match(/^ {2}([a-zA-Z0-9_]+):/))
    .filter(Boolean)
    .map((m) => m[1])
}

// PART 3: parse the appendix markdown's own zh / en columns. Rows look like
//   | 12 | `aiKbFdCopy` | `Copy content` | 复制内容 | Copy content | FD |
// for §A.1 新增, and
//   | 1 | `aiKbClose` | `Close` | 关闭 | Close | FD |
// for §A.1 复用. Both have the same 6-cell shape: idx | key | $t串 | zh | en | 用处.
function appendixRows() {
  const md = execFileSync('git', ['show', `${APPENDIX_SHA}:${APPENDIX_PATH}`], {
    cwd: NEW_UI_ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  const rows = new Map()
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    // ['', idx, key, $t, zh, en, 用处, '']
    if (cells.length !== 8) continue
    const keyCell = cells[2]
    const m = keyCell.match(/^`?(aiKb[A-Za-z0-9]+)`?$/)
    if (!m) continue
    if (!/^\d+$/.test(cells[1])) continue
    const key = m[1]
    const strip = (s) => s.replace(/^`(.*)`$/, '$1')
    rows.set(key, { english: strip(cells[3]), zh: strip(cells[4]), en: strip(cells[5]) })
  }
  return rows
}

function runAppendixCrossCheck(zhLocale, enLocale) {
  console.log('===== PART 3 — shipped values vs Appendix A §A.1 zh/en columns (independent artifact) =====')
  const rows = appendixRows()
  const allKeys = [...Object.keys(NEW_KEYS), ...Object.keys(REUSED_KEYS)]
  let ok = true

  if (rows.size !== 63) {
    console.log(`FAIL: parsed ${rows.size} rows out of the appendix tables, expected 63`)
    ok = false
  } else {
    console.log(`parsed 63 rows from ${APPENDIX_SHA}:${APPENDIX_PATH}`)
  }

  const missingInAppendix = allKeys.filter((k) => !rows.has(k))
  const extraInAppendix = [...rows.keys()].filter((k) => !allKeys.includes(k))
  if (missingInAppendix.length || extraInAppendix.length) {
    console.log(`FAIL: key-set mismatch vs appendix`)
    console.log(`  in maps but not in appendix: ${missingInAppendix.join(', ') || '(none)'}`)
    console.log(`  in appendix but not in maps: ${extraInAppendix.join(', ') || '(none)'}`)
    ok = false
  }

  let matched = 0
  for (const key of allKeys) {
    const row = rows.get(key)
    if (!row) continue
    const mapEnglish = NEW_KEYS[key] ?? REUSED_KEYS[key]
    const problems = []
    if (row.english !== mapEnglish) {
      problems.push(`English source: map="${mapEnglish}" appendix="${row.english}"`)
    }
    const zhDiffs = diffCodePoints(zhLocale[key] ?? '', row.zh)
    const enDiffs = diffCodePoints(enLocale[key] ?? '', row.en)
    for (const d of zhDiffs) {
      problems.push(`zh [codepoint ${d.index}] shipped=${d.actual} appendix=${d.expected}`)
    }
    for (const d of enDiffs) {
      problems.push(`en [codepoint ${d.index}] shipped=${d.actual} appendix=${d.expected}`)
    }
    if (problems.length === 0) {
      matched++
      continue
    }
    console.log(`MISMATCH  ${key}`)
    for (const p of problems) console.log(`            ${p}`)
    ok = false
  }
  console.log('')
  console.log(`SUMMARY (PART 3): ${matched}/${allKeys.length} MATCH against the appendix's own columns`)
  console.log('')
  return ok
}

// PART 4: the en-authority provenance probe. See the header — with zero real overrides in this
// batch there is no "en ≠ key" material, so this manufactures the discriminator instead of
// declaring one.
function runEnProvenanceProbe(zhPack, enPack, zhLocale, enLocale) {
  console.log('===== PART 4 — en authority provenance probe (Appendix A §A.4-3) =====')
  const probeKey = 'aiKbSrEmptyTitle'
  const english = NEW_KEYS[probeKey]
  const mutatedEn = { ...enPack, [english]: `${enPack[english]} MUTATED-BY-PROBE` }
  console.log(
    `mutating the in-memory en_US.json entry for "${english}": ` +
      `${JSON.stringify(enPack[english])} -> ${JSON.stringify(mutatedEn[english])}`
  )
  const ok = runPart(
    'PART 4 probe run — expected to go RED on exactly 1 key',
    { [probeKey]: english },
    zhPack,
    mutatedEn,
    zhLocale,
    enLocale,
    new Set([probeKey])
  )
  if (ok) {
    console.log(
      `FAIL: the probe stayed GREEN — this script is NOT reading en from en_US.json (that is E-44). ` +
        `PART 1's en column would be worthless.`
    )
    return false
  }
  console.log(
    `PART 4 OK: the probe went RED as required → PART 1/2 really compare against en_US.json's ` +
      `value, not against the $t() key.`
  )
  console.log('')
  return true
}

function main() {
  const zhPack = vue2Json('zh_CN.json')
  const enPack = vue2Json('en_US.json')
  const zhLocale = loadLocale('zh_cn.ts')
  const enLocale = loadLocale('en_us.ts')

  // Block-coverage cross-check (both locales) before the codepoint diff.
  const expected = Object.keys(NEW_KEYS).sort().join(',')
  for (const name of ['zh_cn.ts', 'en_us.ts']) {
    const inBlock = markedBlockKeys(name)
    const dupes = inBlock.filter((k, i) => inBlock.indexOf(k) !== i)
    const actual = [...inBlock].sort().join(',')
    if (actual !== expected || dupes.length > 0) {
      console.log(`FAIL: ${name} marked block key set != NEW_KEYS map`)
      console.log(`  in block but not in map: ${inBlock.filter((k) => !(k in NEW_KEYS))}`)
      console.log(`  in map but not in block: ${Object.keys(NEW_KEYS).filter((k) => !inBlock.includes(k))}`)
      if (dupes.length > 0) console.log(`  duplicated in block: ${dupes}`)
      process.exitCode = 1
    } else {
      console.log(
        `BLOCK-COVERAGE OK: ${name} marked block has exactly the ${inBlock.length} mapped keys, zero duplicates`
      )
    }
  }

  // The 9 reused keys must NOT be inside this task's marked block — reusing means "left where
  // P5a put it", and a copy inside the block would be a duplicate object literal property
  // (last-wins, silently) rather than a reuse.
  for (const name of ['zh_cn.ts', 'en_us.ts']) {
    const inBlock = new Set(markedBlockKeys(name))
    const wrongly = Object.keys(REUSED_KEYS).filter((k) => inBlock.has(k))
    if (wrongly.length > 0) {
      console.log(`FAIL: ${name} marked block re-declares reused keys: ${wrongly.join(', ')}`)
      process.exitCode = 1
    } else {
      console.log(`REUSE OK: ${name} marked block re-declares none of the 9 reused keys`)
    }
  }
  console.log('')

  const okNew = runPart('PART 1 — 54 new keys (Appendix A §A.1 新增)', NEW_KEYS, zhPack, enPack, zhLocale, enLocale)
  const okReused = runPart(
    'PART 2 — 9 reused keys (Appendix A §A.1 复用 / §A.1.1), unchanged by this task',
    REUSED_KEYS,
    zhPack,
    enPack,
    zhLocale,
    enLocale
  )
  const okAppendix = runAppendixCrossCheck(zhLocale, enLocale)
  const okProbe = runEnProvenanceProbe(zhPack, enPack, zhLocale, enLocale)

  if (Object.keys(NEW_KEYS).length !== 54) {
    console.log(`FAIL: NEW_KEYS has ${Object.keys(NEW_KEYS).length} entries, expected 54`)
    process.exitCode = 1
  }
  if (Object.keys(REUSED_KEYS).length !== 9) {
    console.log(`FAIL: REUSED_KEYS has ${Object.keys(REUSED_KEYS).length} entries, expected 9`)
    process.exitCode = 1
  }

  // R10 measurement (NOT a premise — see the header). Appendix A §A.0 measured 0 overrides among
  // all 63; this recomputes it. A drift in either direction is worth stopping for: a new upstream
  // override means the shipped en value is no longer the rendered value.
  const all = { ...NEW_KEYS, ...REUSED_KEYS }
  const overrides = Object.entries(all).filter(([, english]) => enPack[english] !== english)
  console.log(
    `R10 MEASUREMENT: ${overrides.length}/63 en_US.json entries override the $t() key ` +
      `(Appendix A §A.0 measured 0)${overrides.length ? ': ' + overrides.map(([k]) => k).join(', ') : ''}`
  )
  if (overrides.length !== 0) {
    console.log(
      `FAIL: appendix measured 0 overrides for this batch, found ${overrides.length} — stop and report.`
    )
    process.exitCode = 1
  }

  // Every 63 English source string must exist in BOTH packs (0 self-invented copy).
  const noZh = Object.entries(all).filter(([, e]) => zhPack[e] === undefined)
  const noEn = Object.entries(all).filter(([, e]) => enPack[e] === undefined)
  console.log(
    `Vue2 coverage: zh_CN.json ${63 - noZh.length}/63, en_US.json ${63 - noEn.length}/63 ` +
      `(0 self-invented copy required)`
  )
  if (noZh.length || noEn.length) process.exitCode = 1

  if (!okNew || !okReused || !okAppendix || !okProbe) process.exitCode = 1
  console.log('')
  console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS (all 4 parts)')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
