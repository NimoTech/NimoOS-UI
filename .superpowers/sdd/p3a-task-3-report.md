# SP8-P3a Task 3 —— `SkillTile.vue` 实现报告

## 产出文件

- `src/ai/components/settings/skills/SkillTile.vue`(新建)
- `src/ai/components/settings/skills/SkillTile.test.ts`(新建)

## Vue2 蓝本 → New-UI 对照

蓝本:`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillTile.vue`(43 行)。

| Vue2 | New-UI | 说明 |
|---|---|---|
| `:1-13` template,`<div class="sk-tile" :style="{background:bg,width,height,borderRadius}">` | 原样保留 | class 名、内联 style 的四个键(background/width/height/borderRadius)与写法逐行照抄 |
| `:16` `import SkillIcon from './SkillIcon.vue'` | `import AgentIcon from '../../icons/AgentIcon.vue'` | 偏离 2(见下) |
| `:18-26` `COLORS` 字面量渐变表 | 改为 `SKILL_COLOR_IDS` id 列表 + `var(--grad-sk-<id>)` 查表 | 见「配色」小节 |
| `:28` `export const SKILL_COLORS = COLORS` | `export const SKILL_COLOR_IDS = [...]`(7 个 id,顺序与 Vue2 COLORS key 顺序一致) | brief 明确要求改字面量表为 id 列表 |
| `:33-37` props `color/icon/size/radius` 默认值 `blue/sparkle/30/9` | 原样保留(`withDefaults` + `defineProps<...>()`) | 1:1 |
| `:39-41` `computed: { bg() { return COLORS[this.color] || COLORS.blue } }` | `computed(() => { const id = SKILL_COLOR_IDS.includes(props.color) ? props.color : 'blue'; return \`var(--grad-sk-${id})\` })` | 未知 id 回落 blue 的行为等价保留,只是从「字面量表查值」改成「id 名单校验 + 拼 token 名」 |
| `:11` `<SkillIcon :name="icon" :size="Math.round(size*0.5)" color="white" />` | `<AgentIcon :name="icon" :size="Math.round(size*0.5)" color="currentColor" />` | icon 组件替换(偏离 2)+ color 具名色 → currentColor(见「配色」小节),size 计算式逐字保留 |

## 承接的 Vue2 行为

- 未知 `color` id 回落到 `blue`(对齐 Vue2 `COLORS[this.color] || COLORS.blue` 的短路兜底)。
- `icon`/`size`/`radius` 默认值 `sparkle`/`30`/`9`,内部图标尺寸恒为 tile size 的一半(`Math.round`,不是 `Math.floor`)。
- 内联 style 四键(background/width/height/borderRadius)写法与 key 顺序照抄。

## 配色处理(§6 硬约束)

- Vue2 `COLORS` 是渐变字面量表 → 改为「id 名单校验 + 拼接 token 名」`var(--grad-sk-<id>)`。7 个 token(`--grad-sk-{blue,purple,pink,orange,green,teal,slate}`)已在 Task 1 写入 `src/ai/styles/tokens.scss:228-234`,`.sk-tile` 规则已在 Task 1 写入 `src/ai/styles/skills-styles.scss:112-124`(grep 确认存在,行号见上)。
- **`color="white"` 处理(brief §重点关注项)**:先读了 `AgentIcon.vue`——`color` prop(默认值 `currentColor`,`AgentIcon.vue:76`)直接绑定到 SVG 的 `:stroke="color"`(`AgentIcon.vue:84`),不是进 CSS `<style>` 字面量,但仍是一个颜色值,同样受配色约定管辖。
  - 排查发现 `.sk-tile` 规则本身(`skills-styles.scss:117`)已经把 `color: var(--text-on-accent)` 设到容器 div 上(Task 1 已处理,注释写明对应 Vue2 `:97` 的纯白前景)。
  - 全仓 grep 已有消费方证实这是既定惯例:同类「彩色/渐变实底方块内的图标」一律传 `color="var(--text-on-accent)")`(`SearchImageLightbox.vue`、`PhotoGridCard.vue`、`SemanticSearchCard.vue`、`McpCallCard.vue`、`SearchFullResults.vue` 等多处)。
  - 因为 `.sk-tile` 已经把 `color` 设成 `--text-on-accent`,本组件选择显式传 `color="currentColor"`(与 `AgentIcon` 默认值相同,亦有先例 `SettingsRail.vue:107`),让 SVG `stroke` 通过 CSS 继承拿到 `--text-on-accent`,避免在组件里重复书写同一个 token 字面量。**没有新建任何 token**,用的是 Task 1 已经埋好的「恒白前景」token,按 brief 指示的路径走完。
