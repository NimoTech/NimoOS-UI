import { describe, it, expect } from 'vitest'
// Replicate three environment gotchas recorded in settingsStyles.test.ts's header,
// copying the same solutions verbatim (not re-discovering them, just reusing the existing solution):
// ① This repo package.json is "type": "module" → __dirname is unavailable under ESM, use
//    import.meta.url + fileURLToPath equivalent instead.
// ② Type declarations for node:fs / node:path / node:url are provided by `@types/node`. Already installed
//    in this repo, `pnpm exec vue-tsc --noEmit` (one of the three task gate commands)
//    passes directly, **no need for** @ts-expect-error suppression — earlier suppression lines
//    were already deleted during merge.
// ③ Don't use Vite's `?raw` import as an alternative to node:fs — vitest includes CSSEnablerPlugin
//    that uniformly replaces all css/scss to empty string (ignores query strings), ?raw import would cause assertions
//    to "falsely pass" on empty strings. Fall back to node:fs.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

// Same approach as settingsStyles.test.ts: only strip line comments starting with //
// (this file doesn't have that style, but keep consistency with precedent) + block comments,
// then use toContain to prevent assertions being falsely matched by class names/strings mentioned in comments
// (P2b second review proved this with RED probe).
function stripComments(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

const rawSource = read('./knowledge.scss')
const css = stripComments(rawSource)

// Same as stripComments, but replace comment content with **equal number of spaces**
// and preserve line breaks → line numbers align exactly with source file. For assertions that
// need to report true line numbers / need to compare relative line order of two rules
// (stripComments eats line breaks in multi-line comments, making reported line numbers
// shorter than in source file, which misleads reviewers to wrong lines).
// Method exactly follows the precedent in parserStyles.test.ts:43-48, not a new invention.
function blankComments(scss: string): string {
  return scss
    .replace(/\/\*[\s\S]*?\*\//g, (m: string) => m.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/.*$/gm, (_m: string, indent: string) => indent)
}
const cssKeepLines = blankComments(rawSource)

// R1 (coordinator decision) — Appendix D.1's 32 + coordinator-added 6 k-empty* = 38 classes,
// are the complete set of classes that should appear in T4 (token declaration layer + shell segment + keyframes),
// exactly that many, no more no less.
//
// [T11 addition] Dashboard k2-* segment in Appendix D.2: coordinator's original brief says "64 k2-* + k-suggest-chip
// = 65", but testing shows it's a typo: using `sed -n '/### D.2/,/### D.3/p' brief.md | grep -oE
// 'k2?-[a-z0-9-]+'` | sort -u` after dedup gives 64 (63 k2-* + 1 k-suggest-chip),
// independently verified against blueprint `git show main:…/knowledge.scss | sed -n '2282,2452p' | grep -oE
// '\.k2?-[a-z0-9-]+' | sort -u` also exactly 64, and the two sets match item-by-item
// (`diff` zero differences). So whitelist expanded to 38 + 64 = **102** classes, not 103 as written in brief.
//
// Shared foundation segment (blueprint :241-252 / :253-257 / :735-968 / :1296-1316 +
// :1335-1341 / :1398-1428 / :1484-1499 / :2031-2039) adds 32 classes from Appendix D.1,
// 102 → **134** (plan's 101 → 133 was wrong, see Appendix D §D.0: the constant itself is named
// WHITELIST_102, array testing shows 102 items). Independent verification: extract the seven segments above with sed
// then `grep -oE '\.k[a-z0-9-]*-[a-z0-9-]+|\.k-btn|\.k-row|\.k-view|…' | sort -u` gives 34,
// minus already-in-whitelist k-btn (base class moved in P5a) and k-scroll (only appears in blueprint comment :250-252),
// exactly 32, matching Appendix D.1 one-to-one.
//
// "Indexed Files" page exclusive segment (blueprint :1705-2022, S8) adds 53 classes from Appendix D.2,
// 134 → **187** (plan's 186 was wrong, same as above, see Appendix D §D.0). Independent verification:
// `git show main:…/knowledge.scss | sed -n '1705,2022p' | grep -oE '^\.k[a-z0-9-]+|
// ^\.k[a-z0-9-]+(?=[[:.,{ ])' | sort -u` gives 54, minus already-in-whitelist k-btn
// (`.k-filter-bar .k-btn` / `.k-pager .k-btn` two places just adjust height of existing base class),
// exactly 53, matching Appendix D.2 one-to-one.
//
// "Knowledge Base Config Page + Folder Chooser" using 10 segments
// (blueprint knowledge.scss :969-984 / :1141-1149 / :1159-1179 / :1181-1201 / :1203-1225 / :1227-1247 /
// :1249-1265 / :1267-1293 / :1317-1334 / :2250-2263, plus blueprint FolderBrowser.vue:82-143
// <style scoped> entire segment) adds 39 classes from P5c Appendix D.1,
// 187 → **226** (governance §6.4-3 wrote 191 as example of just K17's 4, accurate increment per Appendix D §D.0,
// testing this file also shows 39). Independent verification: extract these 10 segments + FolderBrowser style block
// `grep -oE '\.(k|k2|kn|fb)[a-z0-9-]*' | sort -u` gives 47, minus 8 already in whitelist
// (k-btn / k-modal / k-modal-bg / k-modal-foot / k-scroll / k-scroll-inner / k-view /
// kn-badge, all moved in P5a/P5b), exactly 39, matching Appendix D.1 one-to-one.
// 🔴 Explicitly not in this list (see knowledge.scss header comment): k-section-body
// (blueprint :985-991, Allowlist-exclusive) and k-progress-card/-row/-label/-nums/-bar/-fill
// (blueprint :1152-1157, N15) — the "no over-moving" assertion below is responsible for ensuring
// these 7 classes don't appear at all.
//
// "Notes area" exclusive segment (blueprint :2029/:2040-2045(A)· :2047-2056(B)·
// :2057-2085(C)· :2086-2121(D)· :2122-2194(E, includes ProseMirror segment)· :2195-2241(F)·
// :2242-2249(G)· :2265-2281(H)· :551-571(K43 .k-seg)) adds 65 k-prefix new classes
// from Appendix D §D.1, 226 → **293** (constant name changes with number, this file's convention;
// 226 + 65 + 2 = 293, the 2 are non-k-prefix classes nme-content/ProseMirror added by R9, see section below).
// 🔴 Both governance/plan versions of "missing 66 classes / have 21" are incorrect (E-39),
// coordinator's decision R9 corrected final value to 293, independently reproduced with a
// standalone script (baseline state output
// **before** editing this file: old 225 / new 225, strict superset self-proof).
// K45 (decision R1) moved-in .k-btn.text doesn't go in this whitelist — it's `text` within
// compound class `.k-btn.text`, the "no over-moving" regex below (see) can't scan `text` inside
// compound classes, `text` only goes to NON_K_HELPER_CLASSES (see section below),
// can't be in both (R8/R9 mutual exclusion, tested verified).
//
// "File Aggregated Search" two screens + in-app preview 7 segments
// (blueprint knowledge.scss :351-367(S1)· :457-549(S2)· :573-681(S3)· :726-732(S4)· :1548-1562(S5)·
// :1572-1672(S6), plus KFileViewer.vue:71-76 + :102-119(KF)) adds **55** k-prefix new classes
// listed verbatim in P5e Appendix D §D.7.1, 293 → **348** (constant name changes with number,
// this file's convention).
// 🔴 Final value per decision R8 (independently reproduced with a separately rewritten simulator,
// not from self-reported numbers); independently re-ran the reproduction script,
// reproduced 292→347 / 293→348 / 16→19 and 74=54/17/3.
// ⚠️ **The 1 difference between "constant length ≠ NEW_RE count" is pre-existing, don't "fix" it** —
// that one is `knowledge-app`, true cause is NEW_RE's `k(?:2|n)?-` branch requires `k-`/`k2-`/`kn-`,
// but `knowledge-app` is `kn` + `o`, **doesn't match at all** (decision R8 corrected
// the wrong reasoning in Appendix §D.7.1 about "greedy prefix eating" —
// go by the numbers, don't infer from that reasoning).
// 🔴 **Correction**: this task expanded that branch to `k(?:2|n|r|w)?-` (decision R1),
// `knowledge-app` **still doesn't match** (`k` + optional group consumes `n`, then expects `-`
// but finds `o`; empty match then expects `-` but finds `n`) ⇒ **this 1 difference remains 1 after this phase**
// (constant 425 / scanned 424), root cause unchanged, same don't fix it.
// ⚠️ `k-suggest-chip` **not in these 55** — it was scanned early due to descendant override in Dashboard v2 segment,
// already in whitelist (HALF-MOVED from E-52); this task's base class addition won't change whitelist number.
// ⚠️ `chev` / `path` / `h-md` **not in these 55** — not k* prefix, belong to NON_K_HELPER_CLASSES.
// 🔴 **When whitelist/registry turns red, first thing is check Appendix D §D.3's 24 blueprint dead classes
// (one of the assertions below nails them to zero occurrences), don't modify whitelist.**
const WHITELIST_425 = [
  'knowledge-app',
  'k-rail', 'k-rail-head', 'k-rail-back', 'k-rail-section', 'k-rail-nav',
  'k-rail-item', 'k-rail-item-label', 'k-rail-item-cn', 'k-rail-item-en',
  'k-rail-svc', 'k-rail-svc-row', 'k-rail-svc-dot', 'k-rail-svc-name', 'k-rail-svc-meta',
  'k-rail-foot',
  'k-main', 'k-topbar', 'k-topbar-title', 'k-topbar-sub', 'k-topbar-spacer',
  'k-banner', 'k-banner-icon',
  'k-mobile-tabs', 'k-mobile-tab',
  'k-badge', 'k-badge-dot',
  'k-btn',
  'k-scroll', 'k-scroll-inner',
  'k-skel',
  'k-empty', 'k-empty-illust', 'k-empty-title', 'k-empty-sub', 'k-empty-tips', 'k-empty-tip',
  // ---- T11: Appendix D.2 (64 classes)----
  'k-suggest-chip',
  'k2-search', 'k2-search-dots', 'k2-suggest', 'k2-suggest-label',
  'k2-sec-head', 'k2-sec-title', 'k2-sec-en', 'k2-sec-link',
  'k2-onboard', 'k2-onboard-orb', 'k2-onboard-cta', 'k2-onboard-layers',
  'k2-ob-layer', 'k2-ob-name', 'k2-ob-desc', 'k2-tag',
  'k2-layers', 'k2-layer', 'k2-layer-top', 'k2-layer-name', 'k2-layer-name-en', 'k2-layer-chev',
  'k2-layer-num', 'k2-layer-bar', 'k2-layer-sub', 'k2-layer-desc', 'k2-drafts',
  'k2-glue', 'k2-glue-id',
  'k2-roots', 'k2-root', 'k2-root-top', 'k2-root-ico', 'k2-root-path', 'k2-root-level',
  'k2-root-badges', 'k2-root-meta', 'k2-root-add', 'k2-roots-off', 'k2-chip',
  'k2-live', 'k2-live-top', 'k2-live-ico', 'k2-live-title', 'k2-live-sub',
  'k2-live-grid', 'k2-live-cell', 'k2-cell-label',
  'k2-prog', 'k2-prog-pct', 'k2-paused-note', 'k2-cc',
  'k2-qrow', 'k2-qchip',
  'k2-distill', 'k2-distill-sub',
  'k2-entries', 'k2-entry', 'k2-entry-ico', 'k2-entry-cn', 'k2-entry-en', 'k2-entry-badge',
  'k2-skel-card',
  // ---- P5b T2: Appendix D.1 (32 classes)----
  'k-banner-close', 'k-confirm-body', 'k-confirm-icon', 'k-confirm-summary',
  'k-confirm-title', 'k-done-stat', 'k-done-stat-label', 'k-done-stat-num',
  'k-filter-pill', 'k-filter-pill-count', 'k-modal', 'k-modal-bg',
  'k-modal-foot', 'k-queue-head', 'k-row', 'k-row-action',
  'k-row-actions', 'k-row-badges', 'k-row-check', 'k-row-error',
  'k-row-head', 'k-row-name', 'k-row-path', 'k-row-retry',
  'k-row-status', 'k-row-time', 'k-table', 'k-table-foot',
  'k-toolbar', 'k-toolbar-label', 'k-view', 'kn-badge',
  // ---- P5b T6: Appendix D.2 (53 classes)----
  'k-ab-actions', 'k-ab-info', 'k-ab-inner', 'k-ab-warn',
  'k-fd-error', 'k-fd-grid', 'k-fd-item', 'k-fd-k',
  'k-fd-mod', 'k-fd-mods', 'k-fd-sha', 'k-fd-v',
  'k-fd-wide', 'k-file-detail', 'k-files-actionbar', 'k-files-count',
  'k-files-meta', 'k-files-tools', 'k-filt', 'k-filt-check',
  'k-filt-chip', 'k-filt-clear', 'k-filt-grow', 'k-filt-input',
  'k-filt-label', 'k-filt-select', 'k-filter-bar', 'k-frow-errhint',
  'k-frow-expand', 'k-frow-f', 'k-frow-fhead', 'k-frow-num',
  'k-frow-pathcell', 'k-frow-pathtxt', 'k-frow-rebuild', 'k-frow-skel',
  'k-frow-status', 'k-frow-time', 'k-frow-vec', 'k-frow-zerohint',
  'k-ftable', 'k-pager', 'k-pager-ctrls', 'k-pager-info',
  'k-pager-page', 'k-pager-size', 'k-poll', 'k-rebuild-btn',
  'k-sort', 'k-sort-dir', 'k-status-badge', 'k-type-legacy',
  'k-type-tag',
  // ---- P5c T2a: Appendix D.1 (39 classes)----
  'fb', 'fb-crumb', 'fb-crumbs', 'fb-err',
  'fb-list', 'fb-name', 'fb-row', 'fb-stub',
  'k-modal-body', 'k-modal-head', 'k-modal-title', 'k-modal-x',
  'k-radio-group', 'k-sandbox-icon', 'k-sandbox-link', 'k-section',
  'k-section-head', 'k-section-hint', 'k-section-title', 'k-set-card',
  'k-set-danger', 'k-set-row', 'k-set-row-cn', 'k-set-row-desc',
  'k-set-row-info', 'k-set-row-title', 'k-set-soon', 'k-set-svc',
  'k-svc-cn', 'k-svc-light', 'k-svc-name', 'k-svc-state',
  'k-sw', 'kn-checkline', 'kn-mig-path', 'kn-mig-req',
  'kn-pick-actions', 'kn-pick-note', 'kn-picked',
  // ---- P5d T2: Appendix D.1 (65 classes)----
  'k-seg',
  'kn-act', 'kn-aside-card', 'kn-aside-select', 'kn-aside-title',
  'kn-desc-input', 'kn-diff', 'kn-diff-body', 'kn-diff-pane', 'kn-diff-pane-head',
  'kn-draftbar', 'kn-draftbar-sub', 'kn-draftbar-txt',
  'kn-edit', 'kn-edit-aside', 'kn-edit-main', 'kn-edit-top',
  'kn-editor', 'kn-editor-body-wrap', 'kn-editor-src', 'kn-editor-status', 'kn-editor-toolbar',
  'kn-empty-filtered', 'kn-file-acts', 'kn-filepath',
  'kn-inbox', 'kn-inbox-acts', 'kn-inbox-chev', 'kn-inbox-foot', 'kn-inbox-foot-hint',
  'kn-inbox-head', 'kn-inbox-icon', 'kn-inbox-row', 'kn-inbox-row-desc', 'kn-inbox-row-main',
  'kn-inbox-row-time', 'kn-inbox-row-title', 'kn-inbox-rows', 'kn-inbox-sub', 'kn-inbox-title',
  'kn-kv', 'kn-list', 'kn-list-foot',
  'kn-note-actions', 'kn-note-desc', 'kn-note-line1', 'kn-note-main', 'kn-note-meta',
  'kn-note-row', 'kn-note-side', 'kn-note-time', 'kn-note-title', 'kn-notes-col',
  'kn-pathstrip', 'kn-refbtn', 'kn-savehint', 'kn-src', 'kn-tag',
  'kn-tagchip', 'kn-tagedit', 'kn-tb-btn', 'kn-tb-sep', 'kn-title-input', 'kn-toolbar', 'kn-type-ic',
  // ---- P5d T2: R9 added non-k-prefix classes (2, from K44 top-level exception segment)----
  'nme-content', 'ProseMirror',
  // ---- P5e T2: 55 classes from Appendix D §D.7.1 (copy verbatim from that code block)----
  'k-adv-chip', 'k-adv-chips', 'k-adv-field', 'k-adv-label', 'k-adv-panel', 'k-adv-toggle',
  'k-asset-caption', 'k-asset-caption-head', 'k-asset-caption-text', 'k-asset-drawer', 'k-asset-media', 'k-asset-stage',
  'k-chunk-content', 'k-chunk-item', 'k-chunk-item-body', 'k-chunk-item-head', 'k-chunk-item-preview',
  'k-chunk-list', 'k-chunk-loc', 'k-chunk-nav', 'k-chunk-nav-count', 'k-chunk-rank',
  'k-chunk-viewer', 'k-chunk-viewer-foot', 'k-chunk-viewer-head', 'k-chunk-viewer-title',
  'k-drawer', 'k-drawer-actions', 'k-drawer-back', 'k-drawer-bg', 'k-drawer-body',
  'k-drawer-fileinfo', 'k-drawer-filename', 'k-drawer-head', 'k-drawer-head-spacer', 'k-drawer-summary',
  'k-fileviewer-empty', 'k-fileviewer-fallback', 'k-fileviewer-host',
  'k-hero-suggest', 'k-match-pill', 'k-more-hint',
  'k-rcard', 'k-rcard-body', 'k-rcard-head', 'k-rcard-icon', 'k-rcard-meta', 'k-rcard-meta-item',
  'k-rcard-name', 'k-rcard-snippet', 'k-rcard-tag', 'k-rel', 'k-rel-dot', 'k-rerank-warn',
  // Added 2026-08-15 (Plan B, no counterpart in the blueprint): the thumbnail for album-asset
  // hits, laid over the .k-rcard-icon paper chip.
  'k-rcard-thumb',
  'k-result-count', 'k-results', 'k-search-box', 'k-search-clear', 'k-search-sticky', 'k-search-sticky-inner',
  'k-skel-rcard',
  // ---- 27 k-* classes from Appendix D §D.7.1 (blueprint :985-1141 + :1342-1396 + :1500-1503)----
  // 🔴 `k-section-body` (blueprint :985) and `k-frow` (:1077) are **intentionally not moved in earlier periods,
  // reversed this period** two (errata E-67 records 67→69 difference of 2 is them); `k-frow` has another :1500-1503
  // narrow-screen @media override (gap K60 / decision R2). ⚠️ Different from previously moved `k-frow-f` / `k-frow-fhead` /
  // `k-frow-pathcell` / `k-frow-pathtxt` / `k-frow-num` / `k-frow-status` **are different tokens**,
  // zero collision — but any scan must use complete token exact match (`k-frow\b` would falsely match `k-frow-path` = E-25).
  'k-custom-add', 'k-ext-chip', 'k-ext-chip-mark', 'k-ext-chips',
  'k-extgroup', 'k-extgroup-head', 'k-extgroup-icon', 'k-extgroup-meta',
  'k-extgroup-title', 'k-extgroup-toggle',
  'k-field', 'k-field-hint', 'k-field-label', 'k-field-mono',
  'k-frow', 'k-frow-action', 'k-frow-head', 'k-frow-path', 'k-frow-root', 'k-frow-root-icon',
  'k-priority-hint',
  'k-radio-2', 'k-radio-card', 'k-radio-card-desc', 'k-radio-card-icon', 'k-radio-card-text',
  'k-section-body',
  // ---- 41 kw-* classes from Appendix D §D.7.2 (blueprint :2453-2561, Wiki nav page)----
  // 🔴 This family like `kr-*` below, **old NEW_RE's `k(?:2|n)?-` branch doesn't recognize at all**
  // (`w`/`r` neither `2` nor `n`) ⇒ not handling drops all into nonKClassNames turning red on set-equal assertion.
  // Decision **R1** adopts option B: expand NEW_RE branch + add to whitelist + nonKClassNames add exclusion
  // — exactly same three-piece as previously handling `fb-*` precedent.
  'kw-actions', 'kw-article', 'kw-article-inner',
  'kw-change', 'kw-change-name', 'kw-change-time', 'kw-change-type', 'kw-changes',
  'kw-child', 'kw-child-body', 'kw-child-chev', 'kw-child-ico', 'kw-child-meta',
  'kw-child-name', 'kw-child-sum', 'kw-children',
  'kw-crumb', 'kw-foot', 'kw-head', 'kw-md', 'kw-meta',
  'kw-node', 'kw-node-chev', 'kw-node-ico', 'kw-node-name',
  'kw-pending', 'kw-pending-orb', 'kw-pending-sub', 'kw-pending-title',
  'kw-rawsrc',
  'kw-sec', 'kw-sec-count', 'kw-sec-en', 'kw-sec-head', 'kw-sec-title',
  'kw-split', 'kw-summary', 'kw-title',
  'kw-tree', 'kw-tree-note', 'kw-tree-scroll',
  // ---- 9 kr-* classes from Appendix D §D.5 (gap K53, source RootsView.vue:223-289
  // `<style lang="scss" scoped>`; errata E-63: set difference method structurally can't see .vue built-in style blocks)----
  'kr-adv-row', 'kr-badge', 'kr-check', 'kr-empty', 'kr-error',
  'kr-hint', 'kr-input', 'kr-label', 'kr-path',
]

describe('knowledge.scss — Appendix D whitelist deployment (425 classes, accumulated across the porting wavesT2 )', () => {
  // Review 2026-07-31 Important correction — used `\b` for class name right boundary: `\b` also applies before `-`
  // (transition from letter to hyphen also counts as "word boundary"), so `/\.k-topbar\b/` would match
  // **prefix** classes like `.k-topbar-title`, couldn't detect if `.k-topbar { … }` base class rule is deleted —
  // review proved it with RED probe (delete .k-topbar rule, 8/8 all green). Affected are 9 classes in whitelist
  // that are themselves prefixes of other classes: k-rail/k-rail-item/k-rail-svc/k-topbar/k-banner/k-badge/k-scroll/
  // k-mobile-tab/k-empty. Changed to negative lookahead "right side can't be word character or hyphen", so
  // `.k-topbar` won't match `.k-topbar-title`, only truly independent `.k-topbar` selector
  // (followed by space/`{`/`,`/`[` etc) counts.
  it('All 426 whitelist classes have corresponding rules (permanent version of Appendix D.4 check command①)', () => {
    const missing = WHITELIST_425.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css))
    expect(missing, `Missing classes: ${missing.join(', ')}`).toEqual([])
  })

  // Drift prevention: numbers in constant name must match array length (this file's convention, name itself is part of assertion).
  // 🔴 2026-08-15: 425 → 426. The only addition is `k-rcard-thumb` (the thumbnail for album-asset
  // hits, Plan B, no counterpart in the blueprint). This count assertion exists to stop anyone from
  // casually slipping a class into the whitelist — so changing it means reading the whitelist comment
  // above too, not just levelling the number.
  it('Whitelist exactly 426 items (Appendix D §D.0: 102 + T2\'s 32 + T6\'s 53 + \'s 39 + \'s 65+2 + \'s 55 + \'s 27+41+9 + 1 from 2026-08-15)', () => {
    // 🔴 2026-08-25: 426 → 432. The six additions are the `k-asset-*` classes of
    // components/AssetDetailDrawer.vue (album-asset drawer: shares the .k-drawer shell, adds one
    // media stage + caption block). Still no blueprint dead class involved.
    // 🔴 2026-08-27: 432 → 431. The rail head's title/"RAG · NimoOS" block was replaced by a
    // single back button (same as the agent shell's top-left): `k-rail-title` + `k-rail-sub`
    // removed, `k-rail-back` added. Still no blueprint dead class involved.
    expect(WHITELIST_425).toHaveLength(431)
    expect(new Set(WHITELIST_425).size, 'Whitelist has duplicate items').toBe(431)
  })

  it('.k-toast / .k-toast-ico not ported (diverge from K3, use global useToast() instead)', () => {
    expect(css).not.toMatch(/\.k-toast\b/)
    expect(css).not.toMatch(/\.k-toast-ico\b/)
  })

  // [K10] Blueprint has **two** .k-confirm-icon/-title/-summary: nested version
  // (:1398-1428, inside .knowledge-app) and top-level duplicate version (:1676-1702). Both declarations
  // are identical, in cascade nested (0,2,0) beats top-level (0,1,0) → top-level never took effect in Vue2,
  // K10 decides to discard entire segment. This nails "only moved one": any confirm class appearing twice
  // (= someone also moved in the top-level one) reports red. Above "no over-moving" only checks if class name
  // is in whitelist, can't detect **duplicate definitions**.
  it('K10 — Each .k-confirm-* class has only one rule (blueprint :1676-1702 top-level duplicate already discarded)', () => {
    for (const c of ['k-confirm-body', 'k-confirm-icon', 'k-confirm-title', 'k-confirm-summary']) {
      const hits = css.match(new RegExp(`\\.${c}(?![\\w-])`, 'g')) || []
      expect(hits.length, `${c} appears ${hits.length} times (should be 1; >1 means K10-discarded top-level duplicate was moved in)`).toBe(1)
    }
  })

  // [Fix: guard gap① (Appendix B §B.5 / governance §9 logged)] Original regex was
  // `/\.k2?-[a-z0-9-]+/g` — `k2?` after consuming `k` **requires next character to be `-`**,
  // so classes like `.kn-badge` / `.kn-foo` with `kn-` prefix **won't be scanned at all**.
  // Task S7 segment (blueprint :2031-2039) moves exactly `.kn-*`, and blueprint :2040-2281 has
  // dozens more `.kn-*` from P5d — slip and move one extra, old regex says nothing. RED probe proves:
  // stuff a `.kn-foo { … }` outside whitelist into rule section, old regex 17/17 all green pass;
  // after switching to regex below exactly reports "class outside whitelist: kn-foo".
  // 🔴 This **expands scan scope**, not loosens assertion: scanned classes must all land in whitelist.
  //
  // [Further expansion: guard gap① round two (governance §6.4-4 / §9 logged)]
  // Previous regex only recognized three prefixes `k` / `k2` / `kn` — this task moved in FolderBrowser's `.fb-*` segment
  // (blueprint FolderBrowser.vue:82-143), those 8 classes **won't be scanned at all**. Governance §6.4-4 regex is
  // `/\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g`; testing shows it still misses **bare `.fb`** (no hyphen suffix,
  // `fb-[a-z0-9-]+` requires at least one `-`), and `fb` happens to be one of the 39 classes in Appendix D.1 —
  // if written literally, `.fb` would both escape this scan and fall into `nonKClassNames` below
  // (not matching `^k…-` prefix) reporting "unregistered non-k* class". So make `fb` suffix **optional**,
  // making this regex strictly **superset** of governance-given regex (scans more, loosens nothing);
  // below nonKClassNames exclusion conditions sync with `fb` / `fb-*` handling, two sides consistent.
  // 🔴 This still **expands scan scope**, not loosens assertion: blueprint :2023-2281 still has
  // dozens of `.kn-*` from P5d, :985-991's .k-section-body and :1152-1157's .k-progress-* (N15) shouldn't appear either
  // — slip and move any, this will pinpoint exactly. RED probe recorded separately.
  //
  // [Further expansion: guard gap① round three (governance §9.6 / decision "four-two" / Appendix D §D.2.1)]
  // This task moved in K44's `.nme-content .ProseMirror` top-level segment and K43's `.k-seg`.
  // Previous regex `/\.(?:k(?:2|n)?-[a-z0-9-]+|fb(?:-[a-z0-9-]+)?)/g` couldn't scan two things:
  // ① `nme-content` / `ProseMirror` — prefix is not k/k2/kn/fb;
  // ② `ProseMirror` **even with nme prefix support can't be scanned** — it has uppercase,
  //    old character set only had `[a-z0-9-]` (P5c §6.4.2 pending debt, coordinator decision A-11:
  //    no longer just theory, must implement).
  // New regex: `/\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g`
  // — ① character set adds `A-Z` (implement A-11); ② new optional branches `nme(?:-…)?` and `ProseMirror`.
  // 🔴 This **expands scan scope**, not loosens assertion: programmatic testing (see `p5d-gen-r8r9-sim.mjs`, the audit
  // pasted strict superset self-proof output on current file: old 225 / new 225 identical,
  // proving this change **zero observable** on pre-change current file — RED probe is sole evidence it has discrimination,
  // see separate RED probe section below). Scanned new classes `nme-content`/`ProseMirror` must also land in whitelist (R9: 226→293).
  //
  // [Further expansion: guard gap① round four (decision **R1**, option B)]
  // This task moved in 41 `kw-*` (Wiki page) and 9 `kr-*` (K53, from RootsView.vue `<style scoped>`).
  // Previous regex's `k(?:2|n)?-` branch **only accepts `k-`/`k2-`/`kn-`** — `w` in `kw-` and `r` in `kr-`
  // are neither `2` nor `n` ⇒ these 50 classes **won't be scanned at all**, along with `cur` will fall into
  // `nonKClassNames` below, turning red on set-equal assertion.
  // New branch: `k(?:2|n|r|w)?-`. Three-piece (expand regex + add to whitelist + nonKClassNames add exclusion)
  // **exactly same approach as previously handling `fb-*`**, this repo's established process, not new invention.
  // 🔴 Still **expand scan scope = strengthen**, not loosen: scanned classes must all land in whitelist
  // (miss one → this exactly names it red, the audit's RED probe② output).
  // Strict superset self-proof next (already synced to "P5e version vs P5f version" two regexes,
  // otherwise that would become hollow).
  // 🔴🔴 [Must change (decision **R20's I-2**; R22: this is "extract inline literal to constant",
  // already declared)] Original inlined scan regex in this it, while "strict superset self-proof" below
  // compares with its **hardcoded copy** — zero binding between them. Review proved: narrow back
  // **this inline current regex** to `k(?:2|n)?-`, entire file **374/374 all green**, 50 `kw-*`/`kr-*`
  // once break free from "no over-moving" coverage and nobody reports red ⇒ R1-③'s intended "self-proof
  // becomes hollow" only deferred to next period. Fix: promote to module-scoped shared constant,
  // **"no over-moving" and "strict superset self-proof" share same source** ⇒ narrow current regex,
  // superset self-proof's "net gain = 50" immediately reports red.
  // ⚠️ This is **pure refactor + binding**, doesn't change any match semantics (regex source unchanged);
  // see T2b report probe P-3 for verification.
  // ⚠️ `nonKClassNames()`'s exclusion prefix `/^k(?:2|n|r|w)?-/` is **separate** independent regex,
  //    this task doesn't touch (narrowing it only makes "unregistered non-k* classes" more = report red,
  //    not silent failure); two-side consistency logged as debt, not in this task scope.
  const CLASS_SCAN_RE_SOURCE =
    '\\.(?:k(?:2|n|r|w)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)'
  const scanClassNames = (text: string): Set<string> =>
    new Set((text.match(new RegExp(CLASS_SCAN_RE_SOURCE, 'g')) || []).map((s: string) => s.slice(1)))

  it('No over-moving — all k-/k2-/kn-/kr-/kw-/fb/nme/ProseMirror classes in whitelist (permanent version of Appendix D.4 check command②, character set includes A-Z)', () => {
    const found = [...scanClassNames(css)]
    const extra = found.filter((c) => !WHITELIST_425.includes(c))
    expect(extra, `Classes outside whitelist: ${extra.join(', ')}`).toEqual([])
  })

  // [Strict superset self-proof (per P5c §6.4.1 item 1, prevent "expand scope" from becoming "quietly loosen")]
  // Run both old and new regex on **pre-change current file** (git history version, not post-change current),
  // assert that every class old regex scans, new regex also scans (old ⊆ new) — proving expanding character set/branches
  // purely expands coverage, doesn't let any originally-scanned class escape.
  // 🔴 Real output this assertion ran on T1 final version (`56f8849`) (old 225 / new 225,
  // identical set) — this is also the evidence source for "this change zero observable on current file",
  // RED probe (see separate section) is sole proof this change has discrimination.
  //
  // 🔴🔴 [Must change (decision **R1**-③)] Originally this hardcoded "P5d version vs P5e version"
  // two regexes, **unrelated to what this task actually deploys** — not sync-change, this self-proof becomes
  // **hollow**: forever compares old constants unrelated to current regex, always green no matter how
  // current regex changes. Now OLD_RE = **current regex when P5e closed** (original before previous assertion change),
  // NEW_RE = **current regex this task deploys** (added `r|w` two branches).
  // Verification (R1-③ original): remove `r|w` from tested NEW_RE → this must report red.
  // The audit's real output showed this skewed result (after removing `r|w` exactly lists 50 classes
  // "old scanned, new missed"). ⚠️ Also add assertion in **strict** direction (`new ⊋ old`):
  // only proving `old ⊆ new` allows equal, so "expand scope" might actually expand nothing
  // (P5d at that time on pre-change file was old 225 / new 225). This task's file has `kr-*`/`kw-*`
  // truly present ⇒ strict proper superset **can and must** be programmatically proven.
  //
  // 🔴🔴 [Further fix (decision **R20's I-2**)] Previous `NEW_RE` was **hardcoded copy** of current regex
  // ⇒ current regex can be silently narrowed back and this stays green (review proved 374/374 all green).
  // Now `newHits` directly uses above **`scanClassNames()` = current same source**,
  // only `OLD_RE` (P5e closing historical original) remains hardcoded — it should be historical snapshot anyway.
  // 🔴 Verification (stronger than R1-③): remove `r|w` from **`CLASS_SCAN_RE_SOURCE` (current)** →
  //    this must report red, and "no over-moving" **still all green** (that's the real form of this gap).
  it('Strict superset self-proof — current regex (adds kr-/kw- branches) is strict superset of P5e current regex (old ⊊ new)', () => {
    const OLD_RE = /\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g
    const oldHits = new Set((css.match(OLD_RE) || []).map((s) => s.slice(1)))
    // 🔴 Tested "new" regex = **current** scan source itself, not its copy (I-2 crux)
    const newHits = scanClassNames(css)
    const missing = [...oldHits].filter((c) => !newHits.has(c))
    expect(missing, `Classes old regex scanned but new regex missed (shows expanding scope is actually loosening): ${missing.join(', ')}`).toEqual([])
    // Coverage self-check: both regexes must actually scan something (prevent "regex broken → both empty sets → always green")
    expect(oldHits.size, 'Old regex scanned zero classes — zero discrimination').toBeGreaterThan(300)
    // 🔴 Strict proper superset: new regex must scan **50 more** (41 kw-* + 9 kr-*), exactly that many
    const gained = [...newHits].filter((c) => !oldHits.has(c)).sort()
    expect(
      gained.length,
      `New regex net gain over old should be 50 (41 kw-* + 9 kr-*), actual ${gained.length}: ${gained.join(', ')}`,
    ).toBe(50)
    expect(gained.every((c) => c.startsWith('kw-') || c.startsWith('kr-')), 'Net gain mixed in non-kw-/kr- classes').toBe(true)
  })

  // [Fix: guard gap④] Above "no over-moving" and whitelist
  // both only take `k*` prefix — blueprint embedded **non-k-prefix helper classes** in several
  // (`.k-modal-foot .right`, `.k-fd-v.mono`, `.k-btn.ghost/.outline/.primary/.danger`…),
  // they're neither in whitelist nor in scan regex: future if any `.right { … }` / `.mono { … }` pops up in this file,
  // or someone slips moving in helper classes from elsewhere, **no assertion will say anything**.
  //
  // Resolution: choose "add a registry covering non-k* classes" instead of "write comment logging the gap".
  // Reason: testing shows **zero false positives** — entire this file (stripped comments) scanned with
  // `/\.([a-zA-Z][a-zA-Z0-9_-]*)/` yields only 9 non-`k*` identifiers, all true class names: decimals (`0.5`)
  // and durations (`1.4s`) have digits after dot (blocked by `[a-zA-Z]`); function args like `min()`/`repeat()`/
  // `cubic-bezier()` have no "dot+letter" form. Since noise is zero, no reason "will introduce more false positives"
  // to skip this.
  //
  // 🔴 This also **expands scan scope**, not loosens assertion: new-scanned classes must each register below with reason.
  // This registry can't be used as trash bin — second assertion below pins it down with set equality (red if added/removed).
  const NON_K_HELPER_CLASSES = [
    // .k-btn four variants (blueprint :822/:826/:836/:843), written as `&.ghost` etc, combined with .k-btn
    'ghost', 'outline', 'primary', 'danger',
    // Right-aligned action group in .k-modal-foot (blueprint :1340)
    'right',
    // Unit suffix and second number in .k2-layer-num (blueprint :2320/:2321), moved in P5a T11
    'suffix', 'second',
    // Spin state in .k2-live-ico (blueprint :2364), moved in P5a T11
    'spin',
    // Monospace variant of .k-fd-v (blueprint :1957), written as `&.mono`
    'mono',
    // Alert row in .k-set-row-desc (blueprint :1174), written as nested `.warn { … }`
    // (Appendix D §D.1.1: 9 → 10. ⚠️ Don't slip parser-app in here — governance §6.4-2 decided
    //  it uses nonKClassNames **exclusion condition**, same treatment as existing knowledge-app,
    //  keep registry semantic of "true nested helper classes".)
    'warn',
    // ---- Addition (decision R8: 10 → 16)----
    // 🔴 Governance §9.6 / decision A-10 said "NON_K_HELPER_CLASSES stays 10 unchanged" is wrong —
    // that only counted `nme`/`nme-content`/`ProseMirror` (and `nme` blueprint zero selector, won't scan,
    // `nme-content`/`ProseMirror` use exclusion condition, don't enter this table), missed these 6 true nested helpers.
    // Following A-10 literally "keep 10", the "registry exactly equals true non-k* classes in file"
    // set-equal assertion below would **turn red on commit** (decision R8 corrected to 16, per programmatic test —
    // reproduction command see `p5d-gen-r8r9-sim.mjs`, output verbatim recorded separately).
    // Save-state dot in .kn-savehint (blueprint :2127/:2128)
    'dot',
    // Reference button text in .kn-refbtn (blueprint :2222)
    'lbl',
    // Meta-info separator dot in .kn-note-meta (blueprint :2104)
    'sep',
    // Elastic spacer in .kn-edit-top / .kn-editor-status / .kn-aside-title (blueprint :2125/:2193/:2203),
    //
    'spacer',
    // K45 (decision R1) moved-in .k-btn.text — `&.text` is `text` in compound class `.k-btn.text`,
    // exactly same as existing ghost/outline/primary/danger four `&.x` variants (blueprint :1569-1570).
    // 🔴 `text` only goes to this table (R8), not WHITELIST_425 (R9's regex can't scan `text` in compound,
    // see comment in "no over-moving" above), R8/R9 mutual exclusion, can't register both sides.
    'text',
    // H2/H3 width variant in .kn-tb-btn (blueprint :2167), written as `&.wide`,
    // same as existing mono/ghost "combined variants"
    'wide',
    // ---- Addition (decision R8 / Appendix D §D.7.2: 16 → 19)----
    // 🔴 These three mean "registry grows = new-scanned classes must have source cited", **strengthens** not loosens:
    // below "registry exactly equals true non-k* classes in file, no more no less" **set-equal** assertion
    // still applies, adds one/removes one both report red; this task adds 3 true existing nested helpers,
    // not writing means red. Before/after strengthening nonKClassNames() output verbatim recorded separately (16 → 19).
    // Collapse arrow icon rotation container — .k-adv-toggle .chev (blueprint :509),
    // .k-adv-toggle[data-open="true"] .chev (:510), .k-more-hint .chev (:1561)
    // three **different descendant rules**, same as existing dot/sep/spacer. 
    'chev',
    // Monospace path segment in result card meta — .k-rcard-meta-item .path (blueprint :670).
    // ⚠️ p5-master-plan.md §2.4 class list missed it (errata E-55). Same as existing mono. 
    'path',
    // "Markdown header" highlight in snippet — .k-rcard-snippet .h-md (blueprint :660).
    // 🔴 **Blueprint 13 .vue zero class references**, but it's nested in .k-rcard-snippet → move with parent
    // block as whole, don't extract separately (Appendix D §D.6, same K7 mold as P5d "statusBadge zero consumers
    // also copy export"). 
    'h-md',
    // ---- Addition (decision R1 / Appendix D §D.7.4: 19 → 20)----
    // 🔴 This task adds only **1** to this table. Decision R1 explicitly rejected option A
    // (dump all 41 kw-* + 9 kr-* into this table) — would **turn this "true nested helpers each logged with source"**
    // **small table into the garbage bin it's supposed to prevent**, plus those 50 classes lose coverage from
    // "no over-moving" whitelist scan above = **net reduction in guard coverage**.
    // Option B lets them use WHITELIST_425 + nonKClassNames exclusion (same as fb-*).
    // "Current item" in Wiki breadcrumb — .kw-crumb .cur (blueprint :2475), true nested helper
    // like existing right/mono/dot/sep. 
    'cur',
  ]

  // [Fix: guard gap④ (governance §6.4-2)] This task expanded selectors of two token declaration blocks
  // each by one item `.parser-app` (K21 — Parser two pages reuse this file's token, zero copy), so `parser-app`
  // gets scanned by `/\.([a-zA-Z]…)/` below, falling into "unregistered non-k* classes"; it's a **scope root**,
  // not nested helper → like existing `knowledge-app`, uses exclusion condition not registry entry.
  // Similarly `fb` / `fb-*` (moved in 8 classes from FolderBrowser.vue:82-143) are legit
  // prefix classes in this file, already in WHITELIST_425, and already covered by above "no over-moving" scan,
  // exclude them here together, avoiding same class batch judged by two assertions with contradictory criteria.
  //
  // K44-introduced `nme-content` / `ProseMirror` similarly are **legit prefix/third-party
  // classes** (former blueprint wrapper class, latter third-party ProseMirror-generated class name, mixed case,
  // the only one outside this file's kebab lowercase convention), not nested helpers — like knowledge-app/parser-app/
  // fb, use exclusion condition, don't enter NON_K_HELPER_CLASSES (governance §9.6 mandates).
  //
  // [Addition (decision R1, option B)] Exclusion prefix expanded to `k(?:2|n|r|w)?-` in sync
  // **same criteria as "no over-moving" regex above** (two places must align, else same class batch judged
  // by two assertions with contradictory criteria). `kr-*` / `kw-*` are legit prefix classes in this file,
  // already in WHITELIST_425, and already covered by "no over-moving" scan, exclude like fb-* / knowledge-app / parser-app / nme-content.
  function nonKClassNames(text: string): string[] {
    const found = new Set([...text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))
    return [...found]
      .filter(
        (c) =>
          !/^k(?:2|n|r|w)?-/.test(c) &&
          !/^fb(?:-|$)/.test(c) &&
          c !== 'knowledge-app' &&
          c !== 'parser-app' &&
          c !== 'nme-content' &&
          c !== 'ProseMirror',
      )
      .sort()
  }

  it('Guard gap④ — All non-k*-prefix nested helpers in registry (.right/.mono etc)', () => {
    const extra = nonKClassNames(css).filter((c) => !NON_K_HELPER_CLASSES.includes(c))
    expect(extra, `Unregistered non-k* classes (each must have source cited in NON_K_HELPER_CLASSES): ${extra.join(', ')}`).toEqual([])
  })

  it('Guard gap④ — Registry exactly equals true non-k* classes in file, no more no less (prevent list becoming trash; P5f final 20)', () => {
    expect(nonKClassNames(css)).toEqual([...NON_K_HELPER_CLASSES].sort())
  })

  it('R8/R1 — NON_K_HELPER_CLASSES constant exactly 20 items (P5d\'s 16 + \'s 3 + \'s 1; not governance A-10\'s 10)', () => {
    expect(NON_K_HELPER_CLASSES).toHaveLength(20)
    expect(new Set(NON_K_HELPER_CLASSES).size, 'Registry has duplicate items').toBe(20)
  })

  // [K45 deployment DoD (decision R1-②, Appendix D §D.4.1)] "No over-moving" whitelist
  // set assertion can't naturally catch `.k-btn.text` being moved twice (`text` not in its regex) —
  // switch to count assertion "`.k-btn` scope &.text appears exactly 2 times (rule + hover)".
  // 🔴 Brief §3-2 / T0 re-review noted: must anchor in `.k-btn { … }` range, can't bare-count entire file
  // (entire-file count falsely reds when `&.text` legally appears elsewhere, P5e falsely misses if moved
  // elsewhere again) — method per this file's K10 guarding `.k-confirm-*`: use brace pairing to locate
  // `.k-btn { … }` block (stricter than declBlockRange's "next \n}", because .k-btn block has nested
  // &.xxx { … } rules, can't assume first \n} is block end), count only in range.
  function findKBtnBlockRange(text: string): [number, number] {
    const lines = text.split('\n')
    let acc = 0
    let startLine = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '.k-btn {') {
        startLine = i
        break
      }
      acc += lines[i].length + 1
    }
    expect(startLine, 'Can\'t find .k-btn block (line-start-end anchor, after trim must be exactly ".k-btn {")').toBeGreaterThanOrEqual(0)
    const braceAt = text.indexOf('{', acc)
    let depth = 0
    let i = braceAt
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') {
        depth--
        if (depth === 0) {
          i++
          break
        }
      }
    }
    return [acc, i]
  }

  // [M-4 — Only change test name, don't touch assertion (governance §8.2's M-4 handoff)]
  // Original test name said "&.text **only in** .k-btn{…} scope appears, exactly 2 times",
  // **broader** than what assertion actually does: assertion counts only in `.k-btn { … }` range,
  // knows nothing about whether `&.text` exists **outside** (really guarding "only in" needs another
  // assertion: entire-count - in-range-count === 0). Changed to faithfully describe "exactly 2 times
  // in .k-btn{…} range". 🔴 Assertion body unchanged — this is §9.10 stance: don't change assertion
  // to make test name look nice, don't leave overstated name to fool reviewers.
  it('K45 — In .k-btn{…} range &.text exactly 2 times (rule+hover; move twice = red, brief §3-2 / R1-②)', () => {
    const [start, end] = findKBtnBlockRange(css)
    const body = css.slice(start, end)
    const hits = body.match(/&\.text\b/g) || []
    expect(hits.length, `.k-btn block &.text appears ${hits.length} times (should be 2; ≠2 means K45 moved twice or missed)`).toBe(2)
  })
})

