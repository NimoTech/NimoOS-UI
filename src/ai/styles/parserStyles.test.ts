import { describe, it, expect } from 'vitest'
// SP8-P5c Task 2b —— `parser-styles.scss` 的专属守卫(治理 §6.4-5,堵守卫缺口 ②⑤)。
//
// 【为什么必须新建这个文件】`parser-styles.scss` 在本刀之前是**完全裸奔**的:
//   缺口② `src/styles/color-guard.test.ts` 只 glob `../**/*.vue` 与 `../**/*.css`,**不扫 `.scss`**
//          (P3a 已用 RED 探针实证)→ 裸色字面量进不了它的视野;
//   缺口⑤ `knowledgeStyles.test.ts` 只读 `./knowledge.scss` 这一份源文件 → 管不到本文件。
// 于是本文件承担 4 条硬约束的回归网((a)(b)(c)(d),见下面四个 describe)+ 1 条白名单/元素选择器
// 集合相等(附录 D §D.0 / §D.2 的 PARSER_WHITELIST_70 与 9 个元素选择器登记)。
//
// 环境坑逐字沿用 `knowledgeStyles.test.ts` 头注释记录的三条既有解法(不是重新踩坑):
// ① 本仓 package.json 是 "type": "module" → __dirname 在 ESM 下不可用,改用
//    import.meta.url + fileURLToPath 的等价写法(先例:P5b T11)。
// ② 本仓未装 @types/node —— node:fs / node:path / node:url 没有类型声明,
//    `pnpm exec vue-tsc --noEmit`(任务门三条命令之一)会报 TS2307,逐行 @ts-expect-error 抑制。
// ③ 🔴 **不用 Vite 的 `?raw` 导入替代 node:fs** —— vitest 自带的 CSSEnablerPlugin 对 css/scss
//    一律整体替换成空串(不看查询串),`?raw` 导入会让下面每一条断言都对**空字符串**"假通过"
//    (`expect('').not.toMatch(...)` 恒真、`expect([]).toEqual([...])` 才会红但也不是真在测源文件)。
//    退回 node:fs 直读源文件。
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明,见上方注释
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明,见上方注释
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明,见上方注释
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rawSource: string = readFileSync(resolve(__dirname, './parser-styles.scss'), 'utf8')

// 剥注释 —— 同 knowledgeStyles.test.ts / settingsStyles.test.ts 的既定手法:块注释 + 整行 `//`。
// 只给「选择器/属性结构」类断言用(防注释里提到的选择器名撞对);
// 🔴 色扫(断言 a)**必须跑在未剥注释的 rawSource 上** —— 治理 §6 / R5 要求注释里也不许有色字面量,
// 剥掉注释再扫等于把这一半豁免掉(knowledgeStyles.test.ts 评审 2026-07-31 已用 RED 探针实证过
// 「注释里塞裸色 8/8 全绿」这个窟窿)。
function stripComments(scss: string): string {
  return scss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}
const css = stripComments(rawSource)

