import { describe, it, expect } from 'vitest'
// SP8-P5a Task 4 —— 复刻 settingsStyles.test.ts(SP8-P2a Task 2)头注释里记录的三处环境坑,
// 逐字照抄同样的解法(不是重新踩坑,是同一份既有解法的复用):
// ① 本仓 package.json 是 "type": "module" → __dirname 在 ESM 下不可用,改用
//    import.meta.url + fileURLToPath 的等价写法。
// ② 本仓已装 @types/node(SP8-P6 合流自 master) —— node:fs / node:path / node:url 没有类型声明,
//    `pnpm exec vue-tsc --noEmit`(任务门三条命令之一)会报 TS2307,逐行 @ts-expect-error 抑制。
// ③ 不用 Vite 的 `?raw` 导入替代 node:fs —— vitest 自带 CSSEnablerPlugin 对 css/scss
//    一律整体替换成空串(不看查询串),?raw 导入会让断言对空字符串"假通过"。退回 node:fs。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

// 同 settingsStyles.test.ts 的既定手法:只剥「整行以 // 开头」的行注释(本档没有这种
// 注释,但保持与先例一致)+ 块注释,再做 toContain,防止断言被注释里提到的类名/字符串撞对
// (P2b 二次评审曾用 RED 探针实证过这类假通过)。
function stripComments(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

const rawSource = read('./knowledge.scss')
const css = stripComments(rawSource)

// 【P5e-T2 新增】同 stripComments,但把注释内容换成**等量空格**、保留换行 → 行号与源文件
// 逐行对齐。给「需要报真实行号 / 需要比较两段规则的相对行序」的断言用(stripComments 会
// 吃掉多行注释里的换行,用它算出来的行号比源文件小一截,报出去会把评审引到错误的行)。
// 手法逐字照 parserStyles.test.ts:43-48 的既定先例,不是新发明。
function blankComments(scss: string): string {
  return scss
    .replace(/\/\*[\s\S]*?\*\//g, (m: string) => m.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/.*$/gm, (_m: string, indent: string) => indent)
}
const cssKeepLines = blankComments(rawSource)

// R1(协调者拍板)—— 附录 D.1 的 32 个 + 协调者追加的 6 个 k-empty* = 38 个,是 T4
// (token 声明层 + 壳段 + keyframes)唯一该出现的类全集,一个不多一个不少。
//
// 【T11 追加】附录 D.2 的仪表盘 k2-* 段,协调者 brief 原文写"64 个 k2-* + k-suggest-chip
// = 65 个",实测是笔误:用 `sed -n '/### D.2/,/### D.3/p' brief.md | grep -oE
// 'k2?-[a-z0-9-]+' | sort -u` 去重后是 64 个(63 个 k2-* + 1 个 k-suggest-chip),
// 与蓝本 `git show main:…/knowledge.scss | sed -n '2282,2452p' | grep -oE
// '\.k2?-[a-z0-9-]+' | sort -u` 独立核对也是精确 64 个、且两份集合逐一比对完全相同
// (`diff` 零差异)。故白名单扩到 38 + 64 = **102** 个,不是 brief 里写的 103。
//
// 【P5b-T2 追加】共享底座段(蓝本 :241-252 / :253-257 / :735-968 / :1296-1316 +
// :1335-1341 / :1398-1428 / :1484-1499 / :2031-2039)新增附录 D.1 的 32 个类,
// 102 → **134**(计划书写的 101 → 133 是错的,见附录 D §D.0:本常量名就叫
// WHITELIST_102、数组实测 102 项)。独立复核:把上面七段用 sed 抽出来后
// `grep -oE '\.k[a-z0-9-]*-[a-z0-9-]+|\.k-btn|\.k-row|\.k-view|…' | sort -u` 得 34 个,
// 减去已在白名单里的 k-btn(P5a 搬的基类)与 k-scroll(只在蓝本 :250-252 注释里出现),
// 恰好 32 个,与附录 D.1 逐一相同。
//
// 【P5b-T6 追加】"已收录文件"页专属段(蓝本 :1705-2022,S8)新增附录 D.2 的 53 个类,
// 134 → **187**(计划书写的 186 是错的,同上,见附录 D §D.0)。独立复核:
// `git show main:…/knowledge.scss | sed -n '1705,2022p' | grep -oE '^\.k[a-z0-9-]+|
// ^\.k[a-z0-9-]+(?=[[:.,{ ])' | sort -u` 得 54 个,减去已在白名单里的 k-btn
// (`.k-filter-bar .k-btn` / `.k-pager .k-btn` 两处只是给既有基类调高度),恰好 53 个,
// 与附录 D.2 逐一相同。
//
// 【P5c-T2a 追加】"知识库配置页 + 目录选择器"用到的 10 段(蓝本 knowledge.scss
// :969-984 / :1141-1149 / :1159-1179 / :1181-1201 / :1203-1225 / :1227-1247 /
// :1249-1265 / :1267-1293 / :1317-1334 / :2250-2263,外加蓝本
// FolderBrowser.vue:82-143 的 <style scoped> 全段)新增 P5c 附录 D.1 的 39 个类,
// 187 → **226**(治理 §6.4-3 写的 191 只是举例了 K17 那 4 个,准确增量以附录 D §D.0
// 为准,本档实测也是 39)。独立复核:把这 10 段 + FolderBrowser 的 style 块抽出来
// `grep -oE '\.(k|k2|kn|fb)[a-z0-9-]*' | sort -u` 得 47 个,减去已在白名单里的 8 个
// (k-btn / k-modal / k-modal-bg / k-modal-foot / k-scroll / k-scroll-inner / k-view /
// kn-badge,都是 P5a/P5b 搬的),恰好 39 个,与附录 D.1 逐一相同。
// 🔴 显式不在此列(见 knowledge.scss 头注释):k-section-body(蓝本 :985-991,Allowlist
// 专用)与 k-progress-card/-row/-label/-nums/-bar/-fill(蓝本 :1152-1157,N15)——
// 下面「没有搬多」那条断言负责守住这 7 个类一个都不出现。
//
// 【P5d-T2 追加】"笔记区"专属段(蓝本 :2029/:2040-2045(A)· :2047-2056(B)·
// :2057-2085(C)· :2086-2121(D)· :2122-2194(E,含 ProseMirror 段)· :2195-2241(F)·
// :2242-2249(G)· :2265-2281(H)· :551-571(K43 .k-seg))新增附录 D §D.1 的 65 个
// k 前缀新类,226 → **293**(常量名跟着数字改,本档既定习惯;226 + 65 + 2 = 293,
// 后面 2 个是 R9 追加的非 k 前缀类 nme-content/ProseMirror,见下方独立小节)。
// 🔴 治理/计划书写的「缺 66 类 / 已有 21」两种口径都不成立(E-39),协调者裁定 R9
// 已订正终值为 293,独立复现命令见 `.superpowers/sdd/p5d-gen-r8r9-sim.mjs`(T2 报告
// 已贴对拍到本档编辑**之前**的基线状态输出:old 225 / new 225,严格超集自证)。
// K45(裁定 R1)搬入的 .k-btn.text 不进本白名单 —— 它是复合类 `.k-btn.text` 里的
// `text`,「没有搬多」的正则(见下方)扫不到复合类里的 `text`,`text` 只归
// NON_K_HELPER_CLASSES(见下方独立小节),不许同时进两侧(R8/R9 二选一,已实测坐实)。
//
// 【P5e-T2 追加】「文件聚合搜索」两屏 + in-app 预览的 7 段(蓝本 knowledge.scss
// :351-367(S1)· :457-549(S2)· :573-681(S3)· :726-732(S4)· :1548-1562(S5)·
// :1572-1672(S6),外加 KFileViewer.vue:71-76 + :102-119(KF))新增 P5e 附录 D §D.7.1
// 逐字列出的 **55** 个 k 前缀新类,293 → **348**(常量名跟着数字改,本档既定习惯)。
// 🔴 终值以裁定 R8 为准(T0 评审用自己重写的模拟器独立复现过,不是 T0 自报);
// T2 开工第一动作已独立重跑 `.superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs`
// 与 `classes2.mjs`,复现 292→347 / 293→348 / 16→19 与 74=54/17/3,输出逐字贴在 T2 报告。
// ⚠️ **「常量长度 ≠ NEW_RE 扫出数」那 1 差是现状就有的,不许去「修平」** ——
// 那一项是 `knowledge-app`,真因是 NEW_RE 的 `k(?:2|n)?-` 分支要求 `k-`/`k2-`/`kn-`,
// 而 `knowledge-app` 是 `kn` + `o`,**压根匹配不上**(裁定 R8 订正了附录 §D.7.1 给的
// 「贪婪吃前缀」那个错理由 —— 照数字做,别照那个理由推演)。
// 🔴 **P5f-T2 订正**:P5f 把该分支扩成 `k(?:2|n|r|w)?-`(裁定 R1),`knowledge-app`
// **仍然匹配不上**(`k` + 可选组吃掉 `n` 后要 `-` 却遇到 `o`;空匹配后要 `-` 却遇到 `n`)
// ⇒ **这 1 差在本期落地后依旧是 1**(常量 425 / 扫出 424),真因不变,同样不许修平。
// ⚠️ `k-suggest-chip` **不在这 55 个里** —— 它早因 Dashboard v2 段那条后代覆盖被扫到、
// 已在白名单里(E-52 的 HALF-MOVED);本刀补基类不会让白名单数字变。
// ⚠️ `chev` / `path` / `h-md` **不在这 55 个里** —— 不是 k* 前缀,归 NON_K_HELPER_CLASSES。
// 🔴 **白名单/登记表报红时,第一件事是回查附录 D §D.3 那 24 个蓝本死类清单
// (下方有一条常驻断言钉住它们零出现),不许改白名单。**
const WHITELIST_425 = [
  'knowledge-app',
  'k-rail', 'k-rail-head', 'k-rail-title', 'k-rail-sub', 'k-rail-section', 'k-rail-nav',
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
  // ---- T11:附录 D.2(64 个)----
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
  // ---- P5b T2:附录 D.1(32 个)----
  'k-banner-close', 'k-confirm-body', 'k-confirm-icon', 'k-confirm-summary',
  'k-confirm-title', 'k-done-stat', 'k-done-stat-label', 'k-done-stat-num',
  'k-filter-pill', 'k-filter-pill-count', 'k-modal', 'k-modal-bg',
  'k-modal-foot', 'k-queue-head', 'k-row', 'k-row-action',
  'k-row-actions', 'k-row-badges', 'k-row-check', 'k-row-error',
  'k-row-head', 'k-row-name', 'k-row-path', 'k-row-retry',
  'k-row-status', 'k-row-time', 'k-table', 'k-table-foot',
  'k-toolbar', 'k-toolbar-label', 'k-view', 'kn-badge',
  // ---- P5b T6:附录 D.2(53 个)----
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
  // ---- P5c T2a:附录 D.1(39 个)----
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
  // ---- P5d T2:附录 D.1(65 个)----
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
  // ---- P5d T2:R9 追加的非 k 前缀类(2 个,K44 顶层例外段引入)----
  'nme-content', 'ProseMirror',
  // ---- P5e T2:附录 D §D.7.1 的 55 个(逐字照抄该节代码块)----
  'k-adv-chip', 'k-adv-chips', 'k-adv-field', 'k-adv-label', 'k-adv-panel', 'k-adv-toggle',
  'k-chunk-content', 'k-chunk-item', 'k-chunk-item-body', 'k-chunk-item-head', 'k-chunk-item-preview',
  'k-chunk-list', 'k-chunk-loc', 'k-chunk-nav', 'k-chunk-nav-count', 'k-chunk-rank',
  'k-chunk-viewer', 'k-chunk-viewer-foot', 'k-chunk-viewer-head', 'k-chunk-viewer-title',
  'k-drawer', 'k-drawer-actions', 'k-drawer-back', 'k-drawer-bg', 'k-drawer-body',
  'k-drawer-fileinfo', 'k-drawer-filename', 'k-drawer-head', 'k-drawer-head-spacer', 'k-drawer-summary',
  'k-fileviewer-empty', 'k-fileviewer-fallback', 'k-fileviewer-host',
  'k-hero-suggest', 'k-match-pill', 'k-more-hint',
  'k-rcard', 'k-rcard-body', 'k-rcard-head', 'k-rcard-icon', 'k-rcard-meta', 'k-rcard-meta-item',
  'k-rcard-name', 'k-rcard-snippet', 'k-rcard-tag', 'k-rel', 'k-rel-dot', 'k-rerank-warn',
  'k-result-count', 'k-results', 'k-search-box', 'k-search-clear', 'k-search-sticky', 'k-search-sticky-inner',
  'k-skel-rcard',
  // ---- P5f-T2:附录 D §D.7.1 的 27 个 k-*(蓝本 :985-1141 + :1342-1396 + :1500-1503)----
  // 🔴 `k-section-body`(蓝本 :985)与 `k-frow`(:1077)是**前几期故意没搬、本期反转搬入**
  // 的两个(勘误 E-67 记的 67→69 差 2 就是它们);`k-frow` 另有一条 :1500-1503 的窄屏
  // @media 覆盖(偏差 K60 / 裁定 R2)。⚠️ 与 P5b-T6 搬的 `k-frow-f` / `k-frow-fhead` /
  // `k-frow-pathcell` / `k-frow-pathtxt` / `k-frow-num` / `k-frow-status` **是不同 token**,
  // 零碰撞 —— 但任何扫描一律用完整 token 精确匹配(`k-frow\b` 会被 `k-frow-path` 假命中 = E-25)。
  'k-custom-add', 'k-ext-chip', 'k-ext-chip-mark', 'k-ext-chips',
  'k-extgroup', 'k-extgroup-head', 'k-extgroup-icon', 'k-extgroup-meta',
  'k-extgroup-title', 'k-extgroup-toggle',
  'k-field', 'k-field-hint', 'k-field-label', 'k-field-mono',
  'k-frow', 'k-frow-action', 'k-frow-head', 'k-frow-path', 'k-frow-root', 'k-frow-root-icon',
  'k-priority-hint',
  'k-radio-2', 'k-radio-card', 'k-radio-card-desc', 'k-radio-card-icon', 'k-radio-card-text',
  'k-section-body',
  // ---- P5f-T2:附录 D §D.7.2 的 41 个 kw-*(蓝本 :2453-2561,Wiki 导航页)----
  // 🔴 这一族与下面的 `kr-*` 一样,**旧 NEW_RE 的 `k(?:2|n)?-` 分支压根不认**
  // (`w`/`r` 都不是 `2` 也不是 `n`)⇒ 不处理会一次性掉进 nonKClassNames 打红集合相等断言。
  // 裁定 **R1** 采纳方案 B:扩 NEW_RE 分支 + 进本白名单 + nonKClassNames 加排除条件
  // —— 与 P5c-T2a 处理 `fb-*` 的三件套**逐字同款先例**。
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
  // ---- P5f-T2:附录 D §D.5 的 9 个 kr-*(偏差 K53,来源 RootsView.vue:223-289 的
  // `<style lang="scss" scoped>`;勘误 E-63:差集法结构性地看不到 .vue 自带的 style 块)----
  'kr-adv-row', 'kr-badge', 'kr-check', 'kr-empty', 'kr-error',
  'kr-hint', 'kr-input', 'kr-label', 'kr-path',
]

describe('knowledge.scss —— 附录 D 白名单落地(425 个,R1 + T11 + P5b-T2 + P5b-T6 + P5c-T2a + P5d-T2 + P5e-T2 + P5f-T2)', () => {
  // 评审 2026-07-31 Important 订正 —— 原来用 `\b` 做类名右边界:`\b` 在 `-` 前也成立
  // (从字母切到连字符同样算"单词边界"),于是 `/\.k-topbar\b/` 会被 `.k-topbar-title`
  // 这样的**前缀**类满足,删掉唯一的 `.k-topbar { … }` 基类规则也测不出来 —— 评审用
  // RED 探针实证过(删 .k-topbar 规则,8/8 全绿)。受影响的是白名单里本身就是其它
  // 类前缀的 9 个:k-rail/k-rail-item/k-rail-svc/k-topbar/k-banner/k-badge/k-scroll/
  // k-mobile-tab/k-empty。改用「右边不能紧跟单词字符或短横线」的负向前瞻,这样
  // `.k-topbar` 不会被 `.k-topbar-title` 满足,只有真正独立的 `.k-topbar` 选择器
  // (后面接空格/`{`/`,`/`[` 等)才算数。
  it('425 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)', () => {
    const missing = WHITELIST_425.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css))
    expect(missing, `缺失的类:${missing.join(', ')}`).toEqual([])
  })

  // 防漂移:常量名里的数字与数组长度必须一致(本档既定习惯,名字本身就是断言的一部分)。
  it('白名单恰好 425 项(附录 D §D.0:102 + T2 的 32 + T6 的 53 + P5c-T2a 的 39 + P5d-T2 的 65+2 + P5e-T2 的 55 + P5f-T2 的 27+41+9)', () => {
    expect(WHITELIST_425).toHaveLength(425)
    expect(new Set(WHITELIST_425).size, '白名单里有重复项').toBe(425)
  })

  it('.k-toast / .k-toast-ico 不移植(偏离 K3,改走全局 useToast())', () => {
    expect(css).not.toMatch(/\.k-toast\b/)
    expect(css).not.toMatch(/\.k-toast-ico\b/)
  })

  // 【P5b-T2 · K10】蓝本有**两份** .k-confirm-icon/-title/-summary:嵌套版
  // (:1398-1428,在 .knowledge-app 内)与顶层重复版(:1676-1702)。两份声明逐字等价,
  // 级联上嵌套版 (0,2,0) 完胜顶层版 (0,1,0) → 顶层那份在 Vue2 里从未生效过,K10 判定
  // 整段丢弃。这条钉住"只搬了一份":任何一个 confirm 类出现两次(= 有人把顶层那份也
  // 搬了进来)就报红。上面「没有搬多」那条只查类名在不在白名单,查不出**重复定义**。
  it('K10 —— .k-confirm-* 每个类只有一份规则(蓝本 :1676-1702 的顶层重复段已丢弃)', () => {
    for (const c of ['k-confirm-body', 'k-confirm-icon', 'k-confirm-title', 'k-confirm-summary']) {
      const hits = css.match(new RegExp(`\\.${c}(?![\\w-])`, 'g')) || []
      expect(hits.length, `${c} 出现 ${hits.length} 次(应为 1;>1 说明 K10 丢弃的顶层重复段被搬了进来)`).toBe(1)
    }
  })

  // 【P5b-T2 修:守卫缺口①(附录 B §B.5 / 治理文件 §9 登记在案)】原正则是
  // `/\.k2?-[a-z0-9-]+/g` —— `k2?` 吃掉 `k` 之后**要求下一个字符是 `-`**,所以
  // `.kn-badge` / `.kn-foo` 这类 `kn-` 前缀的类**一个都扫不到**。本任务 S7 段
  // (蓝本 :2031-2039)搬的正是 `.kn-*`,而蓝本 :2040-2281 还有几十个 `.kn-*` 是
  // P5d 的 —— 手滑多搬一条,旧正则一句话都不会说。RED 探针实证:往规则段落里塞
  // 一条白名单外的 `.kn-foo { … }`,旧正则下 17/17 全绿放行;改成下面这个正则后
  // 精确报「白名单外的类:kn-foo」。
  // 🔴 这是**扩大扫描范围**,不是放宽断言:被扫到的类仍然必须全部落在白名单里。
  //
  // 【P5c-T2a 再扩:守卫缺口①第二轮(治理 §6.4-4 / §9 登记在案)】上一版正则只认
  // `k` / `k2` / `kn` 三种前缀 —— 本任务往本档搬进了 FolderBrowser 的 `.fb-*` 段
  // (蓝本 FolderBrowser.vue:82-143),那 8 个类**一个都扫不到**。治理 §6.4-4 给的正则是
  // `/\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g`;实测它仍漏**裸 `.fb`**(没有连字符后缀,
  // `fb-[a-z0-9-]+` 要求至少一个 `-`),而 `fb` 恰好是附录 D.1 登记的 39 个类之一 ——
  // 若照字面写,`.fb` 会既躲过本条扫描、又因为不匹配 `^k…-` 前缀而掉进下面
  // `nonKClassNames` 报成"未登记的非 k* 类"。故把 `fb` 那一支的后缀写成**可选**,
  // 使本条正则严格是治理给定正则的**超集**(只扫得更多,不放宽任何断言);
  // 下面 nonKClassNames 的排除条件同步按 `fb` / `fb-*` 处理,两处口径一致。
  // 🔴 这仍然是**扩大扫描范围**,不是放宽断言:蓝本 :2023-2281 还有几十个 `.kn-*` 是
  // P5d 的、:985-991 的 .k-section-body 与 :1152-1157 的 .k-progress-*(N15)也不该出现
  // —— 手滑多搬任意一条,这里就会精确指名。RED 探针见 P5c-T2a 报告。
  //
  // 【P5d-T2 再扩:守卫缺口①第三轮(治理 §9.6 / 裁定书「四之二」/附录 D §D.2.1)】
  // 本任务往本档搬入了 K44 的 `.nme-content .ProseMirror` 顶层段与 K43 的 `.k-seg`。
  // 上一版正则 `/\.(?:k(?:2|n)?-[a-z0-9-]+|fb(?:-[a-z0-9-]+)?)/g` 扫不到两样东西:
  // ① `nme-content` / `ProseMirror` —— 前缀不是 k/k2/kn/fb;
  // ② `ProseMirror`**即使加了 nme 前缀支持也扫不到**——它带大写字母,而旧字符集只有
  //    `[a-z0-9-]`(P5c §6.4.2 挂账的债票,协调者裁定 A-11:这次不再是理论问题,必须兑现)。
  // 新正则:`/\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g`
  // —— ① 字符集加 `A-Z`(兑现 A-11);② 新增 `nme(?:-…)?` 与 `ProseMirror` 两个可选分支。
  // 🔴 这是**扩大扫描范围**,不是放宽断言:程序化实测(见 `p5d-gen-r8r9-sim.mjs`,T2 报告
  // 已贴对现状文件的严格超集自证输出:old 225 / new 225 完全相同,证明这条改动在改动前的
  // 现状文件上**零可观测** —— RED 探针是唯一能证明它有判别力的证据,见下方独立 RED 探针
  // 小节)。被扫到的 `nme-content`/`ProseMirror` 两个新类同样必须落在白名单里(R9:226→293)。
  //
  // 【P5f-T2 再扩:守卫缺口①第四轮(裁定 **R1**,方案 B)】本任务往本档搬入了 41 个
  // `kw-*`(Wiki 页)与 9 个 `kr-*`(K53,来自 RootsView.vue 的 `<style scoped>`)。
  // 上一版正则的 `k(?:2|n)?-` 分支**只接受 `k-`/`k2-`/`kn-`** —— `kw-` 的 `w`、`kr-` 的 `r`
  // 都不是 `2` 也不是 `n` ⇒ 这 50 个类**一个都扫不到**,会连同 `cur` 一次性掉进
  // 下面的 `nonKClassNames`,打红那条集合相等断言。
  // 新分支:`k(?:2|n|r|w)?-`。三件套(扩正则 + 进白名单 + nonKClassNames 加排除条件)
  // 与 **P5c-T2a 处理 `fb-*` 的做法逐字同款**,是本仓既定流程,不是新发明。
  // 🔴 这仍然是**扩大扫描范围 = 加固**,不是放宽:被扫到的类仍然必须全部落在白名单里
  // (少写一个 → 本条精确指名报红,T2 报告贴了 RED 探针②的输出)。
  // 严格超集自证见下一条(已同步换成「P5e 版 vs P5f 版」两个正则,否则那条会变空壳)。
  // 🔴🔴 【P5f-T2b 必改(裁定 **R20 的 I-2**;R22:这属于「把内联字面量提到常量」,已申报)】
  // 原文把扫描正则**内联**写在本条 it 里,而下面「严格超集自证」比的是它的一份**硬编码拷贝**
  // —— 两者之间零绑定。评审实证:把**本条内联的现役正则**窄回 `k(?:2|n)?-`,
  // 全档 **374/374 全绿**,50 个 `kw-*`/`kr-*` 一次性脱离「没有搬多」覆盖而无人报红
  // ⇒ R1-③ 想消灭的「自证变空壳」只是被推迟到了下一期。
  // 修法:提成模块内共享常量,**「没有搬多」与「严格超集自证」共用同一个源**
  // ⇒ 窄回现役正则,超集自证的「净增量 = 50」立刻报红。
  // ⚠️ 这是**纯重构 + 绑定**,不改任何匹配语义(正则源逐字不变);判据见 T2b 报告探针 P-3。
  // ⚠️ `nonKClassNames()` 的排除前缀 `/^k(?:2|n|r|w)?-/` 是**另一份**独立正则,本刀不动
  //    (窄回它只会让「未登记的非 k* 类」变多 = 报红,不是静默失守);两处口径一致性
  //    登记为债务,不在本刀范围。
  const CLASS_SCAN_RE_SOURCE =
    '\\.(?:k(?:2|n|r|w)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)'
  const scanClassNames = (text: string): Set<string> =>
    new Set((text.match(new RegExp(CLASS_SCAN_RE_SOURCE, 'g')) || []).map((s: string) => s.slice(1)))

  it('没有搬多 —— 全部 k-/k2-/kn-/kr-/kw-/fb/nme/ProseMirror 类都在白名单内(附录 D.4 自检命令②的常驻版,字符集含 A-Z)', () => {
    const found = [...scanClassNames(css)]
    const extra = found.filter((c) => !WHITELIST_425.includes(c))
    expect(extra, `白名单外的类:${extra.join(', ')}`).toEqual([])
  })

  // 【P5d-T2 · 严格超集自证(照 P5c §6.4.1 第 1 条的做法,防止「扩范围」变成「悄悄放宽」)】
  // 对**改动前的现状文件**(git 历史版本,不是本次改动后的当前文件)分别跑旧正则与新正则,
  // 断言旧正则扫到的每一个类,新正则都扫得到(old ⊆ new)——证明这次扩字符集/扩分支
  // 纯粹是扩大覆盖,没有让任何原本会被扫到的类逃过去。
  // 🔴 T2 报告已贴这条断言对 T1 收官版本(`56f8849`)跑出的真实输出(old 225 / new 225,
  // 完全相同的集合)—— 这也是「本条改动在现状文件上零可观测」的证据来源,RED 探针
  // (见下方独立小节)才是这条改动唯一有判别力的证明。
  //
  // 🔴🔴 【P5f-T2 必改(裁定 **R1**-③)】本条原先硬编码的是「P5d 版 vs P5e 版」两个正则,
  // **与本刀真正落地的那条正则无关** —— 不同步换掉,这条自证就变成**空壳**:它会永远
  // 比较两个与现役正则无关的旧常量,不管现役正则怎么改都恒绿。
  // 现在 OLD_RE = **P5e 收官时的现役正则**(即上一条断言改动前的原文),
  // NEW_RE = **本刀落地的现役正则**(加了 `r|w` 两个分支)。
  // 判据(R1-③ 原文):把 `r|w` 从被测的 NEW_RE 里删掉 → 本条必须报红。
  // T2 报告贴了这个偏态的实测输出(删 `r|w` 后精确列出 50 个「旧扫到、新漏掉」的类)。
  // ⚠️ 同时补一条**严格**方向的断言(`new ⊋ old`):只证 `old ⊆ new` 允许两者相等,
  // 那样「扩范围」有可能其实什么都没扩(P5d 当时在改动前的文件上就是 old 225 / new 225)。
  // 本刀的文件里 `kr-*`/`kw-*` 已经真实存在 ⇒ 严格真包含**可以且必须**被程序化证明。
  //
  // 🔴🔴 【P5f-T2b 再修(裁定 **R20 的 I-2**)】上一版的 `NEW_RE` 是现役正则的一份**硬编码
  // 拷贝** ⇒ 现役正则可以被静默窄回而本条恒绿(评审已实证 374/374 全绿)。
  // 现在 `newHits` 直接走上面的 **`scanClassNames()` = 现役同一个源**,
  // 只有 `OLD_RE`(P5e 收官时的历史原文)仍是硬编码 —— 它本来就该是历史快照。
  // 🔴 判据(比 R1-③ 更强):把 `r|w` 从 **`CLASS_SCAN_RE_SOURCE`(现役)** 里删掉 →
  //    本条必须报红,且「没有搬多」那条**仍然全绿**(那才是这个缺口的真实形态)。
  it('严格超集自证 —— 现役正则(加 kr-/kw- 分支)是 P5e 现役正则的严格超集(old ⊊ new)', () => {
    const OLD_RE = /\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g
    const oldHits = new Set((css.match(OLD_RE) || []).map((s) => s.slice(1)))
    // 🔴 被测的「新」正则 = **现役**扫描源本身,不是它的拷贝(I-2 的整条要害)
    const newHits = scanClassNames(css)
    const missing = [...oldHits].filter((c) => !newHits.has(c))
    expect(missing, `旧正则扫到但新正则漏掉的类(说明扩范围其实是放宽):${missing.join(', ')}`).toEqual([])
    // 覆盖度自检:两个正则都必须真的扫到东西(防「正则失效 → 两个空集 → 恒绿」)
    expect(oldHits.size, '旧正则一个类都没扫到 —— 零判别力').toBeGreaterThan(300)
    // 🔴 严格真包含:新正则必须**多**扫到 50 个(41 个 kw-* + 9 个 kr-*),一个不多一个不少
    const gained = [...newHits].filter((c) => !oldHits.has(c)).sort()
    expect(
      gained.length,
      `新正则相对旧正则的净增量应为 50(41 个 kw-* + 9 个 kr-*),实际 ${gained.length}:${gained.join(', ')}`,
    ).toBe(50)
    expect(gained.every((c) => c.startsWith('kw-') || c.startsWith('kr-')), '净增量里混进了非 kw-/kr- 的类').toBe(true)
  })

  // 【P5b-T6 修:守卫缺口④(T2 评审挂账,协调者交给 T6 处置)】上面「没有搬多」那条
  // 与白名单本身都只收 `k*` 前缀 —— 蓝本在几个类里嵌了**非 k 前缀的辅助类**
  // (`.k-modal-foot .right`、`.k-fd-v.mono`、`.k-btn.ghost/.outline/.primary/.danger`…),
  // 它们既不在白名单、也不进扫描正则:将来本文件里冒出任意一条 `.right { … }` /
  // `.mono { … }`,或者有人手滑把别处的辅助类搬了进来,**不会有任何断言说话**。
  //
  // 处置:选"补一条覆盖非 k* 类的登记表",而不是"写条注释登记缺口了事"。理由是
  // 实测下来**零假阳性** —— 本档全文(剥注释后)用 `/\.([a-zA-Z][a-zA-Z0-9_-]*)/`
  // 扫出来的非 `k*` 标识符恰好只有下面这 9 个,全都是真类名:CSS 里的小数(`0.5`)
  // 与时长(`1.4s`)点号后面跟的是数字,被 `[a-zA-Z]` 挡掉;`min()`/`repeat()`/
  // `cubic-bezier()` 这类函数参数里也没有"点+字母"的形式。既然噪音为 0,就没有
  // "会引入更多假阳性"这个不做的理由。
  //
  // 🔴 这同样是**扩大扫描范围**,不是放宽断言:新扫到的类必须逐个在下面登记并写理由。
  // 这份清单不许当垃圾桶塞 —— 下面第二条用集合相等把它钉死(多一个少一个都报红)。
  const NON_K_HELPER_CLASSES = [
    // .k-btn 的四个变体(蓝本 :822/:826/:836/:843),写作 `&.ghost` 等,与 .k-btn 连写
    'ghost', 'outline', 'primary', 'danger',
    // .k-modal-foot 内的右对齐动作组(蓝本 :1340),P5b-T2 搬入
    'right',
    // .k2-layer-num 内的单位后缀与第二数字(蓝本 :2320/:2321),P5a T11 搬入
    'suffix', 'second',
    // .k2-live-ico 内的旋转态(蓝本 :2364),P5a T11 搬入
    'spin',
    // .k-fd-v 的等宽变体(蓝本 :1957),写作 `&.mono`,P5b-T6 搬入
    'mono',
    // .k-set-row-desc 内的警示行(蓝本 :1174),写作嵌套 `.warn { … }`,P5c-T2a 搬入
    // (附录 D §D.1.1:9 → 10。⚠️ 不要顺手把 parser-app 也塞进来 —— 治理 §6.4-2 已裁定
    //  它走 nonKClassNames 的**排除条件**,与既有的 knowledge-app 同款处理,登记表保持
    //  "真·嵌套辅助类"的语义。)
    'warn',
    // ---- P5d-T2 追加(裁定书 R8:10 → 16)----
    // 🔴 治理 §9.6 / 裁定 A-10 写「NON_K_HELPER_CLASSES 保持 10 项不变」是错的 ——
    // 那句只算了 `nme`/`nme-content`/`ProseMirror`(且 `nme` 蓝本零选择器、根本扫不到,
    // `nme-content`/`ProseMirror` 走排除条件不进本表),漏算了下面这 6 个真·嵌套辅助类。
    // 照 A-10 字面「保持 10 项」做,下面「登记表恰好等于文件里真实存在的非 k* 类」那条
    // 集合相等断言会**一提交就红**(裁定书 R8 已订正为 16,以程序化实测为准 —— 复现命令
    // 见 `p5d-gen-r8r9-sim.mjs`,输出逐字见 T2 报告)。
    // .kn-savehint 内的保存状态小圆点(蓝本 :2127/:2128),P5d-T2 搬入
    'dot',
    // .kn-refbtn 内的引用按钮文字(蓝本 :2222),P5d-T2 搬入
    'lbl',
    // .kn-note-meta 内的元信息分隔点(蓝本 :2104),P5d-T2 搬入
    'sep',
    // .kn-edit-top / .kn-editor-status / .kn-aside-title 内的弹性占位(蓝本 :2125/:2193/:2203),
    // P5d-T2 搬入
    'spacer',
    // K45(裁定 R1)搬入的 .k-btn.text —— `&.text` 是复合类 `.k-btn.text` 里的 `text`,
    // 与既有 ghost/outline/primary/danger 四个 `&.x` 变体完全同款(蓝本 :1569-1570)。
    // 🔴 `text` 只归本表(R8),不进 WHITELIST_425(R9 的正则扫不到复合类里的 `text`,
    // 见上方「没有搬多」小节注释),R8/R9 二选一,不许同时登记两侧。
    'text',
    // .kn-tb-btn 内的 H2/H3 加宽变体(蓝本 :2167),写作 `&.wide`,P5d-T2 搬入,与既有
    // mono/ghost 等「连写变体」同款
    'wide',
    // ---- P5e-T2 追加(裁定 R8 / 附录 D §D.7.2:16 → 19)----
    // 🔴 这三个是「登记表变长 = 新扫到的类都必须写明出处」,是**加固**不是放宽:
    // 下面那条「登记表恰好等于文件里真实存在的非 k* 类,不多不少」的**集合相等**断言
    // 仍然生效,多写一个/少写一个都报红;本刀新增 3 条真实存在的嵌套辅助类,不写就报红。
    // 加固前/加固后两次 nonKClassNames() 的逐字输出贴在 T2 报告(16 → 19)。
    // 折叠箭头图标的旋转容器 —— .k-adv-toggle .chev(蓝本 :509)、
    // .k-adv-toggle[data-open="true"] .chev(:510)、.k-more-hint .chev(:1561)
    // 三条**不同的后代规则**,与既有 dot/sep/spacer 同款。P5e-T2 搬入
    'chev',
    // 结果卡 meta 里的等宽路径片段 —— .k-rcard-meta-item .path(蓝本 :670)。
    // ⚠️ p5-master-plan.md §2.4 的类清单漏列了它(勘误 E-55)。与既有 mono 同款。P5e-T2 搬入
    'path',
    // 摘要里的「Markdown 标题行」高亮 —— .k-rcard-snippet .h-md(蓝本 :660)。
    // 🔴 **蓝本 13 个 .vue 里零 class 引用**,但它嵌在 .k-rcard-snippet 内 → 随父块整体搬、
    // 不单独摘除(附录 D §D.6,同 P5d「statusBadge 零消费者也照抄导出」的 K7 模具)。P5e-T2 搬入
    'h-md',
    // ---- P5f-T2 追加(裁定 R1 / 附录 D §D.7.4:19 → 20)----
    // 🔴 本刀只往本表加 **1 个**。裁定 R1 明确否决了方案 A(把 41 个 kw-* + 9 个 kr-*
    // 全倒进本表)—— 那会把这份「真·嵌套辅助类逐个登记出处」的小表**亲手变成它要防的
    // 垃圾桶**,而且那 50 个类从此不再受上面「没有搬多」白名单扫描的覆盖 = **净减少
    // 守卫覆盖面**。方案 B 让它们走 WHITELIST_425 + nonKClassNames 排除条件(同 fb-*)。
    // Wiki 面包屑里的「当前项」—— .kw-crumb .cur(蓝本 :2475),与既有 right/mono/dot/sep
    // 同款的真·嵌套辅助类。P5f-T2 搬入
    'cur',
  ]

  // 【P5c-T2a 修:守卫缺口④(治理 §6.4-2)】本任务给两个 token 声明块的选择器各扩了一项
  // `.parser-app`(K21 —— Parser 两页复用本档 token,零复制),于是 `parser-app` 会被下面
  // 这个 `/\.([a-zA-Z]…)/` 扫出来、掉进"未登记的非 k* 类";它是**作用域根**,不是嵌套
  // 辅助类 → 与既有的 `knowledge-app` 同款,走排除条件而不是塞进登记表。
  // 同理 `fb` / `fb-*`(P5c-T2a 从 FolderBrowser.vue:82-143 搬入的 8 个类)是本档正经
  // 前缀类、已进 WHITELIST_425、且已被上面那条"没有搬多"扫描覆盖,这里一并排除,
  // 避免同一批类被两条断言用两套互相矛盾的口径判定。
  //
  // 【P5d-T2 追加】K44 引入的 `nme-content` / `ProseMirror` 同理是**正经前缀类/第三方
  // 类**(前者是蓝本 wrapper 类,后者是第三方 ProseMirror 生成的类名,大小写混排,
  // 本档 kebab 小写惯例之外的唯一一个),不是嵌套辅助类 —— 与 knowledge-app/parser-app/
  // fb 同款,走排除条件,不进 NON_K_HELPER_CLASSES(治理 §9.6 明令)。
  //
  // 【P5f-T2 追加(裁定 R1,方案 B)】排除前缀同步扩成 `k(?:2|n|r|w)?-` —— 与上面
  // 「没有搬多」那条正则**同一口径**(两处必须一致,否则同一批类会被两条断言用互相
  // 矛盾的口径判定)。`kr-*` / `kw-*` 是本档正经前缀类、已进 WHITELIST_425、且已被
  // 「没有搬多」扫描覆盖,与 fb-* / knowledge-app / parser-app / nme-content 同款排除。
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

  it('守卫缺口④ —— 非 k* 前缀的嵌套辅助类全部在登记表内(.right/.mono 这类)', () => {
    const extra = nonKClassNames(css).filter((c) => !NON_K_HELPER_CLASSES.includes(c))
    expect(extra, `未登记的非 k* 类(每个都要在 NON_K_HELPER_CLASSES 里写明出处):${extra.join(', ')}`).toEqual([])
  })

  it('守卫缺口④ —— 登记表恰好等于文件里真实存在的非 k* 类,不多不少(防清单变垃圾桶;P5f 终值 20)', () => {
    expect(nonKClassNames(css)).toEqual([...NON_K_HELPER_CLASSES].sort())
  })

  it('R8/R1 —— NON_K_HELPER_CLASSES 常量恰好 20 项(P5d 的 16 + P5e-T2 的 3 + P5f-T2 的 1;不是治理 A-10 的 10 项)', () => {
    expect(NON_K_HELPER_CLASSES).toHaveLength(20)
    expect(new Set(NON_K_HELPER_CLASSES).size, '登记表里有重复项').toBe(20)
  })

  // 【P5d-T2 · K45 落地 DoD(裁定书 R1-②,附录 D §D.4.1)】「没有搬多」的白名单集合断言
  // 天然守不住 `.k-btn.text` 被重复搬(`text` 不在它的正则里)—— 改用「.k-btn 作用域内
  // &.text 恰好出现 2 次(规则 + hover)」的计数断言。🔴 brief §3-2 / T0 复审指出:必须
  // 锚定在 `.k-btn { … }` 区间内,不能对全文裸计数(全文计数在别处合法出现 `&.text` 时
  // 会误红,P5e 若在别处重复搬又会漏判)——手法照本档 K10 守 `.k-confirm-*` 的做法:
  // 先用花括号配对定位 `.k-btn { … }` 声明块(比 declBlockRange 的"下一个 \n}"更严,
  // 因为 .k-btn 块内有嵌套的 &.xxx { … } 规则,不能假设第一个 \n} 就是块尾),再只在
  // 区间内计数。
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
    expect(startLine, '找不到 .k-btn 声明块(行首行尾锚定,trim 后须恰为 ".k-btn {")').toBeGreaterThanOrEqual(0)
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

  // 【P5e-T2 · M-4 —— 只改用例名,不动断言(治理 §8.2 的 M-4 交接项)】原用例名写
  // 「&.text **只在** .k-btn{…} 作用域内出现,恰好 2 次」,比断言实际做的事**宽**:
  // 断言只在 `.k-btn { … }` 区间内计数,对区间**之外**是否还有 `&.text` 一无所知
  // (真要守「只在」,得再加一条全文计数 - 区间内计数 === 0 的断言)。改成如实描述
  // 「在 .k-btn{…} 区间内恰好 2 次」。🔴 断言体一行未动 —— 这是 §9.10 的口径:
  // 不为了让用例名好看去改断言,也不留一个过度声明的名字骗评审。
  it('K45 —— .k-btn{…} 区间内 &.text 恰好 2 次(规则+hover;重复搬即报红,brief §3-2 / R1-②)', () => {
    const [start, end] = findKBtnBlockRange(css)
    const body = css.slice(start, end)
    const hits = body.match(/&\.text\b/g) || []
    expect(hits.length, `.k-btn 块内 &.text 出现 ${hits.length} 次(应为 2;≠2 说明 K45 重复搬或漏搬)`).toBe(2)
  })
})