// ============================================================================
// New guards (Appendix D §D.3 / §D.4 / K46 / K47)
// ============================================================================

// Complete list of blueprint dead-code classes (copied verbatim from p5-master-plan.md §2.2 / Appendix D §D.3).
// These 24 classes have zero class references in blueprint's own 13 .vue files, remains after v1 dashboard / v1
// progress card replaced by k2-* Dashboard v2. P5a correctly didn't move, P5e also must not move.
const BLUEPRINT_DEAD_CLASSES = [
  // Blueprint :272-349(7)
  'k-hero', 'k-hero-orb', 'k-hero-title', 'k-hero-sub',
  'k-hero-search', 'k-hero-search-go', 'k-hero-search-kbd',
  // Blueprint :380-411(5)
  'k-stat', 'k-stat-label', 'k-stat-value', 'k-stat-suffix', 'k-stat-cn',
  // Blueprint :413-455(6)
  'k-quick-grid', 'k-quick-card', 'k-quick-icon',
  'k-quick-card-title', 'k-quick-card-en', 'k-quick-card-desc',
  // Blueprint :1152-1160(6)
  'k-progress-card', 'k-progress-row', 'k-progress-label',
  'k-progress-nums', 'k-progress-bar', 'k-progress-fill',
]

describe('knowledge.scss — Appendix D §D.3: All 24 blueprint dead-code classes not moved in', () => {
  // 🔴 Why this assertion must exist: P5e's .k-hero-suggest (blueprint :351) and .k-suggest-chip (:357)
  // **sandwiched between .k-hero-search-kbd (:343) and .k-stat (:380)** ⇒ "move entire :272-455"
  // would at once bring in **18** dead classes. Above "no over-moving" whitelist assertion would turn red,
  // implementer very likely misdiagnose as "whitelist number wrong" and modify whitelist — this assertion
  // makes it clear: turn red, first check dead class list.
  //
  // 🔴 Verification criterion: `(?![\w-])` negative lookahead, **can't use `\b`** — `\b` also applies at
  // letter↔hyphen transition, `/\.k-hero\b/` would falsely match perfectly legal `.k-hero-suggest`
  // (true class this task needs to move) (E-25 pitfall, coordinator fell into once during planning).
  // This is also why this and "whitelist" use the same technique.
  //
  // 🔴 Runs on **comment-stripped** `css`: Appendix D §D.3's reproduction command is bare grep on
  // **raw text**, it already had 2 false positives before T2 baseline (k-quick-grid / k-progress-card, from
  // knowledge.scss :61 / :1318 / :1605 three existing comments with class-name references before dot) —
  // that command **isn't** authoritative, this assertion is. See the errata section recorded separately.
  it('24 dead classes zero appearances in knowledge.scss (after stripping comments)', () => {
    const leaked = BLUEPRINT_DEAD_CLASSES.filter((c) => new RegExp(`\\.${c}(?![\\w-])`).test(css))
    expect(
      leaked,
      `Blueprint dead-code classes moved in: ${leaked.join(', ')} — 🔴 First check Appendix D §D.3 list, ` +
        '**don\'t modify whitelist** (those 24 classes have zero references in blueprint\'s own 13 .vue, P5a correctly didn\'t move)',
    ).toEqual([])
  })

  // List can't be trash bin / can't be silently shrunk (same criterion as other "exception list exactly N items")
  it('Dead class list exactly 24 items (7 + 5 + 6 + 6), no duplicates', () => {
    expect(BLUEPRINT_DEAD_CLASSES).toHaveLength(24)
    expect(new Set(BLUEPRINT_DEAD_CLASSES).size, 'Dead class list has duplicates').toBe(24)
  })

  // 🔴 Parameterized guard prevents empty loop (governance §9.14-4): 24 independent test cases really running,
  // not "list read failed → loop body never executes → all green". --reporter=verbose can count 24.
  for (const cls of BLUEPRINT_DEAD_CLASSES) {
    it(`Dead class ${cls} zero appearances`, () => {
      expect(new RegExp(`\\.${cls}(?![\\w-])`).test(css), `${cls} was moved in`).toBe(false)
    })
  }
})

