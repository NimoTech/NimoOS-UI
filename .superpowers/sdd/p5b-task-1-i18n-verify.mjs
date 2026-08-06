#!/usr/bin/env node
// P5b Task 1 — codepoint-by-codepoint verification of the 95 aiKb* keys that have a
// Vue2 authoritative zh value (Appendix A §A.1, 95 rows). Mirrors the P5a Task 8
// lesson (governance §12 E-*, brief line 35-42): the appendix table itself was
// diffed clean against the Vue2 source, but *hand-copying* it into TS introduced 5
// full-width-punctuation typos that all three test gates missed. This script closes
// that gap by re-deriving the Vue2 value directly from `git show main:...` (not from
// the appendix markdown, not by eyeballing) and comparing every codepoint against
// what actually landed in zh_cn.ts.
//
// Scope: only the 95 keys in Appendix A §A.1 (all "have a Vue2 source" per the task
// brief / governance file — this is NOT 89, that was the plan doc's mistake, see
// governance §12 E-1). The 9 reused keys (A.0) were not touched by this task. The 4
// keys in A.2 are new copy with no Vue2 source (K16/K18/K19). The 1 key in A.4
// (aiKbStatusIndexing / K20) has no Vue2 zh_CN.json entry (that's the whole point of
// K20 — Vue2 falls back to showing the raw English string there too), so it is
// excluded from this codepoint diff by design, not by oversight.
//
// Usage: node .superpowers/sdd/p5b-task-1-i18n-verify.mjs
// Run from the New-UI repo root (paths below are relative to it).

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NEW_UI_ROOT = path.resolve(__dirname, '../../') // .superpowers/sdd/ -> repo root
const VUE2_REPO = '/home/nimo/NimoTech/NimoOS-UI'