// ============================================================================
// P5e-T2 新增守卫(附录 D §D.3 / §D.4 / K46 / K47)
// ============================================================================

// 蓝本死代码类的完整清单(逐字抄自 p5-master-plan.md §2.2 / 附录 D §D.3)。
// 这 24 个类在**蓝本自己**的 13 个 .vue 里零 class 引用,是 v1 仪表盘 / v1 进度卡被
// k2-* Dashboard v2 取代后留下的遗迹。P5a 正确地没搬,P5e 也不许搬。
const BLUEPRINT_DEAD_CLASSES = [
  // 蓝本 :272-349(7)
  'k-hero', 'k-hero-orb', 'k-hero-title', 'k-hero-sub',
  'k-hero-search', 'k-hero-search-go', 'k-hero-search-kbd',
  // 蓝本 :380-411(5)
  'k-stat', 'k-stat-label', 'k-stat-value', 'k-stat-suffix', 'k-stat-cn',
  // 蓝本 :413-455(6)
  'k-quick-grid', 'k-quick-card', 'k-quick-icon',
  'k-quick-card-title', 'k-quick-card-en', 'k-quick-card-desc',
  // 蓝本 :1152-1160(6)
  'k-progress-card', 'k-progress-row', 'k-progress-label',
  'k-progress-nums', 'k-progress-bar', 'k-progress-fill',
]