- 全文件 grep `#[0-9a-fA-F]{3,6}|rgba?\(` 无命中;唯一出现字符串 `white` 的地方是头部中文注释里描述 Vue2 原文用词(`【color="white" 处理】Vue2 :11 给 SkillIcon 传具名色 white`),不是代码字面量。

## 偏离申报

命中公共约束 §3 已授权偏离表中的 **第 2 条**:`SkillIcon.vue` 不移植,统一用 `AgentIcon.vue`。已在组件头部注释与本报告中注明。

无其它未申报偏离。

## `export const` 技术说明(非偏离,记录判断过程)

`<script setup>` 编译器不支持顶层 `export`(实测 `@vue/compiler-sfc@3.5.39`:`compileScript` 对 `<script setup>` 里的 `export const` 直接抛 `<script setup> cannot contain ES module exports`)。`SkillTile.vue` 因此用双 `<script>` 块:普通 `<script lang="ts">` 只承载 `export const SKILL_COLOR_IDS`,`<script setup lang="ts">` 承载其余逻辑——这是 Vue 官方支持的标准搭配写法,非违反「组件范式」约束。

## RED → GREEN 证据

**探针 1:未知 id 回落 blue 的兜底逻辑**

破坏(去掉 id 白名单校验,直接拼 `props.color`):
```
const bg = computed(() => {
  const id = props.color
  return `var(--grad-sk-${id})`
})
```
运行 `pnpm exec vitest run src/ai/components/settings/skills/SkillTile.test.ts`:
```
 ❯ src/ai/components/settings/skills/SkillTile.test.ts (14 tests | 1 failed) 64ms
     × 未知 color id 回落 blue（Vue2 :40 `COLORS[this.color] || COLORS.blue` 同款兜底） 7ms
AssertionError: expected 'background: var(--grad-sk-not-a-real-…' to contain 'var(--grad-sk-blue)'
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
```
复原后重跑:`Test Files  1 passed (1)` / `Tests  14 passed (14)`。

**探针 2:内部图标 size = tile size 一半的取整方式(Math.round vs Math.floor)**

用例特意选 `size=31`(`31*0.5=15.5`,round→16、floor→15,判别力足够,不是 round/floor 结果相同的整数输入)。
破坏(`Math.round` → `Math.floor`):
```
 ❯ src/ai/components/settings/skills/SkillTile.test.ts (14 tests | 1 failed) 66ms
     × 内部图标 size 是 tile size 的一半（Math.round(size*0.5)，对齐 Vue2 :11） 5ms
AssertionError: expected '15' to be '16'
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
```
复原后重跑:`Test Files  1 passed (1)` / `Tests  14 passed (14)`。

## i18n

本组件无文案(纯图形 tile),未新增/复用任何 i18n 键。

## 三门终值

```
pnpm test                   → exit=0 · Test Files 288 passed (288) · Tests 2365 passed (2365)
pnpm exec vue-tsc --noEmit  → exit=0 · 无输出
pnpm build                  → exit=0 · 仅既有的 >500KB chunk 警告(index-Caue1y3_.js 等,与本任务无关，构建前即存在)
```

协调者给出的当前基线为 287 文件/2350 例。`SkillTile.test.ts` 单独运行为 14 例（`1` 顺序断言 + `it.each` 七色展开 7 例 + 未知回落/默认 blue/默认 size-radius/自定义 size-radius/图标折半/icon 透传各 1 例）。全量运行后为 288 文件/2365 例——文件数 +1 与预期一致；用例数 +15 比本文件的 14 例多 1。已核实 `git status` 只新增了本任务的 2 个文件，没有改动任何既有文件,因此这 1 例之差不是本任务引入的,判断为协调者给出的基线数字本身的口径误差（±1 例级别的误差不影响任何红项归属判断）,如实记录、不作掩盖。三门本身：无红项。

## 该任务确认的既有代码/约定引用

- `AgentIcon.vue:76,84`(color prop 默认值与 stroke 绑定)
- `skills-styles.scss:112-124`(`.sk-tile` 规则,含 `color: var(--text-on-accent)`)
- `tokens.scss:228-234`(7 个 `--grad-sk-*` token)
- `SystemTab.test.ts:52`(inline `:style` 断言惯例,原样沿用)