// In **line-preserving** text, locate line number by "entire line after trim exactly equals given string".
// Line-start/entire-line anchor naturally excludes same-name references in comments
// (comments already replaced with equal spaces by blankComments, content gone).
// Method same as this file's findKBtnBlockRange "exact match after trim" criterion, not substring search
// (bearing lessons from four "substring check can't catch real defects" here).
function lineIndexOfExact(text: string, trimmedLine: string): number {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) if (lines[i].trim() === trimmedLine) return i
  return -1
}

// In line-preserving text, locate nested rule block starting from "line after trim exactly equals selectorLine",
// use brace pairing to find block end (can't assume "next \n}" — that only works for zero-indent top-level blocks).
function nestedBlockBody(text: string, selectorLine: string): string {
  const at = lineIndexOfExact(text, selectorLine)
  expect(at, `Can't find rule block ${selectorLine} (entire-line trim exact match, excluded same-name in comments)`).toBeGreaterThanOrEqual(0)
  const lines = text.split('\n')
  let offset = 0
  for (let i = 0; i < at; i++) offset += lines[i].length + 1
  const braceAt = text.indexOf('{', offset)
  let depth = 0
  let i = braceAt
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) { i++; break }
    }
  }
  return text.slice(offset, i)
}

describe('knowledge.scss — E-52: .k-suggest-chip base class must be before k2 descendant override', () => {
  // [Fact] P5a only moved descendant override from blueprint :2291 (this file's Dashboard v2 segment
  // `.k2-suggest .k-suggest-chip { white-space: nowrap; }`), **base class entirely missed** = errata E-52;
  // and blueprint DashboardView.vue:292 and SearchView both use it ⇒ P5a-delivered dashboard suggestion chips
  // always ran on "just one white-space, zero base class styles" (rounding/padding/borders/color/hover all missing)
  // = **true visual defect in delivered product**, this task adds base class.
  //
  // 🔴🔴 **This assertion pins "fidelity to the blueprint's source order", not "cascade doesn't flip"**
  //   (decision R7 / errata E-56):
  //   · Base class `.knowledge-app .k-suggest-chip` specificity (0,2,0), declares padding/background/
  //     border/border-radius/font-size/color/cursor/transition + :hover;
  //   · Override `.knowledge-app .k2-suggest .k-suggest-chip` specificity (0,3,0), **only declares
  //     white-space**;
  //   ⇒ ① (0,3,0) > (0,2,0), so reversing the order wouldn't flip the cascade anyway; ② the two
  //   **have completely disjoint property sets**.
  //   **So "reversing the order would cause a visible regression" is false** — the coordinator's
  //   original claim "otherwise the cascade flips and all three gates go green" was wrong and has
  //   been corrected publicly. Neither the test name nor comments may cite that reasoning again.
  it('Base class declaration line number < k2 descendant override line number (pins fidelity to the blueprint source order, not the cascade outcome)', () => {
    const baseAt = lineIndexOfExact(cssKeepLines, '.k-suggest-chip {')
    const overrideAt = lineIndexOfExact(cssKeepLines, '.k2-suggest .k-suggest-chip { white-space: nowrap; }')
    expect(baseAt, "Can't find .k-suggest-chip base class declaration block (missing back-port from E-52?)").toBeGreaterThanOrEqual(0)
    expect(overrideAt, "Can't find .k2-suggest .k-suggest-chip descendant override (the one P5a moved in)").toBeGreaterThanOrEqual(0)
    expect(
      baseAt,
      `Base class is on line ${baseAt + 1}, override is on line ${overrideAt + 1} — base class must precede override (blueprint source order: ` +
        'base class :357-367 / override :2291)',
    ).toBeLessThan(overrideAt)
  })

  // The base class body must also be present — order alone isn't enough; missing any declaration still means E-52 wasn't fully back-ported.
  it('Base class block contains the six declarations from blueprint :358-366 + :hover (missing any means E-52 was not fully back-ported)', () => {
    const body = nestedBlockBody(cssKeepLines, '.k-suggest-chip {')
    for (const decl of [
      'padding: 5px 11px;',
      'background: var(--bg-elevated);',
      'border: 1px solid var(--line-faint);',
      'border-radius: var(--r-pill);',
      'font-size: 12px;',
      'color: var(--text-secondary);',
      'cursor: pointer;',
      'transition: all 120ms ease;',
      '&:hover { border-color: var(--accent); color: var(--accent); }',
    ]) {
      expect(body, `.k-suggest-chip base class is missing ${decl}`).toContain(decl)
    }
  })
})

