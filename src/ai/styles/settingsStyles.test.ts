import { describe, it, expect } from 'vitest'
// SP8-P2a Task 2 —— 落地时踩了两处环境差异,均只改「怎么读文件」,不改任何断言内容:
// ① brief 原文用 resolve(__dirname, ...);本仓 package.json 是 "type": "module",
//    __dirname 在 ESM 下不可用,改用 import.meta.url + fileURLToPath 的等价写法。
// ② 本仓 tsconfig.json 的 "types" 只有 ["vite/client","vitest/globals"],未装
//    @types/node —— node:fs / node:path / node:url 没有类型声明,`pnpm exec
//    vue-tsc --noEmit`(任务门三条命令之一)会报 TS2307。
//    曾尝试改用 Vite 静态 `?raw` 导入替代 node:fs(仿 src/styles/color-guard.test.ts
//    的 import.meta.glob 先例),但实测行为不同:vitest 自带的 CSSEnablerPlugin
//    (node_modules/vitest 内 `vitest:css-disable` transform,enforce:"pre")只要
//    id 匹配 css/scss 扩展名、且 `test.css.include` 未显式收录该文件,就把内容
//    整体替换成空串——**不看 `?raw`/`?url` 查询串**,抢在 assetPlugin 的真实 raw
//    读取之前清空。实测证实 color-guard.test.ts 现有的 `?raw` glob 对 .css 文件
//    同样命中此坑(实测 THEME_LEN=0),只是它的裸色扫描对空字符串天然不报错,
//    这个既有 false-negative 与本任务无关,修它需要碰
//    `src/styles/color-guard.test.ts`,不在本任务允许改动的 4 个文件之列,不修。
//    要在不改 vite.config.ts(加 test.css.include)、不装 @types/node、不碰
//    tsconfig.json/package.json 的前提下解决,退回 node:fs 方案,用
//    `@ts-expect-error` 就地抑制这三行找不到模块声明的类型错误(运行时已验证可用,
//    见下方 vitest 实跑结果);模块解析失败后被推断的类型退化为 any,故后续两处
//    filter 回调参数显式标注 `l: string` 以满足 noImplicitAny。
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明,见上方注释
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明,见上方注释
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明,见上方注释
import { fileURLToPath } from 'node:url'

// SP8-P2a Task 2 —— 样式档是机械移植件,没有运行时行为可测。这条守卫只做两件
// 事:①钉住「本档不得重复定义 token」这条架构约定 ②钉住选择器基座没被改名。
// 视觉 1:1 由 reviewer 逐行 diff Vue2 原文 + 用户 :5288 验收负责,不是本测试的职责。

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

