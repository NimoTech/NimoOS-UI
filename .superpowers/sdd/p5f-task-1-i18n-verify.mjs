#!/usr/bin/env node
// P5f Task 1 — codepoint-by-codepoint verification of the i18n keys this task landed.
//
// Why this script exists (P5a Task 8 blood lesson, restated in every p5*-common-constraints.md
// §7 since, and in p5f-plan.md §1 T1-2): the appendix value table itself diffed clean against the
// Vue2 authoritative source, but *hand-copying* it into TS introduced 5 full-width punctuation
// typos that all three test gates missed. So the shipped values are never trusted from the
// appendix markdown, and never from eyeballing — they are re-derived here directly from
// `git show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json` and compared codepoint by codepoint
// against what actually landed in src/i18n/{zh_cn,en_us}.ts.
//
// 🔴 R10 / E-31 / E-44 — the en side NEVER assumes "en === the $t() key". Vue2's default AND
// fallback locale are both en_us (src/plugins/i18n.js:9-10), so the English UI renders
// `en_US.json`'s value, not the `$t()` key. This batch *measures* en === key for all 90 entries
// (printed below as a measurement, never used as a premise) — but the very same en_US.json
// carries 308 overrides among its 2676 entries (measured; e.g. lang_name -> "English"), which is
// exactly why Appendix A §A.0.1 orders the read to go through the JSON anyway. PART 4 manufactures
// the discriminator and proves the read is real; without it, this batch could not tell a correct
// script from the E-44 bug.
//
// Five independent checks, all required to pass:
//
//   PART 1 — the 79 NEW keys (Appendix A §A.6, minus the 11 reused rows). All 79 have a
//            Vue2-authoritative zh AND en value; this task created zero new copy. DoD = 79/79.
//
//   PART 2 — the 11 REUSED keys (Appendix A §A.2 minus ruling R3's three). These were NOT written
//            by this task (P5a/P5b/P5c/P5d shipped them); the check is "still untouched and still
//            equal to the Vue2 language pack", so a stray edit in this batch cannot silently
//            redefine copy an earlier phase already shipped. DoD = 11/11 MATCH.
//
//   PART 3 — the shipped values vs the *appendix markdown's own zh/en columns* (§A.6's 90-row
//            table), read from the working tree. PART 1/2 would still pass if the NEW_KEYS map
//            below named the wrong English source string and that wrong string happened to exist
//            in zh_CN.json — PART 3 is the independent artifact that catches it.
//
//   PART 4 — the en-authority provenance probe. Because this batch has zero en_US.json overrides
//            there is no natural "en ≠ key" material for a reverse assertion, so instead: mutate
//            one entry of the in-memory en_US.json and prove the en comparison goes red. If it
//            stayed green, the script would be reading the key instead of the JSON (= E-44) and
//            PART 1's en column would be worthless.
//
//   PART 5 — ruling R3's three keys. `Delete` / `Auto` / `Removed` collide value-for-value with
//            existing aiKb* keys on BOTH axes, so a reviewer cannot tell "correctly new" from
//            "should have been reused" by looking at values. This part pins the *decision*: the
//            three new keys exist, are NOT the pre-existing keys, and carry identical values to
//            them (which is the whole point — the split is semantic, per A-1, not textual).
//
// Usage: node .superpowers/sdd/p5f-task-1-i18n-verify.mjs
// Run from anywhere; paths are resolved relative to this file.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NEW_UI_ROOT = path.resolve(__dirname, '../../') // .superpowers/sdd/ -> repo root
const VUE2_REPO = '/home/nimo/NimoTech/NimoOS-UI'
const BLUEPRINT_SHA = '7a6ee6b7'
const APPENDIX_PATH = path.join(__dirname, 'p5f-appendix-A-i18n.md')