describe('knowledge.scss —— 附录 D §D.3:24 个蓝本死代码类一个都没被搬进来(P5e-T2 新建)', () => {
  // 🔴 为什么这条断言必须存在:P5e 要搬的 .k-hero-suggest(蓝本 :351)与 .k-suggest-chip
  // (:357)**紧夹在 .k-hero-search-kbd(:343)与 .k-stat(:380)中间** ⇒ 「整段搬
  // :272-455」会一次带进 **18** 个死类。上面「没有搬多」那条白名单断言会报红,而实现者
  // 极可能误判成「白名单数字错了」去改白名单 —— 这条断言把话说清楚:报红先回查死类清单。
  //
  // 🔴 判据口径:`(?![\w-])` 负向前瞻,**不许用 `\b`** —— `\b` 在字母↔连字符的过渡处
  // 同样成立,`/\.k-hero\b/` 会被完全合法的 `.k-hero-suggest`(本刀真要搬的类)**假命中**
  // (E-25 的坑,协调者规划时栽过一次)。这也是本条与「白名单」那条共用同一手法的原因。
  //
  // 🔴 跑在**剥注释后**的 `css` 上:附录 D §D.3 给的复现命令是对**原始文本**裸 grep,
  // 它在 T2 之前的基线上就已经有 2 处假阳性(k-quick-grid / k-progress-card,来自
  // knowledge.scss :61 / :1318 / :1605 三条既有注释里带前导点的类名引用)——
  // 那条命令**不是**权威判据,本断言是。详见 T2 报告的勘误一节。
  it('24 个死类在 knowledge.scss(剥注释后)零出现', () => {
    const leaked = BLUEPRINT_DEAD_CLASSES.filter((c) => new RegExp(`\\.${c}(?![\\w-])`).test(css))
    expect(
      leaked,
      `蓝本死代码类被搬进来了:${leaked.join(', ')} —— 🔴 先回查附录 D §D.3 的清单,` +
        '**不许改白名单**(那 24 个类在蓝本自己的 13 个 .vue 里零引用,P5a 正确地没搬)',
    ).toEqual([])
  })

  // 清单不许当垃圾桶 / 不许被悄悄缩短(同本档其它「例外清单恰好 N 项」的口径)
  it('死类清单恰好 24 项(7 + 5 + 6 + 6),无重复', () => {
    expect(BLUEPRINT_DEAD_CLASSES).toHaveLength(24)
    expect(new Set(BLUEPRINT_DEAD_CLASSES).size, '死类清单里有重复项').toBe(24)
  })

  // 🔴 参数化守卫防空循环(治理 §9.14-4):24 条独立用例真在跑,不是「清单读失败 → 循环
  // 体一次没执行 → 全绿」。用 --reporter=verbose 能数到 24 条。
  for (const cls of BLUEPRINT_DEAD_CLASSES) {
    it(`死类 ${cls} 零出现`, () => {
      expect(new RegExp(`\\.${cls}(?![\\w-])`).test(css), `${cls} 被搬进来了`).toBe(false)
    })
  }
})

// 在**保行版**文本里按「整行 trim 后恰等于给定串」定位行号。行首/整行锚定,天然排除
// 注释里的同名引用(注释已被 blankComments 换成等量空格,连内容都不在了)。
// 手法同本档 findKBtnBlockRange 的「trim 后精确匹配」口径,不是子串搜索(承本档四次
// 「子串检查抓不住真实缺陷」的教训)。
function lineIndexOfExact(text: string, trimmedLine: string): number {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) if (lines[i].trim() === trimmedLine) return i
  return -1
}

// 在保行版文本里定位「trim 后恰等于 selectorLine 的那一行」开始的嵌套规则块,用大括号
// 配对找块尾(不能假设「下一个 \n}」—— 那只对零缩进的顶层块成立)。
function nestedBlockBody(text: string, selectorLine: string): string {
  const at = lineIndexOfExact(text, selectorLine)
  expect(at, `找不到规则块 ${selectorLine}(整行 trim 精确匹配,已排除注释里的同名引用)`).toBeGreaterThanOrEqual(0)
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

describe('knowledge.scss —— E-52:.k-suggest-chip 基类必须在 k2 后代覆盖之前(P5e-T2 新建)', () => {
  // 【事实】P5a 只搬了蓝本 :2291 的后代覆盖(本档 Dashboard v2 段的
  // `.k2-suggest .k-suggest-chip { white-space: nowrap; }`),**基类整条漏搬** = 勘误 E-52;
  // 而蓝本 DashboardView.vue:292 与 SearchView 都在用它 ⇒ P5a 已交付的仪表盘建议 chip
  // 一直跑在「只有一条 white-space、零基类样式」上(圆角/内距/边框/底色/hover 全缺)
  // = **已交付产出里的真实视觉缺陷**,本刀补基类。
  //
  // 🔴🔴 **本断言钉的是「蓝本源序的移植忠实性」,不是「防级联反掉」**(裁定 R7 / 勘误 E-56):
  //   · 基类 `.knowledge-app .k-suggest-chip` 特异度 (0,2,0),声明 padding/background/
  //     border/border-radius/font-size/color/cursor/transition + :hover;
  //   · 覆盖 `.knowledge-app .k2-suggest .k-suggest-chip` 特异度 (0,3,0),**只声明
  //     white-space**;
  //   ⇒ ① (0,3,0) > (0,2,0),顺序颠倒也不会反掉;② 两者**属性集完全不相交**。
  //   **所以「顺序反了会有可见回归」是假的** —— 协调者原先那句「否则级联反掉而三门全绿」
  //   是写错的,已对外更正。用例名与注释一律不许再写那个理由。
  it('基类声明行号 < k2 后代覆盖行号(钉蓝本源序的移植忠实性,不是钉级联结果)', () => {
    const baseAt = lineIndexOfExact(cssKeepLines, '.k-suggest-chip {')
    const overrideAt = lineIndexOfExact(cssKeepLines, '.k2-suggest .k-suggest-chip { white-space: nowrap; }')
    expect(baseAt, '找不到 .k-suggest-chip 基类声明块(E-52 的补搬缺失?)').toBeGreaterThanOrEqual(0)
    expect(overrideAt, '找不到 .k2-suggest .k-suggest-chip 后代覆盖(P5a 搬入的那条)').toBeGreaterThanOrEqual(0)
    expect(
      baseAt,
      `基类在第 ${baseAt + 1} 行、覆盖在第 ${overrideAt + 1} 行 —— 基类必须在覆盖之前(蓝本源序:` +
        '基类 :357-367 / 覆盖 :2291)',
    ).toBeLessThan(overrideAt)
  })

  // 基类的实体也要在:光有顺序不够,漏搬任何一条声明都是 E-52 没补干净。
  it('基类块含蓝本 :358-366 的六项声明 + :hover(漏一条即 E-52 没补干净)', () => {
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
      expect(body, `.k-suggest-chip 基类缺 ${decl}`).toContain(decl)
    }
  })
})