// SP8-P2b Task 10 二次评审补漏 —— 之前 `.mcp-label`/`.mcp-reveal-warn` 那条 `toContain`
// 断言只查子串,而修复本身的**注释**里就带反引号引的类名(`` `.mcp-label` ``),删掉真正
// 的 CSS 规则、只留注释也能让断言通过(已用 RED 探针实测确认)。这里在 fixture 层面统一
// 剥掉注释(`//` 整行注释 + `/* … */` 块注释)后再断言,本档全部 `toContain` 检查因此都
// 只能被真实声明满足,不会被注释里提到的类名/字符串撞对。
// 只剥「整行以 // 开头」的行注释(本档惯例,行注释永不跟在真代码后面),不做「行内任意位置
// 的 //」全局替换 —— `.set-select` 那条 `background-image: url("data:image/svg+xml,...
// http://www.w3.org/2000/svg...")` 规则里,数据 URI 本身含 `//`,不是注释,不能被切断。
function stripComments(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

describe('settings-styles.scss', () => {
  const css = stripComments(read('./settings-styles.scss'))

  it('不重复定义 token(token 只能来自 tokens.scss 的 .agent-app 作用域)', () => {
    const declarations = css.split('\n').filter((l: string) => /^\s*--[a-z-]+\s*:/.test(l))
    expect(declarations).toEqual([])
  })

  it('保留 .set-app 网格基座与两栏宽度', () => {
    expect(css).toContain('grid-template-columns: 258px 1fr')
  })

  it('保留 stack 模式的分区锚点样式', () => {
    expect(css).toContain('.set-stack-item')
    expect(css).toContain('scroll-margin-top')
  })

  it('保留 720px 窄屏的图标化导航栏', () => {
    expect(css).toContain('@media (max-width: 720px)')
    expect(css).toContain('grid-template-columns: 60px 1fr')
  })

  // SP8-P2b Task 10 评审补漏 —— McpTokensSection.vue 用了 .mcp-label/.mcp-reveal-warn
  // 但组件零 <style> 块,首次落地时漏收 Vue2 McpTokensSection.vue:245/246 的对应规则,
  // 补进本档后用这两条钉住选择器不会再被静默删掉。断言选择器**紧跟一个 `{`**(而不是裸
  // 子串)、且 `.mcp-reveal-warn` 后面确实带着 `color: var(--danger)` 声明 —— 光删规则、
  // 留注释这条会先因为上面 fixture 层的 stripComments() 就抓不到注释了,这里的 `{`/声明
  // 断言是第二道保险(即便日后 stripComments 被削弱,裸删规则本身也过不了)。仍然**只证明
  // 选择器与其声明存在**,不逐字比对全部取值(那部分由评审逐行比对 Vue2 源码负责,同本文件
  // 头注释的既定分工)。
  it('保留 McpTokensSection 明文弹窗的 .mcp-label / .mcp-reveal-warn(Vue2 :245/246 scoped 样式迁移)', () => {
    expect(css).toContain('.mcp-label {')
    expect(css).toContain('.mcp-reveal-warn {')
    expect(css).toContain('color: var(--danger)')
  })

  // SP8-P2b Task 12 —— ChannelsSection.vue 同样走「零 <style> 块」惯例(与 Task 10 的
  // .mcp-label/.mcp-reveal-warn 同一分工),Vue2 sections/ChannelsSection.vue:387-410
  // scoped 里的 .chan-* 规则(`.chan-x`/`.chan-x:hover` 已被 SkModal 的 `.sk-x` 收编,不搬)
  // 迁到本档。同上一条的两道保险:选择器紧跟 `{`(不是裸子串、不会被注释里的反引号类名
  // 撞对),并抓一条真实声明(`.chan-type-opt[data-active="true"]` 的
  // `border-color: var(--accent)`)证明规则体还在,不是只剩选择器空壳。
  // SP8-P2b 验收反馈(2026-07-30 用户拍板)—— Vue2 的 .px-open 底色是 `--accent-softer`,
  // 浅色主题下这层极浅的强调色几乎看不见,用户原话「看不出有按钮」。改成实底强调色 + 白字
  // (`--text-on-accent` 只在 accent 实底上可用,这里正是实底,符合既有约定)。
  // **有意偏离 Vue2 视觉 1:1,已在 ObservabilitySection.test.ts 用例 20 与台账登记。**
  it('.px-open 是实底强调色按钮(用户拍板偏离 Vue2 的 accent-softer)', () => {
    const at = css.indexOf('.px-open {')
    expect(at, '找不到 .px-open 规则').toBeGreaterThanOrEqual(0)
    const rule = css.slice(at, css.indexOf('}', at))
    expect(rule).toContain('background: var(--accent)')
    expect(rule).toContain('color: var(--text-on-accent)')
    // 反向:不能再留着旧的极浅底色
    expect(rule).not.toContain('--accent-softer')
  })

  it('保留 ChannelsSection 的 .chan-*(Vue2 :387-410 scoped 样式迁移)', () => {
    for (const sel of [
      '.chan-bot {', '.chan-model-lbl {', '.chan-switch {', '.chan-modal-warn {',
      '.chan-modal-hint {', '.chan-type-row {', '.chan-type-opt {',
      // 用户 2026-07-30 拍板新增:添加机器人失败的行内报错(取代 Vue2 的 danger toast)
      '.chan-field-err {',
      '.chan-type-opt[data-active="true"] {', '.chan-field-hint {', '.chan-invite {',
    ]) {
      expect(css).toContain(sel)
    }
    expect(css).toContain('border-color: var(--accent)')
  })
})

// SP8-P2b 验收缺陷(2026-07-30 用户报「浅色模式下执行步数的上下箭头底板是黑色」)——
// 根因不是取值写错,而是**作用域漏了 `color-scheme`**:`src/styles/theme.css` 只在 `:root`
// 声明 `color-scheme: dark`(New-UI 默认蓝/暗主题)与 `:root[data-theme="light"]` 的 light;
// 而 AI 区自建了一层嵌套主题作用域(`SettingsPage.vue:362` / `AgentPage.vue:295` 把
// `data-theme` 贴在 `.agent-app` 容器上,不动 `<html>`)。`color-scheme` 是可继承属性,
// AI 区没有自己声明,于是浅色 AI 页在全局暗色主题下继承到 `dark` → 浏览器按暗色 UA 调色板
// 画**原生控件内部**(`input[type=number]` 的上下箭头底板、原生 checkbox、插入符等),
// 于是浅底输入框上挂一块黑箭头板。
// Vue2 无此问题:老应用全局没有 `color-scheme: dark`(只有 Photos 一处 scoped),UA 默认按
// 浅色画,所以这是 New-UI 独有回归(全局暗默认 + 嵌套主题作用域两件事叠出来的),不是移植走样。
// 这条守卫钉住「AI 区两套主题块各自声明自己的 color-scheme」——只要谁把它删了就红。
function blockOf(css: string, selector: string, fromEnd = false): string {
  // fromEnd:`.ai-toast-scope {` 这个串也出现在两个主题块的**选择器列表**里
  // (`.agent-app,\n.ai-toast-scope {`),从头找会命中那一整块 token 表。独立的
  // `.ai-toast-scope` 覆盖块追加在文件末尾,故从后往前找才是它。
  const at = fromEnd ? css.lastIndexOf(selector) : css.indexOf(selector)
  expect(at, `tokens.scss 里找不到选择器 ${selector}`).toBeGreaterThanOrEqual(0)
  const rest = css.slice(at + selector.length)
  const end = rest.indexOf('\n}')
  expect(end, `${selector} 的规则体没有闭合`).toBeGreaterThan(0)
  return rest.slice(0, end)
}

describe('tokens.scss —— AI 区嵌套主题作用域必须自带 color-scheme', () => {
  const css = stripComments(read('./tokens.scss'))

  it('.agent-app(浅色基座)声明 color-scheme: light', () => {
    expect(blockOf(css, '.agent-app,\n.ai-toast-scope {')).toContain('color-scheme: light')
  })

  it('.agent-app[data-theme="dark"] 声明 color-scheme: dark', () => {
    expect(blockOf(css, '.agent-app[data-theme="dark"],\n.ai-toast-scope[data-theme="dark"] {'))
      .toContain('color-scheme: dark')
  })

  // 【SP8-P2b 验收第 3 轮】AI 区 toast 作用域(`.ai-toast-scope`)必须①能拿到整套 AI token
  // (靠挂在两个主题块的选择器上)②覆盖 toast 自己的那几个,否则 AppToast 会继续用全局蓝黑
  // 主题的半透明白底 + 白字,在 AI 浅色页面上看不见。详见 aiTheme.test.ts 的根因说明。
  it('.ai-toast-scope 挂在 AI 两套主题块的选择器上(才能拿到整套 AI token)', () => {
    expect(css).toContain('.agent-app,\n.ai-toast-scope {')
    expect(css).toContain('.agent-app[data-theme="dark"],\n.ai-toast-scope[data-theme="dark"] {')
  })

  it('.ai-toast-scope 覆盖 toast 的底色/前景色,且全部走 AI token(无裸色)', () => {
    const rule = blockOf(css, '.ai-toast-scope {', true)
    for (const decl of ['--toast-bg:', '--toast-fg:', '--toast-warn-bg:', '--toast-warn-fg:',
      '--toast-danger-bg:', '--toast-danger-fg:', '--chip-border:']) {
      expect(rule, `.ai-toast-scope 缺 ${decl}`).toContain(decl)
    }
    // 取值必须引用 AI token,不许写死颜色字面量
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(rule).not.toMatch(/rgba?\(/)
  })
})

describe('sk-shared.scss', () => {
  const css = stripComments(read('./sk-shared.scss'))

  it('导出设置区依赖的 6 条通用类', () => {
    for (const sel of [
      '.sk-section', '.sk-section-head', '.sk-section-title',
      '.sk-section-hint', '.sk-section-body', '.sk-btn',
    ]) {
      expect(css).toContain(sel)
    }
  })

  it('不重复定义 token', () => {
    const declarations = css.split('\n').filter((l: string) => /^\s*--[a-z-]+\s*:/.test(l))
    expect(declarations).toEqual([])
  })

  it('SP8-P2b Task 1 —— 导出弹窗外壳与表单字段两组类', () => {
    for (const sel of [
      '.sk-modal-bg', '.sk-modal', '.sk-modal-head', '.sk-modal-title',
      '.sk-modal-body', '.sk-modal-foot', '.sk-field', '.sk-field-label', '.sk-field-hint',
    ]) {
      expect(css).toContain(sel)
    }
  })

  it('SP8-P2b Task 1 —— 保留两个入场动画关键帧', () => {
    expect(css).toContain('@keyframes sk-fade-in')
    expect(css).toContain('@keyframes sk-pop')
  })
})
