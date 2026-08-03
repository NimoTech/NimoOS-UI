#!/usr/bin/env node
// P5c Task 1 — codepoint-by-codepoint verification of the i18n keys this task landed.
//
// Why this script exists (P5a Task 8 blood lesson, restated in p5c-common-constraints.md
// §7 and the T1 brief §3.2): the appendix value table itself diffed clean against the
// Vue2 authoritative source, but *hand-copying* it into TS introduced 5 full-width
// punctuation typos that all three test gates missed. So the values are never trusted
// from the appendix markdown or from eyeballing — they are re-derived here directly from
// `git show main:src/assets/lang/zh_CN.json` and compared codepoint by codepoint against
// what actually landed in src/i18n/zh_cn.ts.
//
// Two independent checks, both required to pass:
//
//   PART 1 — the 99 NEW keys (Appendix A §A.2's 98 rows + `aiKbDeviceAuto` from
//            coordinator ruling A-1). All 99 have a Vue2-authoritative zh value; this
//            task created zero new copy. DoD = 99/99 MATCH.
//            Bonus (same loop): en value must equal the literal $t() English original,
//            re-derived from `git show main:src/assets/lang/en_US.json` — T0 measured zero
//            overrides in that file, and this re-verifies it rather than assuming it.
//
//   PART 2 — the 10 REUSED keys (Appendix A §A.1's 11 rows minus `aiKbOriginAuto`, which
//            ruling A-1 moved out of the reuse set). These were NOT written by this task;
//            the check is "still untouched and still equal to the Vue2 language pack",
//            so that a stray edit in this batch cannot silently redefine copy that P5a/
//            P5b already shipped. DoD = 10/10 MATCH.
//
// Usage: node .superpowers/sdd/p5c-task-1-i18n-verify.mjs
// Run from anywhere; paths are resolved relative to this file.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NEW_UI_ROOT = path.resolve(__dirname, '../../') // .superpowers/sdd/ -> repo root
const VUE2_REPO = '/home/nimo/NimoTech/NimoOS-UI'