describe('knowledge.scss —— K46 / K47:.k-fileviewer-host 三属性 + 三条 ::v-deep 不搬(P5e-T2 新建)', () => {
  // 🔴 K46 判据 ③(治理 §3 的 K46 原文):`position: fixed` / `inset: 0` / `z-index: 1100`
  // 三个属性**必须原样保留**,**各有一条独立断言**(拿掉任一 → 必须报红)。
  // 依据:`src/files/viewers/ViewerShell.vue:24` 是
  // `position: absolute; inset: 0; z-index: 200; overflow: hidden;` ——
  // ViewerShell **需要一个铺满视口的定位祖先**;拿掉 host 的 `fixed` 会让 in-app 预览器
  // **塌进文档流**(治理 §2 第 2 条原文:这是本期最容易「顺手清理」出真 bug 的一处)。
  // 三条分开写而不是一条 toContain 三次 —— 一条断言里塞三个 toContain 只要有一个还在
  // 就可能被误读成「都在」,而 vitest 在第一个失败处就停,后两个失去判别力(本档 R4
  // 那条「4 个 token 共享一个断言,改坏 1 个仍全绿」的教训同款)。
  const HOST = '.k-fileviewer-host {'

  it('K46-③a —— .k-fileviewer-host 保留 position: fixed(拿掉 → 预览器塌进文档流)', () => {
    expect(nestedBlockBody(cssKeepLines, HOST), 'host 丢了 position: fixed').toContain('position: fixed;')
  })

  it('K46-③b —— .k-fileviewer-host 保留 inset: 0(拿掉 → 铺不满视口)', () => {
    expect(nestedBlockBody(cssKeepLines, HOST), 'host 丢了 inset: 0').toContain('inset: 0;')
  })

  it('K46-③c —— .k-fileviewer-host 保留 z-index: 1100(必须压在 .k-drawer-bg 的 1050 之上)', () => {
    expect(nestedBlockBody(cssKeepLines, HOST), 'host 丢了 z-index: 1100').toContain('z-index: 1100;')
  })

  // K47 —— host 的底色是本期净剩的唯一一处色字面量,映射到 token(附录 B §B.4)。
  // 上面那条全文色扫会抓「有没有裸值」,但抓不到「换成了别的 token」。
  it('K47 —— .k-fileviewer-host 底色是 var(--bg-canvas)(与蓝本兄弟规则 .k-fileviewer-fallback 同源)', () => {
    expect(nestedBlockBody(cssKeepLines, HOST), 'host 底色不是 --bg-canvas').toContain('background: var(--bg-canvas);')
  })

  // z-index 相对关系(附录 B §B.4.1):1100 > 1050,两个数字都原样搬。
  it('K46 —— .k-drawer-bg 的 z-index 是 1050,严格小于 host 的 1100', () => {
    const bg = nestedBlockBody(cssKeepLines, '.k-drawer-bg {')
    expect(bg, '.k-drawer-bg 的 z-index 被改动了').toContain('z-index: 1050;')
    const m = /z-index:\s*(\d+);/.exec(bg)
    expect(m, '.k-drawer-bg 里找不到 z-index').not.toBeNull()
    expect(Number(m![1]), '.k-drawer-bg 必须低于 .k-fileviewer-host 的 1100').toBeLessThan(1100)
  })

  // 🔴 K46 判据主体:蓝本 KFileViewer.vue:77-101 的三条 ::v-deep 规则**整段不搬**。
  // 它们是补 **Vue2** viewer 依赖 `.file-panel .modal-card .overlay` 祖先链的补丁;
  // 本仓 DocViewer.vue / ExcelViewer.vue **自身模板零那三个类**,`.overlay` 已由
  // ViewerShell.vue:23-29 的 scoped 规则自带(position/inset/z-index/overflow/flex 全在)
  // ⇒ 照搬 = 复制一个本仓不存在的问题的补丁。
  // ⚠️ 诚实登记:`.overlay` **不是全仓零命中**(ViewerShell.vue:9 会吐 `<div class="overlay">`)
  // —— 但这不削弱 K46,反而加强它:补丁纯属重复。本断言的范围是 **knowledge.scss 内**。
  // 跑在剥注释后的 `css` 上(本档 K46 的说明注释里逐字引了这三个类名)。
  for (const cls of ['overlay', 'v-container', 'doc-container']) {
    it(`K46 —— .${cls} 在 knowledge.scss(剥注释后)零出现(蓝本 :77-101 整段不搬)`, () => {
      expect(
        new RegExp(`\\.${cls}(?![\\w-])`).test(css),
        `.${cls} 出现在 knowledge.scss 里 —— K46 被违反(那三条 ::v-deep 是 Vue2 祖先链补丁,` +
          '本仓 ViewerShell 已自带同款定位,照搬是复制一个不存在的问题的补丁)',
      ).toBe(false)
    })
  }

  // 反向:本档确实没有留下任何 ::v-deep / :deep 写法(scoped 降级后它们也没有意义)
  it('K46 —— knowledge.scss 里零 ::v-deep / :deep(...)(scoped 已降级为 .knowledge-app 作用域)', () => {
    expect(css, '出现 ::v-deep').not.toMatch(/::v-deep/)
    expect(css, '出现 :deep(').not.toMatch(/:deep\(/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【P5e-T4 新增,裁定 R16】Important-1「7 个新 token 的『token → 消费选择器』绑定零守卫」。
// 事实(T2 评审实证,不是推测):把 [data-kind="md"] 与 [data-kind="doc"] 消费的 token
// 互换 → 334/334 全绿(探针 G1);把 .k-rcard-icon 底色从 --paper-surface 换成
// --bg-elevated → 也全绿(探针 G3)。8 个新 token 里只有 --mark-hl-bg 的绑定被既有的
// 「三条 mark 规则各归其位」断言钉住了,其余 7 个(5 个 --rtag-* + --paper-surface +
// --shadow-drawer)只有「两档都有声明、值没被重算」的断言,没有「哪个选择器消费哪个
// token」的绑定断言。产品代码本身经评审逐字比对确认正确(五个 [data-kind] ↔ 五个
// --rtag-* 无串位,与蓝本 :618-622 源序逐字一致)⇒ 这是纯粹的测试覆盖缺口,不是代码
// 缺陷。但 --rtag-md 正是裁定 R15-③ 认定「本机不可达 ⇒ 守卫是唯一防线」的拍板项,
// 串位一次会永久静默 ⇒ 必须补。
//
// 判据(裁定 R16 ②):把两个 [data-kind] 消费的 token 互换 → 必须报红;把
// .k-rcard-icon 的底色换成别的 token → 必须报红(报告贴两段输出 + md5sum 还原)。
// 只加固,不放宽任何既有断言(§9.10);不改 knowledge.scss 本身。
describe('knowledge.scss —— R16:7 个新 token 的消费绑定(P5e-T4 新建,补 T2 评审 Important-1 缺口)', () => {
  const TAG = '.k-rcard-tag {'
  const ICON = '.k-rcard-icon {'
  const DRAWER = '.k-drawer {'

  // 5 条 —— .k-rcard-tag[data-kind] ↔ --rtag-* 逐对绑定(蓝本 :618-622 源序)
  const kindBindings: Array<[string, string]> = [
    ['pdf', '--rtag-pdf'],
    ['md', '--rtag-md'],
    ['doc', '--rtag-doc'],
    ['txt', '--rtag-txt'],
    ['code', '--rtag-code'],
  ]
  it.each(kindBindings)(
    'k-rcard-tag[data-kind="%s"] 消费 var(%s)(判据:与另一个 data-kind 互换 → 必须报红,见 T4 报告 RED 探针)',
    (kind, token) => {
      const body = nestedBlockBody(cssKeepLines, TAG)
      expect(body, `.k-rcard-tag[data-kind="${kind}"] 没有绑定 var(${token})`).toContain(
        `&[data-kind="${kind}"] { background: var(${token}); }`,
      )
    },
  )

  // 第 6 条 —— .k-rcard-icon 底色 ↔ --paper-surface
  it('k-rcard-icon 底色消费 var(--paper-surface)(判据:换成别的 token → 必须报红)', () => {
    const body = nestedBlockBody(cssKeepLines, ICON)
    expect(body, '.k-rcard-icon 底色不是 var(--paper-surface)').toContain('background: var(--paper-surface);')
  })

  // 第 7 条 —— .k-drawer 投影 ↔ --shadow-drawer
  it('k-drawer 投影消费 var(--shadow-drawer)(判据:换成别的 token → 必须报红)', () => {
    const body = nestedBlockBody(cssKeepLines, DRAWER)
    expect(body, '.k-drawer 投影不是 var(--shadow-drawer)').toContain('box-shadow: var(--shadow-drawer);')
  })
})

// 找到「从 selectorLiteral 开始、到下一个独立一行的 `}` 为止」这个声明块的字符区间。
// 两个 token 声明块都是纯 `--x: y;` 平铺属性,没有嵌套规则,所以「下一个 `\n}`」
// 就是它的真实结束位置 —— 与 settingsStyles.test.ts 的 blockOf 同一手法。
//
// 【评审 2026-08-01 Important I-2 订正,本档第五次同族"守卫自己有窟窿"事故】原来
// 用 `text.indexOf(selectorLiteral)` 找起点 —— 这是纯子串搜索,会被文件头注释里
// **逐字引用的同一个选择器串**撞对:头注释 :8/:46/:51/:179 都写过反引号包着的
// `` `.knowledge-app { … }` ``(为了向读者解释选择器写法),`indexOf` 命中的是这些
// 注释里最早出现的那一处,而不是真正的声明块 —— 导致豁免区间的起点往前多算了整整
// 65 行头注释(评审 RED 探针实证:把色字面量塞进头注释,守卫全绿放行;塞进规则段落
// 才报红)。教训(与本档前四次 `\b`/剥注释时机/子串检查/import 撞对同一类):**任何
// 「在文件里定位某段文本」的判据,都必须行首锚定 + 整行精确匹配,不能是子串搜索**。
// 修法:真正的声明块选择器在源码里总是**独占一行、零缩进、行尾紧跟 `{`**
// (如 `.knowledge-app {`),而注释里的引用前面总有 ` * ` 或反引号等前缀,不可能独占
// 一整行 —— 改用 `^selectorLiteral$`(多行模式)的正则去匹配,天然排除注释里的同名
// 引用。`.exec()` 不带 `g` 标志时只返回**第一个**匹配,这正是我们要的(暗色 token 块
// 在文件最前面,T4 的壳段与 T11 的仪表盘段虽然也各自起了一个 `.knowledge-app {` 顶层
// 块,但都在 token 块之后,不会被误选)。
function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function declBlockRange(text: string, selectorLiteral: string): [number, number] {
  const lineAnchored = new RegExp(`^${escapeForRegExp(selectorLiteral)}$`, 'm')
  const m = lineAnchored.exec(text)
  expect(m, `找不到声明块 ${selectorLiteral}(行首锚定,已排除注释里的同名引用)`).not.toBeNull()
  const at = m!.index
  const braceAt = text.indexOf('{', at)
  const end = text.indexOf('\n}', braceAt)
  expect(end, `${selectorLiteral} 声明块未闭合`).toBeGreaterThan(0)
  return [at, end + 2]
}

function declBlockBody(text: string, selectorLiteral: string): string {
  const [start, end] = declBlockRange(text, selectorLiteral)
  return text.slice(start, end)
}

// 【P5c-T2a · K21】两个 token 声明块的选择器各扩了一项 `.parser-app`(治理 §6.1 的 C-3
// 裁定:Parser 两页复用本档这套 token,token 声明零复制;不能让页面根挂 .knowledge-app,
// 因为下面 `.knowledge-app { … }` 那个壳块与 token 块**共用同一选择器**、会连满屏两列
// 外壳一起带过去)。这两个常量必须跟着改 —— 上面 declBlockRange 用的是
// `^选择器$`(多行模式)**行首行尾锚定**,选择器少一个字/换一行都会让
// `expect(m).not.toBeNull()` 直接报红。这本身就是一条防漂移断言:scss 里的选择器一旦被
// 改回单个 `.knowledge-app {`(= K21 被回滚、Parser 两页的 token 全部解析不到、真机上
// 那两页会变成一片透明),这里立刻精确报"找不到声明块"。RED 探针见 P5c-T2a 报告。
const DARK_TOKEN_SELECTOR = '.knowledge-app, .parser-app {'
const LIGHT_TOKEN_SELECTOR =
  ':root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {'

describe('knowledge.scss —— 配色硬约束(本档除声明层外无自动守卫,§6 豁免登记）', () => {
  // 【协调者 2026-07-31 裁定口径,T11/T12 续写本档时同样适用】
  //   - 规则段落(壳段、后续批次的表格/仪表盘等)里的**注释**:一律不许出现任何色
  //     字面量 —— 不管是 Vue2 的原始裸色还是 New-UI 这边取的新值,都不行。要引用
  //     蓝本原文时写「蓝本 knowledge.scss:行号 + 中文描述颜色语义」,例如
  //     `/* 蓝本 :145 前景裸色 → --text-on-accent */`,不要把 `white`/`#fff`/
  //     `rgba(...)` 这类字面量抄进注释(它们会原样进构建产物,也绕开了这条测试)。
  //   - 两个 token 声明块(`.knowledge-app { … }` 基础块 / `:root[data-theme="light"]
  //     .knowledge-app { … }` 浅色块)内部:允许 —— 那里的字面量就是被声明的值本身,
  //     行尾注出处时带上具体取值也可以(如 `/* theme.css:183 */`)。
  //
  // 【本条是本任务最有价值的守卫】color-guard.test.ts 不扫 .scss(P3a RED 探针实证)——
  // 这条测试是 knowledge.scss 唯一的裸色回归网。只豁免两个 token 声明块本身
  // (那里就是 token 的定义处,见 §6),除此之外全文一处裸色字面量都不许有 ——
  // **包括注释里的**(治理文件 §6:注释里也不许出现 Vue2 的原始色字面量)。
  //
  // 评审 2026-07-31 Important 订正 —— 原版这条扫描跑在 `stripComments()` 之后的
  // `css` 上,于是注释里的裸色**永远抓不到**(评审用 RED 探针实证:在注释里塞
  // `/* 原 #ff0000 */` 之类,8/8 全绿;同处改成真代码 `color: #ff0000` 才报红)。
  // 剥注释这件事本身没错(P2b 教训:`toContain` 会被注释里的类名撞对),但那是给
  // "类名/token 是否存在"这类断言用的,不该用在色扫上。色扫改成基于**未剥注释的
  // 原始文本** `rawSource`,只把两个 token 声明块的字符区间切掉(区间边界仍按
  // rawSource 自己的位置算,不能借用剥过注释版本的偏移量,两份文本长度不同)。
  it('token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)', () => {
    const [darkStart, darkEnd] = declBlockRange(rawSource, DARK_TOKEN_SELECTOR)
    const [lightStart, lightEnd] = declBlockRange(rawSource, LIGHT_TOKEN_SELECTOR)
    // 两个声明块必须按文件顺序不重叠(dark 在前、light 紧随其后),否则下面的拼接会切错。
    expect(darkEnd, 'dark 声明块应先于 light 声明块结束').toBeLessThanOrEqual(lightStart)

    const rest = rawSource.slice(0, darkStart) + rawSource.slice(darkEnd, lightStart) + rawSource.slice(lightEnd)

    expect(rest, '声明层之外出现 #hex').not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(rest, '声明层之外出现 rgb()/rgba()').not.toMatch(/rgba?\(/)
    expect(rest, '声明层之外出现 hsl()/hsla()').not.toMatch(/hsla?\(/)
    expect(rest, '声明层之外出现 oklch()').not.toMatch(/oklch\(/)
    // 评审 2026-07-31 Minor 追加 —— 原正则只覆盖 hex/rgb/rgba/oklch/white/black,
    // 补齐现代 CSS 色函数(lab/lch/hwb/color())与几个常见具名色。`transparent`
    // 不算色字面量(评审已核:.k-skel 与 .k-btn.ghost 那两处 `transparent` 是蓝本
    // :694/:828 逐字照搬的透明边框/透明底,不是"某个颜色写死",保留)。
    expect(rest, '声明层之外出现 lab()').not.toMatch(/\blab\(/)
    expect(rest, '声明层之外出现 lch()').not.toMatch(/\blch\(/)
    expect(rest, '声明层之外出现 hwb()').not.toMatch(/\bhwb\(/)
    expect(rest, '声明层之外出现 color()').not.toMatch(/\bcolor\(/)
    // 【T11 自查发现的守卫窟窿,已订正】原来这 8 条具名色检查用 `\bWORD\b`。JS 正则的
    // `\b` 在字母↔连字符的过渡处同样成立(`-` 是非单词字符),所以 `/\bwhite\b/` 会被
    // 完全合法的 CSS 属性 `white-space` 撞对(`white` 右边紧跟 `-`,一样满足"单词边界"),
    // `/\bblack\b/`/`/\bred\b/` 等对 `black-ish`/`foo-red` 这类连字符复合词同理会假阳性
    // ——这是本档第五次同类"守卫自己有窟窿"事故(前四次见文件顶部注释)。T11 的仪表盘
    // 段落大量使用 `white-space: nowrap`(蓝本原文如此,1:1 照抄),原版规则会把这些
    // 完全合规的规则误判成"裸色字面量"。改用「左右都不能紧跟单词字符或连字符」的
    // 双向负向断言(与文件顶部「没有搬多」测试已经用过的 `(?![\w-])` 同一手法,这里补上
    // 左侧的 `(?<![\w-])`),`white-space` 左边是空格/分号等非单词字符、但右边紧跟 `-`
    // 会被右侧的 `(?![\w-])` 挡住,不再误判;真正的字面量(如 `color: white;`,两侧都是
    // 空格/分号)两侧仍都满足负向断言,继续能报红。
    expect(rest, '声明层之外出现具名色 white').not.toMatch(/(?<![\w-])white(?![\w-])/)
    expect(rest, '声明层之外出现具名色 black').not.toMatch(/(?<![\w-])black(?![\w-])/)
    expect(rest, '声明层之外出现具名色 red').not.toMatch(/(?<![\w-])red(?![\w-])/)
    expect(rest, '声明层之外出现具名色 green').not.toMatch(/(?<![\w-])green(?![\w-])/)
    expect(rest, '声明层之外出现具名色 blue').not.toMatch(/(?<![\w-])blue(?![\w-])/)
    expect(rest, '声明层之外出现具名色 orange').not.toMatch(/(?<![\w-])orange(?![\w-])/)
    expect(rest, '声明层之外出现具名色 gray').not.toMatch(/(?<![\w-])gray(?![\w-])/)
    expect(rest, '声明层之外出现具名色 grey').not.toMatch(/(?<![\w-])grey(?![\w-])/)
  })

  it('.knowledge-app 两档都显式声明 color-scheme(P2b 教训:嵌套主题作用域不声明会继承 :root)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(darkBody, '暗色档缺 color-scheme: dark').toContain('color-scheme: dark')
    expect(lightBody, '浅色档缺 color-scheme: light').toContain('color-scheme: light')
  })

  // R2(协调者拍板)—— 附录 B「New-UI 已有的直接用」对 *-soft 家族是错的:那批 token
  // 只在 tokens.scss 的 .agent-app/.ai-toast-scope 作用域声明,.knowledge-app 解析不到,
  // 必须自己在两档声明层里各补一份。这条钉住:删掉任何一档的任何一个就报红。
  // 【T11 追加】仪表盘 k2-* 段另用到 --danger-soft-border(k2-qchip[data-tone=danger]
  // 的 hover 强化态)与 --modal-scrim(k2-ob-layer .k2-tag 暗色蒙版的 color-mix 派生源),
  // 4→6 个,同一断言扩容,不新开 describe。
  // 【P5b-T2 追加】共享底座段另用到 3 个:--success-soft-border(.kn-badge[data-s="curated"]
  // 的边框,蓝本 :2038)、--danger-soft-faint(.k-confirm-summary 的底色,蓝本 :1417;
  // T6 段 :1972 会复用)、--danger-hover(.k-btn.danger 的 hover 底色,蓝本 :846)。
  // 归属依治理文件 §6.2 的 token 归属表(--purple-soft 归 T6,本任务不声明)。6→9 个。
  // 【P5b-T6 追加】"已收录文件"段(S8)只新用到 1 个:--purple-soft(蓝本 :1894 的
  // .k-type-tag[data-kind="code"] 底色),归属表判给 T6 声明。本段用到的
  // --danger-soft-faint 已由 T2 声明(蓝本 :1972 是它的第二个使用点),不重复。9→10 个。
  it('R2 —— 10 个本档用到的 *-soft/-scrim/-hover token 两档都有值(T4 的 4 + T11 的 2 + P5b-T2 的 3 + P5b-T6 的 1)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    for (const tok of [
      '--warning-soft:', '--warning-soft-border:', '--success-soft:', '--danger-soft:',
      '--danger-soft-border:', '--modal-scrim:',
      '--success-soft-border:', '--danger-soft-faint:', '--danger-hover:',
      '--purple-soft:',
    ]) {
      expect(darkBody, `暗色档缺 ${tok}`).toContain(tok)
      expect(lightBody, `浅色档缺 ${tok}`).toContain(tok)
    }
  })

  // R4(评审 2026-07-31 裁定,覆盖附录 B 原表)—— --shadow-* 带颜色,不是无色结构量,
  // 两档必须各给一份不同的值(暗色档取 tokens.scss:360-363 的暗投影,浅色档取
  // :107-110 的暖投影)。之前按"结构量,两档共享"处理,只在暗色档声明一份、浅色档
  // 沿用同一份暖投影值——会让 .k-rail-item[data-active]/.k-rail-svc 的投影在暗色底上
  // 几乎看不见。这条钉住两档必须分别声明、且取值不同(防止将来被"合并成一份"回归)。
  // 评审技法自查(RED 探针 3 暴露的教训,详见报告)—— 最初这条守卫只用"lightBody 里
  // 某处出现过 rgba(40,35,25,…)"这种整块子串检查,4 个 token 共享同一个断言,只要
  // --shadow-sm/md/lg 三个还在暖投影,即使把 --shadow-xs 单独改回暗投影也测不出来
  // (探针实测:改坏 --shadow-xs 一个,9/9 仍然全绿)。改成**逐个 token 精确匹配自己
  // 那一行**,任何一个 token 的值被单独改错都能报红。
  it('R4 —— --shadow-xs/sm/md/lg 每一个 token 在两档里分别精确取暗/浅两套不同的投影值', () => {
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
      expect(darkBody, `暗色档 ${tok} 值不对`).toContain(dark)
      expect(lightBody, `浅色档 ${tok} 值不对`).toContain(light)
      // 反向:两档不能是同一份值(防止被"合并回结构量共享"的回归)
      expect(darkBody, `暗色档 ${tok} 不该出现浅色档的暖投影值`).not.toContain(light)
      expect(lightBody, `浅色档 ${tok} 不该出现暗色档的黑投影值`).not.toContain(dark)
    }
  })

  // 【P5b-T2】--danger-hover 是本期**全仓无源、新造**的唯一一个 token(另两个
  // --success-soft-border / --danger-soft-faint 都能在 AI tokens.scss 里回源核对)。
  // 设计 §6.2 附了一句派生描述("对本档 --danger 做与蓝本同比例的加深,亮度 −9%"),
  // 但 T0 实测**这条规则复算不出给定的两个十六进制**,治理文件 §6.2 因此明文裁定
  // "以设计给出的十六进制为准,禁止下游按规则重算出别的值"。上面 R2 那条只查
  // "有没有声明",查不到"值被谁按那条描述重算过" —— 这条把两档取值逐字钉死。
  it('--danger-hover 两档取值逐字等于设计 §6.2 给定值(治理 §6.2:禁止按"亮度 −9%"重算)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(darkBody, '暗档 --danger-hover 取值被改动').toContain('--danger-hover: #E35F52;')
    expect(lightBody, '浅档 --danger-hover 取值被改动').toContain('--danger-hover: #A83226;')
    // 反向:两档不能同值(同值 = 有人把它当成了"结构量/两档共享")
    expect(darkBody).not.toContain('--danger-hover: #A83226;')
    expect(lightBody).not.toContain('--danger-hover: #E35F52;')
  })

  // 【P5c-T2a】本任务新声明 4 个 token(附录 B §B.8),名字里都不含 `-soft`/`-scrim`/
  // `-hover` 后缀 → 上面 R2 那条数组按治理 §B.8 的裁定**不扩**;但"两档都有声明"这层
  // 由下面「浅色档颜色 token 覆盖完整性」的集合断言自动覆盖,而**取值有没有被重算/改动**
  // 则没有任何守卫 —— 附录 B §B.8 明写这 4 个全部是"仓内逐字同值出处、零凭空造、禁重算"
  // (承 P5a T11 R9 的教训:自行发明 color-mix 比例)。这条照 --danger-hover 那条的同款
  // 写法,把两档取值逐字钉死;并反向钉住"两档同值"这个 theme-invariant 属性
  // (与既有 --purple/--pink/--teal/--modal-scrim 同族)。
  it('P5c-T2a 的 4 个新 token 两档取值逐字等于 AI tokens.scss 出处值(附录 B §B.8:禁重算)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, string> = {
      // tokens.scss:201(浅)/ :345(暗)—— iOS 开关拨钮前景,theme-invariant
      '--switch-thumb': '--switch-thumb: #ffffff;',
      // tokens.scss:202 / :346 —— 同一个拨钮的投影,整条 box-shadow 都在 token 里
      '--switch-thumb-shadow': '--switch-thumb-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);',
      // tokens.scss:162 / :321 —— .k-sandbox-icon 的 inset 高光,整条 box-shadow 在 token 里
      '--gloss-inset-dot': '--gloss-inset-dot: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);',
      // tokens.scss:236 的 --grad-sk-blue 改名不改值(-sk- 是技能区专用命名)
      '--grad-sandbox': '--grad-sandbox: linear-gradient(135deg, #5AC8FA, #007AFF);',
    }
    for (const [tok, decl] of Object.entries(expected)) {
      expect(darkBody, `暗色档 ${tok} 缺声明或取值被改动`).toContain(decl)
      expect(lightBody, `浅色档 ${tok} 缺声明或取值被改动(不许"两档同值就省一档")`).toContain(decl)
    }
  })

  // 【P5d-T2 · K39】本任务新声明 9 个 token(附录 B §B.1 是权威)。7 个 theme-invariant
  // (4 个笔记渐变 + 2 个 wash 渐变 + 2 个代码块色),两档同值;--shadow-warning-glow
  // 两档**不同值**(RGB 三元组随 --warning-soft-border 换档,alpha 沿用蓝本 0.3/0.24)。
  // 🔴 诚实登记(K39 明令,不许照抄 P5c "4/4 都有出处"那句):4 个笔记渐变里只有
  // --grad-note-note 与既有 --grad-sandbox 逐字同值,另 3 个全仓零同值先例,蓝本设计包
  // 是值的唯一权威源 —— 这条测试只钉「取值没有被下游重算/改动」,不代表这些值本身
  // 有仓内先例。
  it('K39 —— 7 个 theme-invariant 新 token 两档取值逐字相同(附录 B §B.1,禁重算)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, string> = {
      // notesViewHelpers.js:6,与既有 --grad-sandbox 逐字同值(仍另建新名,理由见 scss 头注释)
      '--grad-note-note': '--grad-note-note: linear-gradient(135deg, #5AC8FA, #007AFF);',
      // notesViewHelpers.js:7,全仓零同值先例
      '--grad-note-summary': '--grad-note-summary: linear-gradient(135deg, #30B0C7, #34C759);',
      // notesViewHelpers.js:8 与 knowledge.scss:2066(.kn-inbox-icon)共用同一份,全仓零同值先例
      '--grad-note-insight': '--grad-note-insight: linear-gradient(135deg, #FF9500, #FFCC00);',
      // notesViewHelpers.js:9,全仓零同值先例
      '--grad-note-digest': '--grad-note-digest: linear-gradient(135deg, #AF52DE, #FF2D55);',
      // knowledge.scss:2060,保留蓝本色相(裁定 R11)
      '--grad-inbox-wash':
        '--grad-inbox-wash: linear-gradient(160deg, rgba(255, 149, 0, 0.07), rgba(255, 204, 0, 0.04) 55%, transparent);',
      // knowledge.scss:2132,保留蓝本色相(裁定 R11)
      '--grad-draftbar-wash':
        '--grad-draftbar-wash: linear-gradient(135deg, rgba(255, 149, 0, 0.09), rgba(255, 204, 0, 0.04));',
      // NotesMarkdownEditor.vue:44,theme-invariant
      '--code-block-bg': '--code-block-bg: #0d0d0d;',
      '--code-block-fg': '--code-block-fg: #ffffff;',
    }
    for (const [tok, decl] of Object.entries(expected)) {
      expect(darkBody, `暗色档 ${tok} 缺声明或取值被改动`).toContain(decl)
      expect(lightBody, `浅色档 ${tok} 缺声明或取值被改动(不许"两档同值就省一档")`).toContain(decl)
    }
  })

  it('K39 —— --shadow-warning-glow 两档取值不同(暗 0.3 / 浅 0.24,附录 B §B.1 第 7 行)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(darkBody, '暗档 --shadow-warning-glow 取值被改动').toContain(
      '--shadow-warning-glow: 0 3px 8px rgba(224, 165, 59, 0.3);',
    )
    expect(lightBody, '浅档 --shadow-warning-glow 取值被改动').toContain(
      '--shadow-warning-glow: 0 3px 8px rgba(200, 134, 10, 0.24);',
    )
    // 反向:两档不能同值(同值 = 有人把它当成了 theme-invariant)
    expect(darkBody).not.toContain('--shadow-warning-glow: 0 3px 8px rgba(200, 134, 10, 0.24);')
    expect(lightBody).not.toContain('--shadow-warning-glow: 0 3px 8px rgba(224, 165, 59, 0.3);')
  })

  it('K39 —— #FF9500,#FFCC00 只声明一份 --grad-note-insight(两个消费方共用,不许声明两份)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    for (const body of [darkBody, lightBody]) {
      const hits = body.match(/--grad-note-insight:/g) || []
      expect(hits.length, '--grad-note-insight 声明次数应为 1(#FF9500,#FFCC00 两个消费方共用一份)').toBe(1)
    }
    // 消费方(.kn-inbox-icon 与 K44 顶层段外的其余引用留给 T3/T6/T7)本刀只核 scss 内的
    // .kn-inbox-icon 一处,确认它引用 token 而不是重复声明色值。
    expect(css, '.kn-inbox-icon 应引用 --grad-note-insight 而不是重复声明字面量').toContain(
      'background: var(--grad-note-insight);',
    )
  })

  // 【P5e-T2 · 附录 B §B.1 / §B.2】本刀在两档各补 8 个声明:--paper-surface(本档尚未
  // 声明的**既有例外 token**,不是新建)+ 7 个新建(--rtag-* 五个 / --shadow-drawer /
  // --mark-hl-bg)。上面「浅色档颜色 token 覆盖完整性」的集合断言只查「有没有声明」,
  // **查不到取值被谁重算过** —— 这两条照 --danger-hover / K39 那两条的同款写法把取值逐字
  // 钉死(附录 B §B.5-2 明令「本表以外的任何色字面量 → NEEDS_CONTEXT,不许自选 token」,
  // 反过来表内的值也不许下游重算)。
  it('P5e-T2 —— --paper-surface + 5 个 --rtag-* 两档取值逐字相同(theme-invariant,附录 B §B.1/§B.2.1)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, string> = {
      // AI tokens.scss:193(浅)/:342(暗)两档同值,skin-agnostic 例外 token
      '--paper-surface': '--paper-surface: #ffffff;',
      // 蓝本 :618-622;与 AI tokens.scss --kind-pdf/-md/-doc/-xls 及本档 --purple 逐字同值
      '--rtag-pdf': '--rtag-pdf: #FF3B30;',
      '--rtag-md': '--rtag-md: #1a1a1a;',
      '--rtag-doc': '--rtag-doc: #007AFF;',
      '--rtag-txt': '--rtag-txt: #34C759;',
      '--rtag-code': '--rtag-code: #AF52DE;',
    }
    for (const [tok, decl] of Object.entries(expected)) {
      expect(darkBody, `暗色档 ${tok} 缺声明或取值被改动`).toContain(decl)
      expect(lightBody, `浅色档 ${tok} 缺声明或取值被改动(不许"两档同值就省一档")`).toContain(decl)
    }
    // 🔴 反向:--rtag-txt 不许被"顺手借名"成 --kind-txt —— tokens.scss:210/:351 的
    // --kind-txt 是另一个值(中性灰,也是未知类型兜底),在本档重声明会造成全仓同名两值。
    expect(darkBody, '本档不许重声明 --kind-txt(全仓同名两值)').not.toContain('--kind-txt:')
    expect(lightBody, '本档不许重声明 --kind-txt(全仓同名两值)').not.toContain('--kind-txt:')
  })

  it('P5e-T2 —— --shadow-drawer / --mark-hl-bg 两档取值不同(附录 B §B.2.2/§B.2.3,禁重算)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    // 几何部分逐字照蓝本 :1582;颜色部分照裁定 R4(暗档纯色投影 / 浅档暖调投影,
    // alpha 取同档 --shadow-lg 首段)。蓝本原值是冷调,与本档 R4 已统一的两套不同源,不照抄。
    const darkShadow = '--shadow-drawer: -20px 0 60px rgba(0, 0, 0, 0.55);'
    const lightShadow = '--shadow-drawer: -20px 0 60px rgba(40, 35, 25, 0.10);'
    expect(darkBody, '暗档 --shadow-drawer 取值被改动').toContain(darkShadow)
    expect(lightBody, '浅档 --shadow-drawer 取值被改动').toContain(lightShadow)
    expect(darkBody, '暗档不该出现浅档的暖调投影值').not.toContain(lightShadow)
    expect(lightBody, '浅档不该出现暗档的投影值').not.toContain(darkShadow)
    // 蓝本 :1660;浅档逐字照蓝本 alpha,暗档降 alpha(.k-chunk-content 的前景是
    // --text-primary,照抄浅档 alpha 会把底推到中间调、浅色字对比度最差)。
    const darkMark = '--mark-hl-bg: rgba(255, 235, 0, 0.22);'
    const lightMark = '--mark-hl-bg: rgba(255, 235, 0, 0.40);'
    expect(darkBody, '暗档 --mark-hl-bg 取值被改动').toContain(darkMark)
    expect(lightBody, '浅档 --mark-hl-bg 取值被改动').toContain(lightMark)
    expect(darkBody, '暗档不该用浅档的 alpha').not.toContain(lightMark)
    expect(lightBody, '浅档不该用暗档的 alpha').not.toContain(darkMark)
  })

  // 🔴 附录 D §D.6 明令:三条 mark 规则里**只有蓝本 :1660 是字面量**,另两条
  // (:653 .k-rcard-snippet mark / :1645 .k-chunk-item-preview mark)蓝本用的就是
  // --accent-soft/--accent 两个 token —— **不许一起改成 --mark-hl-bg**。
  // 上面的全文色扫抓不到这种「改对了方向但改错了对象」的偏离。
  it('附录 D §D.6 —— 三条 mark 规则各归其位(只有 .k-chunk-content mark 用 --mark-hl-bg)', () => {
    const markRules = [...css.matchAll(/^\s*(?:\.[\w-]+ )?mark\b[^\n]*$|^\s*\.[\w-]+ mark \{[^\n]*$/gm)].map((m) => m[0].trim())
    // 逐条精确核对(锚在各自的父块选择器上,不是全文裸计数)
    const snippetMark = nestedBlockBody(cssKeepLines, '.k-rcard-snippet {')
    expect(snippetMark, '.k-rcard-snippet mark 应保持蓝本 :654-655 的 token').toContain('background: var(--accent-soft);')
    expect(snippetMark, '.k-rcard-snippet mark 被误改成 --mark-hl-bg').not.toContain('--mark-hl-bg')
    const previewLine = css.split('\n').filter((l) => l.includes('.k-chunk-item-preview mark'))
    expect(previewLine.length, '.k-chunk-item-preview mark 规则应恰好 1 条').toBe(1)
    expect(previewLine[0], '.k-chunk-item-preview mark 应保持蓝本 :1645 的 token').toContain('background: var(--accent-soft);')
    expect(previewLine[0], '.k-chunk-item-preview mark 被误改成 --mark-hl-bg').not.toContain('--mark-hl-bg')
    const contentLine = css.split('\n').filter((l) => l.includes('.k-chunk-content mark'))
    expect(contentLine.length, '.k-chunk-content mark 规则应恰好 1 条').toBe(1)
    expect(contentLine[0], '.k-chunk-content mark 应用 --mark-hl-bg(蓝本 :1660 是唯一的字面量处)').toContain('background: var(--mark-hl-bg);')
    // 覆盖度自检:确实抓到了 mark 规则(防止上面的正则一条都没匹配到而"假通过")
    expect(markRules.length, '一条 mark 规则都没抓到(正则失效 = 零判别力)').toBeGreaterThanOrEqual(3)
  })

  it('--accent-soft-2 不在本档重复声明(R2 例外:全局 theme.css 的 :root 与浅色块已有,跟随全局解析)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(darkBody).not.toContain('--accent-soft-2:')
    expect(lightBody).not.toContain('--accent-soft-2:')
    // 但壳段确实引用了它(k-banner[data-tone="info"] 与 k-btn.primary 的阴影)
    expect(css).toContain('var(--accent-soft-2)')
  })

  // 评审 2026-07-31 Critical 订正 —— 初版曾在浅色声明块里"刻意不声明 --accent/
  // --accent-soft/--success,靠 CSS 继承拿外层浅色值"。这个推理不成立:暗色块
  // `.knowledge-app { … }` 的选择器无条件命中(没有 data-theme 限定),在浅色主题下
  // 同样作用于这个元素本身;custom property 继承规则是"元素自身有声明时自身声明
  // 胜出",所以浅色块留空并不会继承到浅色值,而是被暗色块的字面值(#5E97F2 等)
  // 直接命中 —— 浅色主题下强调色/成功态会用错暗色调色板。这条钉住浅色块必须显式
  // 声明这三项字面值,任何一项被"优化掉"都会精确报红。
  it('浅色档必须显式声明 --accent/--accent-soft/--success(不能靠继承,见头注释订正说明)', () => {
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(lightBody, '浅色档缺 --accent(会被暗色块的 #5E97F2 命中)').toContain('--accent: #3b5bdb')
    expect(lightBody, '浅色档缺 --accent-soft(会被暗色块的值命中)').toContain('--accent-soft: rgba(59, 91, 219, 0.11)')
    expect(lightBody, '浅色档缺 --success(会被暗色块的 #4FB870 命中)').toContain('--success: #15754c')
    // 反向:确认没有退回自引用循环写法
    expect(lightBody).not.toContain('--accent: var(--accent)')
    expect(lightBody).not.toContain('--accent-soft: var(--accent-soft)')
    expect(lightBody).not.toContain('--success: var(--success)')
  })
})

