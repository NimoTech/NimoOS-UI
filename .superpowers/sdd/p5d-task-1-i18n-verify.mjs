#!/usr/bin/env node
// P5d Task 1 — codepoint-by-codepoint verification of the i18n keys this task landed.
//
// Why this script exists (P5a Task 8 blood lesson, restated in every p5*-common-constraints.md
// §7 since): the appendix value table itself diffed clean against the Vue2 authoritative
// source, but *hand-copying* it into TS introduced full-width punctuation typos that all
// three test gates missed. So the values are never trusted from the appendix markdown or
// from eyeballing — they are re-derived here directly from
// `git show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json` and compared codepoint by codepoint
// against what actually landed in src/i18n/{zh_cn,en_us}.ts.
//
// 🔴 R10 — the one thing this script does DIFFERENTLY from its p5c-task-1-i18n-verify.mjs
// ancestor: P5a/P5b/P5c all measured ZERO en_US.json overrides, so those scripts compared the
// shipped en value against the literal $t() English source string. That assumption is FALSE
// for this batch (p5d-appendix-A-i18n.md §A.0①, coordinator ruling R10) — en_US.json has 2
// real overrides here (`this cannot be undone` -> `this cannot be undone.`,
// `Note item` -> `Note`), and Vue2's default AND fallback locale are both en_us
// (src/plugins/i18n.js:9-10), so the English UI renders en_US.json's value, not the source
// string. This script therefore ALWAYS compares the shipped en value against
// `en_US.json[english]` (never against the literal `english` key) — that is correct whether
// or not en_US.json happens to override a given entry, and generalizes better than special-
// casing the 2 known overrides.
//
// Two independent checks, both required to pass:
//
//   PART 1 — the 92 NEW keys (Appendix A §A.2). All 92 have a Vue2-authoritative zh value;
//            this task created zero new copy, left zero dead keys. DoD = 92/92 MATCH.
//
//   PART 2 — the 7 REUSED keys (Appendix A §A.1, coordinator ruling A-6). These were NOT
//            written by this task; the check is "still untouched and still equal to the
//            Vue2 language pack", so a stray edit in this batch cannot silently redefine
//            copy that P5a/P5b/P5c already shipped. DoD = 7/7 MATCH.
//
// Usage: node .superpowers/sdd/p5d-task-1-i18n-verify.mjs
// Run from anywhere; paths are resolved relative to this file.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NEW_UI_ROOT = path.resolve(__dirname, '../../') // .superpowers/sdd/ -> repo root
const VUE2_REPO = '/home/nimo/NimoTech/NimoOS-UI'
const BLUEPRINT_SHA = '7a6ee6b7'