// ---------------------------------------------------------------------------
// PART 1 map: New-UI key -> Vue2 English original string (= the JSON key in both
// zh_CN.json and en_US.json). 99 entries. Taken 1:1 from p5c-appendix-A-i18n.md §A.2's
// "Vue2 英文原串" column (98 rows) plus aiKbDeviceAuto -> 'Auto' (ruling A-1).
// ---------------------------------------------------------------------------
const NEW_KEYS = {
  aiKbConcurrencyLevel: 'Concurrency level',
  aiKbDeviceAuto: 'Auto',
  aiKbFbEmpty: '(empty)',
  aiKbFbLoadFailed: 'Failed to load folders',
  aiKbFbLoading: 'Loading…',
  aiKbFbNoVolumes: 'No volumes detected — type a path above',
  aiKbFbVolumes: 'Volumes',
  aiKbInferenceDevice: 'Inference device',
  aiKbPause: 'Pause',
  aiKbPrCcFullPower: 'Full power',
  aiKbPrCcPowerSaving: 'Power-saving',
  aiKbPrDetailsTitle: 'Parser details',
  aiKbPrFoldersTitle: 'Pending folders (top {top} of {total} groups)',
  aiKbPrIndexedVectors: 'Indexed vectors',
  aiKbPrNoPending: 'No pending',
  aiKbPrOcrHint: '5–10× slower, only useful for truly scanned documents',
  aiKbPrOcrLabel: 'Enable OCR for scanned PDFs (RapidOCR)',
  aiKbPrQueueDone: 'Done',
  aiKbPrQueueRunning: 'Processing',
  aiKbPrRecentFailures: 'Recent failures ({n})',
  aiKbPrResolvedHint: '→ actual {device}',
  aiKbPrTestLink: 'Test sandbox',
  aiKbPrUnreachable: 'Parser service is not running or unreachable.',
  aiKbPtAsWellAs: 'as well as',
  aiKbPtBackLink: 'Back to details',
  aiKbPtChooseFile: 'Choose file',
  aiKbPtChunksTitle: 'Chunk results ({n} chunks)',
  aiKbPtDefaults:
    'Defaults: target=600, overlap=80, min=2 (sandbox loose values; production uses 600/80/5–20).',
  aiKbPtDoclingToggle: 'docling markdown output ({n} chars)',
  aiKbPtDragDrop: 'or drag and drop here',
  aiKbPtHelp1: 'Upload a file to see how Parser processes it (chunking + embedding + scoring).',
  aiKbPtHelpNoWrite: 'Will not write to index',
  aiKbPtHelpPreviewOnly: 'preview only',
  aiKbPtMaxSize:
    'Max 30 MB. PDF will trigger model weight download (~200 MB, one-time) on first run.',
  aiKbPtOcr: 'OCR (scanned PDF)',
  aiKbPtOverlapNote:
    'overlap only applies to plain text; markdown/source splits by paragraph or function boundary.',
  aiKbPtProcessing: 'Processing…',
  aiKbPtQueryPlaceholder: '(Optional) Enter a query to compute cosine similarity per chunk',
  aiKbPtReset: 'Reset',
  aiKbPtRun: 'Run',
  aiKbPtScoredTitle: 'Query similarity ranking (top {n})',
  aiKbPtSupports: 'Supports text files such as',
  aiKbPtTitle: 'Parser test sandbox',
  aiKbPtTooBig: 'File exceeds 30 MB, not supported in sandbox',
  aiKbPtViaDocling: '(converted to markdown via docling)',
  aiKbPtZeroChunks: 'Parsed 0 chunks. The file may be too short or all segments were filtered out.',
  aiKbResume: 'Resume',
  aiKbResumed: 'Resumed',
  aiKbSetAutoCapture: 'Auto-capture insights',
  aiKbSetAutoCaptureCn: 'Auto-capture conversation insights',
  aiKbSetAutoCaptureDesc:
    'After a conversation goes idle, worthwhile conclusions are saved as AI-draft notes for your review.',
  aiKbSetAutoCaptureOff: 'Auto-capture disabled',
  aiKbSetAutoCaptureOffWarn: 'Disabled — queued drafts are discarded as well',
  aiKbSetAutoCaptureOn: 'Auto-capture enabled',
  aiKbSetChange: 'Change',
  aiKbSetChecking: 'Checking…',
  aiKbSetConcurrencyDesc:
    'Higher values are faster but use more resources. 4 is recommended when the NAS is idle.',
  aiKbSetConcurrencySet: 'Concurrency set to {n}',
  aiKbSetConcurrentFiles: 'Concurrent files',
  aiKbSetCurrentlyUsing: 'Currently using:',
  aiKbSetDangerZone: 'Danger zone',
  aiKbSetDeviceAutoCurrent: 'Auto (currently {r})',
  aiKbSetDeviceCn: 'Inference device — for maintainers',
  aiKbSetDeviceSet: 'Inference device: {label}',
  aiKbSetDirEmptyMigratable: 'Empty folder · can migrate',
  aiKbSetDirNotEmpty: 'Not empty — point-to only',
  aiKbSetMigrateAck: 'I understand this moves files on disk',
  aiKbSetMigrateNotEmpty: 'This folder is not empty.',
  aiKbSetMigrateReq1:
    'The target folder must be empty — the server refuses to move into a non-empty folder.',
  aiKbSetMigrateReq2: 'Files are moved (not copied); the old folder is left empty.',
  aiKbSetMigrateReq3:
    'Notes are briefly read-only during the move; it usually finishes in seconds.',
  aiKbSetMigrateStart: 'Start moving',
  aiKbSetMigrateTitle: 'Move note files?',
  aiKbSetMoveFiles: 'Move files to new directory…',
  aiKbSetNotesFolder: 'Notes folder',
  aiKbSetNotesFolderCn: 'Where note markdown files live',
  aiKbSetNotesFolderDesc: 'Each user has a subfolder; files are plain Markdown.',
  aiKbSetNotesFolderUpdated: 'Notes folder updated',
  aiKbSetNotesSection: 'Knowledge notes',
  aiKbSetNotesSectionHint: 'Notes are Markdown files on disk',
  aiKbSetOcrCn: 'OCR for scanned PDFs',
  aiKbSetOcrOff: 'OCR disabled',
  aiKbSetOcrOn: 'OCR enabled',
  aiKbSetOcrOnlyScanned: 'Only useful for scanned PDFs.',
  aiKbSetOcrTitle: 'OCR for scanned documents',
  aiKbSetOcrWarn: 'Enabling this slows indexing 5–10×',
  aiKbSetPickNote:
    '"Point to" keeps files where they are and adopts the .md files already in the folder; "Move" relocates your existing note files there (the target must be empty).',
  aiKbSetPointToExisting: 'Point to existing directory',
  aiKbSetRebuildAll: 'Rebuild all indexes',
  aiKbSetRebuildAllDesc: 'Drops all existing indexes and re-scans all files.',
  aiKbSetRebuildEllipsis: 'Rebuild…',
  aiKbSetSandboxHint: 'Parse a single file without touching the index',
  aiKbSetSandboxTitle: 'Test Sandbox',
  aiKbSetSelected: 'Selected',
  aiKbSetSvcPausedDesc: 'New files will not be indexed automatically',
  aiKbSetSvcPausedLine: '⏸ Paused',
  aiKbSetSvcRunningDesc: 'Continuously monitoring and indexing new files',
  aiKbSetSvcRunningLine: '✅ Running',
  aiKbSwitchFailed: 'Switch failed',
}

