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
import { readFileSync } from 'node:fs'
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

const css = stripComments(read('./knowledge.scss'))

// R1(协调者拍板)—— 附录 D.1 的 32 个 + 协调者追加的 6 个 k-empty* = 38 个,是本批
// (T4:token 声明层 + 壳段 + keyframes)唯一该出现的类全集,一个不多一个不少。
const WHITELIST_38 = [
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
]

describe('knowledge.scss —— 附录 D.4 白名单落地(38 个,R1 拍板)', () => {
  it('38 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)', () => {
    const missing = WHITELIST_38.filter((c) => !new RegExp(`\\.${c}\\b`).test(css))
    expect(missing, `缺失的类:${missing.join(', ')}`).toEqual([])
  })

  it('.k-toast / .k-toast-ico 不移植(偏离 K3,改走全局 useToast())', () => {
    expect(css).not.toMatch(/\.k-toast\b/)
    expect(css).not.toMatch(/\.k-toast-ico\b/)
  })

  it('没有搬多 —— 全部 k-/k2- 类都在白名单内(附录 D.4 自检命令②的常驻版)', () => {
    const found = Array.from(new Set(css.match(/\.k2?-[a-z0-9-]+/g) || [])).map((s) => s.slice(1))
    const extra = found.filter((c) => !WHITELIST_38.includes(c))
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
  // 【本条是本任务最有价值的守卫】color-guard.test.ts 不扫 .scss(P3a RED 探针实证)——
  // 这条测试是 knowledge.scss 唯一的裸色回归网。只豁免两个 token 声明块本身
  // (那里就是 token 的定义处,见 §6),除此之外全文一处裸色字面量都不许有。
  it('token 声明层之外,全文零色字面量(#hex / rgb() / rgba() / 具名色)', () => {
    const [darkStart, darkEnd] = declBlockRange(css, DARK_TOKEN_SELECTOR)
    const [lightStart, lightEnd] = declBlockRange(css, LIGHT_TOKEN_SELECTOR)
    // 两个声明块必须按文件顺序不重叠(dark 在前、light 紧随其后),否则下面的拼接会切错。
    expect(darkEnd, 'dark 声明块应先于 light 声明块结束').toBeLessThanOrEqual(lightStart)

    const rest = css.slice(0, darkStart) + css.slice(darkEnd, lightStart) + css.slice(lightEnd)

    expect(rest, '声明层之外出现 #hex').not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(rest, '声明层之外出现 rgb()/rgba()').not.toMatch(/rgba?\(/)
    expect(rest, '声明层之外出现 oklch()').not.toMatch(/oklch\(/)
    expect(rest, '声明层之外出现具名色 white').not.toMatch(/\bwhite\b/)
    expect(rest, '声明层之外出现具名色 black').not.toMatch(/\bblack\b/)
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
  it('R2 —— 4 个本批用到的 *-soft token 两档都有值(warning-soft/-border, success-soft, danger-soft)', () => {
    const darkBody = declBlockBody(css, DARK_TOKEN_SELECTOR)
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    for (const tok of ['--warning-soft:', '--warning-soft-border:', '--success-soft:', '--danger-soft:']) {
      expect(darkBody, `暗色档缺 ${tok}`).toContain(tok)
      expect(lightBody, `浅色档缺 ${tok}`).toContain(tok)
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