// key -> Vue2 English original string (= the JSON key in zh_CN.json).
// Taken 1:1 from p5b-appendix-A-i18n.md §A.1 "Vue2 英文原串" column (95 rows).
const KEY_TO_VUE2_ENGLISH = {
  aiKbAll: 'All',
  aiKbAllCaughtUp: 'All caught up',
  aiKbCancel: 'Cancel',
  aiKbCancelFailed: 'Cancel failed',
  aiKbCancelSelected: 'Cancel selected',
  aiKbCancelled: 'Cancelled',
  aiKbCancelledNSelected: 'Cancelled {n} selected jobs',
  aiKbCannotCancel: 'This job can no longer be cancelled.',
  aiKbClear: 'Clear',
  aiKbClearFailedConfirmBody: 'This will permanently remove all {n} failed records.',
  aiKbClearFailedConfirmTitle: 'Clear failed records?',
  aiKbClearFailedErr: 'Clear failed',
  aiKbClearFailedRecords: 'Clear failed records',
  aiKbClearFilters: 'Clear filters',
  aiKbClearSelected: 'Clear selected',
  aiKbClearedNFailed: 'Cleared {n} failed records',
  aiKbClose: 'Close',
  aiKbColAction: 'Action',
  aiKbColFile: 'File',
  aiKbColPath: 'Path',
  aiKbColSize: 'Size',
  aiKbColTime: 'Time',
  aiKbColType: 'Type',
  aiKbColVectors: 'Vectors',
  aiKbConfirmClear: 'Confirm clear',
  aiKbConfirmRebuildN: 'Confirm rebuild ({n})',
  aiKbFailedOnly: 'Failed only',
  aiKbLegacy: 'Legacy',
  aiKbLegacyDoc: 'Legacy .doc',
  aiKbLegacyDocTip: 'Quick-filter legacy .doc files',
  aiKbLoadErrorLabel: 'Load error:',
  aiKbMonthsAgo: '{n} months ago',
  aiKbNFailedRecords: '{n} failed records',
  aiKbNIndexedFiles: '{n} indexed files',
  aiKbNPendingJobs: '{n} pending jobs',
  aiKbNRetried: '{n}× retried',
  aiKbNRunningJobs: '{n} running jobs',
  aiKbNSelected: '{n} selected',
  aiKbNoFailedDistill: 'No failed distillation jobs.',
  aiKbNoFailedJobs: 'No failed jobs — the index service is running normally.',
  aiKbNoMatchSub:
    'No files match these filters. Try widening the path / type prefix, or switch status to All.',
  aiKbNoMatchTitle: 'No matching files',
  aiKbNoRunningJobs: 'No running jobs',
  aiKbOriginAuto: 'Auto',
  aiKbOriginManual: 'Manual',
  aiKbOverExplicitCap: 'Exceeds {cap} limit — use rebuild-all instead',
  aiKbPagerNext: 'Next',
  aiKbPagerPrev: 'Previous',
  aiKbPathPrefix: 'Path prefix',
  aiKbPerPage: 'Per page',
  aiKbPollTip: 'Auto-refreshes every 30 s while rows are indexing',
  aiKbPolling: 'Auto-refreshing · 30s',
  aiKbQueueEmpty: 'Queue is empty',
  aiKbQueuedNJobs: 'Queued {n} jobs',
  aiKbRebuild: 'Rebuild',
  aiKbRebuildAllBody1:
    'Force-rebuild all {n} matching files — this may take several minutes.',
  aiKbRebuildAllBody2:
    'The backend will tombstone then re-queue each file; old search content will be replaced.',
  aiKbRebuildAllInRoot: 'Rebuild all in Root',
  aiKbRebuildAllOverCap:
    '{n} files — exceeds the single-batch {cap} limit; the server may reject this (400). Narrow the path prefix and rebuild in batches.',
  aiKbRebuildAllTip: 'Rebuild the {n} files matching current filters',
  aiKbRebuildAllTitle: 'Rebuild entire matching set?',
  aiKbRebuildCapHint: 'Rebuild exceeds the {cap} limit — narrow the path prefix and retry.',
  aiKbRebuildFailed: 'Rebuild failed',
  aiKbRebuildRowTip: 'Force rebuild this row',
  aiKbRebuildSelectedN: 'Rebuild selected ({n})',
  aiKbRebuilding: 'Rebuilding…',
  aiKbRequeued: 'Requeued',
  aiKbRetry: 'Retry',
  aiKbRetryAllFailed: 'Retry all failed',
  aiKbRetryFailedErr: 'Retry failed',
  aiKbRetrySelected: 'Retry selected',
  aiKbRoot: 'Root',
  aiKbScopeDistill: 'Document distillation',
  aiKbScopeIndex: 'File indexing',
  aiKbSelectAllTip: 'Select all selectable rows on this page',
  aiKbSelectFilesHint: 'Select files to force-rebuild',
  aiKbShowingFirst200: 'Showing first 200 — bulk action still covers all.',
  aiKbShowingFirstN: 'Showing first {n} — narrow the filter to see the rest.',
  aiKbShowingRange: 'Showing {from}–{to} of {total}',
  aiKbSkipped: 'Skipped',
  aiKbSortAsc: 'Ascending',
  aiKbSortDesc: 'Descending',
  aiKbSortIndexTime: 'Index time',
  aiKbSortVectorCount: 'Vector count',
  aiKbStatusActive: 'Active',
  aiKbStatusError: 'Error',
  aiKbStatusIndexed: 'Indexed',
  aiKbStatusRemoved: 'Removed',
  aiKbTombstonedNoSelect: 'Tombstoned files cannot be selected',
  aiKbTombstonedTip: 'Deleted — rescan to restore',
  aiKbTotalDone: 'Total done:',
  aiKbTotalDoneLabel: 'Total done',
  aiKbTypePrefix: 'Type prefix',
  aiKbZeroVec: 'No searchable content',
  aiKbZeroVecTip: 'Indexed but has no searchable content (not an error)',
}

function codePoints(str) {
  return Array.from(str).map((ch) => ch.codePointAt(0))
}