// ---------------------------------------------------------------------------
// PART 2 map: the 10 keys this batch REUSES without redefining. Appendix A §A.1's 11
// rows minus aiKbOriginAuto (ruling A-1 replaced that reuse with the new aiKbDeviceAuto).
// ---------------------------------------------------------------------------
const REUSED_KEYS = {
  aiKbCcBalanced: 'Balanced',
  aiKbCancel: 'Cancel',
  aiKbDeferredTitle: 'Coming soon',
  aiKbFailed: 'Failed',
  aiKbLastSynced: 'Last synced',
  aiKbOpFailed: 'Operation failed',
  aiKbPaused: 'Paused',
  aiKbPending: 'Pending',
  aiKbRefresh: 'Refresh',
  aiKbRunning: 'Running',
}

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

// Read the Vue2 authoritative language packs via `git show main:...` — never `cat` the
// shared working tree (it sits on an older branch with other sessions' uncommitted
// changes; governance §1 hard rule).
function vue2Json(file) {
  const raw = execFileSync('git', ['show', `main:src/assets/lang/${file}`], {
    cwd: VUE2_REPO,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  return JSON.parse(raw)
}

// Load a New-UI locale module. It's TS (`export default {...}`) rather than JSON, so pull
// out the object literal and evaluate it in an isolated Function scope — good enough for a
// flat object of string literals, and it deliberately reads the shipped file rather than
// any intermediate artifact.
function loadLocale(name) {
  const src = readFileSync(path.join(NEW_UI_ROOT, 'src/i18n', name), 'utf8')
  const objSource = src.slice(src.indexOf('{'))
  // eslint-disable-next-line no-new-func
  return new Function(`'use strict'; return (${objSource.replace(/;\s*$/, '')})`)()
}

function runPart(title, keyMap, zhPack, enPack, zhLocale, enLocale) {
  console.log(`===== ${title} =====`)
  const keys = Object.keys(keyMap)
  let matched = 0

  for (const key of keys) {
    const english = keyMap[key]
    const vue2Zh = zhPack[english]
    const vue2En = enPack[english]
    const gotZh = zhLocale[key]
    const gotEn = enLocale[key]
    const problems = []

    if (vue2Zh === undefined) problems.push(`no zh_CN.json entry for English source "${english}"`)
    if (typeof gotZh !== 'string') problems.push('key missing (or non-string) in zh_cn.ts')
    if (typeof gotEn !== 'string') problems.push('key missing (or non-string) in en_us.ts')

    if (problems.length === 0) {
      const zhDiffs = diffCodePoints(gotZh, vue2Zh)
      // en value must be the literal $t() English original. en_US.json is expected to map
      // each English key to itself (T0: zero overrides) — assert that instead of assuming.
      if (vue2En !== undefined && vue2En !== english) {
        problems.push(`en_US.json overrides "${english}" to "${vue2En}"`)
      }
      const enDiffs = diffCodePoints(gotEn, english)
      if (zhDiffs.length === 0 && enDiffs.length === 0 && problems.length === 0) {
        matched++
        console.log(`MATCH     ${key}`)
        continue
      }
      console.log(`MISMATCH  ${key}  —  codepoint diff vs Vue2 source "${english}"`)
      for (const d of zhDiffs) {
        console.log(`            zh [codepoint ${d.index}] new-ui=${d.actual}  vue2=${d.expected}`)
      }
      for (const d of enDiffs) {
        console.log(`            en [codepoint ${d.index}] new-ui=${d.actual}  vue2=${d.expected}`)
      }
      for (const p of problems) console.log(`            ${p}`)
      console.log(`            new-ui zh: ${JSON.stringify(gotZh)}`)
      console.log(`            vue2   zh: ${JSON.stringify(vue2Zh)}`)
      console.log(`            new-ui en: ${JSON.stringify(gotEn)}`)
      console.log(`            vue2   en: ${JSON.stringify(english)}`)
      continue
    }

    console.log(`MISMATCH  ${key}  —  ${problems.join('; ')}`)
  }

  console.log('')
  console.log(`SUMMARY (${title}): ${matched}/${keys.length} MATCH`)
  console.log('')
  return matched === keys.length
}

// Read back the keys actually present inside the `>>> SP8-P5c Task 1` ... `<<< SP8-P5c
// Task 1` marked block of a locale file. NEW_KEYS above is hand-written, so a *missing*
// entry there would otherwise go unnoticed (a mistyped English source self-detects — the
// zh_CN.json lookup fails — but an omission does not). This closes that gap by comparing
// the map's key set against what the shipped file's marked block really contains.
function markedBlockKeys(name) {
  const src = readFileSync(path.join(NEW_UI_ROOT, 'src/i18n', name), 'utf8')
  const start = src.indexOf('// >>> SP8-P5c Task 1')
  const end = src.indexOf('// <<< SP8-P5c Task 1')
  if (start < 0 || end < 0) throw new Error(`marked block not found in ${name}`)
  return src
    .slice(start, end)
    .split('\n')
    .map((l) => l.match(/^ {2}([a-zA-Z0-9_]+):/))
    .filter(Boolean)
    .map((m) => m[1])
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
      console.log(`BLOCK-COVERAGE OK: ${name} marked block has exactly the ${inBlock.length} mapped keys, zero duplicates`)
    }
  }
  console.log('')

  const okNew = runPart(
    'PART 1 — 99 new keys (Appendix A §A.2 98 rows + aiKbDeviceAuto per ruling A-1)',
    NEW_KEYS,
    zhPack,
    enPack,
    zhLocale,
    enLocale
  )
  const okReused = runPart(
    'PART 2 — 10 reused keys (Appendix A §A.1 minus aiKbOriginAuto), unchanged by this task',
    REUSED_KEYS,
    zhPack,
    enPack,
    zhLocale,
    enLocale
  )

  if (Object.keys(NEW_KEYS).length !== 99) {
    console.log(`FAIL: NEW_KEYS has ${Object.keys(NEW_KEYS).length} entries, expected 99`)
    process.exitCode = 1
  }
  if (Object.keys(REUSED_KEYS).length !== 10) {
    console.log(`FAIL: REUSED_KEYS has ${Object.keys(REUSED_KEYS).length} entries, expected 10`)
    process.exitCode = 1
  }
  if (!okNew || !okReused) process.exitCode = 1
}

main()