// ---------------------------------------------------------------------------
// PART 1 map: New-UI key -> Vue2 English original string (= the JSON key in both
// zh_CN.json and en_US.json). 92 entries, taken 1:1 from p5d-appendix-A-i18n.md §A.2's
// "Vue2 英文原串" column (alphabetical by New-UI key name, matching the marked block order
// in zh_cn.ts / en_us.ts).
// ---------------------------------------------------------------------------
const NEW_KEYS = {
  aiKbAiDraft: 'AI draft',
  aiKbArchived: 'Archived',
  aiKbCurated: 'Curated',
  aiKbNeAdoptedDisk: 'Loaded the latest version — your body was replaced',
  aiKbNeBackToList: 'Back to list',
  aiKbNeBasedOnRev: 'based on rev {n}',
  aiKbNeBold: 'Bold',
  aiKbNeBulletList: 'Bullet list',
  aiKbNeCodeBlock: 'Code block',
  aiKbNeConfirmAsCurated: 'Confirm as curated note',
  aiKbNeConflictBody:
    'While you were editing, the file on disk changed (maybe Obsidian or another tab). Choose which body to keep — your title, summary and tags stay as typed.',
  aiKbNeConflictMine: 'Your unsaved edits',
  aiKbNeConflictTheirs: 'Latest version on disk',
  aiKbNeConflictTitle: 'This note was saved by someone else first',
  aiKbNeCopyMyBody: 'Copy my body',
  aiKbNeCopyPath: 'Copy path',
  aiKbNeDescPlaceholder: 'One-line summary (shown in lists and search)',
  aiKbNeDraftBar1: 'This is an',
  aiKbNeDraftBar2: 'AI-captured draft',
  aiKbNeDraftBar3: ', not curated knowledge yet',
  aiKbNeDraftBarSub: 'Confirm to move it into the knowledge base — you can edit first, then confirm.',
  aiKbNeDraftCopied: 'Your draft copied',
  aiKbNeEditDirectHint: 'Editing the file directly also works — synced back within 60 s',
  aiKbNeFileManager: 'File manager',
  aiKbNeFileOnDisk: 'File on disk',
  aiKbNeH2: 'Heading 2',
  aiKbNeH3: 'Heading 3',
  aiKbNeItalic: 'Italic',
  aiKbNeKeepMine: 'Keep my edits',
  aiKbNeKeptMine: 'Kept your edits — saving will overwrite rev {n}',
  aiKbNeLastModified: 'Last modified',
  aiKbNeMdPlaceholder: '# Markdown source…',
  aiKbNeNChars: '{n} characters',
  aiKbNeNewFileHint: 'A .md file is created in the notes folder on save',
  aiKbNeNewStatusHint: 'Becomes a curated note once saved',
  aiKbNeNotSavedYet: 'Not saved yet',
  aiKbNeOpenConversation: 'Open source conversation',
  aiKbNePathCopied: 'Path copied',
  aiKbNeProperties: 'Properties',
  aiKbNeQuote: 'Quote',
  aiKbNeReferencedBy: 'Referenced by',
  aiKbNeRemoveTag: 'Remove',
  aiKbNeRevealFile: 'Reveal in file manager',
  aiKbNeRichText: 'Rich text',
  aiKbNeSave: 'Save',
  aiKbNeSaved: 'Saved',
  aiKbNeSavedRev: 'Saved · rev {n}',
  aiKbNeSaving: 'Saving…',
  aiKbNeSource: 'Source',
  aiKbNeSourceConversation: 'Source conversation',
  aiKbNeSources: 'Sources',
  aiKbNeStrike: 'Strikethrough',
  aiKbNeTagsPlaceholder: 'Tags, comma separated…',
  aiKbNeTitlePlaceholder: 'Note title…',
  aiKbNeUnsaved: 'Unsaved changes',
  aiKbNeUseDisk: 'Use disk version',
  aiKbNoteConfirmed: 'Note confirmed',
  aiKbNoteSrcAgent: 'Written by agent',
  aiKbNoteSrcHuman: 'Written by you',
  aiKbNoteSrcPipeline: 'Auto-captured',
  aiKbNoteTypeDigest: 'Digest',
  aiKbNoteTypeInsight: 'Insight',
  aiKbNoteTypeNote: 'Note item', // R10: en_US.json overrides this to 'Note'
  aiKbNoteTypeSummary: 'Summary',
  aiKbNtAllTypes: 'All types',
  aiKbNtArchive: 'Archive',
  aiKbNtArchiveInstead: 'Archive instead',
  aiKbNtConfirm: 'Confirm',
  aiKbNtConfirmAll: 'Confirm all',
  aiKbNtDelete: 'Delete',
  aiKbNtDeleteBody1: 'The Markdown file on disk is deleted with it —',
  aiKbNtDeleteBody2: 'this cannot be undone', // R10: en_US.json overrides to 'this cannot be undone.'
  aiKbNtDeleteBody3: 'If you only need it out of the way, use Archive instead.',
  aiKbNtDeleteTitle: 'Delete note?',
  aiKbNtEmptySub:
    'After a chat with the agent, worthwhile conclusions become AI drafts automatically; you can also create a note directly, or drop .md files into the notes folder.',
  aiKbNtEmptyTitle: 'No notes yet',
  aiKbNtInboxFootHint: 'From "Auto-capture insights" — can be turned off under Advanced → Knowledge notes',
  aiKbNtInboxSub:
    'Conclusions captured after conversations. Confirm to make them curated knowledge, delete to discard.',
  aiKbNtInboxTitle: 'AI drafts awaiting review',
  aiKbNtListFoot: '{n} notes — searchable globally, recallable by the agent and exposed read-only via MCP',
  aiKbNtNDraftsConfirmed: '{n} drafts confirmed',
  aiKbNtNewNote: 'New Note',
  aiKbNtNoMatch: 'No notes match the filter',
  aiKbNtNoteArchived: 'Note archived',
  aiKbNtNoteDeleted: 'Note deleted',
  aiKbNtOpenFolder: 'Open in file manager',
  aiKbNtPathLead: 'Every note is a Markdown file in',
  aiKbNtPathTail: 'edit them with Obsidian or the file manager, synced within 60 s',
  aiKbNtReviewOneByOne: 'Review one by one',
  aiKbRelDaysAgo: '{n} d ago',
  aiKbRelHrAgo: '{n} h ago',
  aiKbRelMinAgo: '{n} min ago',
}