describe('knowledge.scss — K46 / K47: .k-fileviewer-host three properties + three ::v-deep rules not ported', () => {
  // 🔴 K46 criterion ③ (governance §3's original K46 text): `position: fixed` / `inset: 0` / `z-index: 1100`
  // **must be preserved verbatim**, **each with its own independent assertion** (removing any one → must go red).
  // Rationale: `src/files/viewers/ViewerShell.vue:24` is
  // `position: absolute; inset: 0; z-index: 200; overflow: hidden;` —
  // ViewerShell **needs a positioned ancestor that fills the viewport**; removing the host's `fixed` would
  // make the in-app preview viewer **collapse into normal document flow** (governance §2 item 2's original
  // text: this is the spot in this phase most likely to grow a real bug from "casual cleanup").
  // Written as three separate assertions rather than one toContain called three times — cramming three
  // toContain calls into one assertion means if even one is still present it can be misread as "all present",
  // and vitest stops at the first failure, leaving the other two with no discriminating power (same lesson
  // as this file's R4 case, "4 tokens sharing one assertion, breaking 1 still stays all-green").
  const HOST = '.k-fileviewer-host {'

  it('K46-③a — .k-fileviewer-host retains position: fixed (removing it → preview viewer collapses into document flow)', () => {
    expect(nestedBlockBody(cssKeepLines, HOST), 'host lost position: fixed').toContain('position: fixed;')
  })

  it('K46-③b — .k-fileviewer-host retains inset: 0 (removing it → does not fill the viewport)', () => {
    expect(nestedBlockBody(cssKeepLines, HOST), 'host lost inset: 0').toContain('inset: 0;')
  })

  it('K46-③c — .k-fileviewer-host retains z-index: 1100 (must stay above .k-drawer-bg\'s 1050)', () => {
    expect(nestedBlockBody(cssKeepLines, HOST), 'host lost z-index: 1100').toContain('z-index: 1100;')
  })

  // K47 — host's background color is the one remaining color literal in this phase, mapped to a token (Appendix B §B.4).
  // The full-text color scan above catches "is there a raw value", but not "was it swapped to a different token".
  it('K47 — .k-fileviewer-host background color is var(--bg-canvas) (shares origin with blueprint sibling rule .k-fileviewer-fallback)', () => {
    expect(nestedBlockBody(cssKeepLines, HOST), 'host background is not --bg-canvas').toContain('background: var(--bg-canvas);')
  })

  // z-index relative ordering (Appendix B §B.4.1): 1100 > 1050, both numbers carried over verbatim.
  it('K46 — .k-drawer-bg z-index is 1050, strictly less than host\'s 1100', () => {
    const bg = nestedBlockBody(cssKeepLines, '.k-drawer-bg {')
    expect(bg, '.k-drawer-bg z-index was changed').toContain('z-index: 1050;')
    const m = /z-index:\s*(\d+);/.exec(bg)
    expect(m, "Can't find z-index in .k-drawer-bg").not.toBeNull()
    expect(Number(m![1]), '.k-drawer-bg must be lower than .k-fileviewer-host\'s 1100').toBeLessThan(1100)
  })

  // 🔴 K46's core criterion: blueprint KFileViewer.vue:77-101's three ::v-deep rules **not ported at all**.
  // They are patches for the **Vue2** viewer's dependency on the `.file-panel .modal-card .overlay` ancestor
  // chain; this repo's DocViewer.vue / ExcelViewer.vue templates **have zero of those three classes**, and
  // `.overlay` already comes built-in from ViewerShell.vue:23-29's scoped rule (position/inset/z-index/overflow/flex all present)
  // ⇒ porting them would be copying a patch for a problem that doesn't exist in this repo.
  // ⚠️ Honest disclosure: `.overlay` is **not zero-hit across the whole repo** (ViewerShell.vue:9 does emit `<div class="overlay">`)
  // — but this doesn't weaken K46, it reinforces it: the patch is pure duplication. This assertion's scope
  // is **within knowledge.scss only**.
  // Runs against the comment-stripped `css` (this file's K46 explanatory comment quotes these three class names verbatim).
  for (const cls of ['overlay', 'v-container', 'doc-container']) {
    it(`K46 — .${cls} has zero occurrences in knowledge.scss (comments stripped) (blueprint :77-101 entire segment not ported)`, () => {
      expect(
        new RegExp(`\\.${cls}(?![\\w-])`).test(css),
        `.${cls} appears in knowledge.scss — K46 violated (those three ::v-deep rules are Vue2 ancestor-chain patches; ` +
          'this repo\'s ViewerShell already provides the same positioning; porting them would copy a patch for a nonexistent problem)',
      ).toBe(false)
    })
  }

  // Reverse check: this phase genuinely left behind no ::v-deep / :deep usage (they'd be meaningless anyway once scoped was downgraded)
  it('K46 — zero ::v-deep / :deep(...) in knowledge.scss (scoped has been downgraded to .knowledge-app scoping)', () => {
    expect(css, '::v-deep appears').not.toMatch(/::v-deep/)
    expect(css, ':deep( appears').not.toMatch(/:deep\(/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【Decision R16】Important-1 "the 7 new tokens' 'token → consuming selector'
// binding has zero guard".
// Fact (proven by T2 review, not speculation): swapping the tokens consumed by
// [data-kind="md"] and [data-kind="doc"] → 334/334 still all green (probe G1); changing
// .k-rcard-icon's background from --paper-surface to --bg-elevated → also all green (probe G3).
// Of the 8 new tokens, only --mark-hl-bg's binding is pinned by the existing "each of the
// three mark rules is in its rightful place" assertion; the other 7 (5 × --rtag-* +
// --paper-surface + --shadow-drawer) only have assertions for "both theme blocks declare it,
// the value wasn't recomputed" — no binding assertion for "which selector consumes which
// token". The product code itself was confirmed correct by verbatim review comparison (the
// five [data-kind] values ↔ the five --rtag-* values have no cross-wiring, matching the
// blueprint's :618-622 source order verbatim) ⇒ this is a pure test-coverage gap, not a code
// defect. But --rtag-md is exactly the item decision R15-③ ruled "unreachable on this machine
// ⇒ the guard is the only line of defense" for, and a single cross-wiring would go silent
// forever ⇒ it must be covered.
//
// Criterion (decision R16 ②): swapping the tokens consumed by the two [data-kind] values →
// must go red; swapping .k-rcard-icon's background to a different token → must go red (report
// pastes both outputs + md5sum restore).
// Reinforcement only, doesn't loosen any existing assertion (§9.10); doesn't change knowledge.scss itself.
describe('knowledge.scss — R16: consumption bindings for the 7 new tokens (gap)', () => {
  const TAG = '.k-rcard-tag {'
  const ICON = '.k-rcard-icon {'
  const DRAWER = '.k-drawer {'

  // 5 assertions — .k-rcard-tag[data-kind] ↔ --rtag-* pairwise binding (blueprint :618-622 source order)
  const kindBindings: Array<[string, string]> = [
    ['pdf', '--rtag-pdf'],
    ['md', '--rtag-md'],
    ['doc', '--rtag-doc'],
    ['txt', '--rtag-txt'],
    ['code', '--rtag-code'],
  ]
  it.each(kindBindings)(
    'k-rcard-tag[data-kind="%s"] consumes var(%s) (criterion: swapping with another data-kind → must go red, see T4 report RED probe)',
    (kind, token) => {
      const body = nestedBlockBody(cssKeepLines, TAG)
      expect(body, `.k-rcard-tag[data-kind="${kind}"] is not bound to var(${token})`).toContain(
        `&[data-kind="${kind}"] { background: var(${token}); }`,
      )
    },
  )

  // 6th assertion — .k-rcard-icon background ↔ --paper-surface
  it('k-rcard-icon background consumes var(--paper-surface) (criterion: swapping to a different token → must go red)', () => {
    const body = nestedBlockBody(cssKeepLines, ICON)
    expect(body, '.k-rcard-icon background is not var(--paper-surface)').toContain('background: var(--paper-surface);')
  })

  // 7th assertion — k-drawer shadow ↔ --shadow-drawer
  it('k-drawer shadow consumes var(--shadow-drawer) (criterion: swapping to a different token → must go red)', () => {
    const body = nestedBlockBody(cssKeepLines, DRAWER)
    expect(body, '.k-drawer shadow is not var(--shadow-drawer)').toContain('box-shadow: var(--shadow-drawer);')
  })
})

// Locate the character range of the declaration block "from selectorLiteral to the next
// standalone `}` on its own line".
// Both token declaration blocks are pure flat `--x: y;` properties with no nested rules, so
// "the next `\n}`" is genuinely the end of the block — same technique as settingsStyles.test.ts's blockOf.
//
// 【Review 2026-08-01 Important I-2 correction, this file's fifth incident of this same
// family of "the guard itself has a hole"】The original version used `text.indexOf(selectorLiteral)`
// to find the start point — this is a pure substring search, and it gets falsely matched by the
// **verbatim quote of the same selector string** in the file's header comment: the header comment
// at :8/:46/:51/:179 all write out `` `.knowledge-app { … }` `` wrapped in backticks (to explain
// selector syntax to the reader), so `indexOf` hits whichever of those occurs earliest in the
// comments, not the real declaration block — this made the exemption range's start point count
// a whole 65 extra header-comment lines too far back (proven by review RED probe: stuffing a
// color literal into the header comment, the guard passes all green; only stuffing it into a
// rule section makes it go red). Lesson (same family as this file's previous four `\b` /
// comment-stripping-timing / substring-check / import-collision incidents): **any criterion
// that "locates a piece of text in the file" must anchor to line-start + match the whole line
// exactly, never a substring search**.
// Fix: the real declaration-block selector in the source is always **alone on its own line,
// zero indentation, immediately followed by `{` at end of line** (like `.knowledge-app {`),
// while references in comments always have a ` * ` or backtick prefix and can never occupy
// a whole line by themselves — switch to matching with a `^selectorLiteral$` (multiline mode)
// regex, which naturally excludes same-name references in comments. `.exec()` without the `g`
// flag returns only the **first** match, which is exactly what we want (the dark token block
// is at the very top of the file; although T4's shell segment and T11's dashboard segment each
// also open their own top-level `.knowledge-app {` block, both come after the token block and
// won't be mistakenly selected).
function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function declBlockRange(text: string, selectorLiteral: string): [number, number] {
  const lineAnchored = new RegExp(`^${escapeForRegExp(selectorLiteral)}$`, 'm')
  const m = lineAnchored.exec(text)
  expect(m, `Can't find declaration block ${selectorLiteral} (line-start anchored, excludes same-name references in comments)`).not.toBeNull()
  const at = m!.index
  const braceAt = text.indexOf('{', at)
  const end = text.indexOf('\n}', braceAt)
  expect(end, `${selectorLiteral} declaration block is not closed`).toBeGreaterThan(0)
  return [at, end + 2]
}

function declBlockBody(text: string, selectorLiteral: string): string {
  const [start, end] = declBlockRange(text, selectorLiteral)
  return text.slice(start, end)
}

// 【K21】Both token declaration blocks' selectors each gained an extra `.parser-app`
// (governance §6.1's C-3 decision: Parser's two pages reuse this file's token set, zero
// duplication of the token declarations; can't let the page root carry .knowledge-app, because
// the `.knowledge-app { … }` shell block further below **shares the exact same selector** as the
// token block, which would drag the entire two-column shell along with it). These two constants
// must change accordingly — declBlockRange above uses `^selector$` (multiline mode) **anchored
// at both line-start and line-end**, so a selector missing even one character, or wrapped onto
// another line, makes `expect(m).not.toBeNull()` go straight to red. This is itself a
// drift-prevention assertion: the moment the selector in the scss gets changed back to a plain
// `.knowledge-app {` (= K21 reverted, Parser's two pages can no longer resolve any tokens, and
// on a real device those two pages would render as blank/transparent), this immediately and
// precisely reports "declaration block not found". See the RED probe recorded separately.
const DARK_TOKEN_SELECTOR = '.knowledge-app, .parser-app {'
const LIGHT_TOKEN_SELECTOR =
  ':root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {'

describe('knowledge.scss — hard color constraint (this file has no automated guard outside the declaration layer, exemption logged in §6)', () => {
  // 【Coordinator's 2026-07-31 decision wording, applies equally when T11/T12 continue this file】
  //   - **Comments** in rule sections (the shell segment, later batches' tables/dashboards, etc.):
  //     no color literal is allowed at all — whether it's Vue2's original raw color or a new
  //     value chosen on the New-UI side, neither is allowed. To reference the blueprint's
  //     original text, write "blueprint knowledge.scss:line-number + a description of the color's
  //     semantic role", e.g. `/* blueprint :145 raw foreground color → --text-on-accent */` —
  //     don't copy literal color values (hex codes, `rgba(...)` calls, or named-color keywords)
  //     into comments (they'd carry over verbatim into the build output, and also bypass this test).
  //   - Inside the two token declaration blocks (`.knowledge-app { … }` base block /
  //     `:root[data-theme="light"] .knowledge-app { … }` light-theme block): allowed — the
  //     literals there are the declared values themselves; it's fine to note the concrete value
  //     alongside a source reference at end of line (e.g. `/* theme.css:183 */`).
  //
  // 【This is the single most valuable guard in this task】color-guard.test.ts doesn't scan .scss
  // (proven by P3a RED probe) — this test is knowledge.scss's only regression net for raw color
  // literals. Only the two token declaration blocks themselves are exempt (that's where the
  // tokens are actually defined, see §6); everywhere else in the file, not a single raw color
  // literal is allowed — **including inside comments** (governance doc §6: Vue2's original raw
  // color literals aren't allowed in comments either).
  //
  // Review 2026-07-31 Important correction — the original version of this scan ran against
  // the `css` produced after `stripComments()`, so raw colors inside comments could **never**
  // be caught (proven by review RED probe: stuffing something like `/* was #ff0000 */` into a
  // comment, 8/8 still all green; only changing the same spot to real code `color: #ff0000`
  // made it go red). Stripping comments isn't wrong in itself (P2b's lesson: `toContain` can be
  // falsely matched by a class name mentioned in a comment), but that technique is meant for
  // "does this class name/token exist" assertions, not for color scanning. The color scan now
  // runs against the **unstripped original text** `rawSource`, cutting out only the character
  // ranges of the two token declaration blocks (the range boundaries are still computed against
  // rawSource's own positions — they can't borrow offsets from the comment-stripped version,
  // since the two texts differ in length).
  it('Zero color literals (#hex / rgb() / hsl() / oklch() / named colors…) anywhere outside the token declaration layer, including comments', () => {
    const [darkStart, darkEnd] = declBlockRange(rawSource, DARK_TOKEN_SELECTOR)
    const [lightStart, lightEnd] = declBlockRange(rawSource, LIGHT_TOKEN_SELECTOR)
    // The two declaration blocks must not overlap, in file order (dark first, light immediately after), otherwise the splice below would cut incorrectly.
    expect(darkEnd, 'dark declaration block should end before the light declaration block').toBeLessThanOrEqual(lightStart)

    const rest = rawSource.slice(0, darkStart) + rawSource.slice(darkEnd, lightStart) + rawSource.slice(lightEnd)

    expect(rest, '#hex appears outside the declaration layer').not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(rest, 'rgb()/rgba() appears outside the declaration layer').not.toMatch(/rgba?\(/)
    expect(rest, 'hsl()/hsla() appears outside the declaration layer').not.toMatch(/hsla?\(/)
    expect(rest, 'oklch() appears outside the declaration layer').not.toMatch(/oklch\(/)
    // Review 2026-07-31 Minor addition — the original regex only covered hex/rgb/rgba/oklch and
    // two named colors. Rounded it out with the modern CSS color functions (lab/lch/hwb/color())
    // and a few common named colors. `transparent` doesn't count as a color literal (review
    // confirmed: the two `transparent` occurrences in .k-skel and .k-btn.ghost are the
    // transparent border/background carried verbatim from blueprint :694/:828 — not "some color
    // hardcoded", so they stay).
    expect(rest, 'lab() appears outside the declaration layer').not.toMatch(/\blab\(/)
    expect(rest, 'lch() appears outside the declaration layer').not.toMatch(/\blch\(/)
    expect(rest, 'hwb() appears outside the declaration layer').not.toMatch(/\bhwb\(/)
    expect(rest, 'color() appears outside the declaration layer').not.toMatch(/\bcolor\(/)
    // 【Guard hole found in T11 self-check, corrected】The original 8 named-color checks used `\bWORD\b`. JS regex's
    // `\b` holds the same way at a letter↔hyphen boundary (`-` counts as a non-word character), so `/\bwhite\b/`
    // collides with the entirely legitimate CSS property `white-space` (`white` is immediately followed by `-`,
    // which still satisfies "word boundary"); `/\bblack\b/` / `/\bred\b/` have the same false-positive problem
    // with hyphenated compounds like `black-ish` / `foo-red`. This is this file's fifth incident of the same
    // "the guard has a hole" kind (see the first four in the comment at the top of the file). The T11 dashboard
    // section makes heavy use of `white-space: nowrap` (verbatim from the blueprint, copied 1:1), and the
    // original rule misjudged these fully compliant declarations as "bare color literals". Switched to a
    // bidirectional negative-lookaround assertion — "neither side may be immediately followed by a word
    // character or hyphen" (the same technique the "didn't over-copy" test at the top of the file already uses
    // for `(?![\w-])`, here adding `(?<![\w-])` on the left) — `white-space` has a space/semicolon (a non-word
    // character) on its left, but is immediately followed by `-` on its right, so the right-side `(?![\w-])`
    // blocks it and it's no longer a false positive; a genuine literal (e.g. `color: white;`, with spaces or
    // semicolons on both sides) still satisfies the negative lookaround on both sides and keeps failing
    // correctly.
    expect(rest, 'named color `white` appears outside the declaration layer').not.toMatch(/(?<![\w-])white(?![\w-])/)
    expect(rest, 'named color `black` appears outside the declaration layer').not.toMatch(/(?<![\w-])black(?![\w-])/)
    expect(rest, 'named color `red` appears outside the declaration layer').not.toMatch(/(?<![\w-])red(?![\w-])/)
    expect(rest, 'named color `green` appears outside the declaration layer').not.toMatch(/(?<![\w-])green(?![\w-])/)
    expect(rest, 'named color `blue` appears outside the declaration layer').not.toMatch(/(?<![\w-])blue(?![\w-])/)
    expect(rest, 'named color `orange` appears outside the declaration layer').not.toMatch(/(?<![\w-])orange(?![\w-])/)
    expect(rest, 'named color `gray` appears outside the declaration layer').not.toMatch(/(?<![\w-])gray(?![\w-])/)
    expect(rest, 'named color `grey` appears outside the declaration layer').not.toMatch(/(?<![\w-])grey(?![\w-])/)
  })

  it('.knowledge-app explicitly declares color-scheme in both variants (P2b lesson: a nested theme scope inherits :root if it does not declare its own)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(darkBody, 'dark variant missing color-scheme: dark').toContain('color-scheme: dark')
    expect(lightBody, 'light variant missing color-scheme: light').toContain('color-scheme: light')
  })

  // R2 (coordinator's call) — Appendix B's "New-UI already has direct uses" is wrong for the *-soft family:
  // those tokens are declared only in tokens.scss's .agent-app/.ai-toast-scope scope, which .knowledge-app can't
  // resolve, so we must add our own copy in both variants' declaration layers. This pins it down: dropping
  // either variant's copy of any one of them fails.
  // 【T11 addition】The dashboard k2-* section also uses --danger-soft-border (the hover-intensified state of
  // k2-qchip[data-tone=danger]) and --modal-scrim (the color-mix source for k2-ob-layer .k2-tag's dark overlay),
  // 4→6 tokens, expanding the same assertion, no new describe block.
  // 【Addition】The shared foundation section uses 3 more: --success-soft-border (the border of
  // .kn-badge[data-s="curated"], blueprint :2038), --danger-soft-faint (the background of
  // .k-confirm-summary, blueprint :1417; reused by the T6 section at :1972), --danger-hover (the hover
  // background of .k-btn.danger, blueprint :846).
  // Attribution follows the token-ownership table in the governance doc §6.2 (--purple-soft belongs to T6,
  // not declared by this task). 6→9 tokens.
  // 【Addition】The "collected files" section (S8) newly uses only 1: --purple-soft (the background of
  // .k-type-tag[data-kind="code"] at blueprint :1894), which the ownership table assigns to T6. This section's
  // use of --danger-soft-faint was already declared by T2 (blueprint :1972 is its second use site), so it is
  // not duplicated. 9→10 tokens.
  it('R2 — all 10 *-soft/-scrim/-hover tokens this file uses have values in both variants (from the porting waves, 3 from + 1 from )', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    for (const tok of [
      '--warning-soft:', '--warning-soft-border:', '--success-soft:', '--danger-soft:',
      '--danger-soft-border:', '--modal-scrim:',
      '--success-soft-border:', '--danger-soft-faint:', '--danger-hover:',
      '--purple-soft:',
    ]) {
      expect(darkBody, `dark variant missing ${tok}`).toContain(tok)
      expect(lightBody, `light variant missing ${tok}`).toContain(tok)
    }
  })

  // R4 (review ruling 2026-07-31, supersedes Appendix B's original table) — --shadow-* carries color, it is
  // not a colorless structural value, so both variants must each give a different value (the dark variant
  // takes the dark-toned shadow from tokens.scss:360-363, the light variant takes the warm-toned shadow from
  // :107-110). It used to be treated as "a structural value shared by both variants" — only the dark variant
  // declared one, and the light variant reused the same warm-toned value — which made
  // .k-rail-item[data-active]/.k-rail-svc's shadow nearly invisible against a dark background. This pins down
  // that both variants must declare it separately with different values (guards against a future regression
  // back to "merged into one").
  // Review-technique self-check (a lesson exposed by RED probe 3, see the report for details) — this guard
  // originally only did a whole-substring check like "does rgba(40,35,25,…) appear somewhere in lightBody",
  // with all 4 tokens sharing one assertion; as long as --shadow-sm/md/lg stayed on the warm-toned shadow,
  // even reverting --shadow-xs alone back to the dark-toned shadow wouldn't be caught (probe confirmed:
  // break --shadow-xs alone, 9/9 still all green). Changed to **matching each token's own line individually**
  // — now any single token's value being changed incorrectly on its own will fail.
  it('R4 — each of --shadow-xs/sm/md/lg takes its own distinct dark/light shadow value exactly in both variants', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, { dark: string; light: string }> = {
      '--shadow-xs': {
        dark: '--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);',
        light: '--shadow-xs: 0 1px 2px rgba(40, 35, 25, 0.04);',
      },
      '--shadow-sm': {
        dark: '--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);',
        light: '--shadow-sm: 0 1px 2px rgba(40, 35, 25, 0.05);',
      },
      '--shadow-md': {
        dark: '--shadow-md: 0 8px 28px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3);',
        light: '--shadow-md: 0 6px 22px rgba(40, 35, 25, 0.08), 0 1px 2px rgba(40, 35, 25, 0.04);',
      },
      '--shadow-lg': {
        dark: '--shadow-lg: 0 24px 48px rgba(0, 0, 0, 0.55), 0 8px 16px rgba(0, 0, 0, 0.3);',
        light: '--shadow-lg: 0 24px 48px rgba(40, 35, 25, 0.10), 0 8px 16px rgba(40, 35, 25, 0.06);',
      },
    }
    for (const [tok, { dark, light }] of Object.entries(expected)) {
      expect(darkBody, `dark variant ${tok} value is wrong`).toContain(dark)
      expect(lightBody, `light variant ${tok} value is wrong`).toContain(light)
      // Reverse: the two variants must not share the same value (guards against a regression back to "merged into a shared structural value")
      expect(darkBody, `dark variant ${tok} should not contain the light variant's warm-toned shadow value`).not.toContain(light)
      expect(lightBody, `light variant ${tok} should not contain the dark variant's dark-toned shadow value`).not.toContain(dark)
    }
  })

  // 【Note】--danger-hover is the only token **created with no source anywhere in the repo** this cycle
  // (the other two, --success-soft-border / --danger-soft-faint, can both be traced back and verified against
  // AI's tokens.scss). Design §6.2 attached a derivation note ("darken this variant's --danger by the same
  // ratio as the blueprint, −9% lightness"), but T0 testing found **this rule cannot reproduce the two given
  // hex values**, so the governance doc §6.2 explicitly ruled: "the hex values design gave are authoritative,
  // downstream must not recompute other values from the rule." The R2 check above only verifies "was it
  // declared", not "did someone recompute the value from that derivation note" — this test pins both
  // variants' values down verbatim.
  it('--danger-hover matches design §6.2 given value verbatim in both variants (governance §6.2: recomputing from "−9% lightness" is forbidden)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(darkBody, 'dark variant --danger-hover value was changed').toContain('--danger-hover: #E35F52;')
    expect(lightBody, 'light variant --danger-hover value was changed').toContain('--danger-hover: #A83226;')
    // Reverse: the two variants must not share the same value (same value = someone treated it as "a shared structural value")
    expect(darkBody).not.toContain('--danger-hover: #A83226;')
    expect(lightBody).not.toContain('--danger-hover: #E35F52;')
  })

  // 【Note】This task newly declares 4 tokens (Appendix B §B.8), none of whose names carry a `-soft`/
  // `-scrim`/`-hover` suffix, so per governance §B.8's ruling the R2 array above **is not expanded**; but the
  // "declared in both variants" layer is auto-covered by the "light variant color-token coverage completeness"
  // set assertion below, while **whether the value was recomputed/changed** has no guard at all — Appendix B
  // §B.8 explicitly states all 4 have "a verbatim same-value source in the repo, none invented from thin air,
  // recomputation forbidden" (per the lesson from P5a T11 R9: inventing a color-mix ratio yourself). This test
  // uses the same style as the --danger-hover one to pin both variants' values down verbatim, and reversely
  // pins down the theme-invariant property of "same value in both variants" (in the same family as the
  // existing --purple/--pink/--teal/--modal-scrim).
  it('4 new tokens match AI tokens.scss source values verbatim in both variants (Appendix B §B.8: recomputing forbidden)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, string> = {
      // tokens.scss:201 (light) / :345 (dark) — foreground of the iOS switch thumb, theme-invariant
      '--switch-thumb': '--switch-thumb: #ffffff;',
      // tokens.scss:202 / :346 — the shadow of the same thumb, the whole box-shadow lives in the token
      '--switch-thumb-shadow': '--switch-thumb-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);',
      // tokens.scss:162 / :321 — the inset highlight of .k-sandbox-icon, the whole box-shadow lives in the token
      '--gloss-inset-dot': '--gloss-inset-dot: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);',
      // Renamed from tokens.scss:236's --grad-sk-blue without changing the value (-sk- is skills-section-specific naming)
      '--grad-sandbox': '--grad-sandbox: linear-gradient(135deg, #5AC8FA, #007AFF);',
    }
    for (const [tok, decl] of Object.entries(expected)) {
      expect(darkBody, `dark variant ${tok} missing declaration or value was changed`).toContain(decl)
      expect(lightBody, `light variant ${tok} missing declaration or value was changed (both variants having the same value doesn't excuse skipping one)`).toContain(decl)
    }
  })

  // 【K39】This task newly declares 9 tokens (Appendix B §B.1 is authoritative). 7 are theme-invariant
  // (4 note gradients + 2 wash gradients + 2 code-block colors), same value in both variants;
  // --shadow-warning-glow **differs** between variants (the RGB triple switches with --warning-soft-border,
  // alpha stays at the blueprint's 0.3/0.24).
  // Honest disclosure (K39's explicit order, do not copy P5c's "4/4 all have a source" line): of the 4 note
  // gradients, only --grad-note-note is verbatim identical to the existing --grad-sandbox; the other 3 have
  // zero same-value precedent anywhere in the repo, and the blueprint design package is the sole authority for
  // the value — this test only pins down "the value was not recomputed/changed downstream", it does not mean
  // these values themselves have a repo precedent.
  it('K39 — 7 theme-invariant new tokens match verbatim in both variants (Appendix B §B.1, recomputing forbidden)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, string> = {
      // notesViewHelpers.js:6, verbatim identical to existing --grad-sandbox (still given a separate new name; see the scss header comment for why)
      '--grad-note-note': '--grad-note-note: linear-gradient(135deg, #5AC8FA, #007AFF);',
      // notesViewHelpers.js:7, zero same-value precedent anywhere in the repo
      '--grad-note-summary': '--grad-note-summary: linear-gradient(135deg, #30B0C7, #34C759);',
      // notesViewHelpers.js:8, shared with knowledge.scss:2066 (.kn-inbox-icon), zero same-value precedent anywhere in the repo
      '--grad-note-insight': '--grad-note-insight: linear-gradient(135deg, #FF9500, #FFCC00);',
      // notesViewHelpers.js:9, zero same-value precedent anywhere in the repo
      '--grad-note-digest': '--grad-note-digest: linear-gradient(135deg, #AF52DE, #FF2D55);',
      // knowledge.scss:2060, keeps the blueprint's hue (ruling R11)
      '--grad-inbox-wash':
        '--grad-inbox-wash: linear-gradient(160deg, rgba(255, 149, 0, 0.07), rgba(255, 204, 0, 0.04) 55%, transparent);',
      // knowledge.scss:2132, keeps the blueprint's hue (ruling R11)
      '--grad-draftbar-wash':
        '--grad-draftbar-wash: linear-gradient(135deg, rgba(255, 149, 0, 0.09), rgba(255, 204, 0, 0.04));',
      // NotesMarkdownEditor.vue:44, theme-invariant
      '--code-block-bg': '--code-block-bg: #0d0d0d;',
      '--code-block-fg': '--code-block-fg: #ffffff;',
    }
    for (const [tok, decl] of Object.entries(expected)) {
      expect(darkBody, `dark variant ${tok} missing declaration or value was changed`).toContain(decl)
      expect(lightBody, `light variant ${tok} missing declaration or value was changed (both variants having the same value doesn't excuse skipping one)`).toContain(decl)
    }
  })

  it('K39 — --shadow-warning-glow differs between variants (dark 0.3 / light 0.24, Appendix B §B.1 row 7)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(darkBody, 'dark variant --shadow-warning-glow value was changed').toContain(
      '--shadow-warning-glow: 0 3px 8px rgba(224, 165, 59, 0.3);',
    )
    expect(lightBody, 'light variant --shadow-warning-glow value was changed').toContain(
      '--shadow-warning-glow: 0 3px 8px rgba(200, 134, 10, 0.24);',
    )
    // Reverse: the two variants must not share the same value (same value = someone treated it as theme-invariant)
    expect(darkBody).not.toContain('--shadow-warning-glow: 0 3px 8px rgba(200, 134, 10, 0.24);')
    expect(lightBody).not.toContain('--shadow-warning-glow: 0 3px 8px rgba(224, 165, 59, 0.3);')
  })

  it('K39 — #FF9500,#FFCC00 declare only one copy of --grad-note-insight (shared by two consumers, must not declare it twice)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    for (const body of [darkBody, lightBody]) {
      const hits = body.match(/--grad-note-insight:/g) || []
      expect(hits.length, '--grad-note-insight should be declared exactly once (shared by the two consumers of #FF9500,#FFCC00)').toBe(1)
    }
    // Consumers (.kn-inbox-icon and the remaining references outside K44's top-level section, left to T3/T6/T7) — this pass only checks the one
    // .kn-inbox-icon site inside the scss, confirming it references the token instead of re-declaring the color literal.
    expect(css, '.kn-inbox-icon should reference --grad-note-insight instead of re-declaring the literal').toContain(
      'background: var(--grad-note-insight);',
    )
  })

  // 【Appendix B §B.1 / §B.2】This pass adds 8 declarations in each variant: --paper-surface (an
  // **existing exception token** this file has not yet declared, not a new one) + 7 new ones (5 --rtag-* /
  // --shadow-drawer / --mark-hl-bg). The "light variant color-token coverage completeness" set assertion above
  // only checks "was it declared", **it cannot tell whether the value was recomputed by someone** — these two
  // tests use the same style as the --danger-hover / K39 ones to pin the values down verbatim (Appendix B
  // §B.5-2 explicitly rules "any color literal outside this table → NEEDS_CONTEXT, do not pick your own
  // token"; conversely, values that are in the table must not be recomputed downstream either).
  it('--paper-surface + 5 --rtag-* tokens match verbatim in both variants (theme-invariant, Appendix B §B.1/§B.2.1)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, string> = {
      // AI tokens.scss:193 (light) / :342 (dark), same value in both variants, a skin-agnostic exception token
      '--paper-surface': '--paper-surface: #ffffff;',
      // Blueprint :618-622; verbatim identical to AI tokens.scss's --kind-pdf/-md/-doc/-xls and this file's --purple
      '--rtag-pdf': '--rtag-pdf: #FF3B30;',
      '--rtag-md': '--rtag-md: #1a1a1a;',
      '--rtag-doc': '--rtag-doc: #007AFF;',
      '--rtag-txt': '--rtag-txt: #34C759;',
      '--rtag-code': '--rtag-code: #AF52DE;',
    }
    for (const [tok, decl] of Object.entries(expected)) {
      expect(darkBody, `dark variant ${tok} missing declaration or value was changed`).toContain(decl)
      expect(lightBody, `light variant ${tok} missing declaration or value was changed (both variants having the same value doesn't excuse skipping one)`).toContain(decl)
    }
    // Reverse: --rtag-txt must not be casually reused under the name --kind-txt — tokens.scss:210/:351's
    // --kind-txt is a different value (a muted neutral, also an unknown-type fallback); re-declaring it here would create two values under the same name across the repo.
    expect(darkBody, 'this file must not re-declare --kind-txt (two values under the same name across the repo)').not.toContain('--kind-txt:')
    expect(lightBody, 'this file must not re-declare --kind-txt (two values under the same name across the repo)').not.toContain('--kind-txt:')
  })

  it('--shadow-drawer / --mark-hl-bg differ between variants (Appendix B §B.2.2/§B.2.3, recomputing forbidden)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    // The geometry part follows blueprint :1582 verbatim; the color part follows ruling R4 (a plain dark-toned
    // shadow for the dark variant / a warm-toned shadow for the light variant, alpha taken from the same
    // variant's --shadow-lg's first segment). The blueprint's original value is cool-toned, from a different
    // source than the two sets this file already unified under R4, so it is not copied verbatim.
    const darkShadow = '--shadow-drawer: -20px 0 60px rgba(0, 0, 0, 0.55);'
    const lightShadow = '--shadow-drawer: -20px 0 60px rgba(40, 35, 25, 0.10);'
    expect(darkBody, 'dark variant --shadow-drawer value was changed').toContain(darkShadow)
    expect(lightBody, 'light variant --shadow-drawer value was changed').toContain(lightShadow)
    expect(darkBody, 'dark variant should not contain the warm-toned shadow value of the light variant').not.toContain(lightShadow)
    expect(lightBody, 'light variant should not contain the shadow value of the dark variant').not.toContain(darkShadow)
    // Blueprint :1660; the light variant follows the blueprint's alpha verbatim, the dark variant lowers the
    // alpha (.k-chunk-content's foreground is --text-primary; copying the light variant's alpha would push the
    // background toward a mid-tone, giving light-colored text the worst contrast).
    const darkMark = '--mark-hl-bg: rgba(255, 235, 0, 0.22);'
    const lightMark = '--mark-hl-bg: rgba(255, 235, 0, 0.40);'
    expect(darkBody, 'dark variant --mark-hl-bg value was changed').toContain(darkMark)
    expect(lightBody, 'light variant --mark-hl-bg value was changed').toContain(lightMark)
    expect(darkBody, 'dark variant should not use the alpha of the light variant').not.toContain(lightMark)
    expect(lightBody, 'light variant should not use the alpha of the dark variant').not.toContain(darkMark)
  })

  // 🔴 Appendix D §D.6 explicitly rules: of the three mark rules, **only blueprint :1660 is a literal**; the
  // other two (:653 .k-rcard-snippet mark / :1645 .k-chunk-item-preview mark) use the tokens --accent-soft/
  // --accent in the blueprint — **do not change them to --mark-hl-bg along with it**.
  // The whole-file color scan above cannot catch this kind of "changed in the right direction but on the
  // wrong target" drift.
  it('Appendix D §D.6 — each of the three mark rules stays in its own place (only .k-chunk-content mark uses --mark-hl-bg)', () => {
    const markRules = [...css.matchAll(/^\s*(?:\.[\w-]+ )?mark\b[^\n]*$|^\s*\.[\w-]+ mark \{[^\n]*$/gm)].map((m) => m[0].trim())
    // Check each one precisely (anchored on its own parent block selector, not a whole-file bare count)
    const snippetMark = nestedBlockBody(cssKeepLines, '.k-rcard-snippet {')
    expect(snippetMark, '.k-rcard-snippet mark should keep the token from blueprint :654-655').toContain('background: var(--accent-soft);')
    expect(snippetMark, '.k-rcard-snippet mark was mistakenly changed to --mark-hl-bg').not.toContain('--mark-hl-bg')
    const previewLine = css.split('\n').filter((l) => l.includes('.k-chunk-item-preview mark'))
    expect(previewLine.length, '.k-chunk-item-preview mark should have exactly 1 rule').toBe(1)
    expect(previewLine[0], '.k-chunk-item-preview mark should keep the token from blueprint :1645').toContain('background: var(--accent-soft);')
    expect(previewLine[0], '.k-chunk-item-preview mark was mistakenly changed to --mark-hl-bg').not.toContain('--mark-hl-bg')
    const contentLine = css.split('\n').filter((l) => l.includes('.k-chunk-content mark'))
    expect(contentLine.length, '.k-chunk-content mark should have exactly 1 rule').toBe(1)
    expect(contentLine[0], '.k-chunk-content mark should use --mark-hl-bg (blueprint :1660 is the only literal spot)').toContain('background: var(--mark-hl-bg);')
    // Coverage self-check: confirm mark rules were actually captured (guards against the regex above matching nothing and "passing" vacuously)
    expect(markRules.length, 'not a single mark rule was captured (a dead regex has zero discriminating power)').toBeGreaterThanOrEqual(3)
  })

  it('--accent-soft-2 is not re-declared in this file (R2 exception: already in the global theme.css, in :root and the light block, follows the global resolution)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(darkBody).not.toContain('--accent-soft-2:')
    expect(lightBody).not.toContain('--accent-soft-2:')
    // But the shell section does reference it (the shadow of k-banner[data-tone="info"] and k-btn.primary)
    expect(css).toContain('var(--accent-soft-2)')
  })

  // Review 2026-07-31 Critical correction — the initial version deliberately left --accent/--accent-soft/
  // --success undeclared in the light declaration block, relying on CSS inheritance to pick up the outer
  // light value. That reasoning doesn't hold: the dark block's selector, `.knowledge-app { … }`, matches
  // unconditionally (no data-theme qualifier), so it applies to this same element under the light theme too;
  // the custom-property inheritance rule is "the element's own declaration wins when the element has one", so
  // leaving the light block empty does not inherit the light value — it gets hit directly by the dark block's
  // literal values (#5E97F2 etc.) instead — the accent/success states end up using the dark palette under the
  // light theme. This test pins down that the light block must explicitly declare these three literal values;
  // any one of them being "optimized away" fails precisely.
  it('light variant must explicitly declare --accent/--accent-soft/--success (cannot rely on inheritance, see the correction note in the header comment)', () => {
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(lightBody, 'light variant missing --accent (would get hit by #5E97F2 from the dark block)').toContain('--accent: #3b5bdb')
    expect(lightBody, 'light variant missing --accent-soft (would get hit by the value from the dark block)').toContain('--accent-soft: rgba(59, 91, 219, 0.11)')
    expect(lightBody, 'light variant missing --success (would get hit by #4FB870 from the dark block)').toContain('--success: #15754c')
    // Reverse: confirm it didn't fall back to a self-referential circular declaration
    expect(lightBody).not.toContain('--accent: var(--accent)')
    expect(lightBody).not.toContain('--accent-soft: var(--accent-soft)')
    expect(lightBody).not.toContain('--success: var(--success)')
  })
})

