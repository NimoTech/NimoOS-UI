# Task 3 报告:行级 UI 原语 + 文案/token 分片

## 实现内容

严格按 brief 逐字实现,未做任何偏离:

1. **`src/styles/theme.sp9.css`**:两个主题块(`:root` / `:root[data-theme='light']`)各加一行 `--set-warn-fg`(深色 `#f0b429`,浅色 `#b7791f`)。
2. **`src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`**:各追加 60 个 P1 文案键(general / 电源流 / developer 三段),同名同序,逐字取自 brief。
3. **`src/settings/components/SettingsRow.vue`**(新建):行骨架组件。`clickable` 时根元素渲染为 `<button>` 并带 `.set-chevron`(›),否则渲染 `<div>`;`disabled` 时 `<button disabled>` 且点击守卫双重生效(属性 + 处理函数内判断);`sub` 与 `hint` 具名插槽按需渲染。
4. **`src/settings/components/SettingsSwitch.vue`**(新建):纯图形开关,`role=switch` + `aria-checked` + `aria-label`(用 `label` prop,不渲染可见文字);完全受控——只 `emit('update:modelValue', !modelValue)`,自身不持状态、点击后不改渲染的 class(由父组件决定是否落库后回写 v-model)。
5. **`src/settings/components/SettingsRow.test.ts` / `SettingsSwitch.test.ts`**(新建):brief 给出的 6+4 个测试用例,逐字誊写。
6. **`src/settings/styles/settings.css`**:追加公共骨架样式——`.set-list`(卡片容器)、`.set-list-item`(含 `.clickable`/`:disabled` 状态)、`.set-row-text/label/sub/ctl`、`.set-chevron`、`.set-row-hint`、`.set-switch`/`.set-switch-thumb`(含 `.on` 态)、`.set-select`/`.set-input`(药丸风原生表单控件)、`.set-btn`/`.set-btn.primary`(变体自带 `:hover`,避免基类 hover 优先级洗色)、`.set-card`、`.set-ok`/`.set-info`/`.set-warn`/`.set-danger` 状态文字。全部颜色走 token,零字面量。

本任务不渲染任何页面/面板——纯原语与资源分片,供后续任务(4-11)消费。

## 命令与结果

| 步骤 | 命令 | 结果 |
|---|---|---|
| 基线 | `pnpm test` | 270 files / 1946 tests,全绿 |
| Step1 | `pnpm test src/styles/theme.sp9.test.ts src/styles/color-guard.test.ts` | 2 files / 144 tests 通过 |
| Step2 | `pnpm test src/i18n/parity.test.ts` | 1 file / 5 tests 通过 |
| Step4 | `pnpm test src/settings/components/SettingsRow.test.ts src/settings/components/SettingsSwitch.test.ts`(实现前) | 2 files failed —— `Failed to resolve import "./SettingsRow.vue"` / `"./SettingsSwitch.vue"`,确认红灯为"文件不存在"而非用例本身错误 |
| Step8a | `pnpm test src/settings src/styles src/i18n` | 14 files / 230 tests 通过 |
| Step8b(任务门) | `pnpm test` | **272 files / 1958 tests,全绿**(较基线 +2 files / +12 tests,与本任务新增的 2 个测试文件、12 个 `it` 用例精确对应) |
| Step8c(任务门) | `pnpm exec vue-tsc --noEmit` | 零错误,无输出 |

## 提交

- **commit SHA**:`3d2cc0f`
- 提交前 `git status --short` 确认:3 行 `design-export/*.html` 的 `D`(不属于本任务,未触碰)仍在原位;唯一的 untracked `docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md`(非本任务产物)未被 add/commit。
- 提交路径与 brief 给出的 pathspec 完全一致(8 个文件,含 4 个新文件 + 4 个修改文件),未使用 `git add -A` / `git commit -a`。

## 对 brief 的疑虑/风险(仅供记录,未改动实现)

1. **消费 token 清单与实际用到的 token 不完全一致**:brief 「Interfaces」段列出的既有 token 清单里没有 `--accent-text` 和 `--chip-bg-hi`,但 Step 7 给的 CSS 里用到了这两个(`.set-list-item.clickable:hover { color: var(--accent-text) }`、`.set-btn:hover:not(:disabled) { background: var(--chip-bg-hi) }`)。核实 `src/styles/theme.css` 两个主题块里都已定义这两个 token(`--accent-text`、`--chip-bg-hi`),所以没有违反"颜色只能来自 token"的约束,只是清单本身遗漏了这两项——不影响实现,仅供后续任务作者核对时留意。
2. **`SettingsRow.vue` 的 `<component :is>` 用法**:`clickable` 为 `false`/`undefined` 时用 `<div>` 承载整行,`div` 上仍绑了 `@click` 处理器,但由于 `clickable && !disabled && emit(...)` 条件短路,非 clickable 时点击不会 emit——这与 brief 给的模板逐字一致,行为符合"非 clickable 不可聚焦"的测试断言(`div` 本身没有 `tabindex`,不在 tab 序列里)。没有发现需要偏离的地方。
3. **`disabled` 测试用例里的注释提到"@vue/test-utils 的 trigger 对 disabled 元素照样会派发"**:验证属实——原生 `<button disabled>` 在 jsdom/happy-dom 环境下用 `.trigger('click')` 确实会派发事件(不像真实浏览器会拦截),brief 已经预见到这点并要求组件内部也要有 disabled 守卫(而非只依赖原生 `disabled` 属性),实现里 `@click="clickable && !disabled && emit('click')"` 满足这一点。没有问题,只是想指出这是个容易让人误判"测试通过=真实浏览器行为一致"的陷阱,值得记在案头(类似 CLAUDE.md 记忆里提到的其他 jsdom 差异坑)。

其余均按 brief 字面实现,未发现需要报告的风险或错误。
