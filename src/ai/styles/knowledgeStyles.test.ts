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
const WHITELIST_102 = [
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
]

describe('knowledge.scss —— 附录 D.4 白名单落地(102 个,R1 + T11 拍板订正)', () => {
  // 评审 2026-07-31 Important 订正 —— 原来用 `\b` 做类名右边界:`\b` 在 `-` 前也成立
  // (从字母切到连字符同样算"单词边界"),于是 `/\.k-topbar\b/` 会被 `.k-topbar-title`
  // 这样的**前缀**类满足,删掉唯一的 `.k-topbar { … }` 基类规则也测不出来 —— 评审用
  // RED 探针实证过(删 .k-topbar 规则,8/8 全绿)。受影响的是白名单里本身就是其它
  // 类前缀的 9 个:k-rail/k-rail-item/k-rail-svc/k-topbar/k-banner/k-badge/k-scroll/
  // k-mobile-tab/k-empty。改用「右边不能紧跟单词字符或短横线」的负向前瞻,这样
  // `.k-topbar` 不会被 `.k-topbar-title` 满足,只有真正独立的 `.k-topbar` 选择器
  // (后面接空格/`{`/`,`/`[` 等)才算数。
  it('102 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)', () => {
    const missing = WHITELIST_102.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css))
    expect(missing, `缺失的类:${missing.join(', ')}`).toEqual([])
  })

  it('.k-toast / .k-toast-ico 不移植(偏离 K3,改走全局 useToast())', () => {
    expect(css).not.toMatch(/\.k-toast\b/)
    expect(css).not.toMatch(/\.k-toast-ico\b/)
  })

  it('没有搬多 —— 全部 k-/k2- 类都在白名单内(附录 D.4 自检命令②的常驻版)', () => {
    const found = Array.from(new Set(css.match(/\.k2?-[a-z0-9-]+/g) || [])).map((s) => s.slice(1))
    const extra = found.filter((c) => !WHITELIST_102.includes(c))
    expect(extra, `白名单外的类:${extra.join(', ')}`).toEqual([])
  })
})

// 找到「从 selectorLiteral 开始、到下一个独立一行的 `}` 为止」这个声明块的字符区间。
// 两个 token 声明块都是纯 `--x: y;` 平铺属性,没有嵌套规则,所以「下一个 `\n}`」
// 就是它的真实结束位置 —— 与 settingsStyles.test.ts 的 blockOf 同一手法。
function declBlockRange(text: string, selectorLiteral: string): [number, number] {
  const at = text.indexOf(selectorLiteral)
  expect(at, `找不到声明块 ${selectorLiteral}`).toBeGreaterThanOrEqual(0)
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
  it('R2 —— 6 个本批用到的 *-soft/-scrim token 两档都有值(T4 的 4 个 + T11 追加的 2 个)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    for (const tok of [
      '--warning-soft:', '--warning-soft-border:', '--success-soft:', '--danger-soft:',
      '--danger-soft-border:', '--modal-scrim:',
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