// ---------------------------------------------------------------------------
// PART 1 map: New-UI key -> Vue2 English original string (= the JSON key in both zh_CN.json and
// en_US.json). 79 entries, taken 1:1 from p5f-appendix-A-i18n.md §A.6's 90-row table minus the 11
// rows marked 🟢 可复用. Alphabetical by New-UI key name to match the marked block order in
// zh_cn.ts / en_us.ts.
//
// Stem convention (p5f-common-constraints.md §7): aiKbAl* = AllowlistView (35) ·
// aiKbRt* = RootsView (22) · aiKbWk* = WikiView (20) · stemless aiKb* = used by more than one of
// the three pages (2: aiKbAdd on Allowlist+Roots, aiKbRescanStarted on Roots+Wiki).
// ---------------------------------------------------------------------------
export const NEW_KEYS = {
  aiKbAdd: 'Add',
  aiKbAlAddFailed: 'Add failed',
  aiKbAlAddFolderRule: 'Add folder rule',
  aiKbAlAddRule: 'Add rule',
  aiKbAlAddedExt: 'Added {ext}',
  aiKbAlAdvancedCustom: 'Advanced: custom extensions',
  aiKbAlAllDeselected: 'All {group} deselected',
  aiKbAlAllSelected: 'All {group} selected',
  aiKbAlAllow: 'Allow',
  aiKbAlAllowDesc: 'Index files under this path',
  aiKbAlDeleteFailed: 'Delete failed',
  aiKbAlDeleteRule: 'Delete rule',
  aiKbAlDeletedCleaning: 'Deleted. Cleaning up affected files…',
  aiKbAlDeny: 'Deny',
  aiKbAlDenyDesc: 'Stop indexing this path',
  aiKbAlEnabledSuffix: 'enabled',
  aiKbAlExampleHint: 'Example: deny /Downloads/* to stop indexing that folder',
  aiKbAlFileTypes: 'File types',
  aiKbAlFileTypesHint: 'Unchecked types are no longer indexed',
  aiKbAlFolderRules: 'Folder rules',
  aiKbAlGroupCode: 'Code',
  aiKbAlGroupDocuments: 'Documents',
  aiKbAlGroupText: 'Text',
  aiKbAlLibrary: 'Library',
  aiKbAlLibraryHint: 'Use "any" to apply to all libraries',
  aiKbAlNoRules: 'No rules yet — click [+ Add rule] above to get started.',
  aiKbAlNowIndexing: 'Now indexing {ext}',
  aiKbAlPathHint: 'Wildcard * supported, e.g. /Photos/**/*.raw',
  aiKbAlPriorityFull:
    'Priority: Deny > Allow > Default-allow. Example: deny /Downloads/* to stop indexing that folder.',
  aiKbAlPriorityHint: 'Priority: Deny > Allow > Default-allow',
  aiKbAlSaveFailed: 'Save failed',
  aiKbAlSaveRule: 'Save rule',
  aiKbAlSavedCleaning: 'Saved. Cleaning up in background…',
  aiKbAlSelectAll: 'Select all',
  aiKbAlSelectNone: 'Select none',
  aiKbAlStoppedIndexing: 'Stopped indexing {ext}',
  aiKbRescanStarted: 'Rescan started',
  aiKbRtAddMirror: 'Add in mirror mode',
  aiKbRtAddRoot: 'Add root directory',
  aiKbRtAdvancedOptions: 'Advanced options',
  aiKbRtBackendTooOld: 'Backend version too old — deploy the Wiki service update first.',
  aiKbRtDelete: 'Delete',
  aiKbRtDeleteHint:
    'Index data in the knowledge base is kept; re-adding the same directory reuses it.',
  aiKbRtDeleteTitle: 'Delete index root?',
  aiKbRtEmpty: 'No index roots configured — the knowledge base will not index any files.',
  aiKbRtPurgeFiles: 'Also delete the generated .wiki.md files under this directory',
  aiKbRtReadOnly:
    'This directory is read-only — retry in mirror mode to store wiki data centrally.',
  aiKbRtRescanNow: 'Rescan now',
  aiKbRtRootAdded: 'Root added',
  aiKbRtRootDeleted: 'Root deleted',
  aiKbRtRootDisabled: 'Root disabled',
  aiKbRtRootEnabled: 'Root enabled',
  aiKbRtScanEvery: 'Scan every {h} h',
  aiKbRtScanInterval: 'Scan interval (hours)',
  aiKbRtSelectedPath: 'Selected path',
  aiKbRtSubtitle: 'Directories scanned for the knowledge base',
  aiKbRtWatchAuto: 'Auto',
  aiKbRtWatchMode: 'Watch mode',
  aiKbRtWatchScanOnly: 'Scan only',
  aiKbWkCollapsed: 'Collapsed — contents are not indexed individually',
  aiKbWkContents: 'Contents',
  aiKbWkEmptySub: 'Add a knowledge root and the wiki map will build itself from your folders.',
  aiKbWkEmptyTitle: 'No wiki has been generated yet',
  aiKbWkItemCount: '{n} items',
  aiKbWkMaintained: 'Maintained automatically by Nimo',
  aiKbWkNoSummarySub: 'It will be generated automatically on the next scan.',
  aiKbWkNoSummaryTitle: 'This folder has no wiki summary yet',
  aiKbWkOpAdded: 'Added',
  aiKbWkOpRemoved: 'Removed',
  aiKbWkOpRenamed: 'Renamed',
  aiKbWkOpUpdated: 'Updated',
  aiKbWkOpenFolder: 'Open folder',
  aiKbWkRecentChanges: 'Recent changes',
  aiKbWkRenderNote:
    'This page renders {path} — the index service rewrites it after folder changes',
  aiKbWkRenderedView: 'Rendered view',
  aiKbWkRescanRoot: 'Rescan this root',
  aiKbWkSummaryUpdated: 'Summary updated {t}',
  aiKbWkTreeError: 'Failed to load the wiki tree',
  aiKbWkViewSource: 'View source',
}