// 本文件允许出现在第 0 列的三个选择器(治理 §6.1 落地约束 2 + §6.4-5 的判据 b,**K31 订正后**)。
// `.parser-app` 只带 K22 那三行结构属性;两个页面段按 K23 各自一个作用域,同名类不合并。
//
// 🔴 【K31,协调者 2026-08-03 裁定 —— 这三个常量本身就是一条防漂移断言】两个页面段是
// **后代**选择器 `.parser-app .parser-status-page`,**不是**复合选择器 `.parser-app.parser-status-page`:
// `.parser-app` 是**外层包裹元素**(K22 的滚动容器),页面根类在**内层元素**上,模板写成
// `<div class="parser-app"><div class="parser-status-page">…</div></div>`。
// 若压成同一个元素,该元素同时是蓝本的 `max-width: 900px; margin: 0 auto` 与 K22 的 `overflow-y: auto`
// → 滚动条落在 900px 居中列的右缘(宽屏上约在屏幕中间),而 Vue2 是整页滚动、滚动条在视口最右缘,
// **是用户可见的界面不 1:1**。K22 引的两个先例(`.area-shell`+`.area-body`、`.knowledge-app`+`.k-scroll`)
// 本来就是两元素。→ 谁把 scss 改回复合形式,下面断言 (b) 与 (d) 会同时精确报红(已做 RED 探针)。
const ROOT_SELECTOR = '.parser-app'
const SCOPE_STATUS = '.parser-app .parser-status-page'
const SCOPE_TEST = '.parser-app .parser-test-page'
const TOP_LEVEL_SELECTORS = [ROOT_SELECTOR, SCOPE_STATUS, SCOPE_TEST]

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 取「以 `selector {` 独占一行(零缩进)开头、到与之配对的 `}` 为止」的整块文本。
// 🔴 起点判据用 `^…$`(多行模式)**行首行尾锚定**,不是子串搜索 —— knowledgeStyles.test.ts 的
// I-2 事故教训:`indexOf` 会被注释里逐字引用的同一个选择器串撞对(本文件头注释里就逐字写着
// `.parser-app .parser-status-page`)。这里先剥注释、再行首锚定,双保险。
// 结束位置用**花括号配平**(本文件的两个页面段内部有多层嵌套规则,knowledgeStyles 那份
// 「下一个 `\n}`」的简化手法在这里会切错)。
function blockOf(text: string, selector: string): string {
  const anchored = new RegExp(`^${escapeForRegExp(selector)} \\{$`, 'm')
  const m = anchored.exec(text)
  expect(m, `找不到顶层规则 \`${selector} {\`(行首行尾锚定,已排除注释里的同名引用)`).not.toBeNull()
  const start = m!.index
  const open = text.indexOf('{', start)
  let depth = 0
  let i = open
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
  expect(depth, `\`${selector}\` 的花括号未配平`).toBe(0)
  return text.slice(start, i)
}

// 把 scss 里所有「规则头」抽出来(`选择器 {` 的选择器部分)。
// 正则口径:从上一个 `{` / `}` / `;` / 行首起、到下一个 `{` 之间、且不含 `(` `)` 的那段文本
// —— 排除 `(` 让 `grid-template-columns: repeat(2, 1fr)` 这类带括号的声明值不会被误当选择器;
// `;` 作为分隔符让「单行多声明 + 末尾嵌套规则」也能正确切开(本文件大量这种排版,1:1 照蓝本)。
// 每次匹配后把 lastIndex 退回那个 `{`,因为它同时是下一条规则的前导分隔符。
function ruleHeads(scss: string): string[] {
  const out: string[] = []
  const re = /(?:^|[{};])([^{};()]*)\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(scss))) {
    const sel = m[1].trim().replace(/\s+/g, ' ')
    if (sel) out.push(sel)
    re.lastIndex = m.index + m[0].length - 1
  }
  return out
}

// ---------------------------------------------------------------------------
// (a) 全文(含注释)零色字面量
// ---------------------------------------------------------------------------
// 正则口径 = `color-guard.test.ts` 的 HEX/FUNC 两条 + 现代 CSS 色函数 + **CSS 具名色全清单**
// (T2a 评审的方法② 用了 100 个具名色的完整清单做人肉扫描,这里把它固化成常驻断言,
//  并按 CSS Color 4 的 named-color 列表补齐到 148 个 —— 是那 100 个的严格超集)。
// `transparent` **不算**色字面量(P5a T11 已定口径:它是关键字,不是"某个颜色写死"),
// 故不在清单里;本文件实测 `transparent` 零处。
// 🔴 具名色用**大小写敏感**匹配:CSS 关键字实际写法一律小写,而大小写不敏感会把中文注释里的
// 「RED 探针」这类词当成具名色 red 报出来(T2a 评审的方法② 就吃到 2 处这种假阳性,靠人肉排除;
// 常驻断言不能靠人肉排除,故取小写口径 —— 与 knowledgeStyles.test.ts:370-377 同款)。
// 🔴 两侧都用 `(?<![\w-])` / `(?![\w-])` 负向断言:JS 的 `\b` 在字母↔连字符处同样成立,
// `/\bwhite\b/` 会被完全合法的 `white-space: nowrap` 撞对(本文件有 4 处 `white-space`)。
const CSS_NAMED_COLORS = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow',
  'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
  'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white',
  'whitesmoke', 'yellow', 'yellowgreen',
]