// 【P5d-T2 · K44 顶层裸选择器例外(治理 §6.2-2 明令 / 裁定 R4 / 附录 D §D.2.2)】
// 🔴 这条断言是**新建**,不是修改 —— 现状文件里压根没有任何「顶层裸选择器」相关断言
// (`grep -n "顶层\|裸选择器\|top-level" knowledgeStyles.test.ts` 在本刀之前只命中
// K10 注释,查不到这条)。基线:改动前的现状文件 depth-0(顶层、零缩进)开块选择器
// 共 15 条,全部是 `.knowledge-app`(含与 `.parser-app` 复合的两个 token 声明块)/
// `:root[data-theme="light"] …`/`@keyframes` —— 排除这三类后「裸选择器」实测 = 0。
// K44 搬入唯一一条真正的顶层裸选择器:`.nme-content .ProseMirror`(蓝本
// NotesMarkdownEditor.vue:41-46,理由见 knowledge.scss 该段注释)。
//
// 判据:抽出全文件 depth-0(大括号深度为 0 时遇到的 `{`)选择器,过滤掉
// `.knowledge-app*`/`:root*`/`@*` 三类,断言剩下的**集合恰好等于**
// `['.nme-content .ProseMirror']` —— 集合相等式,不是「排除掉就算了」(裁定 R4 明令)。
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

describe('knowledge.scss —— K44 顶层裸选择器例外(治理 §6.2-2 / 裁定 R4,T2 新建断言)', () => {
  function bareTopLevelSelectors(): string[] {
    return depthZeroSelectors(css).filter(
      (s) => !s.startsWith('.knowledge-app') && !s.startsWith(':root') && !s.startsWith('@'),
    )
  }

  it('顶层裸选择器(排除 .knowledge-app 系 / :root 系 / @ 开头)恰好只有 .nme-content .ProseMirror 一条', () => {
    expect(bareTopLevelSelectors()).toEqual(['.nme-content .ProseMirror'])
  })
})

// 【终审 ⚠️-D1,2026-08-01 补,本轮修复最有价值的一条】上面几条(R2/R4/"3 个同名
// token")各自只逐个点名钉住了 13 个具名 token(6 个 *-soft/scrim + 4 个 --shadow-*
// + 3 个同名 --accent/--accent-soft/--success)。除这 13 个之外,任何一个颜色 token
// 从浅色块消失都**没有任何守卫**——终审 RED 探针实证:删掉浅色块
// `--line-strong: #D8D3C7;` 一整行,`knowledgeStyles` + `color-guard` 209/209
// 全绿,无人报红。真机后果:浅色主题下 `.k2-root-add` 的虚线边框会取到暗色块的
// `#3A3A3D`——本档已经因为同一款故障(浅色块漏声明)吃过一次 Critical
// (T4:--accent/--accent-soft/--success 三个)。
//
// 判据(头注释「隐藏坑」段已经证明过的前提):暗色块 `.knowledge-app { … }` 选择器
// 无条件命中,浅色主题下同样作用于这个元素本身,custom property 继承规则是
// "元素自身有声明时自身声明胜出"——所以暗色块声明的每一个**颜色** token,浅色块
// 都必须也显式声明(值可以不同,只要求"有声明",值是否正确由上面 R2/R4/3-同名
// 那几条各自的精确值断言负责,两层不重复)。
//
// 例外(两档共享、只在暗色/基础块声明一次,不要求浅色块重复声明)登记如下,
// 每条都写明理由——这份清单不许当垃圾桶塞,新增例外必须像下面这样逐条写理由:
const SHARED_STRUCTURAL_EXCEPTIONS = [
  // 9 个真结构量 —— 圆角半径与字体栈,不带任何色度/色相/明度信息,不是"颜色 token"。
  // 附录 B 原文就把这 9 个归类为"结构量,两档共享,只写基础块"。
  '--r-xs', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-2xl', '--r-pill',
  '--font-sans', '--font-mono',
  // 2 个品牌渐变色 —— --grad-iri/--grad-iri-soft 是彩虹品牌识别渐变,与皮肤无关。
  // 回源核实:AI tokens.scss 自己也只在 :119-120 声明一次(暗色块 :250 起不重定义),
  // `.agent-app` 两档共用同一份 —— 与本档做法一致,属 `theme.css` 例外清单第 1 类
  // (品牌识别色、皮肤无关的例外),不是漏声明。
  '--grad-iri', '--grad-iri-soft',
]

describe('knowledge.scss —— 浅色档颜色 token 覆盖完整性(终审 ⚠️-D1,集合断言)', () => {
  function declaredTokenNames(body: string): Set<string> {
    return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  }

  it('暗色块声明的每一个颜色 token,浅色块必须也声明(白名单外漏一个就精确指名)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const darkTokens = declaredTokenNames(darkBody)
    const lightTokens = declaredTokenNames(lightBody)
    const missing = [...darkTokens].filter(
      (t) => !SHARED_STRUCTURAL_EXCEPTIONS.includes(t) && !lightTokens.has(t),
    )
    expect(missing, `浅色档漏声明的颜色 token(白名单外):${missing.join(', ')}`).toEqual([])
  })

  it('例外清单当前恰好是这 11 个,不多不少(防止清单被悄悄扩大当垃圾桶)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const darkTokens = declaredTokenNames(darkBody)
    const lightTokens = declaredTokenNames(lightBody)
    // 「暗有浅无」的真实差集必须恰好等于登记的例外清单——多出来的说明例外清单漏登记
    // 了新的真实缺口(应该报红修 scss,不是往清单里加一条了事);少了/清单里有的其实
    // 浅色档也声明了,说明清单该收紧。
    const actualOnlyDark = [...darkTokens].filter((t) => !lightTokens.has(t)).sort()
    expect(actualOnlyDark).toEqual([...SHARED_STRUCTURAL_EXCEPTIONS].sort())
  })
})

