# SP8-P3a Task 3 —— `SkillTile.vue` 独立评审

评审者:Claude(sonnet),不采信实现者报告,逐项回 Vue2 蓝本 + 自测。

## 0. 环境与提交纯净性

- `git status` 起始干净;`git show --stat HEAD`(7a0f693)只含
  `src/ai/components/settings/skills/SkillTile.vue` 与 `SkillTile.test.ts` 两个新文件。**提交纯净,确认。**

## 1. Vue2 蓝本 1:1 比对

蓝本 `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillTile.vue`(43 行)逐行读过。

- **props 默认值**:`color='blue'`/`icon='sparkle'`/`size=30`/`radius=9` —— New-UI `withDefaults` 逐字一致。✅
- **模板结构**:`.sk-tile` div + 内联 `:style` 四键(background/width/height/borderRadius)与 key 顺序、内部图标组件位置——一致。✅
- **颜色查表**:Vue2 `COLORS` 字面量表的 key 顺序(JS 对象字符串键按插入顺序)读取源码确认为
  `blue, purple, pink, orange, green, teal, slate`;New-UI `SKILL_COLOR_IDS` 数组顺序与之逐项相同。✅
  Vue2 每色的十六进制值(如 `blue: #5AC8FA→#007AFF`)与 `tokens.scss:228-234` 的
  `--grad-sk-*` token 值逐字比对,7 色全部精确一致(grep+Read 核对,非采信报告)。✅
- **未知 id 回落 blue**:Vue2 `:40` `COLORS[this.color] || COLORS.blue`;New-UI
  `bg` computed 用 `SKILL_COLOR_IDS.includes(props.color) ? props.color : 'blue'` 等价短路。
  独立 RED 验证见 §4。✅
- **内部图标尺寸算法**:`Math.round(size * 0.5)`,与 Vue2 `:11` 逐字相同(不是 `Math.floor`)。
  代码直接读取确认;未独立复算 round/floor 判别力(信实现者的 size=31 探针,但已读断言本身
  逻辑无误:31*0.5=15.5,round→16/floor→15,判别力充分)。

## 2. `color="white"` → `color="currentColor"` 偏离核查

Brief 明确点名这是需要核实的重点项,不在公共约束 §3 的 6 条预授权名单里。

- **AgentIcon.vue 语义核实**(自己读源码,非采信):`color` prop 默认值 `'currentColor'`
  (`AgentIcon.vue:76`),直接绑定到 `<svg :stroke="color">`(`AgentIcon.vue:84`)。
  AgentIcon 自身不设置 CSS `color` 属性,因此子元素 `currentColor` 会经由正常 CSS 继承
  拿到最近祖先(`.sk-tile` div)的 `color` 计算值。
- `.sk-tile { color: var(--text-on-accent) }` 由 Task 1 写入 `skills-styles.scss:117`,
  已用 grep+Read 核实存在;`--text-on-accent: #ffffff` 在 `tokens.scss:59`(浅色块)与
  `tokens.scss:267`(暗色块 241 起)**两套主题都有值**,均为纯白 —— 核实通过。
- 结论:渲染结果与 Vue2 `color="white"` 视觉等价(两套主题下都是纯白图标),且没有写死颜色字面量,
  符合 §6 硬约束。**功能上判定合规。**
- **流程瑕疵(Minor)**:组件头部注释与报告正文都详细说明了这一处理(三件套的①②实质满足),
  但报告「偏离申报」小节的清单只列了预授权第 2 条(SkillIcon→AgentIcon),没有把
  `white→currentColor` 也作为一条独立偏离正式列在该清单下 —— 是文档组织问题,不影响功能判定。

## 3. `SKILL_COLOR_IDS` 导出核查

- 用普通 `<script lang="ts">` 承载顶层 `export const SKILL_COLOR_IDS = [...] as const`,
  与 `<script setup lang="ts">` 并存 —— Vue SFC 官方支持的标准搭配(script setup 编译器确实
  不允许顶层 `export`),不是范式违规。