describe('parser-styles.scss —— (a) 全文(含注释)零色字面量(缺口②:color-guard 不扫 .scss)', () => {
  it('零 #hex', () => {
    expect(rawSource, '出现 #hex 色字面量').not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('零函数式色值(rgb/rgba/hsl/hsla/lab/lch/oklab/oklch/hwb/color()/color-mix())', () => {
    expect(rawSource, '出现 rgb()/rgba()').not.toMatch(/\brgba?\s*\(/)
    expect(rawSource, '出现 hsl()/hsla()').not.toMatch(/\bhsla?\s*\(/)
    expect(rawSource, '出现 lab()').not.toMatch(/\blab\s*\(/)
    expect(rawSource, '出现 lch()').not.toMatch(/\blch\s*\(/)
    expect(rawSource, '出现 oklab()').not.toMatch(/\boklab\s*\(/)
    expect(rawSource, '出现 oklch()').not.toMatch(/\boklch\s*\(/)
    expect(rawSource, '出现 hwb()').not.toMatch(/\bhwb\s*\(/)
    expect(rawSource, '出现 color()').not.toMatch(/\bcolor\s*\(/)
    expect(rawSource, '出现 color-mix()').not.toMatch(/\bcolor-mix\s*\(/)
    expect(rawSource, '出现 device-cmyk()').not.toMatch(/\bdevice-cmyk\s*\(/)
  })

  it(`零 CSS 具名色(${CSS_NAMED_COLORS.length} 个全清单,含 white / black;transparent 不算)`, () => {
    const offenders: string[] = []
    rawSource.split('\n').forEach((line, i) => {
      for (const name of CSS_NAMED_COLORS) {
        if (new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(line)) {
          offenders.push(`  L${i + 1} [${name}]: ${line.trim()}`)
        }
      }
    })
    expect(offenders, `出现 CSS 具名色(改成 var(--token)):\n${offenders.join('\n')}`).toEqual([])
  })

  it('零 theme-exception 逃逸(治理 §6:本期禁用)', () => {
    expect(rawSource, '出现 theme-exception 逃逸').not.toContain('theme-exception')
  })

  it('零残留的假 token 死引用(附录 B §B.9 自查⑦:不许留 var(--ns-color-*, …) 的壳)', () => {
    expect(rawSource, '残留了 Vue2 那个全仓无声明的假 token 名').not.toContain('ns-color')
  })
})

// ---------------------------------------------------------------------------
// (b) 零顶层裸选择器
// ---------------------------------------------------------------------------
// 判据(治理 §6.4-5 原文):**第 0 列开头的选择器只许是那三个**。蓝本那 60+ 个裸类名
// (`.card` `.row` `.hint` `.error` `.empty` …)与 9 个元素选择器在 Vue2 靠 `scoped` 隔离,
// 搬进 New-UI 的全局 scss 必须自己收口(K9),否则会泄漏到全站 —— 尤其 `.card` 与
// `agent-styles.scss:529` 的 `.agent-app .card` 同名,`h2`/`li`/`input` 这些元素选择器
// 裸在顶层更是全站生效。
describe('parser-styles.scss —— (b) 零顶层裸选择器(K9;第 0 列只许那三个)', () => {
  // 只看「第 0 列是非空白、非 `}`、非 `/` 的行」:
  //   - `}` 是块结束,不是选择器;
  //   - `/` 只可能是块注释开头 `/*`(本文件的块注释续行一律缩进成 ` * `、收尾 ` */`,
  //     所以续行会被"以空白开头"过滤掉,而**不是**靠放行 `*` —— 这样万一真写出顶层
  //     通用选择器 `* { … }`,它仍会被下面的断言逮到)。
  const topLevelLines: Array<[number, string]> = rawSource
    .split('\n')
    .map((l, i): [number, string] => [i + 1, l])
    .filter(([, l]) => l.trim() !== '' && !/^[\s}/]/.test(l))

  it('第 0 列的规则头恰好是那三个选择器(顺序与个数都钉死)', () => {
    const heads = topLevelLines.map(([, l]) => l.replace(/\s*\{\s*$/, '').trim())
    expect(heads, `第 0 列出现了预期外的选择器:\n${topLevelLines.map(([n, l]) => `  L${n}: ${l}`).join('\n')}`).toEqual(
      TOP_LEVEL_SELECTORS,
    )
  })

  it('第 0 列的每一行都是「选择器 + 空格 + {」的完整单行写法(declBlockRange 的行首行尾锚定依赖它)', () => {
    for (const [n, line] of topLevelLines) {
      expect(line, `L${n} 顶层规则头不是单行 \`选择器 {\` 写法:${line}`).toMatch(/^\S.*\S \{$/)
    }
  })
})

// ---------------------------------------------------------------------------
// (c) `.parser-app` 块里零颜色属性、零 `--x:` 声明
// ---------------------------------------------------------------------------
// 堵治理 §6.1 落地约束 1:token 声明层全在 `knowledge.scss`(K21 已把那两个块的选择器各扩了
// 一个 `.parser-app` 逗号项),`.parser-app` 这个作用域根**只**负责 K22 那三行结构属性。
// 一旦有人往这里补一份 token 声明,就会出现「同一 token 两处声明」的漂移源;
// 一旦有人往这里写颜色属性,就会越过两页各自的作用域、同时影响两页。
const COLOR_PROPERTIES = [
  'color',
  'background',
  'background-color',
  'background-image',
  'border',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline',
  'outline-color',
  'box-shadow',
  'text-shadow',
  'text-decoration-color',
  'caret-color',
  'column-rule-color',
  'accent-color',
  'fill',
  'stroke',
  'color-scheme',
]

describe('parser-styles.scss —— (c) .parser-app 块只带 K22 三行结构属性', () => {
  // 🔴 `blockOf` 里带 `expect`,必须在 `it` 内部调用 —— 放在 describe 体里会在**收集阶段**抛,
  // 报错落在文件级而不是某条用例上,失败信息会失真(P5a 同族教训:守卫要指名道姓)。
  const rootBody = () => blockOf(css, ROOT_SELECTOR)

  it('声明恰好是 height / height / overflow-y 三条(K22,一条不多一条不少)', () => {
    const body = rootBody()
    const props = [...body.matchAll(/^\s*(--[\w-]+|[a-zA-Z-]+)\s*:/gm)].map((m) => m[1])
    expect(props, `.parser-app 块的声明清单变了:\n${body}`).toEqual(['height', 'height', 'overflow-y'])
  })

  it('零 `--x:` 自定义属性声明(token 声明层只许在 knowledge.scss)', () => {
    const body = rootBody()
    expect(body, `.parser-app 块里出现了 token 声明:\n${body}`).not.toMatch(/--[\w-]+\s*:/)
  })

  it('零颜色属性', () => {
    const body = rootBody()
    const offenders: string[] = []
    for (const prop of COLOR_PROPERTIES) {
      if (new RegExp(`(?:^|[;{\\s])${escapeForRegExp(prop)}\\s*:`).test(body)) offenders.push(prop)
    }
    expect(offenders, `.parser-app 块里出现了颜色属性:${offenders.join(', ')}`).toEqual([])
  })

  it('零嵌套规则(它不是页面段,页内规则一律归两个页面作用域)', () => {
    const body = rootBody()
    expect(body.slice(body.indexOf('{') + 1), '.parser-app 块里出现了嵌套规则').not.toContain('{')
  })
})

// ---------------------------------------------------------------------------
// (d) 两个页面作用域各自存在,且 `.card` / `.page-header` 在两个作用域下各有一份
// ---------------------------------------------------------------------------
// 堵 K23(防"顺手把同名类合并成一个共享段")。附录 B §B.1 的 C-2 实测:两份蓝本里完整路径
// 相同的只有 `.card` / `.page-header` / `.page-header h2` 三条(声明逐字相同),其余同名类
// (`.row` / `h3` / `li` / `.hint` / `.empty` / `.toggle`)父卡片或声明都不同 —— 合并 = 界面不 1:1。
// 「逐字相同」的那 3 条也照 K23 各留一份(东西在哪儿就搬到哪儿)。
describe('parser-styles.scss —— (d) K23:两个页面作用域各自成段,同名类不合并', () => {
  // 同 (c):`blockOf` 带 `expect`,一律在 `it` 内部求值。
  const scopeBody = (scope: string) => blockOf(css, scope)

  it('两个作用域都存在,且各自带蓝本的页面壳声明(padding / max-width / margin)', () => {
    for (const scope of [SCOPE_STATUS, SCOPE_TEST]) {
      expect(scopeBody(scope), `${scope} 缺 padding`).toMatch(/^\s*padding: 16px;$/m)
      expect(scopeBody(scope), `${scope} 缺 max-width`).toMatch(/^\s*max-width: 900px;$/m)
      expect(scopeBody(scope), `${scope} 缺 margin`).toMatch(/^\s*margin: 0 auto;$/m)
    }
  })

  it('`.card` 在两个作用域下各有且只有一份', () => {
    for (const scope of [SCOPE_STATUS, SCOPE_TEST]) {
      const hits = scopeBody(scope).match(/^[ \t]+\.card\s*\{/gm) || []
      expect(hits.length, `${scope} 下的 \`.card {\` 规则应恰好 1 条,实测 ${hits.length} 条`).toBe(1)
    }
  })

  it('`.page-header`(含嵌套 `h2`)在两个作用域下各有且只有一份', () => {
    for (const scope of [SCOPE_STATUS, SCOPE_TEST]) {
      const hits = scopeBody(scope).match(/^[ \t]+\.page-header\s*\{/gm) || []
      expect(hits.length, `${scope} 下的 \`.page-header {\` 规则应恰好 1 条,实测 ${hits.length} 条`).toBe(1)
      expect(scopeBody(scope), `${scope} 的 .page-header 缺嵌套的 h2`).toMatch(/\.page-header \{[\s\S]*?\bh2 \{/)
    }
  })

  it('两个作用域各自持有本页专属的类,没有被并到一起', () => {
    // 状态页专属(蓝本 parser-styles.scss)/ 测试页专属(蓝本 ParserTest.vue 内联 style)
    for (const only of ['.control-card', '.queue-card', '.folders-card', '.failures-card', '.refresh-btn']) {
      expect(scopeBody(SCOPE_STATUS), `${SCOPE_STATUS} 缺 ${only}`).toContain(`${only} `)
      expect(scopeBody(SCOPE_TEST), `${SCOPE_TEST} 不该有 ${only}`).not.toContain(`${only} `)
    }
    for (const only of ['.upload-card', '.docling-card', '.scored-card', '.chunks-card', '.back-link']) {
      expect(scopeBody(SCOPE_TEST), `${SCOPE_TEST} 缺 ${only}`).toContain(`${only} `)
      expect(scopeBody(SCOPE_STATUS), `${SCOPE_STATUS} 不该有 ${only}`).not.toContain(`${only} `)
    }
  })
})

// ---------------------------------------------------------------------------
// (e) 类白名单与元素选择器登记表(附录 D §D.0 / §D.2)
// ---------------------------------------------------------------------------
// 附录 D §D.2:ParserStatus(31 个类)+ ParserTest(44 个类)去重 = **70**,T0 双向 diff
// 「70/70 都在蓝本 scss 里有定义;scss 里也没有一个模板未用的类」。这条断言是**集合相等**,
// 既守"搬少"也守"搬多"(顺手加一个 New-UI 自造的类会当场红)。
// ⚠️ `parser-app` **不进**这个登记表 —— 它是 New-UI 侧的 token 作用域根(K21/K22),不是蓝本
// 模板类;与治理 §6.4-2 对 `knowledgeStyles.test.ts` 的裁定同款处理(走排除条件,而不是塞进
// 登记表让计数变味)。`parser-status-page` / `parser-test-page` 本来就在这 70 个里。
const PARSER_WHITELIST_70 = [
  'active', 'back-link', 'card', 'checkbox',
  'chunk-head', 'chunk-item', 'chunk-list', 'chunk-ref',
  'chunk-text', 'chunks-card', 'clear-btn', 'concurrency-row',
  'control-card', 'device-row', 'docling-card', 'docling-md',
  'dot', 'dropzone', 'emb-label', 'emb-preview',
  'empty', 'error', 'error-box', 'failure-list',
  'failures-card', 'file-meta', 'folder-bar', 'folder-count',
  'folder-list', 'folder-path', 'folder-row', 'folders-card',
  'has', 'header-actions', 'help-card', 'hint',
  'hint-line', 'kv', 'ok-hint', 'page-header',
  'param', 'params-row', 'parser-status-page', 'parser-test-page',
  'path', 'pause-btn', 'paused', 'pick-btn',
  'query-input', 'queue-card', 'radio', 'rank-line',
  'rank-no', 'rank-text', 'refresh-btn', 'rerank-score',
  'reset-btn', 'resolved-hint', 'row', 'score',
  'scored-card', 'scored-list', 'small', 'status-text',
  'submit-btn', 'test-link', 'toggle', 'unreachable',
  'upload-card', 'warn',
]

// 作用域根类(New-UI 侧,不是蓝本模板类)—— 走排除条件,见上方 ⚠️。
const SCOPE_ROOT_CLASSES = ['parser-app']

// 附录 D §D.2 末尾登记的 9 个元素选择器:`h2`(两页各一)· `h3`(三处)· `b`(.queue-card .kv b)·
// `li`(两处)· `p`(.help-card p)· `em`(两处)· `strong`(.file-meta strong)· `input`(.param input)·
// `code`(.emb-preview code)。🔴 它们在 New-UI 必须全都嵌在作用域里(K9),裸 `h2 { }` 会泄漏全站
// —— 这条集合相等断言同时守住"没有多冒出别的元素选择器"。
const PARSER_ELEMENT_SELECTORS = ['b', 'code', 'em', 'h2', 'h3', 'input', 'li', 'p', 'strong']

describe('parser-styles.scss —— (e) 类白名单 70 + 元素选择器 9(附录 D §D.2,集合相等)', () => {
  const heads = ruleHeads(css)

  it('文件里出现的类名集合 === PARSER_WHITELIST_70(排除作用域根 .parser-app)', () => {
    const found = new Set<string>()
    for (const head of heads) {
      for (const c of head.match(/\.[a-zA-Z][\w-]*/g) || []) {
        const name = c.slice(1)
        if (!SCOPE_ROOT_CLASSES.includes(name)) found.add(name)
      }
    }
    expect([...found].sort(), '类名集合与附录 D §D.2 的 70 项不一致').toEqual([...PARSER_WHITELIST_70].sort())
    expect(PARSER_WHITELIST_70.length, '白名单常量名与实际项数漂了(常量名本身就是防漂移断言)').toBe(70)
  })

  it('文件里出现的元素选择器集合 === 附录 D §D.2 登记的 9 个', () => {
    const found = new Set<string>()
    for (const head of heads) {
      for (const part of head.split(',')) {
        for (const token of part.trim().split(/[\s>+~]+/)) {
          // 剥掉伪类/伪元素(如 `li:first-child` → `li`),剩下纯标签名才算元素选择器
          const bare = token.replace(/::?[a-zA-Z-]+(\([^)]*\))?$/, '')
          if (/^[a-z][a-z0-9]*$/.test(bare)) found.add(bare)
        }
      }
    }
    expect([...found].sort(), '元素选择器集合与附录 D §D.2 登记的 9 个不一致').toEqual(
      [...PARSER_ELEMENT_SELECTORS].sort(),
    )
  })

  it('N15 同族守卫:不许出现知识库区的 `k-*` / `k2-*` / `kn-*` / `fb-*` 类(它们归 knowledge.scss)', () => {
    expect(css, 'parser-styles.scss 里混进了 knowledge.scss 的类').not.toMatch(/\.k(?:2|n)?-[a-z0-9-]+/)
    expect(css, 'parser-styles.scss 里混进了 FolderBrowser 的类').not.toMatch(/\.fb(?:-[a-z0-9-]+)?[\s.,:{]/)
  })
})