// 【评审 2026-08-01 Important I-3】色扫/白名单/R2/R4 等断言都只检查"有没有裸色字面量"/
// "类名是否存在",完全没检查过 var(--x) 引用的 --x 是否真的有地方声明 —— 评审 RED
// 探针实证:把 .k2-prog-pct 的 var(--ly-vec) 换成 var(--k2-nonexistent),三门 + 本档
// 全部断言 10/10 全绿放行(sass 不解析自定义属性引用,vue-tsc/build 更不会管)。真机
// 上这类引用会落成 CSS 规范定义的 guaranteed-invalid value —— 对应的 background/color
// 直接变透明(或继承),页面"少了一块颜色"却没有任何编译期报错。本档已经因为同款
// 故障吃过一次亏(R2 那批 *-soft token 只在 tokens.scss 的 .agent-app/.ai-toast-scope
// 声明、.knowledge-app 解析不到,见文件头 R2 注释),证明这不是假想风险。
//
// 覆盖范围:knowledge.scss 全文所有 var(--x[, fallback]) 引用,--x 必须能在
// ①本档任意位置声明过(含两个 token 声明块 + 规则内局部声明,如 .k2-layer 的
// --ly/--ly-soft/--ly-ln)或 ②全局 src/styles/theme.css 里声明过,两处都没有才报红。
// 例外:带 fallback 的引用(如 .k2-glue-id i 的 var(--g, var(--text-quaternary)))是
// **有意由消费方(模板 inline style)注入**的 token,不强制要求本档/全局声明——但
// fallback 本身(--text-quaternary)仍然要走正常的可解析性检查(matchAll 抓的是每一个
// 独立的 var( 调用,fallback 里嵌套的 var() 是单独一次匹配,不受外层豁免影响)。
describe('knowledge.scss —— var() 引用闭环(评审 Important I-3)', () => {
  const theme = read('../../styles/theme.css')

  function declaredTokens(text: string): Set<string> {
    return new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  }

  it('全文所有 var(--x) 引用都能在本档或全局 theme.css 里找到声明(--g 这类 inline 注入例外见下条)', () => {
    const declaredHere = declaredTokens(css)
    const declaredGlobal = declaredTokens(theme)
    const used = new Set(
      [...css.matchAll(/var\((--[a-z0-9-]+)(\s*,)?/g)]
        .filter((m) => !m[2]) // 带 fallback 的引用豁免(--g,见头注释)
        .map((m) => m[1]),
    )
    const unresolved = [...used].filter((t) => !declaredHere.has(t) && !declaredGlobal.has(t))
    expect(unresolved, `引用了未声明的 token(真机会渲染成透明):${unresolved.join(', ')}`).toEqual([])
  })

  it('--g 是本档唯一登记的"消费方 inline 注入"例外(.k2-glue-id i,理由见头注释)', () => {
    expect(css).toContain('var(--g, var(--text-quaternary))')
  })
})

// 【评审 2026-08-01 Minor M-2】白名单只查类是否存在,不查 [data-layer] 三色是否齐全——
// RED 探针:删掉 `.k2-layer[data-layer="vec"]` 一整条,10/10 仍然全绿。brief 自己预警过
// "漏一个 = 可见回归,单测只查属性值不查颜色"。这条钉住 wiki/vec/note 三色在
// k2-layer 与 k2-ob-layer 上都齐(两个宿主 × 三色 = 6 条,缺哪个就精确指名哪个)。
describe('knowledge.scss —— [data-layer] 三色完整性(评审 Minor M-2)', () => {
  it('k2-layer 与 k2-ob-layer 的 [data-layer=wiki/vec/note] 三色缺一不可', () => {
    const hosts = ['k2-layer', 'k2-ob-layer']
    const layers = ['wiki', 'vec', 'note']
    const missing: string[] = []
    for (const host of hosts) {
      for (const layer of layers) {
        const re = new RegExp(`\\.${host}\\[data-layer="${layer}"\\]`)
        if (!re.test(css)) missing.push(`${host}[data-layer="${layer}"]`)
      }
    }
    expect(missing, `缺失的 data-layer 组合:${missing.join(', ')}`).toEqual([])
  })
})

// 【评审 2026-08-01 Minor M-3】删掉 @keyframes 后 `animation: X` 引用还在,动画静默失效
// (spinner 不转/闪烁不亮),没人报红。这条钉住:凡文件里出现过 `animation: X` 的引用,
// 同档必须能找到对应 `@keyframes X`(反过来:声明了但没人用的 keyframes 不报红,只是
// "冗余",不是缺陷 —— 本档 T4 的 7 个 keyframes 里只有 k-shimmer/k-pulse 被用到,
// 其余是给后续批次预留的,同样不该报红)。
describe('knowledge.scss —— animation 引用与 @keyframes 声明一一对应(评审 Minor M-3)', () => {
  // 【P5b-T6 · N11】唯一登记的例外:`fade-in`。
  // 蓝本 knowledge.scss:1941 的 `.k-file-detail { animation: fade-in 160ms ease }` 引用了
  // 一个**蓝本自己都没有定义**的 keyframes —— 蓝本全档的 @keyframes 只有 `k-fade-in`
  // (T0 已核蓝本 @keyframes 全表:
  //  :1511/1515/1519/1523/1527/1531/1535/1541/1542/1844/2440/2441,没有裸 `fade-in`)。
  // animation-name 悬空 ⇒ 这条淡入在 Vue2 里**从来没播过**。
  // 治理文件 §3.5 N11 明文判为"照抄条":改成 `k-fade-in` 会凭空多出一个 Vue2 没有的
  // 淡入动画 = 界面不 1:1(本期纪律:Vue2 的 bug 不照抄,但"悬空 animation-name /
  // 未定义类 / 永不命中的选择器"这类**不影响正确性、只影响像素**的东西必须照抄)。
  //
  // 🔴 登记方式刻意做成"点名豁免一个名字",不是把整条守卫关掉:
  //   ① 下面的过滤器只跳过 `fade-in` 这一个字符串,任何**别的**悬空引用照样报红;
  //   ② 第二条用例反过来钉住"这个例外必须真的存在"——`.k-file-detail` 里必须**确实**
  //      写着 `animation: fade-in`,而且不能是 `k-fade-in`。要是哪天有人"顺手改对"了,
  //      这条会报红提醒他这是 N11 的照抄条;要是有人把 `fade-in` 从清单里删了却没改
  //      scss,第一条会报红。两条互为对角,谁也绕不过去。
  //   ③ 反向确认(T6 RED 探针 4 已实证):`k-fade-in` 是真实存在且被 `.k-modal-bg`
  //      引用的 keyframes,它**不在**豁免清单里 —— 删掉 `@keyframes k-fade-in` 定义,
  //      第一条用例仍然精确报红。证明豁免的是"fade-in 这一个名字",不是整条守卫。
  const DANGLING_ANIMATION_EXCEPTIONS = ['fade-in']

  it('每一个 animation: X 引用都有对应的 @keyframes X(N11 的 fade-in 是唯一登记例外)', () => {
    const used = new Set(
      [...css.matchAll(/animation(?:-name)?:\s*([a-zA-Z0-9_-]+)/g)].map((m) => m[1]),
    )
    const declared = new Set(
      [...css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((m) => m[1]),
    )
    const missing = [...used].filter(
      (name) => !declared.has(name) && !DANGLING_ANIMATION_EXCEPTIONS.includes(name),
    )
    expect(missing, `引用了但未声明的 @keyframes:${missing.join(', ')}`).toEqual([])
  })

  it('N11 —— .k-file-detail 的悬空 animation 照抄蓝本 :1941 的 fade-in,没有被"顺手改成" k-fade-in', () => {
    // 取 .k-file-detail 规则块的块体(从选择器到第一个 `}`),只在块内断言,
    // 避免被文件别处的 `animation: k-fade-in`(.k-modal-bg)撞对。
    const at = css.search(/\.k-file-detail\s*\{/)
    expect(at, '找不到 .k-file-detail 规则块').toBeGreaterThan(-1)
    const body = css.slice(at, css.indexOf('}', at))
    expect(body, 'N11 被违反:.k-file-detail 的 animation-name 被改动了').toContain('animation: fade-in 160ms ease')
    expect(body, 'N11 被违反:.k-file-detail 被"顺手改对"成 k-fade-in,会凭空多出 Vue2 没有的淡入').not.toContain('k-fade-in')
    // 例外清单恰好只有这一条(同上面几处"清单不许当垃圾桶"的口径)
    expect(DANGLING_ANIMATION_EXCEPTIONS).toEqual(['fade-in'])
  })
})

// 【评审 Important 开放发现 2,2026-08-01 补】把 `KnowledgeLayout.vue:41` 的
// `import '../../styles/knowledge.scss'` 注释掉 → 全量全绿,无人报红 —— 这是本批
// 最严重的一类故障(整个知识库区裸奔,视觉上一无所有),之前没有任何自动化守卫。
// 上面 38 个类的存在性/色字面量等断言全部只读 `knowledge.scss` 这份源文件本身,
// 完全不关心它有没有被任何生产代码 import——文件内容再正确,没人 import 它就是
// 死代码,产物里一行 CSS 都不会有(这正是 R8 那条 Critical 的直接后果:C1 之前
// KnowledgeDeferred.vue 没 import 它、KnowledgeLayout.vue 写了但父路由没接上它、
// dist 里搜不到 `knowledge-app`)。
//
// 复用本档已有的 node:fs 技法(不用 Vite `?raw` —— 同头注释③,CSSEnablerPlugin
// 会把 .vue SFC 里 <style> 块之外的部分保留,但这里我们直接读 .vue 源文件的原始
// 文本找 import 语句字面量,不经过任何编译管线,不受 CSSEnablerPlugin 影响,所以
// 用 `?raw` 或 node:fs 读 .vue 都可以——为了手法统一,同样用 node:fs)。
//
// 【自己做 RED 探针时抓到的真实 bug,已修正】第一版用 `content.includes(needle)`
// 裸子串匹配——把生产文件里的 `import '../../styles/knowledge.scss'` 注释掉
// (`// import '../../styles/knowledge.scss'`)之后再跑,这条守卫**仍然通过**:
// 注释掉的那一行文本里子串 `styles/knowledge.scss` 原封不动还在,子串匹配根本
// 分不清「真的 import」与「写在注释里的同一段文字」。这正是 P3b 教训 4 那类
// 「子串检查抓不住真实缺陷」的同款坑,只是这次是我自己的探针把自己的守卫抓出来
// 的。改成逐行检查:只有「整行去空白后以 `import` 开头、且包含 needle」才算数,
// 注释行(以 `//` 开头)自然不满足「以 import 开头」这个前提,不会被误判。
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

describe('knowledge.scss —— 必须被至少一个生产 .vue 文件 import(评审 Important 开放发现 2)', () => {
  it('src/ai 下有 .vue 文件 import 了 knowledge.scss,否则样式表编译不出任何 CSS、整个知识库区裸奔', () => {
    const aiDir = resolve(__dirname, '..')
    const importers = findVueFilesImporting(aiDir, 'styles/knowledge.scss')
    expect(
      importers.length,
      '没有任何 .vue 文件 import knowledge.scss —— 见 R8:这曾经是真实发生过的情况' +
        '(KnowledgeDeferred.vue 不 import、父路由不接 KnowledgeLayout.vue,dist 里搜不到 knowledge-app)',
    ).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SP8-P5c Task 8 —— 🔴 **守卫缺口③′(P5b 交接项 #4)的统一堵法**(治理 §9 缺口表)。
//
// 【缺口③ 是什么】`color-guard.test.ts:44-56` 的 `styleLines()` 对 `.vue` 只取 `<style>`
//   块 → **模板里的 `style=` / `:style=` / `color=` 属性零扫描**。P5a/P5b 的补法是「每个新
//   `.vue` 在自己的 `*.test.ts` 里补一条定向断言」。
//
// 【缺口③′ 是什么】那条定向断言的现有写法是
//       /<template>([\s\S]*?)\n<\/template>/
//   —— **非贪婪** + 靠「`</template>` 恰好在第 0 列」这个**隐式锚定**。今天五个文件
//   (`QueueView` / `IndexedFilesView` / `FolderBrowser` / `ParserStatus` / `ParserTest`)
//   碰巧都成立(嵌套的闭合标签都是缩进的),所以**现在是对的**;但换个 formatter、
//   或者有人手改缩进把某个嵌套 `</template>` 顶到第 0 列,正则就会**提前截断** →
//   静默少扫一大段模板,而三门全绿。实测嵌套 `</template>` 数量:`QueueView` **12** 个、
//   `IndexedFilesView` **7** 个(治理 §9 缺口表写的「7/12」把两个文件对调了,数字本身对)。
//
// 【本刀的堵法(协调者指定:统一改掉,别再复制)】
//   ① 抽取改成**贪婪** —— 取**最后一个**第 0 列 `</template>`(`lastIndexOf('\n</template>')`),
//      而不是第一个;
//   ② 加**覆盖度自检** —— 断言抽出的片段包含「模板最后一行」的特征串。特征串由**从文件
//      末尾往前扫行**得出(与抽取用的 `lastIndexOf` 是两条独立代码路径),所以一旦有人把
//      抽取换回非贪婪写法、被第一个嵌套 `</template>` 截断,这条自检立刻报红;
//   ③ **集中在本文件**扫 `src/ai/knowledge/**/*.vue` 全部文件,不再每个视图复制一份。
//      五个既有文件里那份脆弱写法仍在(它们与它们的测试都在治理 §1.1 的全期零改动清单里,
//      为一条守卫去碰 P5b/T6/T7 的收官产物不值)——**本文件这条是它们的上位守卫**:
//      即使那五条被截断得一点判别力都不剩,本条仍然扫全模板。
//      🔴 **本刀之后新加的视图一律靠本条**(`SettingsView.test.ts` 就没有复制那个正则,
//      它改用「零 `<style>` 块 → 全文件扫描」这个更严的等价写法)。
//   ④ 文件清单做**集合相等**防漂移:新增视图必须显式进清单(与本档「白名单/例外清单
//      不许当垃圾桶」的既定口径一致)。
//
// RED 探针(T8 报告 §7 贴完整输出):对**每一个**被扫文件,在其模板**最后一行**塞一个裸色
//   → 本条必须精确指名那个文件报红;另有一条「把某个嵌套 `</template>` 顶到第 0 列 + 在它
//   之后塞裸色」的探针,专门证明「贪婪 vs 非贪婪」这次改动本身有判别力(非贪婪写法在那种
//   输入下全绿放行)。探针后 md5 逐字节还原、`git status` 干净(治理 §1.3)。
const KNOWLEDGE_VUE_FILES = [
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
  // SP8-P5f Task 6 —— 新建 `views/WikiView.vue`(上半;T7 续写下半,**不重复登记**)。
  // 不登记会打红上面那条「文件清单集合相等」防漂移断言 —— 那是正确行为(§9.10)。
  'views/WikiView.vue',
]

/** 递归列出目录下所有 `.vue`,返回相对 `src/ai/knowledge/` 的 POSIX 风格路径。 */
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
 * 🔴 **贪婪**抽取根 `<template>` 块:取最后一个第 0 列 `</template>`。
 * 返回三样东西,后两样专供覆盖度自检,且**都由「从文件末尾往前扫行」得出**,
 * 与抽取用的 `lastIndexOf` 是两条独立代码路径:
 *   - `tmpl`     抽出的模板正文
 *   - `byLine`   同一段正文的**逐行独立推导**(开/闭标签行都靠行内容判定)
 *   - `tail`     模板**最后 3 个非空行**的原文(含缩进),当特征串
 *
 * ⚠️ **为什么特征串不能只取「最后一行 trim 后的文本」**(第一版就是这么写的,探针 B 当场
 * 抓出它没判别力):模板最后一行几乎总是 `</div>` 这种通用闭合标签,truncate 之后的片段
 * 里到处都是它 → `toContain` 恒真。改成「最后 3 行含缩进的原文 + `endsWith` 定位」,
 * 再加一条「两条推导逐字相等」,才真的堵住「被第一个嵌套 `</template>` 提前截断」。
 */
function extractTemplate(src: string): { tmpl: string; byLine: string; tail: string } {
  const OPEN = '<template>\n'
  const CLOSE = '\n</template>'
  const EMPTY = { tmpl: '', byLine: '', tail: '' }
  const openAt = src.indexOf(OPEN)
  const closeAt = src.lastIndexOf(CLOSE)
  if (openAt < 0 || closeAt <= openAt) return EMPTY
  const tmpl = src.slice(openAt + OPEN.length, closeAt)

  // ── 独立推导:逐行扫 ──
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
  // `tail` 取**原始最后 3 行**(含缩进、含可能的空行)→ 天然是连续片段,
  // 抽取正确时 `tmpl.endsWith(tail)` 必真;被提前截断时必假。
  return { tmpl, byLine: body.join('\n'), tail: body.slice(-3).join('\n') }
}

/** 逐字符扫描配对括号,整段剥掉 `var(...)` / `color-mix(...)`(同 color-guard 的 stripVar 手法)。 */
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
// SP8-P5d Task 5 —— 票 3(治理 §15.3 / §9.6):守卫缺口③′ 补两条判别力。
//
// 【票 3a:具名色扫描】`color-guard.test.ts` 与本文件的既有 ③′ 断言都只认
// `#hex` / `rgb()`/`hsl()`,CSS 具名色(`color: white` 这种)全程零覆盖。
// 🔴 朴素的「全文找 white 这个词」会冤枉 `white-space: nowrap`(QueueView.vue:474
// 就有一处)—— 必须钉在「属性值位置」:只在 `color:` / `background:` /
// `background-color:` / `border-color:` / `border:` / `box-shadow:` / `fill:` /
// `stroke:` 的**值**部分里找整词具名色。`white-space` 的属性名本身就进不了这张
// 名单(它不是上面任何一个字符串,`\s*:` 也不会跟在 `white-space` 后面因为中间
// 隔着连字符不影响——重点是名单里没有 `white-space` 这个键),因此“钉属性值位置”
// 这一招天然把 `white-space: nowrap` 排除在外,不需要再对值本身做连字符特判。
//
// 【票 3b:覆盖范围】既有 ③′ 只扫 `src/ai/knowledge/**`,`src/ai/components/**`
// (P2a/P2b 产出,Agent 区的卡片/侧栏/设置子组件)的模板 `style=`/`:style=` 是盲区。
// 协调者已用独立脚本对全部 70 个文件做过一次性程序化 dry-run(见任务报告 §7):
// hex / rgb / hsl / 具名色在属性值位置上**零命中**——扩大范围不会带出既有违规,
// 因此本刀直接把同款断言铺到这个目录,不触发 NEEDS_CONTEXT。
// ═══════════════════════════════════════════════════════════════════════════

/** 只在这些 CSS 属性的值部分里找具名色;长名排在短名前面,避免
 *  `background-color`/`border-color` 被 `background`/`border`/`color` 抢先切碎
 *  (正则引擎按数组书写顺序尝试各分支,书写顺序即優先级)。*/
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
// 与 §5(本文件既有的具名色清单,`:510-517`)保持同一份 8 词清单,口径一致。
const NAMED_COLORS = ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']

/**
 * 在「属性值位置」找具名色。先用 `prop\s*:\s*([^;]+)` 抓出每一段 `属性: 值`
 * (输入应先经 `stripColorCalls` 剥掉 `var(...)`/`color-mix(...)`,token 名字
 * 本身不会被当成色值误判),再对值部分做整词匹配(`(?<![\w-])COLOR(?![\w-])`,
 * 同 `:510-517` 的写法,排除 `whitesmoke` 这类以该词为前缀的复合词)。
 * `white-space: nowrap` 这类行天生不会被抓到——它的属性名 `white-space` 根本
 * 不在 `COLOR_VALUE_PROPS` 名单里,正则连切都不会去切它。
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

describe('守卫缺口③′ —— 知识库区每个 .vue 的 <template> 块零裸色(贪婪抽取 + 覆盖度自检)', () => {
  const kbDir = resolve(__dirname, '../knowledge')

  it('文件清单集合相等(防漂移:新增视图必须显式进清单,否则本条报红)', () => {
    expect(listVueFiles(kbDir)).toEqual([...KNOWLEDGE_VUE_FILES].sort())
  })

  it.each(KNOWLEDGE_VUE_FILES)('%s —— 贪婪抽取成功 + 覆盖度自检(片段一直延伸到模板最后一行)', (rel) => {
    const src: string = readFileSync(resolve(kbDir, rel), 'utf8')
    const { tmpl, byLine, tail } = extractTemplate(src)
    expect(tmpl, `${rel}:根 <template> 块没抽出来(第 0 列的 <template>/</template> 缺一个?)`).not.toBe('')
    expect(tail, `${rel}:找不到模板尾部特征串`).not.toBe('')
    // 🔴 覆盖度自检 ①:片段必须**以模板最后 3 行原文收尾**。非贪婪写法会在第一个嵌套
    //    `</template>` 处截断 → 尾部特征串不在片段末尾 → 报红。
    expect(
      tmpl.endsWith(tail),
      `${rel}:抽出的模板片段没延伸到最后一行(尾部特征串:\n${tail}\n)—— 被提前截断了`,
    ).toBe(true)
    // 🔴 覆盖度自检 ②:两条**独立推导**(字符串 lastIndexOf vs 逐行从末尾扫)必须逐字相等。
    //    这条与文本内容无关,是最硬的一层:只要抽取边界错一行就报红。
    expect(tmpl, `${rel}:字符串抽取与逐行推导不一致 —— 抽取边界错了`).toBe(byLine)
  })

  it.each(KNOWLEDGE_VUE_FILES)('%s —— 模板内(剥离 var()/color-mix() 后)零 hex / rgb / hsl 字面量', (rel) => {
    const src: string = readFileSync(resolve(kbDir, rel), 'utf8')
    const { tmpl } = extractTemplate(src)
    const scrubbed = stripColorCalls(tmpl)
    expect(scrubbed, `${rel}:模板里有裸 hex 色`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed, `${rel}:模板里有 rgb()/hsl() 函数色`).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })

  // SP8-P5d Task 5 · 票 3a:属性值位置的具名色扫描(新增)。
  it.each(KNOWLEDGE_VUE_FILES)('%s —— 模板内属性值位置(color/background/border/box-shadow/fill/stroke)零具名色', (rel) => {
    const src: string = readFileSync(resolve(kbDir, rel), 'utf8')
    const { tmpl } = extractTemplate(src)
    const scrubbed = stripColorCalls(tmpl)
    const offenders = namedColorOffensesInValues(scrubbed)
    expect(offenders, `${rel}:模板里在属性值位置发现具名色:\n${offenders.join('\n')}`).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SP8-P5d Task 7 · 修复轮 1(裁定 R17,票据 E-47)—— §0.3「注释里也不许出现
// 色字面量」在「.vue 的 <script> 块注释」这个位置此前零守卫:
// `color-guard.test.ts` 只扫 `.vue`/`.css` 的 `<style>`/属性形态,缺口③′ 只扫
// `<template>` 文本,T5 的具名色扫描钉在 `<template>` 的属性值位置 —— 三条都不看
// `<script>` 块的注释。评审在 `NoteEditPane.vue`(T7)与 `NotesView.vue`(T6)里
// 各逮到一处「申报注释里写了 rgba(...) 字面量」的真违规(已修,见两文件头注释)。
// 🔴 范围钉死在既有 `KNOWLEDGE_VUE_FILES` 清单(与本文件其它守卫同一份文件表),
// **不扩到全仓** —— 扩范围可能扫出别期产出的既有违规,那是 NEEDS_CONTEXT,不是
// 本刀该修的(T5 已有此教训)。`transparent` 是关键字,不算色字面量,不扫它。
describe('§0.3 —— .vue 的 <script> 块注释零色字面量(R17,票据 E-47,范围钉死 KNOWLEDGE_VUE_FILES)', () => {
  /** 抽取一个 .vue 源文件里全部 `<script ...>...</script>` 块的原始内容
   * (一个 SFC 可能同时有 `<script>` 与 `<script setup>` 两块,都要扫)。 */
  function extractScriptBlocks(src: string): string[] {
    const blocks: string[] = []
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) blocks.push(m[1])
    return blocks
  }

  /** 从一段脚本源码里抽出全部注释文本(块注释 + 行注释)。§0.3 只管注释,不管
   * 代码本体(代码本体的颜色治理由 color-guard.test.ts 等既有守卫管)。 */
  function extractScriptComments(code: string): string {
    const blockComments = code.match(/\/\*[\s\S]*?\*\//g) || []
    const lineComments = code.match(/\/\/.*$/gm) || []
    return [...blockComments, ...lineComments].join('\n')
  }

  const kbDir2 = resolve(__dirname, '../knowledge')

  it.each(KNOWLEDGE_VUE_FILES)('%s —— <script> 块注释里零 hex / rgb() / hsl() 色字面量', (rel) => {
    const src: string = readFileSync(resolve(kbDir2, rel), 'utf8')
    const comments = extractScriptBlocks(src).map(extractScriptComments).join('\n')
    expect(comments, `${rel}:<script> 块注释里发现裸 hex 色字面量`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(comments, `${rel}:<script> 块注释里发现 rgb()/hsl() 色字面量`).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })

  // RED + 反向探针见任务报告「修复轮 1」一节(①在清单内文件的 <script> 注释里
  // 注入色字面量必须报红;②一条只引 file:line + 附录 B 行号、不含色值的正常
  // 申报注释必须不报红)。探针注入/还原走 cp + md5 逐字节比对,禁 git checkout。
})

// SP8-P5d Task 5 · 票 3b:同款扫描扩到 `src/ai/components/**`(P2a/P2b 产出,
// Agent 区的卡片/侧栏/设置子组件)。既有 ③′ 只覆盖 `src/ai/knowledge/**`,
// 那个目录的模板 `style=`/`:style=` 是盲区。文件清单同样做集合相等防漂移。
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
  'settings/mcp/McpServerDetail.vue',
  'settings/mcp/McpServerGroup.vue',
  'settings/mcp/McpServerModal.vue',
  'settings/SectionPlaceholder.vue',
  'settings/sections/BlacklistSection.vue',
  'settings/sections/ChannelsSection.vue',
  'settings/sections/ExecutionSection.vue',
  'settings/sections/McpSection.vue',
  'settings/sections/McpTokensSection.vue',
  'settings/sections/MemorySection.vue',
  'settings/sections/ModelsSection.vue',
  'settings/sections/ObservabilitySection.vue',
  'settings/sections/PrivacySection.vue',
  'settings/sections/ProvidersSection.vue',
  'settings/sections/SearchSection.vue',
  'settings/sections/SkillsSection.vue',
  'settings/sections/ThinkingDefaultsSection.vue',
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

describe('守卫缺口③′ 扩展(票 3b)—— src/ai/components/** 同款模板裸色扫描', () => {
  const compDir = resolve(__dirname, '../components')

  it('文件清单集合相等(防漂移:新增组件必须显式进清单,否则本条报红)', () => {
    expect(listVueFiles(compDir)).toEqual([...COMPONENTS_VUE_FILES].sort())
  })

  it.each(COMPONENTS_VUE_FILES)('%s —— 贪婪抽取成功 + 覆盖度自检(片段一直延伸到模板最后一行)', (rel) => {
    const src: string = readFileSync(resolve(compDir, rel), 'utf8')
    const { tmpl, byLine, tail } = extractTemplate(src)
    expect(tmpl, `${rel}:根 <template> 块没抽出来(第 0 列的 <template>/</template> 缺一个?)`).not.toBe('')
    expect(tail, `${rel}:找不到模板尾部特征串`).not.toBe('')
    expect(
      tmpl.endsWith(tail),
      `${rel}:抽出的模板片段没延伸到最后一行(尾部特征串:\n${tail}\n)—— 被提前截断了`,
    ).toBe(true)
    expect(tmpl, `${rel}:字符串抽取与逐行推导不一致 —— 抽取边界错了`).toBe(byLine)
  })

  it.each(COMPONENTS_VUE_FILES)('%s —— 模板内(剥离 var()/color-mix() 后)零 hex / rgb / hsl 字面量', (rel) => {
    const src: string = readFileSync(resolve(compDir, rel), 'utf8')
    const { tmpl } = extractTemplate(src)
    const scrubbed = stripColorCalls(tmpl)
    expect(scrubbed, `${rel}:模板里有裸 hex 色`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed, `${rel}:模板里有 rgb()/hsl() 函数色`).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })

  it.each(COMPONENTS_VUE_FILES)('%s —— 模板内属性值位置(color/background/border/box-shadow/fill/stroke)零具名色', (rel) => {
    const src: string = readFileSync(resolve(compDir, rel), 'utf8')
    const { tmpl } = extractTemplate(src)
    const scrubbed = stripColorCalls(tmpl)
    const offenders = namedColorOffensesInValues(scrubbed)
    expect(offenders, `${rel}:模板里在属性值位置发现具名色:\n${offenders.join('\n')}`).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【P5e-T8 新增,裁定 R23】补 T4 评审 Important-1「祖先链结论零自动化守卫」的缺口。
//
// 事实(T4 评审自加探针实证,见 p5e-task-4-review.md §3-B / 裁定 R23):给
// `.knowledge-app` 加一行 `transform: translateZ(0)` → 全量 4134/4134 仍绿。
// K46 的全部立论(`.k-fileviewer-host` 的 `position: fixed; inset: 0` 能铺满
// 视口,前提是 `.knowledge-app` 及其向上到 <html> 的整条真实 DOM 祖先链都不产生
// 新的 containing block —— 见 `src/files/viewers/ViewerShell.vue:24` 的
// `position: absolute; inset: 0; z-index: 200`,它需要一个铺满视口的定位祖先)
// 目前只靠 T4 的一次性人工实测报告担保,没有自动化回归防线。将来任何一次给
// `.knowledge-app`/`.k-main`/`body`/`html` 加 transform/filter/will-change 之类
// 做过渡动画/性能优化(即便本身正当),都会在真机上悄悄让 in-app 预览器塌陷
// (相对该祖先定位而非铺满视口)—— 而预览器不报错,只错位/不铺满视口,单测、
// sass 门、color-guard 三道全都抓不到。
//
// 本仓可控的真实祖先链(T4 报告 §4 逐段实测,本条断言据此钉住)=
// router-view → .k-main → .knowledge-app → KnowledgeLayout 根(该组件零
// <style>,只在 <script setup> 里 JS 侧 import knowledge.scss)→ App.vue(零
// <style>)→ #app(全仓无此选择器的样式规则)→ body → html。链上真正有 CSS
// declaration 落点的只有两处:knowledge.scss 的 `.knowledge-app`/`.k-main`
// 自身声明,以及 theme.css 的 `body`/`html` 自身声明。
//
// 🔴 必须排除伪元素:`body::before`(theme.css:335)/ `body::after`
// (theme.css:352)各自声明了 transform/filter,这是合法且无害的 —— 伪元素是
// 生成内容子节点,与 `#app` 是兄弟关系而非祖先关系(T4 评审已独立坐实这条 CSS
// 规范推理:containing block 降级只作用于该属性所应用到的那个盒子本身,
// `body::before`/`::after` 的 transform/filter 只影响它们自己的盒子,不会让
// `body` 本身变成新的 containing block)。下面用于抓 `body`/`html` 规则的正则
// 要求选择器结尾紧跟 `{`(`body::before {` 中间夹了 `::before`,不会被这条规则
// 捕获),天然只抓 body/html 元素自身的规则,不会误伤伪元素。
describe('祖先链守卫(R23)—— .knowledge-app / .k-main / body / html 自身声明零 transform·filter·will-change·contain·perspective', () => {
  // 只匹配「属性名紧跟冒号」的真实声明,不匹配作为别的属性值出现的同名词
  // (例如 `transition: transform 0.45s var(--ease);` 里的 `transform` 是
  // transition 的值,不是一条 transform 声明,后面不紧跟冒号,不会被匹配);
  // 负向前瞻 `(?<![\w-])` 同时排除 `backdrop-filter:` 这类以连字符复合的属性名
  // (它不建立 transform 意义上的 containing block 关注点,且不在禁用清单里)。
  const FORBIDDEN = /(?<![\w-])(transform|filter|will-change|contain|perspective)\s*:/

  // 剥掉某个嵌套规则块里所有更深一层的嵌套选择器块,只留该选择器自身的顶层声明。
  // knowledge.scss 是 SCSS 嵌套写法,`.knowledge-app { … 大段嵌套 … }` 把几乎全部
  // 规则都嵌在里面(nestedBlockBody 会把这一整段都取出来,含 `.chev`/`.k2-layer:hover`
  // 等后代选择器自己的 transform/filter——那些只影响各自的盒子,不是 `.knowledge-app`
  // 自身的祖先链关注点,必须先剥掉才能只看「该选择器自己写了什么」)。逐层剥离
  // `{[^{}]*}`(先剥最内层、再剥外一层……)直到再也剥不出更多嵌套块为止。
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

  // 判据(裁定 R23 ②):给 `.knowledge-app` 加一行 `transform: translateZ(0);` →
  // 这条必须报红。任务报告贴了改前(绿)/改后(红)两段输出 + cp 副本 md5sum 逐字节
  // 还原确认,此处的探针改动本身不进 git(只在报告里留痕)。
  it('.knowledge-app 自身声明零 transform/filter/will-change/contain/perspective(判据:加 transform: translateZ(0) → 必须报红)', () => {
    const own = ownDeclarations(nestedBlockBody(cssKeepLines, DARK_TOKEN_SELECTOR))
    const hit = own.match(new RegExp(FORBIDDEN, 'g'))
    expect(hit, `.knowledge-app 自身出现了禁用属性:${JSON.stringify(hit)}`).toBeNull()
  })

  it('.k-main 自身声明零 transform/filter/will-change/contain/perspective', () => {
    const own = ownDeclarations(nestedBlockBody(cssKeepLines, '.k-main {'))
    const hit = own.match(new RegExp(FORBIDDEN, 'g'))
    expect(hit, `.k-main 自身出现了禁用属性:${JSON.stringify(hit)}`).toBeNull()
  })

  // theme.css 的 body/html 自身声明 —— body::before / body::after 伪元素除外
  // (见头注释:生成内容子节点,不是 #app 的祖先)。
  it('theme.css 的 body/html 自身声明零 transform/filter/will-change/contain/perspective(body::before/::after 伪元素除外)', () => {
    const themeRaw = read('../../styles/theme.css')
    const themeCss = stripComments(themeRaw)
    // 选择器紧跟 `{`(排除 `body::before {`/`body::after {` 这类伪元素,它们的
    // `{` 前面还夹着 `::before`/`::after`,不会被这条规则捕获);负向前瞻排除
    // 前面还带字母/点/井号/连字符的情形(避免误配复合类名或 id 里的同名子串)。
    const RULE = /(?<![\w.#-])(html|body)\s*\{([^{}]*)\}/g
    const blocks: string[] = []
    let m: RegExpExecArray | null
    while ((m = RULE.exec(themeCss))) blocks.push(m[2])
    expect(blocks.length, 'theme.css 里一条 body/html 规则块都没扫到 —— 选择器写法是不是变了?').toBeGreaterThan(0)
    for (const decl of blocks) {
      const hit = decl.match(new RegExp(FORBIDDEN, 'g'))
      expect(hit, `theme.css 的 body/html 规则里出现了禁用属性:${JSON.stringify(hit)}\n块内容:\n${decl}`).toBeNull()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【SP8-P5f Task 2 新增守卫】本刀搬入四段(蓝本 :985-1141 / :1342-1396 / :2453-2561
// + K60 的 :1500-1503)与 K53 的 9 个 `kr-*`。以下断言覆盖本刀四类**新增**风险:
//   ① 段边界陷阱(整段搬会带进已搬类的重复定义 —— 白名单/死类断言都抓不到);
//   ② K60(裁定 R2)那条 @media 覆盖真的在;
//   ③ K53 的「自动上膛」条件断言 + `kr-` 前缀全仓唯一(丢 scoped 无害的判据);
//   ④ K54 的两处兜底真的换成了纯 token、K55 的三个新 token 两档取值没被重算。
// 🔴 一律只**加**断言,不改任何既有断言(§9.10)。
// ═══════════════════════════════════════════════════════════════════════════

describe('knowledge.scss —— P5f-T2 段边界陷阱:已搬类不许被重复定义(裁定 R4 / 勘误 E-69)', () => {
  // 🔴 为什么这条必须存在:Allowlist A 段的正确边界是蓝本 `:985-1141`,而治理原文写的是
  // `:985-1160`。按 `:1160` 整段搬会把 `:1142` 的 `.k-set-card` 与 `:1159` 的 `.k-set-row`
  // (**P5c-T2a 已搬**)第二次带进来。**重复定义不会被白名单断言捕获**(类名本来就在
  // 白名单里),也不会被 24 死类断言捕获(它们不是死类)—— 只有这种「恰好 N 处」的
  // 计数断言会响。手法与本档 K10 守 `.k-confirm-*` 恰好 1 次完全同款。
  // 同理弹窗段边界是 `:1396` 而不是 `:1400`:`:1398` 起是 `.k-confirm-body`(P5b-T2 已搬),
  // 那一个由既有的 K10 断言守着,这里不重复。
  it.each([
    ['k-set-card', 1],
    ['k-set-row', 1],
  ])('%s 在本档恰好 %i 处规则(>1 = A 段按 :1160 整段搬,把 P5c-T2a 已搬的那份又搬了一遍)', (cls, n) => {
    const hits = css.match(new RegExp(`\\.${cls}(?![\\w-])`, 'g')) || []
    expect(hits.length, `${cls} 出现 ${hits.length} 次(应为 ${n})`).toBe(n)
  })

  // 反向覆盖度自检:本刀真的搬进来了 —— 否则上面那条「恰好 1 次」在「整段都没搬」的
  // 情况下也会绿(零判别力)。`.k-section-body` 与 `.k-priority-hint` 是 A 段的首尾两条。
  it('覆盖度自检 —— A 段首尾两条规则(.k-section-body / .k-priority-hint)确实在档内', () => {
    expect(css, 'A 段首条 .k-section-body 没搬进来').toMatch(/\.k-section-body(?![\w-])/)
    expect(css, 'A 段末条 .k-priority-hint 没搬进来').toMatch(/\.k-priority-hint(?![\w-])/)
  })
})

describe('knowledge.scss —— K60(裁定 R2):.k-frow 的窄屏 @media 覆盖(P5f-T2 新建)', () => {
  // 🔴 事实:P5b 判蓝本 `:1500-1503` 是死规则,判据原文是**条件式**的
  // (「两个模板里没有任何元素用 class="k-frow"」)。`AllowlistView`(P5f)用的正是
  // `class="k-frow"` ⇒ 前提到期,裁定 R2 批准搬入,登记为偏差 K60。
  // 不搬的后果:窄屏(≤860px)下白名单页文件夹规则表格的列宽与 Vue2 不一致 ——
  // **单测/sass 门/color-guard 三道全都抓不到**,只有这条断言。
  // 判据:删掉这条 @media 内的 `.k-frow { … }` → 本条必须报红。
  it('既有 @media (max-width: 860px) 块内含 .k-frow 的窄屏列宽覆盖(删掉 → 报红)', () => {
    // 用大括号配对切出那个 @media 块,只在块内断言(不对全文裸计数 —— 全文里
    // `.k-frow` 的**基类**规则也在,裸计数分不清两者)。
    const body = nestedBlockBody(cssKeepLines, '@media (max-width: 860px) {')
    expect(body.length, '没抓到 @media (max-width: 860px) 块 —— 零判别力').toBeGreaterThan(100)
    expect(body, '@media 块里找不到 .k-frow 覆盖(K60 没落地?)').toMatch(/\.k-frow \{/)
    expect(body, 'K60 的 grid-template-columns 被改动了(蓝本 :1501 逐字)').toContain(
      'grid-template-columns: 80px 1fr 70px 28px;',
    )
    expect(body, 'K60 的 font-size 被改动了(蓝本 :1502 逐字)').toContain('font-size: 12px;')
  })

  // 🔴 R2-① 的落地判据:只搬了那一条,**没有顺带搬** 同段的 .k-quick-grid / .k-status-strip
  // (两者仍不在白名单,且 .k-quick-grid 还是 24 个死类之一)。
  it('R2-① —— 没有顺带搬 .k-status-strip(.k-quick-grid 由 24 死类断言另行钉住)', () => {
    expect(new RegExp('\\.k-status-strip(?![\\w-])').test(css), '.k-status-strip 被顺带搬了进来').toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【P5f-T2b 新建,裁定 **R19 / R20 的 C-1**】K44 的「知识库区 `.vue` 一律零 `<style>` 块」
// 谓词从**裸子串**加固成**先剥注释 + 行首锚定**,并从「只钉 RootsView.vue 一个文件」
// 扩成 `src/ai/knowledge/**` 全体的参数化断言(一次上膛,T5/T6/T7 免每刀记账)。
//
// 🔴 **为什么必须换形态**(裁定 R19 的原文事实,不是推测):T2 用 `src.includes('<style')`
// 判「文件里有没有 style 块」,它在本仓 `src/ai/knowledge/**` 的 16 个 `.vue` 里命中 **10 个**
// —— 而这 16 个文件的 `</style>` 计数**全部是 0**,10 个命中**全是注释里
// 「零 `<style>` 块」/「蓝本 `<style scoped>`」这类**字面文字**。
// 后果已被评审实证:按同目录既定文风建一个**零 style 块**、注释里写「零 `<style>` 块」的
// `RootsView.vue`,旧谓词**误报红**,而且报的是「出现 <style> 块」⇒ T5 会去找根本不存在的
// 东西,最可能的动作是**放宽这条守卫**(正是 §9.10 最要防的)。
//
// 🔴 **加固自证(程序化,不是自我声明)**:同一批 16 个文件上
// 「裸子串命中 10 个 / 剥注释+行首锚定命中 0 个」;全仓 185 个 `.vue` 上
// 「裸子串 136 / 剥注释+行首锚定 115 / `</style>` 115」——
// 新谓词与「`</style>` 独立口径」**逐文件同解**,旧谓词多出 21 个假阳性。
// 这两组数由下面的「加固自证」与「防空转②」两条断言常驻钉住(R21:两条独立口径)。
//
// 🔴 剥注释 **和** 行首锚定**缺一不可**:只行首锚定挡不住块注释里独占一行的
// `<style scoped>` 引用;只剥注释挡不住行内引用被子串撞对。
function stripVueComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '') // HTML 注释(`<!-- … -->`,SFC 模板/文件头惯用)
    .replace(/\/\*[\s\S]*?\*\//g, '') // JS/CSS 块注释
    .replace(/^[ \t]*\/\/.*$/gm, '') // 整行 JS 行注释(同本档 stripComments 的既定口径)
}

// 真 `<style>` 块的存在式判据。两条独立口径**取或**(更敏感 = 加固):
// ① 开标签独占行首 `^\s*<style[\s>]`;② 闭标签独占行首 `^\s*</style>`。
// 🔴 **禁裸子串 `includes('<style')`**(裁定 R19)。
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

describe('K44(裁定 R19/R20 C-1)—— src/ai/knowledge/** 全体 .vue 零 <style> 块(P5f-T2b 重写)', () => {
  const KNOWLEDGE_DIR = resolve(__dirname, '../knowledge')
  const SRC_DIR = resolve(__dirname, '..', '..')
  const knowledgeVues: string[] = collectVueFiles(KNOWLEDGE_DIR).sort()
  const relKnowledge = (p: string) => p.slice(KNOWLEDGE_DIR.length + 1)

  // 🔴 防空转①(§9.14-4 / §9.19):路径基座必须是真的 —— 少了这条,目录写错/改名会让
  // 下面的 it.each 退化成**零用例静默全绿**,而 vitest 对空 it.each 不报任何错。
  it('防空转① —— knowledge 目录扫到的 .vue > 0,且 views 子目录在扫描范围内', () => {
    expect(knowledgeVues.length, 'src/ai/knowledge 下一个 .vue 都没扫到 —— 路径基座写错了?').toBeGreaterThan(0)
    expect(
      knowledgeVues.some((p: string) => p.includes('/knowledge/views/')),
      'views 子目录没被递归扫到 —— 参数化断言会漏掉 T5/T6/T7 新建的视图',
    ).toBe(true)
  })

  // 🔴 防空转②(裁定 R20 C-1 明令):**正例必须取自全仓真有 style 块的 `.vue`**,
  // 不是知识库区那 4 行注释。全仓 185 个 `.vue` 里有 115 个真有 style 块
  // (独立口径:`grep -rl '</style>' src --include=*.vue | wc -l` = 115,两条口径同解)。
  it('防空转② —— hasStyleBlock 在全仓真有 style 块的 .vue 上恒为真(正例取自 src/**,非知识库区注释)', () => {
    const allVues = collectVueFiles(SRC_DIR)
    expect(allVues.length, '全仓一个 .vue 都没扫到 —— 零判别力').toBeGreaterThan(100)
    // 独立口径:含闭标签的文件集合(与谓词的实现路径不同,R21 的「第二条口径」)
    const byClosingTag = allVues.filter((p: string) => readFileSync(p, 'utf8').includes('</style>'))
    expect(byClosingTag.length, '全仓没有任何 .vue 真有 style 块 —— 谓词可能恒假(空壳)').toBeGreaterThan(100)
    const missed = byClosingTag.filter((p: string) => !hasStyleBlock(readFileSync(p, 'utf8')))
    expect(missed, `这些文件真有 </style> 却被谓词判成「无 style 块」(谓词漏检):\n${missed.join('\n')}`).toEqual([])
    // 反向:谓词判真的,必须都真有闭标签(防谓词恒真)
    const byPredicate = allVues.filter((p: string) => hasStyleBlock(readFileSync(p, 'utf8')))
    expect(byPredicate.length, '谓词一个都没判真 —— 零判别力').toBeGreaterThan(100)
    expect(
      byPredicate.filter((p: string) => !byClosingTag.includes(p)),
      '谓词判真但没有 </style> —— 谓词可能被注释撞对(裸子串复发)',
    ).toEqual([])
  })

  // 🔴 加固自证(§9.10:「加固前 X 命中 N 个 / 加固后 1 个」必须程序化,自我声明不算证明)。
  // 同一批知识库 `.vue` 上:旧裸子串谓词命中 ≥ 4(实测 10),新谓词命中 0。
  it('加固自证 —— 同一批知识库 .vue 上,旧裸子串谓词命中 > 0 而新谓词命中 0(证明这次是加固不是放宽)', () => {
    const naiveHits = knowledgeVues.filter((p: string) => readFileSync(p, 'utf8').includes('<style'))
    const hardenedHits = knowledgeVues.filter((p: string) => hasStyleBlock(readFileSync(p, 'utf8')))
    expect(naiveHits.length, '旧裸子串谓词一个都不命中 —— 加固自证失去对照组').toBeGreaterThan(0)
    expect(
      hardenedHits.map(relKnowledge),
      '知识库区出现真 <style> 块(K44 被破) —— 或者新谓词也被注释撞对了',
    ).toEqual([])
    expect(naiveHits.length, '加固后命中数没有严格减少 —— 这次改动零可观测').toBeGreaterThan(hardenedHits.length)
  })

  // 🔴 参数化(裁定 R20 C-1:「扩成 src/ai/knowledge/** 全体,一次上膛,免每刀记账」)。
  // 清单在**测试运行时**从磁盘读 ⇒ T5 建 `RootsView.vue`、T6 建 `WikiView.vue`、
  // T7 建 `AllowlistView.vue` 的那一刻,本条自动多出一个用例,无需任何人改这里。
  // §9.19 跨刀冲突论证:K44 是全期纪律,T5/T6/T7 本来就不许写 `<style>` 块 ⇒ 不冲突。
  // ⚠️ 这里**故意不做集合相等**(那会变成「每刀记账」,正是 R20 要免掉的)。
  it.each(knowledgeVues.map((p: string) => [relKnowledge(p), p] as [string, string]))(
    'K44 —— %s 零 <style> 块(剥注释 + 行首锚定;注释里写「零 <style> 块」必须仍绿)',
    (_rel: string, full: string) => {
      const src: string = readFileSync(full, 'utf8')
      expect(src.length, `${_rel} 读出来是空的 —— node:fs 读法失效了`).toBeGreaterThan(0)
      expect(
        hasStyleBlock(src),
        `${_rel} 出现真 <style> 块 —— K44 要求整块搬进 src/ai/styles/knowledge.scss,.vue 侧零 <style>`,
      ).toBe(false)
    },
  )
})

describe('knowledge.scss —— K53:RootsView 的 kr-* 已整块搬入 + .vue 侧零 <style>(P5f-T2 新建)', () => {
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

  // 🔴 防空转①(治理 §9.14-4 / §9.19):路径基座必须是真的。少了这条,
  // 「RootsView.vue 还不存在」那一支会退化成「什么都没测」,而且路径写错
  // (少一层 `..`、目录改名)永远发现不了 —— 那正是「守卫是空壳」的典型形态。
  it('防空转 —— views 目录存在且已有 .vue 文件(否则「文件不存在」这个分支毫无意义)', () => {
    const vues = readdirSync(VIEWS_DIR).filter((f: string) => f.endsWith('.vue'))
    expect(vues.length, 'views 目录里一个 .vue 都没有 —— 路径基座写错了?').toBeGreaterThan(0)
  })

  // 🔴 防空转②:同一个「node:fs 读文件 → 判有没有 style 块」的谓词必须**真的有判别力**。
  //   (a) 每个既有视图都能读到**非空**内容 —— 直接堵死「读到空串 ⇒ 恒判无 ⇒ 恒绿」
  //       这条空壳路径(Vite `?raw` 在 vitest 下恒空那个铁律要防的正是它);
  //   (b) 谓词在**真有 style 块的文件**上必须判真 —— 正例见上方新 describe 的「防空转②」
  //       (取自全仓 115 个真有 style 块的 `.vue`)。
  //
  // 🔴🔴 **P5f-T2b 订正(裁定 R19,承「反转不删」)**:本条原文写的是
  // 「至少一个既有视图**含** `<style`、至少一个不含」,谓词用的是裸子串 `src.includes('<style')`。
  // **那个『正例』完全由 4 行注释文字撑着** —— `KnowledgeDeferred` / `KnowledgeLayout` /
  // `SearchView` / `SettingsView` 的 `</style>` 计数**全部是 0**,命中的是注释里
  // 「零 `<style>` 块」这句话本身。⇒ 它证明的不是谓词有判别力,而是注释里有那个词;
  // 而且任何人改一下那 4 行注释的措辞,本条会**无故报红**。
  // 现在:谓词换成 `hasStyleBlock()`(先剥注释 + 行首锚定),正例移到上方 describe
  // 用全仓真样本做;本条只保留「读得到非空内容」这一半 + 「全区判假」。
  it('防空转 —— 同目录既有视图能读到非空内容,且新谓词在本目录一致判「无 style 块」', () => {
    const vues = readdirSync(VIEWS_DIR).filter((f: string) => f.endsWith('.vue'))
    expect(vues.length, 'views 目录一个 .vue 都没有 —— 零判别力').toBeGreaterThan(0)
    const withStyle: string[] = []
    for (const f of vues) {
      const src: string = readFileSync(resolve(VIEWS_DIR, f), 'utf8')
      expect(src.length, `${f} 读出来是空的 —— node:fs 读法失效了`).toBeGreaterThan(0)
      if (hasStyleBlock(src)) withStyle.push(f)
    }
    expect(withStyle, `views 目录出现真 <style> 块的文件(K44 被破):${withStyle.join(', ')}`).toEqual([])
  })

  // 🔴 「自动上膛」条件断言(治理 §9.19)。T2 落地时 `RootsView.vue` 还不存在
  // (它是 T5 的活),本条走「尚未存在」分支;**T5 一建文件就自动上膛**。
  // §9.19 要求论证与后续刀的范围不冲突:**不冲突** —— K44 是全期纪律,
  // T5 本来就不许在 `.vue` 里写 `<style>` 块,本条不向 T5 索要任何它无权写的东西
  // (与 P5e 的 T5↔T6 冲突形成对照:那次是守卫索要 T6 无权写的 markup)。
  // 🔴 P5f-T2b:谓词由裸子串换成 `hasStyleBlock()`(剥注释 + 行首锚定),裁定 R19。
  // 上方新 describe 的参数化断言在 `RootsView.vue` 建出来后会自动覆盖同一件事;
  // 本条保留是因为它带 K53 专属的错误信息(「那 66 行整块搬进 knowledge.scss」),
  // 且它是 T2 已过评审的断言 —— §9.10 只许加固不许删。
  it('K53 —— 若 views/RootsView.vue 存在,则它必须不含 <style>(T5 建文件时自动上膛)', () => {
    if (!exists(ROOTS_VUE)) {
      expect(exists(ROOTS_VUE), 'RootsView.vue 尚未创建(T5 的活)—— 本条处于「上膛待发」状态').toBe(false)
      return
    }
    const src: string = readFileSync(ROOTS_VUE, 'utf8')
    expect(src.length, 'RootsView.vue 读出来是空的').toBeGreaterThan(0)
    expect(
      hasStyleBlock(src),
      'RootsView.vue 出现真 <style> 块 —— K53 要求那 66 行整块搬进 knowledge.scss,.vue 侧零 <style>',
    ).toBe(false)
  })

  // 🔴 K53 判据④:丢 `scoped` 无害的**逐类**证明。判据 = `kr-` 前缀在全仓唯一。
  // 范围钉在「选择器可能出现的地方」= 全部 .scss/.css(本档除外)+ 全部 .vue 的
  // `<style>` 块内容。**不扫模板与测试**(T5 的模板会写 `class="kr-empty"`、它的测试
  // 会写 `find('.kr-empty')` —— 那些都不是选择器定义,扫进来会把后续刀无辜打红)。
  // 🔴 一律用**完整 token 精确匹配** `(?![\w-])`,禁 `\b`(E-25:`\b` 在 `-` 前也成立)。
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

  it('K53 判据④ —— 9 个 kr-* 在「knowledge.scss 之外的全部样式来源」里逐类零出现(丢 scoped 无害)', () => {
    const sources = collectSelectorSources(resolve(__dirname, '../..'))
    // 覆盖度自检:真的扫到了东西(否则「零命中」是假象 —— R13「没看到 ≠ 不存在」)
    expect(sources.length, '一个样式来源都没扫到 —— 零判别力').toBeGreaterThan(3)
    const collisions: string[] = []
    for (const cls of KR_CLASSES) {
      const re = new RegExp(`\\.${cls}(?![\\w-])`)
      for (const [file, text] of sources) if (re.test(text)) collisions.push(`${cls} @ ${file}`)
    }
    expect(collisions, `kr-* 前缀发生碰撞(scoped 语义的丢失不再无害):\n${collisions.join('\n')}`).toEqual([])
  })

  it('K53 —— 9 个 kr-* 在 knowledge.scss 内各恰好 1 条基类规则(整块搬入,不多不少)', () => {
    for (const cls of KR_CLASSES) {
      const hits = css.match(new RegExp(`\\.${cls}(?![\\w-])`, 'g')) || []
      expect(hits.length, `${cls} 在 knowledge.scss 里出现 ${hits.length} 次(应为 1)`).toBe(1)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 【P5f-T2b 新建,裁定 **R20 的 I-1**】P5e 裁定 **R16** 同族缺口的**第二次**:
// 本期把 8 处色字面量映射成 token(附录 B §B.3-②③ 两处 + §B.4 六处),
// 产品码逐处正确,但**没有一条断言把「哪个选择器消费哪个 token」钉住**
// ⇒ 评审实证:把 allow / deny 消费的 token **互换**、把 `--text-on-accent` 换成
// `--text-primary`,跑全量 **4337 全绿,零红**。
//
// 现实后果:① allow/deny 互换 = 白名单页「允许」显示成红、「拒绝」显示成绿(**语义反转**),
// 而 §9.17 认定 `AllowlistView` 两个分区在本机 🟢 **全部可达**、是要逐条真机验收的写操作屏;
// ② `--text-on-accent` 被换掉 = 压在品牌渐变/accent 实底上的图标变成暗档深色前景,
// **正是附录 B §B.3.1 花整节警告的失效形态**。
//
// 手法沿用本档 R16 小节的 `nestedBlockBody()` 模具,零发明。
// 🔴 判据(裁定 R20):① 互换 allow/deny 消费的 token → 必须报红;
//    ② 换掉 `--text-on-accent` → 必须报红。两段输出 + md5sum 还原见 T2b 报告。
describe('knowledge.scss —— I-1(裁定 R20):8 个色映射落点的 token 消费绑定(P5f-T2b 新建)', () => {
  // 附录 B §B.4 六处 —— 两个块 × {allow, deny} × {background, color}。
  // 🔴 逐处钉「选择器 → 属性 → token」,互换任意一对都会精确指名。
  const B4_BINDINGS: Array<[string, string, string, string]> = [
    // [块选择器行, 变体选择器, 属性, token]
    ['.k-frow-action {', '&[data-act="allow"]', 'background', '--success-soft'],
    ['.k-frow-action {', '&[data-act="allow"]', 'color', '--success'],
    ['.k-frow-action {', '&[data-act="deny"]', 'background', '--danger-soft'],
    ['.k-frow-action {', '&[data-act="deny"]', 'color', '--danger'],
    ['.k-radio-card-icon {', '&[data-tone="allow"]', 'background', '--success-soft'],
    ['.k-radio-card-icon {', '&[data-tone="allow"]', 'color', '--success'],
    ['.k-radio-card-icon {', '&[data-tone="deny"]', 'background', '--danger-soft'],
    ['.k-radio-card-icon {', '&[data-tone="deny"]', 'color', '--danger'],
  ]

  // 从块体里切出某个 `&[…]` 变体那一行(蓝本源序里它们都是单行 `{ … }`)。
  // 🔴 整行 trim 后**以变体选择器开头**才算,不是子串搜索(承本档五次「子串撞注释」教训;
  //    注释在 cssKeepLines 里已被 blankComments 换成等量空格,连内容都不在了)。
  function variantLine(blockBody: string, variantSelector: string): string {
    const hits = blockBody
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.startsWith(variantSelector))
    expect(hits.length, `块内找不到唯一的 ${variantSelector} 变体行(命中 ${hits.length} 条)`).toBe(1)
    return hits[0]
  }

  it.each(B4_BINDINGS)(
    '附录 B §B.4 —— %s 内 %s 的 %s 消费 var(%s)(判据:allow/deny 互换 → 必须报红)',
    (block: string, variant: string, prop: string, token: string) => {
      const line = variantLine(nestedBlockBody(cssKeepLines, block), variant)
      expect(line, `${block} 的 ${variant} 里 ${prop} 不是 var(${token}):${line}`).toContain(
        `${prop}: var(${token});`,
      )
    },
  )

  // 防空转(§9.14-4):参数化清单必须真的有 8 条,且 8 条各不相同 —— 否则
  // `it.each([])` 会零用例静默全绿,重复项则会让「8 处全覆盖」变成假象。
  it('防空转 —— §B.4 绑定清单恰好 8 条且互不重复(防空循环 / 防重复项冒充覆盖)', () => {
    expect(B4_BINDINGS).toHaveLength(8)
    expect(new Set(B4_BINDINGS.map((b) => b.join('|'))).size, '绑定清单里有重复项').toBe(8)
  })

  // 附录 B §B.3-② —— `.k-extgroup-icon` 的前景压在 `g.bg` 品牌渐变实底上
  it('附录 B §B.3-② —— .k-extgroup-icon 前景消费 var(--text-on-accent)(判据:换成 --text-primary → 必须报红)', () => {
    const body = nestedBlockBody(cssKeepLines, '.k-extgroup-icon {')
    expect(body, '.k-extgroup-icon 的 color 不是 var(--text-on-accent) —— 见附录 B §B.3.1').toContain(
      'color: var(--text-on-accent);',
    )
    // 🔴 反向:块内不许出现 --on-accent / --text-primary 这两个已被 §B.3.1 明确排除的替身
    expect(/var\(--on-accent\)/.test(body), '.k-extgroup-icon 用了 --on-accent(暗档是深色,压实底上失效)').toBe(false)
  })

  // 附录 B §B.3-③ —— `.k-ext-chip[data-on="true"] .k-ext-chip-mark` 压在 --accent 实底上。
  // 🔴 `.k-ext-chip-mark {` 在本档有**两处**(嵌套的 + 顶层基类),整行精确匹配会撞对第一处
  //    ⇒ 必须**逐层下钻**:.k-ext-chip → &[data-on="true"] → .k-ext-chip-mark,不许直接锚。
  it('附录 B §B.3-③ —— .k-ext-chip[data-on="true"] 下的 .k-ext-chip-mark 前景消费 var(--text-on-accent)', () => {
    const chip = nestedBlockBody(cssKeepLines, '.k-ext-chip {')
    const on = nestedBlockBody(chip, '&[data-on="true"] {')
    const mark = nestedBlockBody(on, '.k-ext-chip-mark {')
    expect(mark, '[data-on="true"] 下的 .k-ext-chip-mark 前景不是 var(--text-on-accent)').toContain(
      'color: var(--text-on-accent);',
    )
    // 覆盖度自检:真的下钻到了那一层(块体里必须同时有 --accent 底色,否则锚错了块)
    expect(mark, '下钻到的不是 [data-on="true"] 那一层的 .k-ext-chip-mark').toContain('background: var(--accent);')
  })

  // 覆盖度自检:8 处 + 2 处 = 附录 B 落在 knowledge.scss 里的全部 10 个 token 引用点。
  // 🔴 「§B.4 六处」在 scss 里是 4 行 × 平均 2 个属性 = 8 个属性级落点(附录按字面量记 6 处,
  //    其中 `color: var(--danger)` 两处蓝本本来就是 token、照抄不改 —— 一并钉住是加固)。
  it('覆盖度自检 —— 4 条变体行确实都在档内且各只有一条(锚点没有漂到别的块)', () => {
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

describe('knowledge.scss —— K54:kr-* 的两处 var() 兜底已改成纯 token(P5f-T2 新建)', () => {
  // 🔴 蓝本原文:`.kr-badge` 是 `var(--bg-tertiary, <中性灰兜底>)`、`.kr-input` 是
  // `var(--border, <中性灰兜底>)`。治理 §6 明令 rgba() 一律禁止(注释里也不许有)
  // ⇒ 兜底字面量不能照抄。附录 B §B.2.2 定死落地取值,实现者零裁量。
  // 上面那条全文色扫只能抓「有没有裸值」,**抓不到「换成了别的 token」** —— 这两条
  // 把落点逐字钉死(手法同 P5e-T4 的「token → 消费选择器绑定」那批)。
  //
  // 🔴🔴 诚实登记(勘误 E-73):`--bg-tertiary` 在蓝本与本仓**两侧都零声明** ⇒ 兜底
  // 一直在生效 ⇒ `.kr-badge` 换成 `--bg-chip` 是**可见变化,不是等价替换**。
  // `--border` 那一处才适用「兜底本是死代码」的论证(本仓 theme.css 有声明)。
  it('K54-① —— .kr-badge 底色是 var(--bg-chip)(附录 B §B.2.2-①,判据:换成别的 token → 报红)', () => {
    const body = nestedBlockBody(cssKeepLines, '.kr-badge {')
    expect(body, '.kr-badge 底色不是 var(--bg-chip)').toContain('background: var(--bg-chip);')
  })

  it('K54-② —— .kr-input 边框是 var(--line)(附录 B §B.2.2-②,判据:换成别的 token → 报红)', () => {
    const body = nestedBlockBody(cssKeepLines, '.kr-input {')
    expect(body, '.kr-input 边框不是 1px solid var(--line)').toContain('border: 1px solid var(--line);')
  })

  it('K54 —— 这两个 token 两档都有值(否则真机会渲染成 guaranteed-invalid)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    for (const tok of ['--bg-chip:', '--line:']) {
      expect(darkBody, `暗色档缺 ${tok}`).toContain(tok)
      expect(lightBody, `浅色档缺 ${tok}`).toContain(tok)
    }
  })

  // 🔴 反向:本档不许出现 `--bg-tertiary` / `--border` 这两个名字的 var() 引用
  // (照抄进来 = K54 没落地;而它们在本档映射层零声明 ⇒ 真机会整块失色)。
  it('K54 —— 本档零 var(--bg-tertiary) / var(--border) 引用(照抄兜底即报红)', () => {
    expect(css, '本档出现 var(--bg-tertiary)').not.toMatch(/var\(\s*--bg-tertiary/)
    expect(css, '本档出现 var(--border[,)])').not.toMatch(/var\(\s*--border\s*[,)]/)
  })

  // 🔴 M-6 申报的可回归化部分:`.kr-path` / `.kr-input` 的字体栈**逐字照抄蓝本硬编码值**
  // (裁定 §三 M-6;字体栈不是颜色,不在本仓 token 约束范围内)。这条钉住它没有被
  // 「顺手统一」成 var(--font-mono) —— 那是改蓝本行为 + 未申报的偏离。
  it('M-6 —— .kr-path / .kr-input 的字体栈照抄蓝本硬编码值,没有被顺手统一成 var(--font-mono)', () => {
    const STACK = 'font-family: ui-monospace, SFMono-Regular, Menlo, monospace;'
    for (const sel of ['.kr-path {', '.kr-input {']) {
      const body = nestedBlockBody(cssKeepLines, sel)
      expect(body, `${sel} 的字体栈被改动了(蓝本 RootsView.vue:235 / :259 逐字)`).toContain(STACK)
      expect(body, `${sel} 被"顺手统一"成 var(--font-mono) —— 那是改蓝本行为`).not.toContain('var(--font-mono)')
    }
  })
})

describe('knowledge.scss —— K55:三个扩展名分组渐变 token 两档取值(P5f-T2 新建)', () => {
  // 🔴 蓝本把这三个渐变写死在 `AllowlistView.vue` 的 `GROUPS_TEMPLATE` 常量里,
  // 经 `:style="{background: g.bg}"` 渲染;`color-guard` **压根不扫 `.ts`/`<script>` 常量**
  // ⇒ 不 token 化就是裸奔(票 B 位置④,变异实测「注释注入 hex 全量全绿」)。
  // 本刀负责**声明层**;常量侧只留 `var(--…)` 引用 + 定向断言,由 T4 落地。
  // 两档同值(品牌识别渐变),但按头注释「隐藏坑」段的论证仍须各写一份。
  it('三个 --grad-ext-* 两档取值逐字相同(theme-invariant,附录 B §B.6,禁重算)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    const expected: Record<string, string> = {
      '--grad-ext-docs': '--grad-ext-docs: linear-gradient(135deg, #5AC8FA, #007AFF);',
      '--grad-ext-text': '--grad-ext-text: linear-gradient(135deg, #5DD68A, #2EB05B);',
      '--grad-ext-code': '--grad-ext-code: linear-gradient(135deg, #C18CFF, #AF52DE);',
    }
    for (const [tok, decl] of Object.entries(expected)) {
      expect(darkBody, `暗色档 ${tok} 缺声明或取值被改动`).toContain(decl)
      expect(lightBody, `浅色档 ${tok} 缺声明或取值被改动(不许"两档同值就省一档")`).toContain(decl)
    }
  })

  // 🔴 为什么另建新名而不复用:--grad-ext-docs 与既有 --grad-note-note / --grad-sandbox
  // **逐字同值**,但 K39/K40 立的规矩就是「同值也另建新名」(语义属主不同)。
  // 这条钉住三者各自独立声明,没有被"去重"成互相引用。
  it('K39/K40 同款 —— 三个 --grad-ext-* 各自独立声明,没有被"去重"成 var(--grad-note-note) 之类', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    for (const tok of ['--grad-ext-docs', '--grad-ext-text', '--grad-ext-code']) {
      const line = darkBody.split('\n').find((l: string) => l.trim().startsWith(`${tok}:`))
      expect(line, `找不到 ${tok} 的声明行`).toBeTruthy()
      expect(line!, `${tok} 被写成了对别的 token 的引用`).not.toContain('var(--grad-')
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 【P5f-T2b 新建,裁定 **R20 的 M-a**】三个 `--grad-ext-*` 目前是**零消费绑定**:
  // 声明层有两条断言(两档取值逐字 + 没被去重成互相引用),但**没有任何东西保证它们
  // 真的被消费** —— 消费方 `GROUPS_TEMPLATE` 属于 T4。失效形态是**静默的**:
  // T4 若忘了换、或换错了对应关系(docs↔code 串位),三个 token 就成死声明,四门全绿。
  //
  // 落法 = 「自动上膛」条件断言(§9.19),与 K53 那条同款模具:
  // **现在**(`views/AllowlistView.vue` 不存在)走惰性分支通过;**T4 一建文件立刻上膛**。
  // 🔴 §9.19 跨刀冲突论证:计划书 T4-2 本来就明令「`GROUPS_TEMPLATE` 的三个 `bg` 字段改
  // `var(--…)`(附录 B 定死)」⇒ 本条不向 T4 索要任何它无权写的东西,**不冲突**。
  // 🔴 §9.19 另一条:新守卫必须自带**防空转断言** —— 见下方「谓词判别力」那条,
  // 它拿两份合成样本证明 `groupBgErrors()` 在文件还不存在时就已经是有牙的。
  // 🔴 读文件一律 `node:fs`(铁律:Vite 的 `?raw` 在 vitest 下**恒空**)。
  const GRAD_EXT_BINDINGS: Array<[string, string]> = [
    ['docs', '--grad-ext-docs'],
    ['text', '--grad-ext-text'],
    ['code', '--grad-ext-code'],
  ]

  // 纯函数:给一段 `AllowlistView.vue` 源码,返回三个分组的 `bg` 绑定错误清单(空 = 全对)。
  // 🔴 定位手法**与格式无关**:从 `id: 'docs'` 起、到下一个 `id:` 或文本末尾为止的窗口,
  //    该窗口内必须出现 `var(--grad-ext-docs)`,且**不许**出现另外两个 `--grad-ext-*`
  //    (串位就是这样被抓住的);同时该窗口的 `bg` 值里不许有色字面量。
  function groupBgErrors(src: string): string[] {
    const errs: string[] = []
    const idRe = /\bid:\s*['"]([a-z]+)['"]/g
    const marks: Array<[string, number]> = []
    let m: RegExpExecArray | null
    while ((m = idRe.exec(src)) !== null) marks.push([m[1], m.index])
    for (const [gid, token] of GRAD_EXT_BINDINGS) {
      const i = marks.findIndex(([name]) => name === gid)
      if (i < 0) {
        errs.push(`GROUPS_TEMPLATE 里找不到 id: '${gid}' 分组`)
        continue
      }
      const start = marks[i][1]
      const end = i + 1 < marks.length ? marks[i + 1][1] : src.length
      const win = src.slice(start, end)
      if (!win.includes(`var(${token})`)) errs.push(`分组 '${gid}' 的 bg 没有消费 var(${token})`)
      for (const [, other] of GRAD_EXT_BINDINGS) {
        if (other !== token && win.includes(`var(${other})`)) {
          errs.push(`分组 '${gid}' 的窗口里混进了 var(${other}) —— 三个渐变 token 串位了`)
        }
      }
      // 🔴 color-guard 不扫 `.vue` 的 `<script>` 常量 ⇒ 这里是唯一防线(票 B 位置④)
      const bgLine = win.match(/\bbg:\s*[^,\n]*/)
      if (bgLine && /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|linear-gradient\(/.test(bgLine[0])) {
        errs.push(`分组 '${gid}' 的 bg 里仍有色字面量 / 内联 gradient:${bgLine[0].trim()}`)
      }
    }
    return errs
  }

  // 🔴 防空转(§9.19 明令,且是「惰性通过期」唯一能证明这条守卫有牙的手段):
  // 拿两份**合成样本**跑同一个谓词 —— 正确形态必须零错误,三种偏态必须各自被抓住。
  it('防空转 —— groupBgErrors 谓词在合成样本上有判别力(文件还不存在时就先证明它不是空壳)', () => {
    const good = `
      const GROUPS_TEMPLATE = [
        { id: 'docs', labelKey: 'Documents', icon: 'file', bg: 'var(--grad-ext-docs)' },
        { id: 'text', labelKey: 'Text', icon: 'edit', bg: 'var(--grad-ext-text)' },
        { id: 'code', labelKey: 'Code', icon: 'code', bg: 'var(--grad-ext-code)' },
      ]`
    expect(groupBgErrors(good), '正确形态被误判成有错 —— 谓词过严,会对 T4 误报').toEqual([])
    // 偏态①:docs / code 串位
    const swapped = good.replace('var(--grad-ext-docs)', 'var(--grad-ext-code)')
    expect(groupBgErrors(swapped).length, '串位没有被抓住 —— 谓词零判别力').toBeGreaterThan(0)
    // 偏态②:某一组没换 token,照抄蓝本的裸渐变
    const literal = good.replace("'var(--grad-ext-text)'", "'linear-gradient(135deg, #5DD68A, #2EB05B)'")
    expect(groupBgErrors(literal).length, '裸色字面量没有被抓住 —— color-guard 不扫这里,本条是唯一防线').toBeGreaterThan(0)
    // 偏态③:整组缺失
    const missing = good.replace("{ id: 'code', labelKey: 'Code', icon: 'code', bg: 'var(--grad-ext-code)' },", '')
    expect(groupBgErrors(missing).length, '分组缺失没有被抓住').toBeGreaterThan(0)
  })

  it('M-a 自动上膛 —— 若 views/AllowlistView.vue 存在,则 GROUPS_TEMPLATE 三个 bg 各消费对应 --grad-ext-*(T4 建文件时上膛)', () => {
    const ALLOWLIST_VUE = resolve(__dirname, '../knowledge/views/AllowlistView.vue')
    let src: string | null = null
    try {
      src = readFileSync(ALLOWLIST_VUE, 'utf8') as string
    } catch {
      src = null
    }
    if (src === null) {
      // 惰性分支:文件是 T4 的活。🔴 路径基座自检 —— views 目录必须真的存在,
      // 否则「读不到 ⇒ 惰性通过」会退化成「路径写错也永远通过」的空壳。
      const vues = readdirSync(resolve(__dirname, '../knowledge/views')).filter((f: string) => f.endsWith('.vue'))
      expect(vues.length, 'views 目录一个 .vue 都没有 —— 路径基座写错了?').toBeGreaterThan(0)
      expect(vues, 'AllowlistView.vue 尚未创建(T4 的活)—— 本条处于「上膛待发」状态').not.toContain(
        'AllowlistView.vue',
      )
      return
    }
    expect(src.length, 'AllowlistView.vue 读出来是空的 —— node:fs 读法失效了').toBeGreaterThan(0)
    expect(src, 'AllowlistView.vue 里找不到 GROUPS_TEMPLATE 常量').toContain('GROUPS_TEMPLATE')
    const errs = groupBgErrors(src)
    expect(errs, `三个 --grad-ext-* 的消费绑定不成立(附录 B §B.6 / 计划书 T4-2):\n${errs.join('\n')}`).toEqual([])
  })
})

describe('knowledge.scss —— var() 兜底豁免的加固(P5f-T2 新建)', () => {
  // 【为什么补】既有那条「--g 是本档唯一登记的消费方 inline 注入例外」只断言了
  // `css` 里含某个字符串,**没有**程序化证明「只有 --g 依赖这层豁免」。本刀搬入的
  // Wiki 段引入了第二处带兜底的引用 `var(--tone, var(--text-quaternary))`(蓝本 :2529)——
  // 但 `--tone` 由 `.kw-change[data-type=…]` 四条规则在本档**真实声明**,它**不依赖**
  // 那层豁免。这条把「谁真的依赖豁免」变成集合相等断言:多出一个未声明的兜底 token
  // (= 真的靠豁免蒙混过关的引用)就精确指名。🔴 纯新增,既有断言一行未改(§9.10)。
  const theme2 = read('../../styles/theme.css')
  function declaredTokens(text: string): Set<string> {
    return new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
  }

  it('依赖「带兜底则豁免」的 token 恰好只有 --g(--tone 在本档真实声明,不靠豁免)', () => {
    const declared = new Set([...declaredTokens(css), ...declaredTokens(theme2)])
    const withFallback = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)\s*,/g)].map((m) => m[1]))]
    // 覆盖度自检:确实抓到了带兜底的引用(否则"恰好只有 --g"是空集恒真)
    expect(withFallback.length, '一处带兜底的 var() 都没抓到 —— 零判别力').toBeGreaterThanOrEqual(2)
    const relying = withFallback.filter((t) => !declared.has(t)).sort()
    expect(relying, `真正依赖兜底豁免的 token(应只有 --g):${relying.join(', ')}`).toEqual(['--g'])
  })
})
