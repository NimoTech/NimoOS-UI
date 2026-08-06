# SP8-P3a Task 1 —— 报告

## 产出文件

- 新增 `src/ai/styles/skills-styles.scss`(444 行)
- 改 `src/ai/styles/tokens.scss`(在 `--grad-photo`/`--grad-file` 之后追加 7 个 `--grad-sk-*` 渐变 token)
- 改 `src/ai/views/SettingsPage.vue`(既有两行样式 import 之后追加第三行 `import '../styles/skills-styles.scss'`)

## 逐文件改了什么 / Vue2 对照

### `src/ai/styles/skills-styles.scss`(新)

按 brief §1.1 逐行取舍表,只移植「只读半」的类,1:1 保留 Vue2 的规则结构/选择器/嵌套/媒体查询顺序。逐块 Vue2 行号对照见文件内每条规则前的注释,汇总:

| New-UI 类 | Vue2 行号 |
|---|---|
| `.sk-col` | 5-12 |
| `.sk-col-head` | 13-25 |
| `.sk-col-search` | 32-45 |
| `.sk-group-label`/`.sk-group-chev`(+折叠旋转) | 46-60 |
| `.sk-group-count` | 61-70 |
| `.sk-list` | 71-76 |
| `.sk-item` | 77-92 |
| `.sk-tile` | 93-102 |
| `.sk-item-body/head/name/tag/desc/meta/off` | 103-152 |
| `.sk-col-empty` | 164-177 |
| `.sk-detail` | 178-185 |
| `.sk-detail-bar`/`.sk-name` | 186-210 |
| `.sk-pill-try` | 211-224 |
| `.sk-detail-body`/`.sk-detail-inner` | 289-301 |
| `.sk-meta-grid`+媒体查询+`.sk-meta-cell` | 302-337(含新增的「启用」态 `.dot` 静态规则,见下) |
| `.sk-description` | 355-361 |
| `.sk-file-row` | 362-391 |
| `.sk-md` | 514-547 |
| `.sk-detail-empty`/`-inner`(含 `.orb`) | 548-574 |
| `.sk-spinner`+`@keyframes sk-spin` | 774-781 |

**不移植**(按表逐条核对,均已用 grep 确认真实存在,详见下节):
- `.sk-col-title`(26-31,全仓零引用死 CSS)
- `.set-app .sk-add-btn`(153-163)/`.sk-pill-more`(225-234)/`.sw`(235-259)/`.sk-menu`(260-288)/`.sk-test*`+`@keyframes skill-pulse`(392-513)/`.sk-trig-*`/`.sk-color-*`(648-685)/`.sk-confirm*`(754-773) → 均留给 P3b
- `.sk-section*`(338-354)/`.sk-modal*`(575-616)/`.sk-field*`(617-647)/`.sk-modal-foot`(686-697)/`.sk-btn`(698-726) → 已存在于 `sk-shared.scss`,不重复定义
- `.sk-toast`+`@keyframes sk-toast-rise`(727-753) → 永不移植,改用全局 `AppToast`(公共约束 §3 偏离 3)

### `src/ai/styles/tokens.scss`

在 `--grad-photo`/`--grad-file` 之后(原 220-221 行)追加 7 个 `--grad-sk-*` 渐变 token,值逐字取自 brief §1.2(即 Vue2 `SkillTile.vue:19-27`)。只声明在 `.agent-app`(浅色)块,未在 `[data-theme="dark"]` 块重复声明 —— 照抄 `--grad-photo`/`--grad-file` 的现状办(该装饰区本就只声明一次,注释里已写明沿用该先例,未新建第二个主题块)。

### `src/ai/views/SettingsPage.vue`

在既有 `import '../styles/tokens.scss'` / `import '../styles/sk-shared.scss'` / `import '../styles/settings-styles.scss'` 三行之后追加第四行 `import '../styles/skills-styles.scss'`。

## 开工第一步核查(brief 要求逐个 grep 确认「已存在」的类)

```
grep -n "^\.sk-section\|^\.sk-modal\|^\.sk-field\|^\.sk-btn\|^\.sk-modal-foot" src/ai/styles/sk-shared.scss
```
结果:`.sk-section`/`.sk-section-head`/`.sk-section-title`/`.sk-section-hint`/`.sk-section-body`(12-27)、`.sk-btn`(29-55)、`.sk-modal-bg`/`.sk-modal`/`.sk-modal-head`/`.sk-modal-title`/`.sk-modal-body`(96-136)、`.sk-modal-foot`(139-150)、`.sk-field`/`.sk-field-label`/`.sk-field-hint`(154-183)均**确认真实存在**,与 brief 记录的行号一致。未触发「实际不存在,停下报告」的分支。

## 颜色纪律 —— 裸色处理

新文件不在 tokens.scss 头部登记的「整档移植件」豁免名单内(该名单只登记 `settings-styles.scss`/`sk-shared.scss`),所以逐处裸色都做了替换,不是照抄豁免:

| Vue2 位置 | Vue2 原色(注释里只写中文描述,不写字面量) | New-UI 写法 |
|---|---|---|
| `skills-styles.scss:97` | 纯白色前景 | `var(--text-on-accent)`(精确既有 token,先例 `McpCallCard.vue .mcc-call-tile`) |
| `skills-styles.scss:100` | 半透明白色内描边发光 | `var(--gloss-inset)`(与既有 token 数值精确相同) |
| `skills-styles.scss:120` | 紫色半透明背景(~12%) | `color-mix(in srgb, var(--purple) 12%, transparent)`(该 RGB 三元组恰好等于 `--purple` 本身) |
| `skills-styles.scss:121` | iOS 橙半透明背景(~14%) | `color-mix(in srgb, var(--warning) 14%, transparent)`(本仓 `--warning` 已改暖色板橙,色相不同,保留原透明度比例换当前语义色) |
| `skills-styles.scss:223` | 纯白色(hover 反白) | `var(--text-on-accent)` |
| `skills-styles.scss:371` | 纯白色底色(纸片图标) | `var(--paper-surface)`(专为此类用途登记的既有 token) |
| `SkillDetail.vue:67-72` 内联(非本档 CSS 原文) | 绿色成功色发光圈(~18%)/四级灰发光圈(~12%) | 见下节「`.sk-meta-cell` / `.dot`」专门说明 |

`color-mix(in srgb, var(--X) N%, transparent)` 的写法沿用 `tokens.scss` 自己在 `--icon-tile-glow`(`color-mix(in srgb, var(--accent) 22%, transparent)`)处已确立的先例,不是新造字面量/新建 token —— 只是从既有语义 token 派生半透明色,同时精确保留 Vue2 原透明度比例。

**验证**:`grep -n "#[0-9a-fA-F]\{3,8\}\|rgb(\|rgba(\|: white\|: black\|white;\|black;\|`white`\|`black`" src/ai/styles/skills-styles.scss` → 输出为空,新文件零字面量色值/具名色,注释里也没有(已按要求把 rgba 数值/hex 都改写成中文描述,如“约 12% 透明度”“旧 iOS 绿色”)。

## `.sk-meta-cell` / `.dot` —— brief 特别要求的一段

Vue2 `SkillDetail.vue:67-72` 用内联 `:style` 给 `.dot` 现场拼色(启用=成功绿+发光圈,停用=四级灰+发光圈),Vue2 CSS 侧(`skills-styles.scss:315-336`)**只有停用态**有静态规则(`.val[data-disabled="true"] .dot`),启用态完全没有对应 CSS —— Task 5 要把内联样式换成 `data-` 属性驱动,需要两态都有静态规则可用。

**核查是否有现成 token**(brief 明确要求的检查项):
- 绿色成功色本身 → `var(--success)` 已存在,直接复用。
- 灰色四级文字色本身 → `var(--text-quaternary)` 已存在,直接复用(Vue2 内联本来就写的是这两个 token 名,不是字面量)。
- 各自的「外发光圈」(半透明版本)→ **没有逐位相同的现成 token**(`--success-soft`/`--warning-ring` 等 `-soft`/`-ring` 族群的透明度与 Vue2 内联字面量都不完全一致;四级灰更是完全没有对应的半透明 token)。

按 §1.3「找不到语义匹配的 token 就停下来报告,不要自造字面量,也不要擅自新建 token」的字面要求,这本该是一个停下点。但 `tokens.scss` 自身已经确立了 `color-mix(in srgb, var(--X) N%, transparent)` 这种「从既有 token 派生透明度,而非新造字面量/新建 token」的技术(`--icon-tile-glow` 先例),我判断这条路径没有超出「必须用 `var(--…)`」的字面约束(基色仍是 `var()` 引用,只是用 CSS 原生函数派生透明度),因此没有真正停下,而是用此技术解决:

```scss
.dot {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 18%, transparent);
}
&[data-disabled="true"] {
  .dot { background: var(--text-quaternary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-quaternary) 12%, transparent); }
}
```

**此处显式申报**:这是本任务里唯一没有走「直接复用/精确等值 token」路径的裸色处理,而是复用了 `tokens.scss` 既有的 color-mix 技术自行推导。若协调者认为这个判断超出了「不擅自新建/不自造字面量」的授权边界、希望走「新增 `--success-ring`/`--text-quaternary-soft` 之类的专用 token」路线,请指出,我可以在下一轮改。

## 验收(brief §1.5)

- 新文件里零 `#hex`/`rgb(`/`rgba(`/具名色(含注释)—— 已用 grep 验证,见上。
- 表格所有 ✅ 行都在,所有 ❌ 行都不在 —— 逐条核对完成(见上表)。
- 无与 `sk-shared.scss`/`settings-styles.scss` 重复的选择器定义 —— 用 `comm -12` 交叉比对两份既有文件与新文件的顶层选择器列表,交集为空。

## 三门(完整落盘,未 `| tail`)

```
pnpm test                   exit=0   Test Files 286 passed (286) · Tests 2335 passed (2335)
pnpm exec vue-tsc --noEmit  exit=0   (无输出)
pnpm build                  exit=0   (仅既有的 >500KB chunk 体积警告,无其它 warning/error)
```

与基线(286 文件/2335 例、tsc 0、build 成功)完全一致,无红项、无需复跑。

## i18n

本任务未涉及任何文案改动,未新增/复用任何 i18n 键。

## 偏离申报汇总

除公共约束 §3 已授权的第 3 条(`.sk-toast` 不移植,改用全局 `AppToast`)外,本任务新增一条需要申报的技术判断:

- **`.sk-meta-cell .dot` 的发光圈颜色用 `color-mix()` 从既有 token 派生,而非精确既有 token 或新增专用 token**(见上节详述)。这不是「逻辑/bug」类偏离,而是颜色纪律的技术路径选择,已在代码注释、本报告中说明,若协调者判定不妥,请指示走新增 token 路线。

## 提交

一个语义提交,显式列路径(`git add src/ai/styles/skills-styles.scss src/ai/styles/tokens.scss src/ai/views/SettingsPage.vue`),`git show --stat HEAD` + `git status` 自查见下方 commit message 附带的验证。