// 【K44 top-level bare-selector exception (governance §6.2-2 explicit ruling / ruling R4 / Appendix D §D.2.2)】
// 🔴 This assertion is **newly added**, not modified — the file as it stood had no "top-level bare selector"
// assertion at all (`grep -n "top-level\|bare selector\|top-level" knowledgeStyles.test.ts` before this pass
// only matched the K10 comment, this one wasn't found). Baseline: before this change, the file had 15
// depth-0 (top-level, zero-indent) opening block selectors, all `.knowledge-app` (including the two
// token-declaration blocks composed with `.parser-app`) / `:root[data-theme="light"] …` / `@keyframes` —
// after excluding these three kinds, "bare selectors" measured 0. K44 brings in the one genuine top-level
// bare selector: `.nme-content .ProseMirror` (blueprint NotesMarkdownEditor.vue:41-46, see the comment on
// that section in knowledge.scss for why).
//
// Criterion: extract the file's depth-0 selectors (the `{` encountered while brace depth is 0), filter out
// the three kinds `.knowledge-app*`/`:root*`/`@*`, and assert the remaining **set is exactly equal to**
// `['.nme-content .ProseMirror']` — a set-equality check, not "excluded, so good enough" (ruling R4's explicit order).
function depthZeroSelectors(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let lastEnd = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') {
      if (depth === 0) {
        const sel = text.slice(lastEnd, i).trim()
        if (sel) out.push(sel)
      }
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) lastEnd = i + 1
    }
  }
  return out
}

describe('knowledge.scss — K44 top-level bare-selector exception (governance §6.2-2 / ruling R4, new assertion added in T2)', () => {
  function bareTopLevelSelectors(): string[] {
    return depthZeroSelectors(css).filter(
      (s) => !s.startsWith('.knowledge-app') && !s.startsWith(':root') && !s.startsWith('@'),
    )
  }

  it('top-level bare selectors (excluding .knowledge-app family / :root family / @ prefixed) are exactly the one .nme-content .ProseMirror', () => {
    expect(bareTopLevelSelectors()).toEqual(['.nme-content .ProseMirror'])
  })
})

// 【Final review ⚠️-D1, added 2026-08-01, the most valuable fix in this round】The tests above (R2/R4/the
// "3 same-named tokens" one) each only pin down 13 named tokens one by one (6 *-soft/scrim + 4 --shadow-* + 3
// same-named --accent/--accent-soft/--success). Any color token other than these 13 disappearing from the
// light block has **no guard at all** — the final review's RED probe confirmed it: delete the whole
// `--line-strong: #D8D3C7;` line from the light block, and `knowledgeStyles` + `color-guard` still come back
// 209/209 all green, nobody fails. Real-device consequence: under the light theme, `.k2-root-add`'s dashed
// border would pick up the dark block's `#3A3A3D` instead — this file has already paid for the exact same
// kind of failure (a missing declaration in the light block) once before, as a Critical (T4: the three
// --accent/--accent-soft/--success).
//
// Criterion (building on the premise the header comment's "hidden pitfall" section already established): the
// dark block's selector, `.knowledge-app { … }`, matches unconditionally, so it applies to this same element
// under the light theme too; the custom-property inheritance rule is "the element's own declaration wins when
// the element has one" — so every **color** token the dark block declares must also be explicitly declared by
// the light block (the value may differ; this only requires "it is declared" — whether the value is correct
// is the job of the precise-value assertions in R2/R4/the 3-same-named tests above, the two layers do not
// overlap).
//
// Exceptions (shared by both variants, declared once in the dark/base block only, the light block is not
// required to repeat it) are registered below, each with its reason spelled out — this list must not be used
// as a dumping ground; any new exception must have its reason written out item by item like the ones below:
const SHARED_STRUCTURAL_EXCEPTIONS = [
  // 9 genuine structural values — border-radius and font stacks, carrying no hue/chroma/lightness information,
  // not "color tokens". Appendix B's original text already classifies these 9 as "structural values, shared
  // by both variants, declared only in the base block".
  '--r-xs', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-2xl', '--r-pill',
  '--font-sans', '--font-mono',
  // 2 brand gradient colors — --grad-iri/--grad-iri-soft are the rainbow brand-identity gradient, skin-agnostic.
  // Traced back and verified: AI's own tokens.scss also declares them only once, at :119-120 (the dark block
  // starting at :250 does not redefine them), and `.agent-app` shares the same copy across both variants —
  // consistent with this file's approach, falling under `theme.css`'s exception-list category 1 (brand-identity
  // colors, skin-agnostic exceptions), not a missing declaration.
  '--grad-iri', '--grad-iri-soft',
]

describe('knowledge.scss — light variant color-token coverage completeness (final review ⚠️-D1, set assertion)', () => {
  function declaredTokenNames(body: string): Set<string> {
    return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  }

  it('every color token declared by the dark block must also be declared by the light block (any one missing outside the whitelist is named precisely)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const darkTokens = declaredTokenNames(darkBody)
    const lightTokens = declaredTokenNames(lightBody)
    const missing = [...darkTokens].filter(
      (t) => !SHARED_STRUCTURAL_EXCEPTIONS.includes(t) && !lightTokens.has(t),
    )
    expect(missing, `color tokens missing from the light variant (outside the whitelist): ${missing.join(', ')}`).toEqual([])
  })

  it('the exception list currently has exactly these 11 entries, no more and no less (guards against the list being quietly expanded into a dumping ground)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const darkTokens = declaredTokenNames(darkBody)
    const lightTokens = declaredTokenNames(lightBody)
    // The actual "in dark but not in light" difference set must be exactly equal to the registered exception
    // list — extra entries mean the exception list is missing a genuine new gap (should fail and get the scss
    // fixed, not just get another list entry added); fewer entries, or an entry in the list that the light
    // variant actually does declare, means the list should be tightened.
    const actualOnlyDark = [...darkTokens].filter((t) => !lightTokens.has(t)).sort()
    expect(actualOnlyDark).toEqual([...SHARED_STRUCTURAL_EXCEPTIONS].sort())
  })
})