// ---------------------------------------------------------------------------
// PART 2 map: the 11 keys this batch REUSES without redefining (Appendix A §A.2's 14 rows minus
// ruling R3's three). All 11 are aiKb* family keys whose zh AND en value both equal this batch's
// copy, and whose semantic domain is the knowledge base itself.
// ---------------------------------------------------------------------------
export const REUSED_KEYS = {
  aiKbCancel: 'Cancel',
  aiKbColAction: 'Action',
  aiKbColPath: 'Path',
  aiKbLastScan: 'Last scan:',
  aiKbManageRoots: 'Manage roots',
  aiKbNavRoots: 'Index Roots',
  aiKbNever: 'never',
  aiKbOpFailed: 'Operation failed',
  aiKbRealtimeWatch: 'Real-time watch',
  aiKbRetry: 'Retry',
  aiKbScheduledScanOnly: 'Scheduled scan only',
}

// ---------------------------------------------------------------------------
// PART 5 map: ruling R3 — the three "same value, different semantic domain" splits. Left = the key
// this batch created; right = the pre-existing key A-1 forbids reusing, and why.
// ---------------------------------------------------------------------------
export const R3_SPLITS = [
  { newKey: 'aiKbRtDelete', rejected: 'aiKbNtDelete', why: 'aiKbNt* = Notes page; this is the Roots page delete button' },
  { newKey: 'aiKbRtWatchAuto', rejected: 'aiKbOriginAuto', why: 'aiKbOrigin* = note origin; this is the watch mode' },
  { newKey: 'aiKbRtWatchAuto', rejected: 'aiKbDeviceAuto', why: 'aiKbDevice* = Parser device; this is the watch mode' },
  { newKey: 'aiKbWkOpRemoved', rejected: 'aiKbStatusRemoved', why: 'aiKbStatus* = indexed-file status; this is a wiki change op label' },
]