// ---------------------------------------------------------------------------
// PART 2 map: the 7 keys this batch REUSES without redefining (Appendix A §A.1,
// coordinator ruling A-6).
// ---------------------------------------------------------------------------
const REUSED_KEYS = {
  aiKbAll: 'All',
  aiKbCancel: 'Cancel',
  aiKbClearFilters: 'Clear filters',
  aiKbOpFailed: 'Operation failed',
  aiKbStatus: 'Status',
  aiKbColType: 'Type',
  aiKbJustNow: 'just now',
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

// Read the Vue2 authoritative language packs via `git show 7a6ee6b7:...` — never `cat` the
// shared working tree (it sits on an older branch with other sessions' uncommitted changes;
// governance §1 hard rule).
function vue2Json(file) {
  const raw = execFileSync('git', ['show', `${BLUEPRINT_SHA}:src/assets/lang/${file}`], {
    cwd: VUE2_REPO,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  return JSON.parse(raw)
}

// Load a New-UI locale module. It's TS (`export default {...}`) rather than JSON, so pull
// out the object literal and evaluate it in an isolated Function scope — good enough for a
// flat object of string literals, and it deliberately reads the shipped file rather than any
// intermediate artifact.
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
      const overrideNote = vue2En !== english ? `  [R10: en_US.json overrides "${english}" -> "${vue2En}"]` : ''
      if (zhDiffs.length === 0 && enDiffs.length === 0) {
        matched++
        console.log(`MATCH     ${key}${overrideNote}`)
        continue
      }
      console.log(`MISMATCH  ${key}  —  codepoint diff vs Vue2 source "${english}"${overrideNote}`)
      for (const d of zhDiffs) {
        console.log(`            zh [codepoint ${d.index}] new-ui=${d.actual}  vue2=${d.expected}`)
      }
      for (const d of enDiffs) {
        console.log(`            en [codepoint ${d.index}] new-ui=${d.actual}  vue2(en_US.json)=${d.expected}`)
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

// Read back the keys actually present inside the `>>> SP8-P5d Task 1` ... `<<< SP8-P5d
// Task 1` marked block of a locale file. NEW_KEYS above is hand-written, so a *missing*
// entry there would otherwise go unnoticed (a mistyped English source self-detects — the
// zh_CN.json lookup fails — but an omission does not). This closes that gap by comparing
// the map's key set against what the shipped file's marked block really contains.
function markedBlockKeys(name) {
  const src = readFileSync(path.join(NEW_UI_ROOT, 'src/i18n', name), 'utf8')
  const start = src.indexOf('// >>> SP8-P5d Task 1')
  const end = src.indexOf('// <<< SP8-P5d Task 1')
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

  const okNew = runPart('PART 1 — 92 new keys (Appendix A §A.2)', NEW_KEYS, zhPack, enPack, zhLocale, enLocale)
  const okReused = runPart(
    'PART 2 — 7 reused keys (Appendix A §A.1 / ruling A-6), unchanged by this task',
    REUSED_KEYS,
    zhPack,
    enPack,
    zhLocale,
    enLocale
  )

  if (Object.keys(NEW_KEYS).length !== 92) {
    console.log(`FAIL: NEW_KEYS has ${Object.keys(NEW_KEYS).length} entries, expected 92`)
    process.exitCode = 1
  }
  if (Object.keys(REUSED_KEYS).length !== 7) {
    console.log(`FAIL: REUSED_KEYS has ${Object.keys(REUSED_KEYS).length} entries, expected 7`)
    process.exitCode = 1
  }

  // R10 sanity: exactly 2 keys in NEW_KEYS should show an en_US.json override — if this
  // count drifts, either a new override appeared upstream (stop and report) or one of the
  // 2 known overrides silently stopped being an override (also worth flagging).
  const overrides = Object.entries(NEW_KEYS).filter(([, english]) => enPack[english] !== english)
  if (overrides.length !== 2) {
    console.log(
      `FAIL: expected exactly 2 en_US.json overrides among NEW_KEYS (R10), found ${overrides.length}: ${overrides
        .map(([k]) => k)
        .join(', ')}`
    )
    process.exitCode = 1
  } else {
    console.log(`R10 OK: exactly 2 en_US.json overrides found — ${overrides.map(([k, e]) => `${k} ("${e}" -> "${enPack[e]}")`).join(', ')}`)
  }

  if (!okNew || !okReused) process.exitCode = 1
}

main()