// 【Review 2026-08-01 Important I-3】The color scan/whitelist/R2/R4 assertions etc. only check "is there a bare
// color literal" / "does the class name exist", they never check whether a var(--x) reference's --x is
// actually declared anywhere — the review's RED probe confirmed it: swap .k2-prog-pct's var(--ly-vec) for
// var(--k2-nonexistent), and all three gates plus this file's own assertions still come back 10/10 all green
// (sass does not resolve custom-property references, and vue-tsc/build care even less). On a real device this
// kind of reference lands as the CSS-spec-defined guaranteed-invalid value — the corresponding background/
// color simply turns transparent (or inherits), and the page is "missing a patch of color" with zero
// compile-time error. This file has already paid for the exact same kind of failure once (the batch of R2
// *-soft tokens declared only in tokens.scss's .agent-app/.ai-toast-scope scope, unresolvable from
// .knowledge-app, see the R2 comment at the top of the file), proving this is not a hypothetical risk.
//
// Coverage: every var(--x[, fallback]) reference in the whole of knowledge.scss — --x must be declared either
// ① somewhere in this file (including the two token-declaration blocks plus local in-rule declarations, such
// as .k2-layer's --ly/--ly-soft/--ly-ln) or ② in the global src/styles/theme.css; it fails only if neither
// has it. Exception: a reference with a fallback (e.g. .k2-glue-id i's var(--g, var(--text-quaternary))) is a
// token **deliberately injected by the consumer** (a template inline style), and is not required to be
// declared by this file or globally — but the fallback itself (--text-quaternary) still goes through the
// normal resolvability check (matchAll captures each independent var( call; a var() nested inside a fallback
// is a separate match, unaffected by the outer exemption).
describe('knowledge.scss — var() reference closure (review Important I-3)', () => {
  const theme = read('../../styles/theme.css')

  function declaredTokens(text: string): Set<string> {
    return new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  }

  it('every var(--x) reference in the whole file resolves to a declaration in this file or the global theme.css (the --g style inline-injection exception is the next test)', () => {
    const declaredHere = declaredTokens(css)
    const declaredGlobal = declaredTokens(theme)
    const used = new Set(
      [...css.matchAll(/var\((--[a-z0-9-]+)(\s*,)?/g)]
        .filter((m) => !m[2]) // References with a fallback are exempt (--g, see the header comment)
        .map((m) => m[1]),
    )
    const unresolved = [...used].filter((t) => !declaredHere.has(t) && !declaredGlobal.has(t))
    expect(unresolved, `references to undeclared tokens (would render transparent on a real device): ${unresolved.join(', ')}`).toEqual([])
  })

  it('--g is the only registered "consumer inline injection" exception in this file (.k2-glue-id i, see the header comment for why)', () => {
    expect(css).toContain('var(--g, var(--text-quaternary))')
  })
})

// 【Review 2026-08-01 Minor M-2】The whitelist only checks whether a class exists, not whether all three
// [data-layer] colors are present — RED probe: delete the entire `.k2-layer[data-layer="vec"]` rule, and it is
// still 10/10 all green. The brief itself warned that "missing one is a visible regression, and unit tests
// only check the attribute value, not the color". This test pins down that the wiki/vec/note colors are all
// present on both k2-layer and k2-ob-layer (2 hosts × 3 colors = 6 combinations; whichever is missing gets
// named precisely).
describe('knowledge.scss — [data-layer] three-color completeness (review Minor M-2)', () => {
  it('none of the [data-layer=wiki/vec/note] colors may be missing on k2-layer or k2-ob-layer', () => {
    const hosts = ['k2-layer', 'k2-ob-layer']
    const layers = ['wiki', 'vec', 'note']
    const missing: string[] = []
    for (const host of hosts) {
      for (const layer of layers) {
        const re = new RegExp(`\\.${host}\\[data-layer="${layer}"\\]`)
        if (!re.test(css)) missing.push(`${host}[data-layer="${layer}"]`)
      }
    }
    expect(missing, `missing data-layer combinations: ${missing.join(', ')}`).toEqual([])
  })
})

// 【Review 2026-08-01 Minor M-3】Delete an @keyframes and the `animation: X` reference to it is still there —
// the animation silently stops working (the spinner does not spin, the flash does not flash) with nobody
// failing. This test pins down: wherever a `animation: X` reference appears in the file, this same file must
// have a matching `@keyframes X` (conversely: a keyframes block that is declared but unused by anyone does not
// fail — that is merely "redundant", not a defect — of T4's 7 keyframes in this file, only k-shimmer/k-pulse
// are actually used, and the rest are reserved for later batches, which likewise should not fail).
describe('knowledge.scss — every animation reference has a matching @keyframes declaration (review Minor M-3)', () => {
  // 【N11】The one registered exception: `fade-in`.
  // Blueprint knowledge.scss:1941's `.k-file-detail { animation: fade-in 160ms ease }` references a keyframes
  // that **the blueprint itself never defines** — the blueprint's whole file only has `@keyframes k-fade-in`
  // (T0 already checked the blueprint's full @keyframes table: :1511/1515/1519/1523/1527/1531/1535/1541/1542/
  // 1844/2440/2441, no bare `fade-in`). The animation-name dangles ⇒ this fade-in **never played, even in
  // Vue2**.
  // Governance doc §3.5 N11 explicitly rules this a "copy verbatim" item: changing it to `k-fade-in` would
  // conjure up a fade-in animation Vue2 never had = the UI is no longer 1:1 (this cycle's discipline: do not
  // copy Vue2's bugs, but things like "a dangling animation-name / an undefined class / a selector that never
  // matches" — which **do not affect correctness, only pixels** — must be copied verbatim).
  //
  // 🔴 The registration is deliberately done as "name one exempt string", not "turn off the whole guard":
  //   ① the filter below only skips the one string `fade-in`; any **other** dangling reference still fails;
  //   ② the second test case reversely pins down that "this exception must actually exist" — `.k-file-detail`
  //      must **genuinely** say `animation: fade-in`, and not `k-fade-in`. If someone "helpfully corrects" it
  //      one day, this test fails and reminds them this is N11's copy-verbatim item; if someone deletes
  //      `fade-in` from the exception list without touching the scss, the first test fails. The two are
  //      diagonal to each other — neither can be routed around.
  //   ③ Reverse confirmation (already proven by T6 RED probe 4): `k-fade-in` is a keyframes block that
  //      genuinely exists and is referenced by `.k-modal-bg`, and it is **not** in the exemption list — delete
  //      the `@keyframes k-fade-in` definition, and the first test still fails precisely. This proves the
  //      exemption is for "the one name fade-in", not the whole guard.
  const DANGLING_ANIMATION_EXCEPTIONS = ['fade-in']

  it('every animation: X reference has a matching @keyframes X (N11 fade-in is the only registered exception)', () => {
    const used = new Set(
      [...css.matchAll(/animation(?:-name)?:\s*([a-zA-Z0-9_-]+)/g)].map((m) => m[1]),
    )
    const declared = new Set(
      [...css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((m) => m[1]),
    )
    const missing = [...used].filter(
      (name) => !declared.has(name) && !DANGLING_ANIMATION_EXCEPTIONS.includes(name),
    )
    expect(missing, `referenced but undeclared @keyframes: ${missing.join(', ')}`).toEqual([])
  })

  it('N11 — the dangling animation on .k-file-detail copies the fade-in from blueprint :1941 verbatim, and has not been "helpfully corrected" to k-fade-in', () => {
    // Take the body of the .k-file-detail rule block (from the selector to the first `}`) and assert only
    // within that block, to avoid matching `animation: k-fade-in` elsewhere in the file (.k-modal-bg).
    const at = css.search(/\.k-file-detail\s*\{/)
    expect(at, 'could not find the .k-file-detail rule block').toBeGreaterThan(-1)
    const body = css.slice(at, css.indexOf('}', at))
    expect(body, 'N11 violated: the animation-name on .k-file-detail was changed').toContain('animation: fade-in 160ms ease')
    expect(body, 'N11 violated: .k-file-detail was "helpfully corrected" to k-fade-in, which would conjure up a fade-in Vue2 never had').not.toContain('k-fade-in')
    // The exception list has exactly this one entry (same "the list is not a dumping ground" rule as above)
    expect(DANGLING_ANIMATION_EXCEPTIONS).toEqual(['fade-in'])
  })
})

// 【Review Important open finding 2, added 2026-08-01】Comment out `KnowledgeLayout.vue:41`'s
// `import '../../styles/knowledge.scss'` → the whole suite is still all green, nobody fails — this is the
// most severe category of failure in this batch (the whole knowledge section runs bare, visually nothing at
// all), and there had never been any automated guard for it before. All 38 classes' existence/color-literal
// assertions above only read the `knowledge.scss` source file itself, and never care whether any production
// code imports it — no matter how correct the file's content is, if nobody imports it, it is dead code and
// not a single line of CSS ends up in the build output (this is exactly the direct consequence of the R8
// Critical: before C1, KnowledgeDeferred.vue did not import it, KnowledgeLayout.vue wrote the import but the
// parent route never wired it up, and `knowledge-app` could not be found anywhere in dist).
//
// Reuses this file's existing node:fs technique (not Vite's `?raw` — same as header comment ③: CSSEnablerPlugin
// preserves the parts of a .vue SFC outside the `<style>` block, but here we read the .vue source file's raw
// text directly to find the literal import statement, going through no compilation pipeline at all and
// unaffected by CSSEnablerPlugin — so either `?raw` or node:fs works fine for reading a .vue; node:fs is used
// here too, for a consistent technique).
//
// 【A real bug caught while writing my own RED probe, now fixed】The first version used a bare
// `content.includes(needle)` substring match — comment out the production file's
// `import '../../styles/knowledge.scss'` (`// import '../../styles/knowledge.scss'`) and run this again, and
// the guard **still passes**: the substring `styles/knowledge.scss` is still sitting there, unchanged, on the
// commented-out line — a substring match simply cannot tell "a genuine import" apart from "the same text
// written inside a comment". This is the same species of bug as P3b lesson 4, "a substring check cannot catch
// a genuine defect" — this time it is my own probe catching my own guard. Changed to a line-by-line check:
// only "the whole line, whitespace stripped, starts with `import` and contains the needle" counts; a comment
// line (starting with `//`) naturally fails the "starts with import" premise, so it can't be misjudged.
function lineIsLiveImport(line: string, needle: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('import') && trimmed.includes(needle)
}

function findVueFilesImporting(dir: string, needle: string): string[] {
  const hits: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = resolve(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      hits.push(...findVueFilesImporting(full, needle))
    } else if (entry.endsWith('.vue')) {
      const content = readFileSync(full, 'utf8') as string
      if (content.split('\n').some((line: string) => lineIsLiveImport(line, needle))) hits.push(full)
    }
  }
  return hits
}

describe('knowledge.scss — must be imported by at least one production .vue file (review Important open finding 2)', () => {
  it('some .vue file under src/ai imports knowledge.scss, otherwise the stylesheet compiles no CSS at all and the whole knowledge section runs bare', () => {
    const aiDir = resolve(__dirname, '..')
    const importers = findVueFilesImporting(aiDir, 'styles/knowledge.scss')
    expect(
      importers.length,
      'no .vue file imports knowledge.scss — see R8: this genuinely happened once before' +
        '(KnowledgeDeferred.vue did not import it, the parent route did not wire up KnowledgeLayout.vue, and knowledge-app could not be found anywhere in dist)',
    ).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 **The unified fix for guard gap ③'** (governance §9 gap table).
//
// 【What gap ③ is】`color-guard.test.ts:44-56`'s `styleLines()` only takes the `<style>` block for a `.vue`
//   file → **zero scanning of `style=` / `:style=` / `color=` attributes in the template**. The earlier fix was
//   "add one targeted assertion in each new `.vue`'s own `*.test.ts`".
//
// 【What gap ③' is】That targeted assertion's existing implementation is
//       /<template>([\s\S]*?)\n<\/template>/
//   — **non-greedy**, relying on the implicit anchor "the `</template>` happens to sit at column 0". Today,
//   for all five files (`QueueView` / `IndexedFilesView` / `FolderBrowser` / `ParserStatus` / `ParserTest`)
//   this happens to hold (every nested closing tag is indented), so **it is correct for now**; but swap
//   formatters, or have someone manually re-indent and push a nested `</template>` to column 0, and the regex
//   would **truncate early** → silently under-scanning a large chunk of the template, while all three gates
//   stay green. Measured nested-`</template>` counts: `QueueView` has **12**, `IndexedFilesView` has **7**
//   (governance §9's gap table wrote "7/12", swapping the two files — the numbers themselves are correct).
//
// 【This pass's fix (coordinator's directive: fix it uniformly, stop copying it)】
//   ① Change the extraction to be **greedy** — take the **last** column-0 `</template>`
//      (`lastIndexOf('\n</template>')`) instead of the first one;
//   ② Add a **coverage self-check** — assert that the extracted slice contains a signature string for "the
//      template's last line". The signature string is derived by **scanning lines backward from the end of
//      the file** (an independent code path from the `lastIndexOf` used for extraction), so the moment someone
//      reverts the extraction to the non-greedy form and it gets truncated by the first nested `</template>`,
//      this self-check fails immediately;
//   ③ **Centralize in this file** the scan over every file under `src/ai/knowledge/**/*.vue`, instead of every
//      view copying its own copy. The fragile implementation still sits in the five existing files (they and
//      their tests are on governance §1.1's whole-cycle zero-touch list; touching P5b/T6/T7's already-shipped
//      output just for one guard is not worth it) — **this test in this file is their superior guard**: even
//      if those five are truncated down to zero discriminating power, this one still scans the whole template.
//      🔴 **Every view added after this pass relies on this test alone** (`SettingsView.test.ts` never copied
//      that regex; it uses the stricter equivalent "zero `<style>` blocks → whole-file scan" instead).
//   ④ The file list uses a **set-equality** check against drift: newly added views must be explicitly added to
//      the list (consistent with this file's established rule that "the whitelist/exception list is not a
//      dumping ground").
//
// RED probe (T8's report §7 pastes the full output): for **every** scanned file, drop a bare color literal
//   into the **last line** of its template → this test must fail and name that exact file; there is also a
//   probe that "pushes some nested `</template>` to column 0 and drops a bare color literal after it",
//   specifically to prove this "greedy vs. non-greedy" change itself has discriminating power (the non-greedy
//   form passes all-green on that input). After each probe, an md5 byte-for-byte restore left `git status`
//   clean (governance §1.3).
const KNOWLEDGE_VUE_FILES = [
  'components/AssetDetailDrawer.vue',
  'components/FileDetailDrawer.vue',
  'components/FolderBrowser.vue',
  'components/KFileViewer.vue',
  'components/KIcon.vue',
  'components/NoteEditPane.vue',
  'components/NotesMarkdownEditor.vue',
  'parser/ParserStatus.vue',
  'parser/ParserTest.vue',
  'views/AllowlistView.vue',
  'views/DashboardView.vue',
  'views/IndexedFilesView.vue',
  'views/KnowledgeDeferred.vue',
  'views/KnowledgeLayout.vue',
  'views/NotesView.vue',
  'views/QueueView.vue',
  'views/RootsView.vue',
  'views/SearchView.vue',
  'views/SettingsView.vue',
  // Newly created `views/WikiView.vue` (the top half; T7 continues writing the bottom
  // half, **not registered twice**). Failing to register it would fail the "file list set equality"
  // anti-drift assertion above — that is correct behavior (§9.10).
  'views/WikiView.vue',
]

/** Recursively list every `.vue` under a directory, returned as POSIX-style paths relative to `src/ai/knowledge/`. */
function listVueFiles(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listVueFiles(full, prefix + entry + '/'))
    else if (entry.endsWith('.vue')) out.push(prefix + entry)
  }
  return out.sort()
}

/**
 * 🔴 **Greedy** extraction of the root `<template>` block: takes the last column-0 `</template>`.
 * Returns three things; the latter two exist purely for the coverage self-check, and **both are derived by
 * scanning lines backward from the end of the file** — an independent code path from the `lastIndexOf` used
 * for extraction:
 *   - `tmpl`     the extracted template body
 *   - `byLine`   an **independent, line-by-line derivation** of the same body (open/close tag lines are both
 *                judged from line content)
 *   - `tail`     the raw text of the template's **last 3 non-blank lines**, used as the signature string
 *
 * ⚠️ **Why the signature string cannot just be "the last line's text, trimmed"** (the first version did
 * exactly this, and probe B caught on the spot that it had no discriminating power): a template's last line
 * is almost always a generic closing tag like `</div>`, and after truncation the surviving slice is full of
 * them too → `toContain` is vacuously true. Changed to "the raw text of the last 3 lines, indentation
 * included, plus `endsWith` for positioning", with an added check that "the two derivations are identical
 * verbatim" — only then does this genuinely block "truncated early by the first nested `</template>`".
 */
function extractTemplate(src: string): { tmpl: string; byLine: string; tail: string } {
  const OPEN = '<template>\n'
  const CLOSE = '\n</template>'
  const EMPTY = { tmpl: '', byLine: '', tail: '' }
  const openAt = src.indexOf(OPEN)
  const closeAt = src.lastIndexOf(CLOSE)
  if (openAt < 0 || closeAt <= openAt) return EMPTY
  const tmpl = src.slice(openAt + OPEN.length, closeAt)

  // ── Independent derivation: scan line by line ──
  const lines: string[] = src.split('\n')
  const openLine = lines.findIndex((l: string) => l === '<template>')
  let closeLine = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] === '</template>') {
      closeLine = i
      break
    }
  }
  if (openLine < 0 || closeLine <= openLine) return EMPTY
  const body = lines.slice(openLine + 1, closeLine)
  // `tail` takes the **raw last 3 lines** (indentation included, possibly blank lines included) → naturally a
  // contiguous slice, so `tmpl.endsWith(tail)` must be true when extraction is correct, and must be false when
  // truncated early.
  return { tmpl, byLine: body.join('\n'), tail: body.slice(-3).join('\n') }
}

/** Character-by-character bracket-pairing scan that strips out `var(...)` / `color-mix(...)` wholesale (the same technique as color-guard's stripVar). */
function stripColorCalls(s: string): string {
  const prefixes = ['var(', 'color-mix(']
  let out = ''
  let i = 0
  while (i < s.length) {
    const hit = prefixes.find((p) => s.startsWith(p, i))
    if (hit) {
      let depth = 0
      let j = i + hit.length - 1
      for (; j < s.length; j++) {
        if (s[j] === '(') depth++
        else if (s[j] === ')') {
          depth--
          if (depth === 0) {
            j++
            break
          }
        }
      }
      i = j
    } else {
      out += s[i]
      i++
    }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// Add two more units of discriminating power to guard gap ③' (governance §15.3 / §9.6).
//
// 【Named-color scanning】Both `color-guard.test.ts` and this file's existing ③' assertion only
// recognize `#hex` / `rgb()`/`hsl()` — CSS named colors (things like `color: white`) have zero coverage
// anywhere. 🔴 A naive "search the whole text for the word white" would wrongly flag `white-space: nowrap`
// (there is one at QueueView.vue:474) — it must be pinned to "attribute-value position": look for a whole-word
// named color only inside the **value** part of `color:` / `background:` / `background-color:` /
// `border-color:` / `border:` / `box-shadow:` / `fill:` / `stroke:`. The property name `white-space` itself
// can never enter this list (it isn't any of the strings above, and it doesn't matter that `\s*:` could
// theoretically follow `white-space` because of the hyphen — the point is `white-space` simply isn't a key in
// the list), so "pin to attribute-value position" naturally excludes `white-space: nowrap` without needing any
// extra hyphen special-casing on the value itself.
//
// 【Coverage】The existing ③' only scans `src/ai/knowledge/**`; `src/ai/components/**` (an earlier pass's
// output, the Agent section's cards/sidebar/settings subcomponents) is a blind spot for template
// `style=`/`:style=`. The coordinator already ran a one-off scripted dry-run over all 70 files independently
// (see the task report §7): hex / rgb / hsl / named colors get **zero hits** in attribute-value position —
// expanding the scope will not surface any pre-existing violation, so this pass lays down the same assertion
// over this directory directly, without triggering NEEDS_CONTEXT.
// ═══════════════════════════════════════════════════════════════════════════

/** Look for named colors only inside the value part of these CSS properties; longer names are listed before
 *  shorter ones so `background-color`/`border-color` don't get chopped up prematurely by `background`/
 *  `border`/`color` (the regex engine tries branches in the array's written order, so order is priority). */
const COLOR_VALUE_PROPS = [
  'background-color',
  'border-color',
  'background',
  'border',
  'box-shadow',
  'color',
  'fill',
  'stroke',
]
// Kept as the same 8-word list as §5 (this file's existing named-color list, `:510-517`), for a consistent standard.
const NAMED_COLORS = ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']

/**
 * Look for named colors at "attribute-value position". First use `prop\s*:\s*([^;]+)` to capture each
 * `property: value` segment (the input should already have had `var(...)`/`color-mix(...)` stripped out by
 * `stripColorCalls`, so a token name itself won't be misjudged as a color value), then do a whole-word match
 * on the value part (`(?<![\w-])COLOR(?![\w-])`, the same technique as `:510-517`, which excludes compound
 * words prefixed with the color name such as `whitesmoke`). Lines like `white-space: nowrap` are never
 * captured in the first place — its property name `white-space` is simply not in the `COLOR_VALUE_PROPS`
 * list, so the regex never even tries to slice it.
 */
function namedColorOffensesInValues(scrubbed: string): string[] {
  const offenders: string[] = []
  const propRe = new RegExp(`\\b(${COLOR_VALUE_PROPS.join('|')})\\s*:\\s*([^;]+)`, 'g')
  let m: RegExpExecArray | null
  while ((m = propRe.exec(scrubbed))) {
    const prop = m[1]
    const value = m[2]
    for (const c of NAMED_COLORS) {
      if (new RegExp(`(?<![\\w-])${c}(?![\\w-])`, 'i').test(value)) {
        offenders.push(`${prop}: ${value.trim().slice(0, 80)}`)
      }
    }
  }
  return offenders
}

describe('guard gap ③′ — every .vue in the knowledge section has zero bare colors in its <template> block (greedy extraction + coverage self-check)', () => {
  const kbDir = resolve(__dirname, '../knowledge')

  it('file list is set-equal (anti-drift: newly added views must be explicitly added to the list, otherwise this test fails)', () => {
    expect(listVueFiles(kbDir)).toEqual([...KNOWLEDGE_VUE_FILES].sort())
  })

  it.each(KNOWLEDGE_VUE_FILES)('%s — greedy extraction succeeds + coverage self-check (the slice extends all the way to the template last line)', (rel) => {
    const src: string = readFileSync(resolve(kbDir, rel), 'utf8')
    const { tmpl, byLine, tail } = extractTemplate(src)
    expect(tmpl, `${rel}: the root <template> block was not extracted (missing a column-0 <template>/</template>?)`).not.toBe('')
    expect(tail, `${rel}: could not find the template's tail signature string`).not.toBe('')
    // 🔴 Coverage self-check ①: the slice must **end with the template's raw last 3 lines**. The non-greedy
    //    form would truncate at the first nested `</template>` → the tail signature string would not be at
    //    the end of the slice → this fails.
    expect(
      tmpl.endsWith(tail),
      `${rel}: the extracted template slice does not extend to the last line (tail signature string:\n${tail}\n) — it was truncated early`,
    ).toBe(true)
    // 🔴 Coverage self-check ②: the two **independent derivations** (string lastIndexOf vs. scanning line by
    //    line from the end) must be identical verbatim. This one has nothing to do with text content — it is
    //    the hardest layer: the extraction boundary being off by even one line fails it.
    expect(tmpl, `${rel}: the string extraction and the line-by-line derivation disagree — the extraction boundary is wrong`).toBe(byLine)
  })

  it.each(KNOWLEDGE_VUE_FILES)('%s — zero hex / rgb / hsl literals inside the template (after stripping var()/color-mix())', (rel) => {
    const src: string = readFileSync(resolve(kbDir, rel), 'utf8')
    const { tmpl } = extractTemplate(src)
    const scrubbed = stripColorCalls(tmpl)
    expect(scrubbed, `${rel}: the template has a bare hex color`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed, `${rel}: the template has an rgb()/hsl() function color`).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })

  // Named-color scanning at attribute-value position (newly added).
  it.each(KNOWLEDGE_VUE_FILES)('%s — zero named colors at attribute-value position (color/background/border/box-shadow/fill/stroke) inside the template', (rel) => {
    const src: string = readFileSync(resolve(kbDir, rel), 'utf8')
    const { tmpl } = extractTemplate(src)
    const scrubbed = stripColorCalls(tmpl)
    const offenders = namedColorOffensesInValues(scrubbed)
    expect(offenders, `${rel}: found named colors at attribute-value position inside the template:\n${offenders.join('\n')}`).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §0.3 ("no color literals in comments either") had
// zero guard coverage at "comments inside a .vue's <script> block" until now:
// `color-guard.test.ts` only scans the `<style>`/attribute forms of `.vue`/`.css`, guard gap ③' only scans the
// `<template>` text, and T5's named-color scan is pinned to attribute-value position inside `<template>` —
// none of the three look at `<script>` block comments. Review caught one genuine violation each in
// `NoteEditPane.vue` (T7) and `NotesView.vue` (T6) — "a declaration comment writing out an rgba(...) literal"
// (already fixed, see the header comment of both files). 🔴 Scope is pinned to the existing
// `KNOWLEDGE_VUE_FILES` list (the same file table as this file's other guards), **not expanded to the whole
// repo** — expanding scope might surface pre-existing violations from other cycles, which is NEEDS_CONTEXT,
// not something this pass should fix (T5 already learned this lesson). `transparent` is a keyword, not a
// color literal, and is not scanned for.
describe('§0.3 — zero color literals in <script> block comments of .vue files (scope pinned to KNOWLEDGE_VUE_FILES)', () => {
  /** Extract the raw content of every `<script ...>...</script>` block in a .vue source file
   * (a SFC may have both a `<script>` block and a `<script setup>` block; scan both). */
  function extractScriptBlocks(src: string): string[] {
    const blocks: string[] = []
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) blocks.push(m[1])
    return blocks
  }

  /** Extract all comment text (block comments + line comments) from a chunk of script source. §0.3 only
   * concerns comments, not the code itself (the code's own color governance is handled by existing guards
   * like color-guard.test.ts). */
  function extractScriptComments(code: string): string {
    const blockComments = code.match(/\/\*[\s\S]*?\*\//g) || []
    const lineComments = code.match(/\/\/.*$/gm) || []
    return [...blockComments, ...lineComments].join('\n')
  }

  const kbDir2 = resolve(__dirname, '../knowledge')

  it.each(KNOWLEDGE_VUE_FILES)('%s — zero hex / rgb() / hsl() color literals in <script> block comments', (rel) => {
    const src: string = readFileSync(resolve(kbDir2, rel), 'utf8')
    const comments = extractScriptBlocks(src).map(extractScriptComments).join('\n')
    expect(comments, `${rel}: found a bare hex color literal in a <script> block comment`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(comments, `${rel}: found an rgb()/hsl() color literal in a <script> block comment`).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })

  // See the "Fix round 1" section of the task report for the RED + reverse probes (① injecting a color
  // literal into a <script> comment of a file on the list must fail; ② a normal declaration comment that only
  // cites file:line + an Appendix B line number, with no color value, must not fail). Probe injection/restore
  // went through cp + byte-for-byte md5 comparison; git checkout was forbidden.
})

// The same scan expanded to `src/ai/components/**` (an earlier pass's output, the Agent
// section's cards/sidebar/settings subcomponents). The existing ③' only covers `src/ai/knowledge/**`; that
// directory's template `style=`/`:style=` is a blind spot. The file list similarly does a set-equality anti-drift check.
const COMPONENTS_VUE_FILES = [
  'blocks/ActionsRow.vue',
  'blocks/BlockRenderer.vue',
  'blocks/ConfirmCard.vue',
  'blocks/ContextUsageBar.vue',
  'blocks/FileListCard.vue',
  'blocks/ImageGridCard.vue',
  'blocks/MarkdownBlock.vue',
  'blocks/MaxTurnsCard.vue',
  'blocks/McpCallCard.vue',
  'blocks/McpElicitFormCard.vue',
  'blocks/McpElicitUrlCard.vue',
  'blocks/McpInstallCard.vue',
  'blocks/McpPermissionCard.vue',
  'blocks/McpWarningCard.vue',
  'blocks/PermissionRequestCard.vue',
  'blocks/PhotoGridCard.vue',
  'blocks/ProcessStrip.vue',
  'blocks/ProgressCard.vue',
  'blocks/SearchFileDrawer.vue',
  'blocks/SearchFullResults.vue',
  'blocks/SearchImageLightbox.vue',
  'blocks/SearchResultsCard.vue',
  'blocks/SemanticSearchCard.vue',
  'blocks/StorageCard.vue',
  'blocks/TerminalCard.vue',
  'blocks/ThinkingBlock.vue',
  'blocks/ToolCard.vue',
  'blocks/VideoCard.vue',
  'icons/AgentIcon.vue',
  'blocks/JudgeStatusCard.vue',
  'settings/mcp/McpServerDetail.vue',
  'settings/mcp/McpServerGroup.vue',
  'settings/mcp/McpServerModal.vue',
  'settings/SectionPlaceholder.vue',
  // settings parity 2026-08-24 — background-model picker (registered per this
  // guard's anti-drift rule).
  'settings/sections/BackgroundTasksSection.vue',
  'settings/sections/BlacklistSection.vue',
  'settings/sections/ChannelsSection.vue',
  'settings/sections/ExecutionSection.vue',
  'settings/sections/LarkSection.vue',
  'settings/sections/McpApprovalsSection.vue',
  'settings/sections/McpSection.vue',
  'settings/sections/McpTokensSection.vue',
  'settings/sections/McpToolList.vue',
  'settings/sections/ToolboxSection.vue',
  'settings/sections/MemorySection.vue',
  'settings/sections/ModelsSection.vue',
  'settings/sections/ObservabilitySection.vue',
  'settings/sections/PermissionsSection.vue',
  'settings/sections/PrivacySection.vue',
  'settings/sections/ProvidersSection.vue',
  'settings/sections/SearchSection.vue',
  'settings/sections/SkillsSection.vue',
  'settings/sections/ThinkingDefaultsSection.vue',
  'settings/sections/WebSection.vue',
  'settings/SetSwitch.vue',
  'settings/SettingsRail.vue',
  'settings/skills/AddSkillModal.vue',
  'settings/skills/SkillDetail.vue',
  'settings/skills/SkillGroup.vue',
  'settings/skills/SkillTile.vue',
  'settings/skills/TestPanel.vue',
  'settings/SkModal.vue',
  'shell/AgentComposer.vue',
  'shell/AgentRightPanel.vue',
  'shell/AgentSidebar.vue',
  'shell/AgentTopbar.vue',
  'shell/KindIcon.vue',
  'shell/MentionPopover.vue',
  'shell/ModelPicker.vue',
  'shell/SlashPopover.vue',
  'shell/ThinkingBar.vue',
  'stream/AssistantMessage.vue',
  'stream/EmptyState.vue',
  'stream/MessageList.vue',
  'stream/TimelineMinimap.vue',
  'stream/UserMessage.vue',
  'tabs/ActivityTab.vue',
  'tabs/ContextTab.vue',
  'tabs/ResourcesTab.vue',
  'tabs/SystemTab.vue',
]

describe('guard gap ③′ extended (ticket 3b) — same bare-color template scan for src/ai/components/**', () => {
  const compDir = resolve(__dirname, '../components')

  it('file list is set-equal (anti-drift: newly added components must be explicitly added to the list, otherwise this test fails)', () => {
    expect(listVueFiles(compDir)).toEqual([...COMPONENTS_VUE_FILES].sort())
  })

  it.each(COMPONENTS_VUE_FILES)('%s — greedy extraction succeeds + coverage self-check (the slice extends all the way to the template last line)', (rel) => {
    const src: string = readFileSync(resolve(compDir, rel), 'utf8')
    const { tmpl, byLine, tail } = extractTemplate(src)
    expect(tmpl, `${rel}: the root <template> block was not extracted (missing a column-0 <template>/</template>?)`).not.toBe('')
    expect(tail, `${rel}: could not find the template's tail signature string`).not.toBe('')
    expect(
      tmpl.endsWith(tail),
      `${rel}: the extracted template slice does not extend to the last line (tail signature string:\n${tail}\n) — it was truncated early`,
    ).toBe(true)
    expect(tmpl, `${rel}: the string extraction and the line-by-line derivation disagree — the extraction boundary is wrong`).toBe(byLine)
  })

  it.each(COMPONENTS_VUE_FILES)('%s — zero hex / rgb / hsl literals inside the template (after stripping var()/color-mix())', (rel) => {
    const src: string = readFileSync(resolve(compDir, rel), 'utf8')
    const { tmpl } = extractTemplate(src)
    const scrubbed = stripColorCalls(tmpl)
    expect(scrubbed, `${rel}: the template has a bare hex color`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed, `${rel}: the template has an rgb()/hsl() function color`).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })

  it.each(COMPONENTS_VUE_FILES)('%s — zero named colors at attribute-value position (color/background/border/box-shadow/fill/stroke) inside the template', (rel) => {
    const src: string = readFileSync(resolve(compDir, rel), 'utf8')
    const { tmpl } = extractTemplate(src)
    const scrubbed = stripColorCalls(tmpl)
    const offenders = namedColorOffensesInValues(scrubbed)
    expect(offenders, `${rel}: found named colors at attribute-value position inside the template:\n${offenders.join('\n')}`).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【Ruling R23】Fixes the gap from T4's review Important-1, "the ancestor-chain
// conclusion has zero automated guarding".
//
// Fact (proven by a probe added during review; see ruling R23): add one line,
// `transform: translateZ(0)`, to `.knowledge-app` → the whole suite still comes back 4134/4134 green. K46's
// entire argument (that `.k-fileviewer-host`'s `position: fixed; inset: 0` can fill the viewport, on the
// premise that `.knowledge-app` and the whole real DOM ancestor chain above it up to <html> never establish a
// new containing block — see `src/files/viewers/ViewerShell.vue:24`'s `position: absolute; inset: 0;
// z-index: 200`, which needs a viewport-filling positioned ancestor) currently rests only on T4's one-off
// manual test report, with no automated regression backstop. Any future addition of a transform/filter/
// will-change etc. to `.knowledge-app`/`.k-main`/`body`/`html` for a transition animation/perf optimization
// (even a legitimate one) would quietly collapse the in-app previewer on a real device (positioned relative to
// that ancestor instead of filling the viewport) — and the previewer does not error, it just mispositions/
// fails to fill the viewport, something none of the unit tests, the sass gate, or color-guard can catch.
//
// The real, controllable ancestor chain in this repo (measured section by section in T4's report §4; this
// test is pinned to it) =
// router-view → .k-main → .knowledge-app → the KnowledgeLayout root (this component has zero <style> blocks,
// it only imports knowledge.scss on the JS side inside <script setup>) → App.vue (zero <style> blocks) → #app
// (no style rule anywhere in the repo targets this selector) → body → html. Only two points on this chain
// actually have a CSS declaration landing on them: knowledge.scss's own declarations for `.knowledge-app`/
// `.k-main`, and theme.css's own declarations for `body`/`html`.
//
// 🔴 Pseudo-elements must be excluded: `body::before` (theme.css:335) / `body::after` (theme.css:352) each
// declare transform/filter, and that is legitimate and harmless — a pseudo-element is a generated-content
// child, a sibling of `#app` rather than an ancestor of it (T4's review independently established this CSS-spec
// reasoning: a containing-block downgrade only applies to the box the property itself is applied to;
// `body::before`/`::after`'s transform/filter only affects their own boxes, and does not turn `body` itself
// into a new containing block). The regex below, used to capture `body`/`html` rules, requires the selector to
// be immediately followed by `{` (`body::before {` has `::before` in between, so it is not captured by this
// rule), so it naturally only captures rules on the body/html elements themselves, without accidentally
// catching pseudo-elements.
describe('ancestor-chain guard (R23) — .knowledge-app / .k-main / body / html declare zero transform/filter/will-change/contain/perspective of their own', () => {
  // Only matches a genuine declaration where "the property name is immediately followed by a colon", not the
  // same word appearing as some other property's value (e.g. in `transition: transform 0.45s var(--ease);`,
  // `transform` is transition's value, not a transform declaration — it isn't immediately followed by a colon,
  // so it isn't matched); the negative lookbehind `(?<![\w-])` also excludes hyphenated compound property
  // names like `backdrop-filter:` (it doesn't raise the same containing-block concern as transform, and isn't
  // on the forbidden list).
  const FORBIDDEN = /(?<![\w-])(transform|filter|will-change|contain|perspective)\s*:/

  // Strip out every deeper level of nested selector block inside a given nested rule block, keeping only that
  // selector's own top-level declarations. knowledge.scss is written in SCSS nesting style, so
  // `.knowledge-app { … a large nested section … }` nests almost every rule inside it (nestedBlockBody pulls
  // out this entire section, including descendant selectors' own transform/filter such as `.chev`/
  // `.k2-layer:hover` — those only affect their own boxes and are not `.knowledge-app`'s own ancestor-chain
  // concern, and must be stripped out first so only "what this selector itself wrote" remains). Strips
  // `{[^{}]*}` layer by layer (innermost first, then the next layer out, …) until no more nested blocks can be stripped.
  function ownDeclarations(nestedText: string): string {
    const first = nestedText.indexOf('{')
    const last = nestedText.lastIndexOf('}')
    let inner = nestedText.slice(first + 1, last)
    let prev: string
    do {
      prev = inner
      inner = inner.replace(/\{[^{}]*\}/g, '')
    } while (inner !== prev)
    return inner
  }

  // Criterion (ruling R23 ②): add one line, `transform: translateZ(0);`, to `.knowledge-app` → this test must
  // fail. The task report pastes both the before (green) / after (red) outputs, confirmed with a cp copy plus
  // byte-for-byte md5sum restore; the probe change itself never went into git (only left a trace in the report).
  it('.knowledge-app declares zero transform/filter/will-change/contain/perspective of its own (criterion: adding transform: translateZ(0) must fail)', () => {
    const own = ownDeclarations(nestedBlockBody(cssKeepLines, DARK_TOKEN_SELECTOR))
    const hit = own.match(new RegExp(FORBIDDEN, 'g'))
    expect(hit, `.knowledge-app itself has a forbidden property: ${JSON.stringify(hit)}`).toBeNull()
  })

  it('.k-main declares zero transform/filter/will-change/contain/perspective of its own', () => {
    const own = ownDeclarations(nestedBlockBody(cssKeepLines, '.k-main {'))
    const hit = own.match(new RegExp(FORBIDDEN, 'g'))
    expect(hit, `.k-main itself has a forbidden property: ${JSON.stringify(hit)}`).toBeNull()
  })

  // theme.css's own declarations for body/html — excluding the body::before / body::after pseudo-elements
  // (see the header comment: generated-content children, not ancestors of #app).
  it('theme.css declares zero transform/filter/will-change/contain/perspective of its own for body/html (excluding the body::before/::after pseudo-elements)', () => {
    const themeRaw = read('../../styles/theme.css')
    const themeCss = stripComments(themeRaw)
    // The selector immediately followed by `{` (excludes pseudo-elements like `body::before {`/
    // `body::after {`, whose `{` has `::before`/`::after` in between and is not captured by this rule); the
    // negative lookbehind excludes cases preceded by a letter/dot/hash/hyphen (avoids mismatching the same
    // substring inside a compound class name or id).
    const RULE = /(?<![\w.#-])(html|body)\s*\{([^{}]*)\}/g
    const blocks: string[] = []
    let m: RegExpExecArray | null
    while ((m = RULE.exec(themeCss))) blocks.push(m[2])
    expect(blocks.length, 'not a single body/html rule block was scanned in theme.css — did the selector style change?').toBeGreaterThan(0)
    for (const decl of blocks) {
      const hit = decl.match(new RegExp(FORBIDDEN, 'g'))
      expect(hit, `theme.css's body/html rule has a forbidden property: ${JSON.stringify(hit)}\nblock content:\n${decl}`).toBeNull()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【New guard】This pass ports in four sections (blueprint :985-1141 / :1342-1396 /
// :2453-2561 + K60's :1500-1503) and K53's 9 `kr-*`. The assertions below cover this pass's four **new**
// categories of risk:
//   ① the section-boundary trap (porting a whole section can drag in a duplicate definition of an
//      already-ported class — neither the whitelist assertion nor the dead-class assertion can catch it);
//   ② K60 (ruling R2)'s @media override genuinely exists;
//   ③ K53's "auto-armed" conditional assertion + the `kr-` prefix being unique across the whole repo
//      (a criterion for "dropping scoped is harmless");
//   ④ K54's two fallback sites are genuinely swapped for pure tokens, and K55's three new tokens have not had
//      their values recomputed in either variant.
// 🔴 This pass only **adds** assertions, it never modifies any existing one (§9.10).
// ═══════════════════════════════════════════════════════════════════════════

describe('knowledge.scss — section-boundary trap: already-ported classes must not be redefined (ruling R4 / errata E-69)', () => {
  // 🔴 Why this test must exist: Allowlist section A's correct boundary is blueprint `:985-1141`, but the
  // governance doc's original text says `:985-1160`. Porting the whole section up to `:1160` would drag in a
  // second copy of `:1142`'s `.k-set-card` and `:1159`'s `.k-set-row` (**already ported previously**). **A
  // duplicate definition is not caught by the whitelist assertion** (the class name is already on the
  // whitelist), nor by the 24-dead-class assertion (they are not dead classes) — only this kind of "exactly N
  // occurrences" count assertion responds. Same technique as this file's own K10 guarding `.k-confirm-*` to
  // exactly 1 occurrence.
  // Likewise, the modal section's boundary is `:1396`, not `:1400`: `:1398` onward is `.k-confirm-body`
  // (already ported previously), which is already guarded by the existing K10 assertion, so it is not repeated
  // here.
  it.each([
    ['k-set-card', 1],
    ['k-set-row', 1],
  ])('%s has exactly %i rule in this file (>1 = section A was ported as a whole block up to :1160, dragging in the copy already ported)', (cls, n) => {
    const hits = css.match(new RegExp(`\\.${cls}(?![\\w-])`, 'g')) || []
    expect(hits.length, `${cls} appears ${hits.length} times (should be ${n})`).toBe(n)
  })

  // Reverse coverage self-check: this pass genuinely ported the section in — otherwise the "exactly 1
  // occurrence" test above would also pass green in the case where "the whole section was never ported at
  // all" (zero discriminating power). `.k-section-body` and `.k-priority-hint` are section A's first and last rules.
  it('coverage self-check — section A first and last rules (.k-section-body / .k-priority-hint) are genuinely present in this file', () => {
    expect(css, 'section A first rule .k-section-body was not ported in').toMatch(/\.k-section-body(?![\w-])/)
    expect(css, 'section A last rule .k-priority-hint was not ported in').toMatch(/\.k-priority-hint(?![\w-])/)
  })
})

describe('knowledge.scss — K60 (ruling R2): .k-frow narrow-screen @media override', () => {
  // 🔴 Fact: P5b judged blueprint `:1500-1503` a dead rule; the original criterion was **conditional**
  // ("no element in either template uses class=\"k-frow\""). `AllowlistView` now uses exactly
  // `class="k-frow"` ⇒ the premise expired, ruling R2 approved porting it in, registered as deviation K60.
  // Consequence of not porting it: under a narrow screen (≤860px), the whitelist page's folder-rules table
  // column widths would not match Vue2 — **none of unit tests/the sass gate/color-guard can catch this**, only
  // this test can.
  // Criterion: delete the `.k-frow { … }` inside this @media block → this test must fail.
  it('the existing @media (max-width: 860px) block contains the .k-frow narrow-screen column-width override (deleting it must fail)', () => {
    // Use brace pairing to slice out that @media block, and assert only within it (not a bare whole-file
    // count — the file also has `.k-frow`'s **base-class** rule elsewhere, and a bare count cannot tell the two apart).
    const body = nestedBlockBody(cssKeepLines, '@media (max-width: 860px) {')
    expect(body.length, 'the @media (max-width: 860px) block was not captured — zero discriminating power').toBeGreaterThan(100)
    expect(body, 'could not find the .k-frow override inside the @media block (did K60 not land?)').toMatch(/\.k-frow \{/)
    expect(body, 'K60 grid-template-columns was changed (verbatim from blueprint :1501)').toContain(
      'grid-template-columns: 80px 1fr 70px 28px;',
    )
    expect(body, 'K60 font-size was changed (verbatim from blueprint :1502)').toContain('font-size: 12px;')
  })

  // 🔴 The landing criterion for R2-①: only that one rule was ported, and .k-quick-grid / .k-status-strip from
  // the same section were **not dragged in along with it** (both are still not on the whitelist, and
  // .k-quick-grid is also one of the 24 dead classes).
  it('R2-① — .k-status-strip was not dragged in along with it (.k-quick-grid is separately pinned by the 24-dead-class assertion)', () => {
    expect(new RegExp('\\.k-status-strip(?![\\w-])').test(css), '.k-status-strip was dragged in along with it').toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【Ruling **C-1 of R19 / R20**】K44's predicate for "every .vue in the knowledge
// section has zero `<style>` blocks, without exception" is hardened from a **bare substring** into
// **comments stripped first, then anchored at start-of-line**, and expanded from "pinned to just the one file
// RootsView.vue" into a parameterized assertion over all of `src/ai/knowledge/**` (armed once, so T5/T6/T7
// don't each have to add their own bookkeeping).
//
// 🔴 **Why the form had to change** (a fact from ruling R19's own text, not speculation): T2 used
// `src.includes('<style')` to judge "does the file have a style block", and it hits **10** of the 16 `.vue`
// files under `src/ai/knowledge/**` in this repo — while all 16 of these files have a `</style>` count of
// **zero**, and all 10 hits are **literal text inside comments** such as "zero `<style>` blocks" / "blueprint
// `<style scoped>`".
// The consequence has already been proven by review: build a `RootsView.vue` that follows the same directory's
// established comment style — genuinely zero style blocks, with a comment saying "zero `<style>` blocks" — and
// the old predicate **falsely fails**, reporting "a <style> block is present" ⇒ T5 would go looking for
// something that does not exist at all, and the most likely response would be to **loosen this guard**
// (exactly what §9.10 is most trying to prevent).
//
// 🔴 **Hardening self-proof (programmatic, not a self-declaration)**: on the same 16 files, "the bare
// substring hits 10 / comments-stripped-plus-start-of-line-anchored hits 0"; across the whole repo's 185
// `.vue` files, "bare substring 136 / comments-stripped-plus-anchored 115 / `</style>` 115" — the new
// predicate agrees with the independent "`</style>`" criterion **file for file**, while the old predicate has
// 21 extra false positives. These two sets of numbers are permanently pinned down by the "hardening
// self-proof" and "anti-vacuous-pass ②" tests below (R21: two independent criteria).
//
// 🔴 Stripping comments **and** anchoring at start-of-line are **both required, neither is optional**:
// anchoring alone cannot block a `<style scoped>` reference sitting alone on its own line inside a block
// comment; stripping comments alone cannot block an inline reference from being matched by the substring check.
function stripVueComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments (`<!-- … -->`, conventional in SFC templates/file headers)
    .replace(/\/\*[\s\S]*?\*\//g, '') // JS/CSS block comments
    .replace(/^[ \t]*\/\/.*$/gm, '') // whole-line JS line comments (the same established criterion as this file's own stripComments)
}

// The existence criterion for a genuine `<style>` block. Two independent criteria, **OR**'d together (more
// sensitive = hardened): ① the opening tag alone at start-of-line, `^\s*<style[\s>]`; ② the closing tag alone
// at start-of-line, `^\s*</style>`.
// 🔴 **The bare substring `includes('<style')` is forbidden** (ruling R19).
function hasStyleBlock(src: string): boolean {
  const stripped = stripVueComments(src)
  return /^[ \t]*<style[\s>]/m.test(stripped) || /^[ \t]*<\/style>\s*$/m.test(stripped)
}

function collectVueFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) collectVueFiles(full, out)
    else if (entry.endsWith('.vue')) out.push(full)
  }
  return out
}

describe('K44 (ruling R19/R20 C-1) — every .vue under src/ai/knowledge/** has zero <style> blocks', () => {
  const KNOWLEDGE_DIR = resolve(__dirname, '../knowledge')
  const SRC_DIR = resolve(__dirname, '..', '..')
  const knowledgeVues: string[] = collectVueFiles(KNOWLEDGE_DIR).sort()
  const relKnowledge = (p: string) => p.slice(KNOWLEDGE_DIR.length + 1)

  // 🔴 Anti-vacuous-pass ① (§9.14-4 / §9.19): the path base must be genuine — without this, a wrong/renamed
  // directory would let the it.each below degenerate into **zero test cases, silently all green**, and vitest
  // reports no error at all for an empty it.each.
  it('anti-vacuous-pass ① — .vue files scanned under the knowledge directory > 0, and the views subdirectory is within the scan scope', () => {
    expect(knowledgeVues.length, 'not a single .vue was scanned under src/ai/knowledge — was the path base written wrong?').toBeGreaterThan(0)
    expect(
      knowledgeVues.some((p: string) => p.includes('/knowledge/views/')),
      'the views subdirectory was not recursively scanned — the parameterized assertion would miss views newly created by T5/T6/T7',
    ).toBe(true)
  })

  // 🔴 Anti-vacuous-pass ② (ruling R20 C-1's explicit order): **the positive example must come from a .vue
  // file with a genuine style block somewhere in the whole repo**, not from the knowledge section's 4 lines
  // of comment. Of the whole repo's 185 `.vue` files, 115 genuinely have a style block (independent criterion:
  // `grep -rl '</style>' src --include=*.vue | wc -l` = 115, the two criteria agree).
  it('anti-vacuous-pass ② — hasStyleBlock is always true on a .vue file with a genuine style block anywhere in the repo (the positive example comes from src/**, not a knowledge-section comment)', () => {
    const allVues = collectVueFiles(SRC_DIR)
    expect(allVues.length, 'not a single .vue was scanned in the whole repo — zero discriminating power').toBeGreaterThan(100)
    // Independent criterion: the set of files containing the closing tag (a different implementation path from the predicate, R21's "second criterion")
    const byClosingTag = allVues.filter((p: string) => readFileSync(p, 'utf8').includes('</style>'))
    expect(byClosingTag.length, 'not a single .vue in the whole repo genuinely has a style block — the predicate might be always false (an empty shell)').toBeGreaterThan(100)
    const missed = byClosingTag.filter((p: string) => !hasStyleBlock(readFileSync(p, 'utf8')))
    expect(missed, `these files genuinely have </style> but the predicate judges them as "no style block" (the predicate misses them):\n${missed.join('\n')}`).toEqual([])
    // Reverse: whatever the predicate judges true must genuinely have a closing tag (guards against the predicate being always true)
    const byPredicate = allVues.filter((p: string) => hasStyleBlock(readFileSync(p, 'utf8')))
    expect(byPredicate.length, 'the predicate judged nothing true — zero discriminating power').toBeGreaterThan(100)
    expect(
      byPredicate.filter((p: string) => !byClosingTag.includes(p)),
      'the predicate judged true but there is no </style> — the predicate may have been matched by a comment (a bare-substring recurrence)',
    ).toEqual([])
  })

  // 🔴 Hardening self-proof (§9.10: "before hardening X hits N / after hardening 1" must be programmatic, a
  // self-declaration does not count as proof). On the same batch of knowledge-section `.vue` files: the old
  // bare-substring predicate hits ≥ 4 (measured 10), the new predicate hits 0.
  it('hardening self-proof — on the same batch of knowledge-section .vue files, the old bare-substring predicate hits > 0 while the new predicate hits 0 (proves this change is a hardening, not a loosening)', () => {
    const naiveHits = knowledgeVues.filter((p: string) => readFileSync(p, 'utf8').includes('<style'))
    const hardenedHits = knowledgeVues.filter((p: string) => hasStyleBlock(readFileSync(p, 'utf8')))
    expect(naiveHits.length, 'the old bare-substring predicate hits nothing at all — the hardening self-proof loses its control group').toBeGreaterThan(0)
    expect(
      hardenedHits.map(relKnowledge),
      'a genuine <style> block appears in the knowledge section (K44 is broken) — or the new predicate was also matched by a comment',
    ).toEqual([])
    expect(naiveHits.length, 'the hit count did not strictly decrease after hardening — this change is unobservable').toBeGreaterThan(hardenedHits.length)
  })

  // 🔴 Parameterized (ruling R20 C-1: "expand to all of src/ai/knowledge/**, armed once, no per-pass bookkeeping").
  // The list is read from disk **at test-run time** ⇒ the moment T5 creates `RootsView.vue`, T6 creates
  // `WikiView.vue`, or T7 creates `AllowlistView.vue`, this test automatically gains one more test case, with
  // nobody needing to touch this file.
  // §9.19's cross-pass-conflict argument: K44 is a whole-cycle discipline, and T5/T6/T7 were never allowed to
  // write a `<style>` block in the first place ⇒ no conflict.
  // ⚠️ **Deliberately not** doing a set-equality check here (that would turn into "per-pass bookkeeping",
  // exactly what R20 is meant to eliminate).
  it.each(knowledgeVues.map((p: string) => [relKnowledge(p), p] as [string, string]))(
    'K44 — %s has zero <style> blocks (comments stripped + start-of-line anchored; a comment saying "zero <style> blocks" must still pass)',
    (_rel: string, full: string) => {
      const src: string = readFileSync(full, 'utf8')
      expect(src.length, `${_rel} read out empty — the node:fs read failed`).toBeGreaterThan(0)
      expect(
        hasStyleBlock(src),
        `${_rel} has a genuine <style> block — K44 requires the whole block to be ported into src/ai/styles/knowledge.scss, with zero <style> on the .vue side`,
      ).toBe(false)
    },
  )
})

describe('knowledge.scss — K53: RootsView kr-* has been ported in as a whole block + zero <style> on the .vue side', () => {
  const VIEWS_DIR = resolve(__dirname, '../knowledge/views')
  const ROOTS_VUE = resolve(VIEWS_DIR, 'RootsView.vue')

  function exists(p: string): boolean {
    try {
      statSync(p)
      return true
    } catch {
      return false
    }
  }

  // 🔴 Anti-vacuous-pass ① (governance §9.14-4 / §9.19): the path base must be genuine. Without this, the
  // "RootsView.vue does not exist yet" branch would degenerate into "testing nothing at all", and a wrong path
  // (a missing `..` level, a renamed directory) would never be discovered — that is the classic shape of "the
  // guard is an empty shell".
  it('anti-vacuous-pass — the views directory exists and already has .vue files (otherwise the "file does not exist" branch is meaningless)', () => {
    const vues = readdirSync(VIEWS_DIR).filter((f: string) => f.endsWith('.vue'))
    expect(vues.length, 'the views directory has no .vue at all — was the path base written wrong?').toBeGreaterThan(0)
  })

  // 🔴 Anti-vacuous-pass ②: the same "node:fs read the file → judge whether it has a style block" predicate
  // must **genuinely have discriminating power**.
  //   (a) every existing view can be read with **non-empty** content — this directly blocks the empty-shell
  //       path of "reads an empty string ⇒ always judged false ⇒ always green" (exactly what the ironclad
  //       rule "Vite `?raw` is always empty under vitest" is guarding against);
  //   (b) the predicate must judge true on a **file that genuinely has a style block** — the positive example
  //       is in the "anti-vacuous-pass ②" test in the new describe above (taken from the whole repo's 115
  //       `.vue` files that genuinely have a style block).
  //
  // 🔴🔴 **Correction (ruling R19, per "reverse, don't delete")**: this test's original text said
  // "at least one existing view **contains** `<style`, at least one does not", with the predicate being the
  // bare substring `src.includes('<style')`. **That "positive example" was entirely propped up by 4 lines of
  // comment text** — `KnowledgeDeferred` / `KnowledgeLayout` / `SearchView` / `SettingsView` all have a
  // `</style>` count of **zero**, and the hit is the phrase "zero `<style>` blocks" inside a comment, nothing
  // more. ⇒ what it proves is not that the predicate has discriminating power, but that the comment happens to
  // contain that word; and if anyone rewords those 4 comment lines, this test would **fail for no reason**.
  // Now: the predicate is swapped for `hasStyleBlock()` (comments stripped first, then start-of-line
  // anchored), the positive example is moved to the describe above using genuine whole-repo samples; this
  // test only keeps the "can read non-empty content" half plus "judged false throughout this section".
  it('anti-vacuous-pass — existing views in the same directory read as non-empty content, and the new predicate consistently judges "no style block" throughout this directory', () => {
    const vues = readdirSync(VIEWS_DIR).filter((f: string) => f.endsWith('.vue'))
    expect(vues.length, 'the views directory has no .vue at all — zero discriminating power').toBeGreaterThan(0)
    const withStyle: string[] = []
    for (const f of vues) {
      const src: string = readFileSync(resolve(VIEWS_DIR, f), 'utf8')
      expect(src.length, `${f} read out empty — the node:fs read failed`).toBeGreaterThan(0)
      if (hasStyleBlock(src)) withStyle.push(f)
    }
    expect(withStyle, `files in the views directory with a genuine <style> block (K44 is broken): ${withStyle.join(', ')}`).toEqual([])
  })

  // 🔴 "Auto-armed" conditional assertion (governance §9.19). At the time T2 landed, `RootsView.vue` did not
  // exist yet (it is T5's job), so this test takes the "does not exist yet" branch; **the moment T5 creates
  // the file, it auto-arms**.
  // §9.19 requires arguing this does not conflict with a later pass's scope: **it does not conflict** — K44 is
  // a whole-cycle discipline, and T5 was never allowed to write a `<style>` block inside a `.vue` in the first
  // place, so this test never asks T5 for anything it has no right to write (contrast with P5e's T5↔T6
  // conflict: that time the guard asked T6 for markup it had no right to write).
  // 🔴 The predicate is swapped from a bare substring to `hasStyleBlock()` (comments stripped +
  // start-of-line anchored), ruling R19. The parameterized assertion in the new describe above will
  // automatically cover the same thing once `RootsView.vue` is built; this test is kept because it carries a
  // K53-specific error message ("those 66 lines must be ported into knowledge.scss as a whole block"), and it
  // is an assertion T2 already passed review on — §9.10 only allows hardening, never deletion.
  it('K53 — if views/RootsView.vue exists, it must not contain <style> (auto-arms once T5 creates the file)', () => {
    if (!exists(ROOTS_VUE)) {
      expect(exists(ROOTS_VUE), 'RootsView.vue has not been created yet (T5 job) — this test is in "armed, awaiting fire" state').toBe(false)
      return
    }
    const src: string = readFileSync(ROOTS_VUE, 'utf8')
    expect(src.length, 'RootsView.vue read out empty').toBeGreaterThan(0)
    expect(
      hasStyleBlock(src),
      'RootsView.vue has a genuine <style> block — K53 requires those 66 lines to be ported into knowledge.scss as a whole block, with zero <style> on the .vue side',
    ).toBe(false)
  })

  // 🔴 K53 criterion ④: **class-by-class** proof that dropping `scoped` is harmless. Criterion = the `kr-`
  // prefix is unique across the whole repo. Scope is pinned to "everywhere a selector could plausibly appear"
  // = every .scss/.css (excluding this file) + the `<style>` block content of every .vue. **Templates and
  // tests are not scanned** (T5's template will write `class="kr-empty"`, and its test will write
  // `find('.kr-empty')` — neither of those is a selector definition; scanning them in would wrongly fail later
  // passes).
  // 🔴 Always use **exact whole-token matching** `(?![\w-])`, never `\b` (E-25: `\b` also holds before a `-`).
  const KR_CLASSES = [
    'kr-adv-row', 'kr-badge', 'kr-check', 'kr-empty', 'kr-error',
    'kr-hint', 'kr-input', 'kr-label', 'kr-path',
  ]

  function collectSelectorSources(dir: string, out: Array<[string, string]> = []): Array<[string, string]> {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      const full = resolve(dir, entry)
      if (statSync(full).isDirectory()) {
        collectSelectorSources(full, out)
      } else if (entry.endsWith('.scss') || entry.endsWith('.css')) {
        if (full.endsWith('/ai/styles/knowledge.scss')) continue
        out.push([full, readFileSync(full, 'utf8') as string])
      } else if (entry.endsWith('.vue')) {
        const src: string = readFileSync(full, 'utf8')
        const blocks = src.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []
        if (blocks.length) out.push([full, blocks.join('\n')])
      }
    }
    return out
  }

  it('K53 criterion ④ — the 9 kr-* classes appear zero times, class by class, in "every style source outside knowledge.scss" (dropping scoped is harmless)', () => {
    const sources = collectSelectorSources(resolve(__dirname, '../..'))
    // Coverage self-check: something was genuinely scanned (otherwise "zero hits" is an illusion — R13's "not seen ≠ does not exist")
    expect(sources.length, 'not a single style source was scanned — zero discriminating power').toBeGreaterThan(3)
    const collisions: string[] = []
    for (const cls of KR_CLASSES) {
      const re = new RegExp(`\\.${cls}(?![\\w-])`)
      for (const [file, text] of sources) if (re.test(text)) collisions.push(`${cls} @ ${file}`)
    }
    expect(collisions, `a kr-* prefix collision occurred (losing scoped semantics is no longer harmless):\n${collisions.join('\n')}`).toEqual([])
  })

  it('K53 — each of the 9 kr-* classes has exactly 1 base-class rule inside knowledge.scss (ported in as a whole block, no more and no less)', () => {
    for (const cls of KR_CLASSES) {
      const hits = css.match(new RegExp(`\\.${cls}(?![\\w-])`, 'g')) || []
      expect(hits.length, `${cls} appears ${hits.length} times in knowledge.scss (should be 1)`).toBe(1)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【Ruling **I-1 of R20**】The **second** occurrence of the same family of gap as
// P5e's ruling **R16**: this cycle maps 8 color literals onto tokens (2 sites in Appendix B §B.3-②③ + 6 sites
// in §B.4); the production code is correct site by site, but **no assertion pins down which selector consumes
// which token** ⇒ review confirmed it: **swap** the tokens allow/deny consume with each other, swap
// `--text-on-accent` for `--text-primary`, and run the whole suite — **4337 all green, zero red**.
//
// Real-world consequence: ① swapping allow/deny = the whitelist page shows "allow" in red and "deny" in green
// (a **semantic inversion**), and §9.17 ruled that both sections of `AllowlistView` are 🟢 **fully reachable**
// on this machine and are write-operation screens meant for real-device acceptance testing item by item;
// ② `--text-on-accent` being swapped out = the icon sitting on the brand gradient/accent solid background
// turns into a dark-toned foreground under the dark variant, **exactly the failure mode Appendix B §B.3.1
// devotes a whole section to warning about**.
//
// The technique reuses this file's own R16 section's `nestedBlockBody()` mold, nothing invented.
// 🔴 Criterion (ruling R20): ① swapping the tokens allow/deny consume → must fail;
//    ② swapping out `--text-on-accent` → must fail. Both output sections + the md5sum restore are in the T2b report.
describe('knowledge.scss — I-1 (ruling R20): token-consumption binding for the 8 color-mapping sites', () => {
  // Appendix B §B.4's 6 sites — 2 blocks × {allow, deny} × {background, color}.
  // 🔴 Pins down "selector → property → token" site by site; swapping any pair fails and names it precisely.
  const B4_BINDINGS: Array<[string, string, string, string]> = [
    // [block selector line, variant selector, property, token]
    ['.k-frow-action {', '&[data-act="allow"]', 'background', '--success-soft'],
    ['.k-frow-action {', '&[data-act="allow"]', 'color', '--success'],
    ['.k-frow-action {', '&[data-act="deny"]', 'background', '--danger-soft'],
    ['.k-frow-action {', '&[data-act="deny"]', 'color', '--danger'],
    ['.k-radio-card-icon {', '&[data-tone="allow"]', 'background', '--success-soft'],
    ['.k-radio-card-icon {', '&[data-tone="allow"]', 'color', '--success'],
    ['.k-radio-card-icon {', '&[data-tone="deny"]', 'background', '--danger-soft'],
    ['.k-radio-card-icon {', '&[data-tone="deny"]', 'color', '--danger'],
  ]

  // Slice out a given `&[…]` variant's line from a block body (in the blueprint's source order they are all
  // single-line `{ … }`). 🔴 Only counts if the whole line, trimmed, **starts with the variant selector** —
  // not a substring search (per this file's own five-time lesson of "substring matched against a comment";
  // comments in cssKeepLines have already been replaced by blankComments with an equal number of spaces, so
  // the content is not even there anymore).
  function variantLine(blockBody: string, variantSelector: string): string {
    const hits = blockBody
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.startsWith(variantSelector))
    expect(hits.length, `could not find a unique ${variantSelector} variant line inside the block (${hits.length} hits)`).toBe(1)
    return hits[0]
  }

  it.each(B4_BINDINGS)(
    'Appendix B §B.4 — %s consumes var(%s) inside %s of %s (criterion: swapping allow/deny must fail)',
    (block: string, variant: string, prop: string, token: string) => {
      const line = variantLine(nestedBlockBody(cssKeepLines, block), variant)
      expect(line, `inside ${block}'s ${variant}, ${prop} is not var(${token}): ${line}`).toContain(
        `${prop}: var(${token});`,
      )
    },
  )

  // Anti-vacuous-pass (§9.14-4): the parameterized list must genuinely have 8 entries, all distinct from each
  // other — otherwise `it.each([])` would silently pass with zero test cases, and duplicate entries would turn
  // "full coverage of all 8 sites" into an illusion.
  it('anti-vacuous-pass — the §B.4 binding list has exactly 8 entries and no duplicates (guards against an empty loop / a duplicate entry masquerading as coverage)', () => {
    expect(B4_BINDINGS).toHaveLength(8)
    expect(new Set(B4_BINDINGS.map((b) => b.join('|'))).size, 'the binding list has a duplicate entry').toBe(8)
  })

  // Appendix B §B.3-② — `.k-extgroup-icon`'s foreground sits on the `g.bg` brand gradient's solid background
  it('Appendix B §B.3-② — .k-extgroup-icon foreground consumes var(--text-on-accent) (criterion: swapping to --text-primary must fail)', () => {
    const body = nestedBlockBody(cssKeepLines, '.k-extgroup-icon {')
    expect(body, '.k-extgroup-icon color is not var(--text-on-accent) — see Appendix B §B.3.1').toContain(
      'color: var(--text-on-accent);',
    )
    // 🔴 Reverse: the block must not contain --on-accent / --text-primary, the two substitutes §B.3.1 explicitly excludes
    expect(/var\(--on-accent\)/.test(body), '.k-extgroup-icon uses --on-accent (dark-toned under the dark variant, fails on a solid background)').toBe(false)
  })

  // Appendix B §B.3-③ — `.k-ext-chip[data-on="true"] .k-ext-chip-mark` sits on the --accent solid background.
  // 🔴 `.k-ext-chip-mark {` appears **twice** in this file (a nested one + a top-level base class), so an exact
  //    whole-line match would match the first one ⇒ must **drill down layer by layer**:
  //    .k-ext-chip → &[data-on="true"] → .k-ext-chip-mark, anchoring directly is not allowed.
  it('Appendix B §B.3-③ — the foreground of .k-ext-chip-mark under .k-ext-chip[data-on="true"] consumes var(--text-on-accent)', () => {
    const chip = nestedBlockBody(cssKeepLines, '.k-ext-chip {')
    const on = nestedBlockBody(chip, '&[data-on="true"] {')
    const mark = nestedBlockBody(on, '.k-ext-chip-mark {')
    expect(mark, 'the foreground of .k-ext-chip-mark under [data-on="true"] is not var(--text-on-accent)').toContain(
      'color: var(--text-on-accent);',
    )
    // Coverage self-check: genuinely drilled down to that layer (the block body must also have the --accent background, otherwise the anchor landed on the wrong block)
    expect(mark, 'did not drill down to the .k-ext-chip-mark under the [data-on="true"] layer').toContain('background: var(--accent);')
  })

  // Coverage self-check: 8 sites + 2 sites = all 10 token reference points Appendix B lands inside
  // knowledge.scss. 🔴 "§B.4's 6 sites" in the scss is 4 lines × an average of 2 properties = 8
  // property-level landing points (Appendix B counts 6 by the literal count; the two `color: var(--danger)`
  // sites among them were already tokens in the blueprint, copied verbatim without change — pinning them down
  // too is a hardening).
  it('coverage self-check — all 4 variant lines are genuinely present in this file and each has exactly one (the anchor has not drifted onto another block)', () => {
    for (const [block, variant] of [
      ['.k-frow-action {', '&[data-act="allow"]'],
      ['.k-frow-action {', '&[data-act="deny"]'],
      ['.k-radio-card-icon {', '&[data-tone="allow"]'],
      ['.k-radio-card-icon {', '&[data-tone="deny"]'],
    ] as Array<[string, string]>) {
      expect(variantLine(nestedBlockBody(cssKeepLines, block), variant).length).toBeGreaterThan(10)
    }
  })
})

describe('knowledge.scss — K54: the two var() fallbacks of kr-* have been changed to pure tokens', () => {
  // 🔴 The blueprint's original text: `.kr-badge` is `var(--bg-tertiary, <a muted-neutral fallback>)`,
  // `.kr-input` is `var(--border, <a muted-neutral fallback>)`. Governance §6 forbids rgba() outright (not
  // even in comments) ⇒ the fallback literal cannot be copied verbatim. Appendix B §B.2.2 fixes the landed
  // value, leaving the implementer zero discretion. The whole-file color scan above can only catch "is there a
  // bare literal", **it cannot catch "swapped for a different token"** — these two tests pin the landing site
  // down verbatim (the same technique as the earlier batch of "token → consuming-selector binding" tests).
  //
  // 🔴🔴 Honest disclosure (errata E-73): `--bg-tertiary` has **zero declarations on both sides** — neither
  // the blueprint nor this repo ⇒ the fallback has always been in effect ⇒ `.kr-badge` being changed to
  // `--bg-chip` is a **visible change, not an equivalent substitution**. Only the `--border` site is where the
  // "the fallback was dead code all along" argument applies (this repo's theme.css does declare it).
  it('K54-① — .kr-badge background is var(--bg-chip) (Appendix B §B.2.2-①, criterion: swapping to a different token must fail)', () => {
    const body = nestedBlockBody(cssKeepLines, '.kr-badge {')
    expect(body, '.kr-badge background is not var(--bg-chip)').toContain('background: var(--bg-chip);')
  })

  it('K54-② — .kr-input border is var(--line) (Appendix B §B.2.2-②, criterion: swapping to a different token must fail)', () => {
    const body = nestedBlockBody(cssKeepLines, '.kr-input {')
    expect(body, '.kr-input border is not 1px solid var(--line)').toContain('border: 1px solid var(--line);')
  })

  it('K54 — both tokens have values in both variants (otherwise a real device would render guaranteed-invalid)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    for (const tok of ['--bg-chip:', '--line:']) {
      expect(darkBody, `dark variant missing ${tok}`).toContain(tok)
      expect(lightBody, `light variant missing ${tok}`).toContain(tok)
    }
  })

  // 🔴 Reverse: this file must not contain a var() reference to either name `--bg-tertiary` / `--border`
  // (copying it in verbatim = K54 did not land; and since they are zero-declared at this file's mapping
  // layer, a real device would lose the whole patch of color).
  it('K54 — this file has zero var(--bg-tertiary) / var(--border) references (copying the fallback verbatim must fail)', () => {
    expect(css, 'this file has var(--bg-tertiary)').not.toMatch(/var\(\s*--bg-tertiary/)
    expect(css, 'this file has var(--border[,)])').not.toMatch(/var\(\s*--border\s*[,)]/)
  })

  // 🔴 The regressable part of M-6's disclosure: `.kr-path` / `.kr-input`'s font stacks **copy the
  // blueprint's hardcoded values verbatim** (ruling §3 M-6; a font stack is not a color, it is outside this
  // repo's token constraints). This test pins down that it was not "helpfully unified" into
  // var(--font-mono) — that would be changing blueprint behavior plus an undisclosed deviation.
  it('M-6 — the font stacks of .kr-path / .kr-input copy the blueprint hardcoded values verbatim, and have not been helpfully unified into var(--font-mono)', () => {
    const STACK = 'font-family: ui-monospace, SFMono-Regular, Menlo, monospace;'
    for (const sel of ['.kr-path {', '.kr-input {']) {
      const body = nestedBlockBody(cssKeepLines, sel)
      expect(body, `${sel}'s font stack was changed (verbatim from blueprint RootsView.vue:235 / :259)`).toContain(STACK)
      expect(body, `${sel} was "helpfully unified" into var(--font-mono) — that would be changing blueprint behavior`).not.toContain('var(--font-mono)')
    }
  })
})

describe('knowledge.scss — K55: the three extension-group gradient tokens values in both variants', () => {
  // 🔴 The blueprint hardcodes these three gradients in `AllowlistView.vue`'s `GROUPS_TEMPLATE` constant,
  // rendered via `:style="{background: g.bg}"`; `color-guard` **does not scan `.ts`/`<script>` constants at
  // all** ⇒ not tokenizing this runs bare (ticket B, location ④; a mutation test confirmed "injecting a hex
  // literal into a comment stays all green"). This pass is responsible for the **declaration layer**; the
  // constant side only keeps a `var(--…)` reference + a targeted assertion, landed by T4.
  // Same value in both variants (a brand-identity gradient), but per the argument in the header comment's
  // "hidden pitfall" section, each variant must still write its own copy.
  it('the three --grad-ext-* tokens match verbatim in both variants (theme-invariant, Appendix B §B.6, recomputing forbidden)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, string> = {
      '--grad-ext-docs': '--grad-ext-docs: linear-gradient(135deg, #5AC8FA, #007AFF);',
      '--grad-ext-text': '--grad-ext-text: linear-gradient(135deg, #5DD68A, #2EB05B);',
      '--grad-ext-code': '--grad-ext-code: linear-gradient(135deg, #C18CFF, #AF52DE);',
    }
    for (const [tok, decl] of Object.entries(expected)) {
      expect(darkBody, `dark variant ${tok} missing declaration or value was changed`).toContain(decl)
      expect(lightBody, `light variant ${tok} missing declaration or value was changed (both variants having the same value doesn't excuse skipping one)`).toContain(decl)
    }
  })

  // 🔴 Why give it a separate new name instead of reusing one: --grad-ext-docs is **verbatim identical** to
  // the existing --grad-note-note / --grad-sandbox, but the rule K39/K40 established is "give it a separate
  // new name even with the same value" (different semantic owner). This test pins down that all three are
  // declared independently, and have not been "deduplicated" into referencing each other.
  it('same style as K39/K40 — the three --grad-ext-* tokens are each declared independently, and have not been "deduplicated" into something like var(--grad-note-note)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    for (const tok of ['--grad-ext-docs', '--grad-ext-text', '--grad-ext-code']) {
      const line = darkBody.split('\n').find((l: string) => l.trim().startsWith(`${tok}:`))
      expect(line, `could not find the declaration line for ${tok}`).toBeTruthy()
      expect(line!, `${tok} was written as a reference to a different token`).not.toContain('var(--grad-')
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 【Ruling **M-a of R20**】The three `--grad-ext-*` tokens currently have **zero
  // consumption binding**: the declaration layer has two assertions (matching verbatim in both variants +
  // not deduplicated into referencing each other), but **nothing guarantees they are genuinely consumed** —
  // the consumer, `GROUPS_TEMPLATE`, belongs to T4. The failure mode is **silent**: if T4 forgets to swap it,
  // or gets the mapping wrong (docs↔code cross-wired), the three tokens become dead declarations, with all
  // four gates staying green.
  //
  // Approach = an "auto-armed" conditional assertion (§9.19), the same mold as the K53 test:
  // **right now** (`views/AllowlistView.vue` does not exist) it passes via the lazy branch; **the moment T4
  // creates the file, it arms**.
  // 🔴 §9.19's cross-pass-conflict argument: the plan document's T4-2 already explicitly orders "change
  // `GROUPS_TEMPLATE`'s three `bg` fields to `var(--…)` (fixed by Appendix B)" ⇒ this test never asks T4 for
  // anything it has no right to write, **no conflict**.
  // 🔴 §9.19's other requirement: a new guard must carry its own **anti-vacuous-pass assertion** — see the
  // "predicate discriminating power" test below, which uses two synthetic samples to prove `groupBgErrors()`
  // already has teeth even while the file does not exist yet.
  // 🔴 Always read files with `node:fs` (ironclad rule: Vite's `?raw` is **always empty** under vitest).
  const GRAD_EXT_BINDINGS: Array<[string, string]> = [
    ['docs', '--grad-ext-docs'],
    ['text', '--grad-ext-text'],
    ['code', '--grad-ext-code'],
  ]

  // Pure function: given a chunk of `AllowlistView.vue` source, return the list of `bg`-binding errors for
  // the three groups (empty = all correct). 🔴 The locating technique is **format-agnostic**: the window from
  //    `id: 'docs'` up to the next `id:` or the end of the text — `var(--grad-ext-docs)` must appear inside
  //    that window, and the other two `--grad-ext-*` **must not** (this is exactly how a cross-wiring gets
  //    caught); the window's `bg` value must also have no color literal.
  function groupBgErrors(src: string): string[] {
    const errs: string[] = []
    const idRe = /\bid:\s*['"]([a-z]+)['"]/g
    const marks: Array<[string, number]> = []
    let m: RegExpExecArray | null
    while ((m = idRe.exec(src)) !== null) marks.push([m[1], m.index])
    for (const [gid, token] of GRAD_EXT_BINDINGS) {
      const i = marks.findIndex(([name]) => name === gid)
      if (i < 0) {
        errs.push(`could not find the id: '${gid}' group in GROUPS_TEMPLATE`)
        continue
      }
      const start = marks[i][1]
      const end = i + 1 < marks.length ? marks[i + 1][1] : src.length
      const win = src.slice(start, end)
      if (!win.includes(`var(${token})`)) errs.push(`group ${gid}: bg does not consume var(${token})`)
      for (const [, other] of GRAD_EXT_BINDINGS) {
        if (other !== token && win.includes(`var(${other})`)) {
          errs.push(`group ${gid}: window has var(${other}) mixed in — the three gradient tokens are cross-wired`)
        }
      }
      // 🔴 color-guard does not scan a `.vue`'s `<script>` constants ⇒ this is the only line of defense (ticket B, location ④)
      const bgLine = win.match(/\bbg:\s*[^,\n]*/)
      if (bgLine && /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|linear-gradient\(/.test(bgLine[0])) {
        errs.push(`group ${gid}: bg still has a color literal / inline gradient: ${bgLine[0].trim()}`)
      }
    }
    return errs
  }

  // 🔴 Anti-vacuous-pass (§9.19's explicit order, and the only way to prove this guard has teeth during its
  // "lazy pass" period): run the same predicate on two **synthetic samples** — the correct shape must give
  // zero errors, and each of three deviant shapes must be caught.
  it('anti-vacuous-pass — the groupBgErrors predicate has discriminating power on synthetic samples (proves it is not an empty shell even before the file exists)', () => {
    const good = `
      const GROUPS_TEMPLATE = [
        { id: 'docs', labelKey: 'Documents', icon: 'file', bg: 'var(--grad-ext-docs)' },
        { id: 'text', labelKey: 'Text', icon: 'edit', bg: 'var(--grad-ext-text)' },
        { id: 'code', labelKey: 'Code', icon: 'code', bg: 'var(--grad-ext-code)' },
      ]`
    expect(groupBgErrors(good), 'the correct shape was misjudged as having an error — the predicate is too strict and would false-fail on T4').toEqual([])
    // Deviant shape ①: docs / code cross-wired
    const swapped = good.replace('var(--grad-ext-docs)', 'var(--grad-ext-code)')
    expect(groupBgErrors(swapped).length, 'the cross-wiring was not caught — the predicate has zero discriminating power').toBeGreaterThan(0)
    // Deviant shape ②: one group never swapped its token, copying the blueprint's bare gradient verbatim
    const literal = good.replace("'var(--grad-ext-text)'", "'linear-gradient(135deg, #5DD68A, #2EB05B)'")
    expect(groupBgErrors(literal).length, 'the bare color literal was not caught — color-guard does not scan here, this test is the only line of defense').toBeGreaterThan(0)
    // Deviant shape ③: a whole group missing
    const missing = good.replace("{ id: 'code', labelKey: 'Code', icon: 'code', bg: 'var(--grad-ext-code)' },", '')
    expect(groupBgErrors(missing).length, 'the missing group was not caught').toBeGreaterThan(0)
  })

  it('M-a auto-arms — if views/AllowlistView.vue exists, each of GROUPS_TEMPLATE three bg fields consumes its matching --grad-ext-* (arms once T4 creates the file)', () => {
    const ALLOWLIST_VUE = resolve(__dirname, '../knowledge/views/AllowlistView.vue')
    let src: string | null = null
    try {
      src = readFileSync(ALLOWLIST_VUE, 'utf8') as string
    } catch {
      src = null
    }
    if (src === null) {
      // Lazy branch: the file is T4's job. 🔴 Path-base self-check — the views directory must genuinely
      // exist, otherwise "cannot read ⇒ passes lazily" would degenerate into an empty shell that "always
      // passes even with a wrong path".
      const vues = readdirSync(resolve(__dirname, '../knowledge/views')).filter((f: string) => f.endsWith('.vue'))
      expect(vues.length, 'the views directory has no .vue at all — was the path base written wrong?').toBeGreaterThan(0)
      expect(vues, 'AllowlistView.vue has not been created yet (T4 job) — this test is in "armed, awaiting fire" state').not.toContain(
        'AllowlistView.vue',
      )
      return
    }
    expect(src.length, 'AllowlistView.vue read out empty — the node:fs read failed').toBeGreaterThan(0)
    expect(src, 'could not find the GROUPS_TEMPLATE constant in AllowlistView.vue').toContain('GROUPS_TEMPLATE')
    const errs = groupBgErrors(src)
    expect(errs, `the consumption binding for the three --grad-ext-* tokens does not hold (Appendix B §B.6 / plan document T4-2):\n${errs.join('\n')}`).toEqual([])
  })
})

describe('knowledge.scss — hardening the var() fallback exemption', () => {
  // 【Why this was added】The existing test "--g is the only registered consumer inline-injection exception in
  // this file" only asserts that `css` contains a certain string, it **does not** programmatically prove
  // "only --g relies on this exemption". The Wiki section ported in by this pass introduces a second reference
  // with a fallback, `var(--tone, var(--text-quaternary))` (blueprint :2529) — but `--tone` is **genuinely
  // declared** in this file by four `.kw-change[data-type=…]` rules, and it **does not rely on** that
  // exemption. This test turns "who genuinely relies on the exemption" into a set-equality assertion: one
  // extra undeclared fallback token (= a reference genuinely sneaking through on the exemption) gets named
  // precisely. 🔴 Purely additive, not a single line of any existing assertion was changed (§9.10).
  const theme2 = read('../../styles/theme.css')
  function declaredTokens(text: string): Set<string> {
    return new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  }

  it('the only token relying on the "exempt if it has a fallback" rule is exactly --g (--tone is genuinely declared in this file, does not rely on the exemption)', () => {
    const declared = new Set([...declaredTokens(css), ...declaredTokens(theme2)])
    const withFallback = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)\s*,/g)].map((m) => m[1]))]
    // Coverage self-check: a reference with a fallback was genuinely captured (otherwise "exactly --g" would be a vacuously true empty set)
    expect(withFallback.length, 'not a single var() reference with a fallback was captured — zero discriminating power').toBeGreaterThanOrEqual(2)
    const relying = withFallback.filter((t) => !declared.has(t)).sort()
    expect(relying, `tokens genuinely relying on the fallback exemption (should only be --g): ${relying.join(', ')}`).toEqual(['--g'])
  })
})