export const BLOCK_MARKER = 'SP8-P5f Task 1'

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
// §0.4 hard rule: NimoOS-UI is read-only, `git show` only).
export function vue2Json(file) {
  const raw = execFileSync('git', ['show', `${BLUEPRINT_SHA}:src/assets/lang/${file}`], {
    cwd: VUE2_REPO,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
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

// Read back the keys actually present inside the `>>> SP8-P5f Task 1` ... `<<< SP8-P5f Task 1`
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

// PART 3: parse Appendix A §A.6's own zh / en columns. Rows look like
//   | 12 | `Library` | Al | 存储库 | Library | 🆕 新建 |
// i.e. idx | 蓝本 key | 页 | zh | en | 复用判定. Keyed by the *English source string* rather than
// by the New-UI key name, because §A.6 does not carry the New-UI key names (T1 assigns those).
function appendixRows() {
  const md = readFileSync(APPENDIX_PATH, 'utf8')
  const rows = new Map()
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    // ['', idx, 蓝本key, 页, zh, en, 复用判定, '']
    if (cells.length !== 8) continue
    if (!/^\d+$/.test(cells[1])) continue
    const m = cells[2].match(/^`(.+?)`(\s*🔸动态)?$/)
    if (!m) continue
    rows.set(m[1], { zh: cells[4], en: cells[5], verdict: cells[6], dynamic: !!m[2] })
  }
  return rows
}

function runAppendixCrossCheck(zhLocale, enLocale) {
  console.log(
    '===== PART 3 — shipped values vs Appendix A §A.6 zh/en columns (independent artifact) ====='
  )
  const rows = appendixRows()
  const all = { ...NEW_KEYS, ...REUSED_KEYS }
  const allKeys = Object.keys(all)
  let ok = true

  if (rows.size !== 90) {
    console.log(`FAIL: parsed ${rows.size} rows out of Appendix A §A.6, expected 90`)
    ok = false
  } else {
    console.log(`parsed 90 rows from ${path.relative(NEW_UI_ROOT, APPENDIX_PATH)}`)
  }

  const missingInAppendix = allKeys.filter((k) => !rows.has(all[k]))
  const mapped = new Set(allKeys.map((k) => all[k]))
  const extraInAppendix = [...rows.keys()].filter((e) => !mapped.has(e))
  if (missingInAppendix.length || extraInAppendix.length) {
    console.log('FAIL: English-source set mismatch vs appendix')
    console.log(
      `  in maps but not in appendix: ${missingInAppendix.map((k) => `${k}(${all[k]})`).join(', ') || '(none)'}`
    )
    console.log(`  in appendix but not in maps: ${extraInAppendix.join(', ') || '(none)'}`)
    ok = false
  }

  let matched = 0
  for (const key of allKeys) {
    const english = all[key]
    const row = rows.get(english)
    if (!row) continue
    const problems = []
    const zhDiffs = diffCodePoints(zhLocale[key] ?? '', row.zh)
    const enDiffs = diffCodePoints(enLocale[key] ?? '', row.en)
    for (const d of zhDiffs) {
      problems.push(`zh [codepoint ${d.index}] shipped=${d.actual} appendix=${d.expected}`)
    }
    for (const d of enDiffs) {
      problems.push(`en [codepoint ${d.index}] shipped=${d.actual} appendix=${d.expected}`)
    }
    // The appendix's own 复用判定 column must agree with which map the key sits in. This is what
    // catches "T1 quietly reused a key the appendix said to create" (and the reverse), which the
    // value comparison alone cannot see — every R3 row has identical values on both sides.
    const appendixSaysReuse = row.verdict.includes('可复用')
    const mapSaysReuse = key in REUSED_KEYS
    const isR3Row = ['Delete', 'Auto', 'Removed'].includes(english)
    if (appendixSaysReuse !== mapSaysReuse && !isR3Row) {
      problems.push(
        `reuse verdict: appendix="${row.verdict}" but this task ${mapSaysReuse ? 'reused' : 'created'} it`
      )
    }
    if (appendixSaysReuse !== mapSaysReuse && isR3Row) {
      console.log(
        `NOTE      ${key} ("${english}") — appendix §A.6 says 可复用, ruling R3 overrides it to 新建 (§A.2's own 🔴 note asks T1 to re-judge; report §4 explains each)`
      )
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
  console.log(`SUMMARY (PART 3): ${matched}/${allKeys.length} MATCH against §A.6's own columns`)
  console.log('')
  return ok
}

// PART 4: the en-authority provenance probe. See the header — with zero real overrides in this
// batch there is no "en ≠ key" material, so this manufactures the discriminator instead of
// declaring one.
function runEnProvenanceProbe(zhPack, enPack, zhLocale, enLocale) {
  console.log('===== PART 4 — en authority provenance probe (Appendix A §A.0.1 / E-44) =====')
  const probeKey = 'aiKbWkTreeError'
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
      'FAIL: the probe stayed GREEN — this script is NOT reading en from en_US.json (that is E-44). ' +
        "PART 1's en column would be worthless."
    )
    return false
  }
  console.log(
    'PART 4 OK: the probe went RED as required → PART 1/2 really compare against en_US.json\'s ' +
      'value, not against the $t() key.'
  )
  console.log('')
  return true
}

// PART 5: ruling R3's three splits (4 rows — `Auto` had two candidate keys to reject), pinned as
// a decision rather than as a value.
function runR3Check(zhLocale, enLocale) {
  console.log(
    '===== PART 5 — ruling R3: three same-value / different-domain splits (4 rejected keys) ====='
  )
  let ok = true
  for (const { newKey, rejected, why } of R3_SPLITS) {
    const problems = []
    if (typeof zhLocale[newKey] !== 'string') problems.push(`${newKey} missing in zh_cn.ts`)
    if (typeof enLocale[newKey] !== 'string') problems.push(`${newKey} missing in en_us.ts`)
    if (typeof zhLocale[rejected] !== 'string') {
      problems.push(`${rejected} no longer exists — R3's premise is gone, stop and report`)
    }
    if (newKey === rejected) problems.push('the new key IS the rejected key')
    // The values MUST still be identical: that is precisely why the split is semantic and not
    // textual. If they ever diverge, the other area changed its copy — which is the exact silent
    // breakage A-1 predicts, and the reason this batch did not reuse.
    if (
      typeof zhLocale[newKey] === 'string' &&
      typeof zhLocale[rejected] === 'string' &&
      zhLocale[newKey] !== zhLocale[rejected]
    ) {
      console.log(
        `NOTE      ${newKey}.zh has diverged from ${rejected}.zh ` +
          `(${JSON.stringify(zhLocale[newKey])} vs ${JSON.stringify(zhLocale[rejected])}) — ` +
          'this is A-1 coming true: reuse would have silently changed this area\'s copy.'
      )
    }
    if (problems.length) {
      console.log(`FAIL      ${newKey}: ${problems.join('; ')}`)
      ok = false
    } else {
      console.log(`OK        ${newKey} is its own key, not ${rejected} — ${why}`)
    }
  }
  console.log('')
  return ok
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
      console.log(
        `  in map but not in block: ${Object.keys(NEW_KEYS).filter((k) => !inBlock.includes(k))}`
      )
      if (dupes.length > 0) console.log(`  duplicated in block: ${dupes}`)
      process.exitCode = 1
    } else {
      console.log(
        `BLOCK-COVERAGE OK: ${name} marked block has exactly the ${inBlock.length} mapped keys, zero duplicates`
      )
    }
  }

  // The 11 reused keys must NOT be inside this task's marked block — reusing means "left where the
  // earlier phase put it", and a copy inside the block would be a duplicate object literal
  // property (last-wins, silently) rather than a reuse.
  for (const name of ['zh_cn.ts', 'en_us.ts']) {
    const inBlock = new Set(markedBlockKeys(name))
    const wrongly = Object.keys(REUSED_KEYS).filter((k) => inBlock.has(k))
    if (wrongly.length > 0) {
      console.log(`FAIL: ${name} marked block re-declares reused keys: ${wrongly.join(', ')}`)
      process.exitCode = 1
    } else {
      console.log(`REUSE OK: ${name} marked block re-declares none of the 11 reused keys`)
    }
  }
  console.log('')

  const okNew = runPart(
    'PART 1 — 79 new keys (Appendix A §A.6 minus the 11 reused rows)',
    NEW_KEYS,
    zhPack,
    enPack,
    zhLocale,
    enLocale
  )
  const okReused = runPart(
    'PART 2 — 11 reused keys (Appendix A §A.2 minus ruling R3), unchanged by this task',
    REUSED_KEYS,
    zhPack,
    enPack,
    zhLocale,
    enLocale
  )
  const okAppendix = runAppendixCrossCheck(zhLocale, enLocale)
  const okProbe = runEnProvenanceProbe(zhPack, enPack, zhLocale, enLocale)
  const okR3 = runR3Check(zhLocale, enLocale)

  if (Object.keys(NEW_KEYS).length !== 79) {
    console.log(`FAIL: NEW_KEYS has ${Object.keys(NEW_KEYS).length} entries, expected 79`)
    process.exitCode = 1
  }
  if (Object.keys(REUSED_KEYS).length !== 11) {
    console.log(`FAIL: REUSED_KEYS has ${Object.keys(REUSED_KEYS).length} entries, expected 11`)
    process.exitCode = 1
  }
  // Stem budget (p5f-common-constraints.md §7): 35 Al + 22 Rt + 20 Wk + 2 stemless = 79.
  const stem = (p) => Object.keys(NEW_KEYS).filter((k) => k.startsWith(p)).length
  const stemless = Object.keys(NEW_KEYS).filter((k) => !/^aiKb(Al|Rt|Wk)/.test(k)).length
  console.log(
    `STEM BUDGET: aiKbAl* ${stem('aiKbAl')} · aiKbRt* ${stem('aiKbRt')} · aiKbWk* ${stem('aiKbWk')} · stemless ${stemless}`
  )
  if (stem('aiKbAl') !== 35 || stem('aiKbRt') !== 22 || stem('aiKbWk') !== 20 || stemless !== 2) {
    console.log('FAIL: stem budget drifted from 35 / 22 / 20 / 2')
    process.exitCode = 1
  }

  // R10 measurement (NOT a premise — see the header). Appendix A §A.0.1 measured 0 overrides among
  // all 90; this recomputes it. A drift in either direction is worth stopping for: a new upstream
  // override means the shipped en value is no longer the rendered value.
  const all = { ...NEW_KEYS, ...REUSED_KEYS }
  const overrides = Object.entries(all).filter(([, english]) => enPack[english] !== english)
  const totalOverrides = Object.entries(enPack).filter(([k, v]) => v !== k).length
  console.log(
    `R10 MEASUREMENT: ${overrides.length}/90 en_US.json entries override the $t() key in THIS batch ` +
      `(Appendix A §A.0.1 measured 0)${overrides.length ? ': ' + overrides.map(([k]) => k).join(', ') : ''} — ` +
      `whole-file context: ${totalOverrides}/${Object.keys(enPack).length} entries do override, ` +
      'which is why the en side is read from the JSON regardless.'
  )
  if (overrides.length !== 0) {
    console.log(
      `FAIL: appendix measured 0 overrides for this batch, found ${overrides.length} — stop and report.`
    )
    process.exitCode = 1
  }

  // Every one of the 90 English source strings must exist in BOTH packs (0 self-invented copy).
  const noZh = Object.entries(all).filter(([, e]) => zhPack[e] === undefined)
  const noEn = Object.entries(all).filter(([, e]) => enPack[e] === undefined)
  console.log(
    `Vue2 coverage: zh_CN.json ${90 - noZh.length}/90, en_US.json ${90 - noEn.length}/90 ` +
      '(0 self-invented copy required)'
  )
  if (noZh.length || noEn.length) process.exitCode = 1

  // 90 distinct English sources across the two maps — a duplicate would mean two New-UI keys
  // silently render the same Vue2 string, i.e. one of them is unaccounted for.
  const englishes = Object.values(all)
  const dupEnglish = englishes.filter((e, i) => englishes.indexOf(e) !== i)
  console.log(
    `DISTINCT ENGLISH SOURCES: ${new Set(englishes).size}/90${dupEnglish.length ? ' — DUPLICATES: ' + [...new Set(dupEnglish)].join(', ') : ''}`
  )
  if (new Set(englishes).size !== 90) process.exitCode = 1

  if (!okNew || !okReused || !okAppendix || !okProbe || !okR3) process.exitCode = 1
  console.log('')
  console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS (all 5 parts)')
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main()
}
