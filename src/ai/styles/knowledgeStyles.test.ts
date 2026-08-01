import { describe, it, expect } from 'vitest'
// SP8-P5a Task 4 —— 复刻 settingsStyles.test.ts(SP8-P2a Task 2)头注释里记录的三处环境坑,
// 逐字照抄同样的解法(不是重新踩坑,是同一份既有解法的复用):
// ① 本仓 package.json 是 "type": "module" → __dirname 在 ESM 下不可用,改用
//    import.meta.url + fileURLToPath 的等价写法。
// ② 本仓未装 @types/node —— node:fs / node:path / node:url 没有类型声明,
//    `pnpm exec vue-tsc --noEmit`(任务门三条命令之一)会报 TS2307,逐行 @ts-expect-error 抑制。
// ③ 不用 Vite 的 `?raw` 导入替代 node:fs —— vitest 自带 CSSEnablerPlugin 对 css/scss
//    一律整体替换成空串(不看查询串),?raw 导入会让断言对空字符串"假通过"。退回 node:fs。
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明,见上方注释
import { readFileSync, readdirSync, statSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明,见上方注释
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明,见上方注释
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
const WHITELIST_187 = [
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
]

describe('knowledge.scss —— 附录 D 白名单落地(187 个,R1 + T11 + P5b-T2 + P5b-T6)', () => {
  // 评审 2026-07-31 Important 订正 —— 原来用 `\b` 做类名右边界:`\b` 在 `-` 前也成立
  // (从字母切到连字符同样算"单词边界"),于是 `/\.k-topbar\b/` 会被 `.k-topbar-title`
  // 这样的**前缀**类满足,删掉唯一的 `.k-topbar { … }` 基类规则也测不出来 —— 评审用
  // RED 探针实证过(删 .k-topbar 规则,8/8 全绿)。受影响的是白名单里本身就是其它
  // 类前缀的 9 个:k-rail/k-rail-item/k-rail-svc/k-topbar/k-banner/k-badge/k-scroll/
  // k-mobile-tab/k-empty。改用「右边不能紧跟单词字符或短横线」的负向前瞻,这样
  // `.k-topbar` 不会被 `.k-topbar-title` 满足,只有真正独立的 `.k-topbar` 选择器
  // (后面接空格/`{`/`,`/`[` 等)才算数。
  it('187 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)', () => {
    const missing = WHITELIST_187.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css))
    expect(missing, `缺失的类:${missing.join(', ')}`).toEqual([])
  })

  // 防漂移:常量名里的数字与数组长度必须一致(本档既定习惯,名字本身就是断言的一部分)。
  it('白名单恰好 187 项(附录 D §D.0:102 + T2 的 32 + T6 的 53)', () => {
    expect(WHITELIST_187).toHaveLength(187)
    expect(new Set(WHITELIST_187).size, '白名单里有重复项').toBe(187)
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
  it('没有搬多 —— 全部 k-/k2-/kn- 类都在白名单内(附录 D.4 自检命令②的常驻版)', () => {
    const found = Array.from(new Set(css.match(/\.k(?:2|n)?-[a-z0-9-]+/g) || [])).map((s) => s.slice(1))
    const extra = found.filter((c) => !WHITELIST_187.includes(c))
    expect(extra, `白名单外的类:${extra.join(', ')}`).toEqual([])
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
  ]

  function nonKClassNames(text: string): string[] {
    const found = new Set([...text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))
    return [...found].filter((c) => !/^k(?:2|n)?-/.test(c) && c !== 'knowledge-app').sort()
  }

  it('守卫缺口④ —— 非 k* 前缀的嵌套辅助类全部在登记表内(.right/.mono 这类)', () => {
    const extra = nonKClassNames(css).filter((c) => !NON_K_HELPER_CLASSES.includes(c))
    expect(extra, `未登记的非 k* 类(每个都要在 NON_K_HELPER_CLASSES 里写明出处):${extra.join(', ')}`).toEqual([])
  })

  it('守卫缺口④ —— 登记表恰好等于文件里真实存在的非 k* 类,不多不少(防清单变垃圾桶)', () => {
    expect(nonKClassNames(css)).toEqual([...NON_K_HELPER_CLASSES].sort())
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

const DARK_TOKEN_SELECTOR = '.knowledge-app {'
const LIGHT_TOKEN_SELECTOR = ':root[data-theme="light"] .knowledge-app {'

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
