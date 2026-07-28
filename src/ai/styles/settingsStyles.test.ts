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