function diffCodePoints(a, b) {
  const ap = codePoints(a)
  const bp = codePoints(b)
  const max = Math.max(ap.length, bp.length)
  const diffs = []
  for (let i = 0; i < max; i++) {
    if (ap[i] !== bp[i]) {
      diffs.push({
        index: i,
        expected: bp[i] !== undefined ? `U+${bp[i].toString(16).toUpperCase().padStart(4, '0')} (${String.fromCodePoint(bp[i])})` : '<end of string>',
        actual: ap[i] !== undefined ? `U+${ap[i].toString(16).toUpperCase().padStart(4, '0')} (${String.fromCodePoint(ap[i])})` : '<end of string>',
      })
    }
  }
  return diffs
}

function main() {
  // 1. Load the Vue2 authoritative JSON via `git show main:...` (read-only, no
  //    checkout/cat of the shared working tree — governance §1 hard rule).
  const vue2Json = execFileSync(
    'git',
    ['show', 'main:src/assets/lang/zh_CN.json'],
    { cwd: VUE2_REPO, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  )
  const vue2 = JSON.parse(vue2Json)

  // 2. Load the New-UI zh_cn.ts we just wrote. It's a TS module (`export default {...}`),
  //    not JSON, so extract the object literal text and eval it in an isolated Function
  //    scope rather than parsing TS properly — good enough for a string-literal object.
  const tsSource = readFileSync(path.join(NEW_UI_ROOT, 'src/i18n/zh_cn.ts'), 'utf8')
  const objStart = tsSource.indexOf('{')
  const objSource = tsSource.slice(objStart)
  // eslint-disable-next-line no-new-func
  const zhCn = new Function(`'use strict'; return (${objSource.replace(/;\s*$/, '')})`)()

  // 3. Compare every one of the 95 keys, codepoint by codepoint.
  const keys = Object.keys(KEY_TO_VUE2_ENGLISH)
  let matchCount = 0
  const results = []

  for (const key of keys) {
    const englishSource = KEY_TO_VUE2_ENGLISH[key]
    const vue2Value = vue2[englishSource]
    const newUiValue = zhCn[key]

    if (vue2Value === undefined) {
      results.push({ key, status: 'MISMATCH', reason: `no Vue2 zh_CN.json entry for English source "${englishSource}"` })
      continue
    }
    if (newUiValue === undefined) {
      results.push({ key, status: 'MISMATCH', reason: `key missing from zh_cn.ts` })
      continue
    }
    if (typeof newUiValue !== 'string') {
      results.push({ key, status: 'MISMATCH', reason: `zh_cn.ts value is not a string: ${JSON.stringify(newUiValue)}` })
      continue
    }

    const diffs = diffCodePoints(newUiValue, vue2Value)
    if (diffs.length === 0) {
      matchCount++
      results.push({ key, status: 'MATCH' })
    } else {
      results.push({
        key,
        status: 'MISMATCH',
        reason: `codepoint diff vs Vue2 "${englishSource}" -> "${vue2Value}"`,
        newUiValue,
        vue2Value,
        diffs,
      })
    }
  }

  // 4. Print every result (not just failures) so the report can paste the full log.
  for (const r of results) {
    if (r.status === 'MATCH') {
      console.log(`MATCH     ${r.key}`)
    } else {
      console.log(`MISMATCH  ${r.key}  —  ${r.reason}`)
      if (r.diffs) {
        for (const d of r.diffs) {
          console.log(`            [codepoint ${d.index}] new-ui=${d.actual}  vue2=${d.expected}`)
        }
        console.log(`            new-ui: ${JSON.stringify(r.newUiValue)}`)
        console.log(`            vue2:   ${JSON.stringify(r.vue2Value)}`)
      }
    }
  }

  console.log('')
  console.log(`SUMMARY: ${matchCount}/${keys.length} MATCH`)

  if (matchCount !== keys.length) {
    process.exitCode = 1
  }
}

main()