- 只含 id 字符串,不含颜色字面量。✅
- 全仓 grep `SKILL_COLOR` 除 SkillTile 自身外无消费方 —— 符合「P3a 无消费方,留给 P3b」的描述。

## 4. 独立 RED 验证(未采信实现者报告的结论,自己另做两次)

**探针 A(与实现者不同的破坏点)**:把 `<AgentIcon :name="icon" ...>` 硬编码成
`<AgentIcon name="sparkle" ...>`(破坏 icon prop 透传)。

```
❯ SkillTile.test.ts (14 tests | 1 failed)
  × icon prop 透传给内部 AgentIcon（默认 sparkle，对齐 Vue2 :36）
AssertionError: expected '<path d="M10 3l1.5 4.5L16 9l-4.5 1.5L…' not to be '<path d="M10 3l1.5 4.5L16 9l-4.5 1.5L…'
Tests  1 failed | 13 passed (14)
```
精确命中该用例,其余 13 例不受影响。已还原,重跑 `Tests 14 passed (14)`,`git status --porcelain` 为空。

**探针 B(针对 it.each 七色判别力,专门验证「查表映射错」而非「校验开关」)**:
在 `bg` computed 里插入 `const bugged = id === 'teal' ? 'slate' : id`(模拟 teal 被错误映射到 slate 的查表错误)。

```
❯ SkillTile.test.ts (14 tests | 1 failed)
  × color=teal → 渲染出对应的 --grad-sk-undefined token
AssertionError: expected 'background: var(--grad-sk-slate); wid…' to contain 'var(--grad-sk-teal)'
Tests  1 failed | 13 passed (14)
```
只有 `teal` 那一条 it.each 用例报红,其余 6 色 + 兜底/默认值等 13 例全绿 ——
证明 `it.each` 确实按 id 逐一判别,不是空转断言。已还原,重跑 `Tests 14 passed (14)`,
`git status --porcelain` 为空。

两次探针均已精确复原,最终 `git status` 干净。

## 5. 配色纪律

- 组件全文 grep `#[0-9a-fA-F]{3,6}|rgba?\(` 无命中(自己 grep 复核,非采信)。
- 唯一 `white` 字样在顶部 HTML 注释里(描述 Vue2 原文用词),且该注释不在任何 `<style>` 块内 ——
  读过 `color-guard.test.ts` 源码确认它只扫描 `.vue` 的 `<style>` 块与 `.css` 全文,
  不扫 template/script 区域的注释,因此不会被扫到,也无需 theme-exception 逃逸。
- 组件**零 `<style>` 块**(读源码确认)。唯一用到的类 `.sk-tile`,grep 确认定义在
  `skills-styles.scss:112-124`。

## 6. 测试门(自测,非采信报告数字)

```
pnpm test                  → exit=0, Test Files 288 passed (288), Tests 2365 passed (2365)
pnpm exec vue-tsc --noEmit → exit=0, 无输出
pnpm build                 → exit=0, 仅既有 >500KB chunk 警告(与本任务无关)
```
与报告自称数字一致。287/2350 → 288/2365 的 +15 已由协调者查明(+1 文件本身 + color-guard
动态按 `**/*.vue` 生成用例),本次复核不重复展开。

## 7. 结论

- 与 Vue2 1:1(props 默认值、DOM/class 结构、颜色映射表顺序与色值、未知 id 回落、
  内部图标尺寸算法)全部核实通过。
- `color="white"→currentColor` 偏离经独立核实功能等价(两主题皆纯白)、无颜色字面量、
  三件套①②实质满足,唯一瑕疵是报告「偏离申报」清单未把它单列一条(Minor,文档瑕疵非功能缺陷)。
- 测试判别力经两次独立 RED(与实现者报告不同的破坏点)验证真实,非空转。
- 提交纯净(仅 2 个本任务文件)。

**规格符合:✅ 通过**
**代码质量:通过**

无 Critical / Important 发现。1 条 Minor(流程文档瑕疵,见 §2)。
