# SP8-P3b Task 1 —— 样式底座(写操作半)+ `pause` 图标 · 实现报告

## 逐文件改动

### `src/ai/styles/skills-styles.scss`

替换了 6 处「留给 P3b」占位注释,新增 CSS 规则,未改动任何既有规则。

| Vue2 `skills-styles.scss` 行号 | 选择器 | 本文件落点(改后行号) |
|---|---|---|
| 153-163 | `.set-app .sk-add-btn` | 180-198 |
| 225-234 | `.sk-pill-more` | 267-275 |
| (确认存在,不移植) | `.sw` | 277-279(仅留一条 grep 复核注释,确认已在 `sk-shared.scss:66-88`) |
| 260-288 | `.sk-menu` | 281-313 |
| 392-513 | `.sk-test*` 全家 + `@keyframes skill-pulse` | 424-556 |
| 648-669 | `.sk-trig-options` / `.sk-trig-option` | 653-674 |
| 670-685 | `.sk-color-row` / `.sk-color-dot`(+ 7 条 `data-color` 规则) | 676-711 |
| 754-773 | `.sk-confirm` / `-body` / `-skill` | 716-734 |

`.sw`(235-259)与 `.sk-toast`+`@keyframes sk-toast-rise`(727-753)按任务书 ❌ 表未动:
- 开工第一步 `grep -n "\.sw\b" src/ai/styles/sk-shared.scss` 确认 `.sw` 已在
  `sk-shared.scss:66-88`(SP8-P2a Task 6 已移植)—— 属实,未重复定义。
- `.sk-toast` 永不移植(公共约束 §3 偏离 10,已用全局 toast),未改动原有注释。

### `src/ai/components/icons/AgentIcon.vue`

在 `play`(:22)与 `code`(原 :23,现 :26)之间插入一条 `pause` 图标(:23-25):
```
pause: '<path d="M7 4v12M13 4v12"/>',
```
逐字取自 brief §1.3 给的例子,20 单位坐标系,无 `fill`,走 `stroke="currentColor"`(组件默认
`color` prop 就是 `currentColor`),不改任何既有图标路径数据。

### `src/ai/styles/tokens.scss`

新增 1 个 token `--gloss-inset-dot`,浅色块(:154 后)与暗色块(:310 后)各一条,值均为
`inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)`(理由见下方色字面量表)。

## 每个色字面量的处理方式(逐条,按 8 段扫描结果)

逐行扫过 8 段范围内的所有色字面量,结果如下(除下列 6 处,其余全部本身已是
token,原样搬无需改动):

| Vue2 位置 | 原字面量 | 处理 |
|---|---|---|
| `:158`(`.sk-add-btn`) | 纯白色前景 | 复用既有 `--text-on-accent`。**这就是协调者预先解歧义①**——Vue2 原文本身就带这条前景色声明,不是缺失,只需脱色成 token;下游 Task 8 往按钮里塞 `AgentIcon` 不传具名色,靠这条 `color` 声明经 `currentColor` 继承拿到白字。 |
| `:283`(`.sk-menu` danger hover) | iOS 红色约 8% 透明度背景 | `color-mix(in srgb, var(--danger) 8%, transparent)` —— 沿用本档已确立的 color-mix 派生惯例(`.sk-item-tag` 先例),不新造字面量。 |
| `:438`(`.sk-test-input button`) | 纯白色前景 | 复用既有 `--text-on-accent`,同 `.sk-add-btn`/`.sk-pill-try:hover` 场景。 |
| `:465`(`.sk-test-result .bullet`) | iOS 绿色约 18% 透明度发光圈 | `color-mix(in srgb, var(--success) 18%, transparent)` —— 与 `.sk-meta-cell` 「启用」态发光圈(本档既有,P3a 已建)完全同族同比例,同法派生。 |
| `:677`(`.sk-color-dot` 内描边发光) | 白色约 20% 透明度内描边发光 | **新增 token** `--gloss-inset-dot`(见下)。 |
| `AddSkillModal.vue:61` 内联 `:style` | 渐变字符串(7 色) | 改 `data-color` 属性 + 7 条 `[data-color="…"] { background: var(--grad-sk-…) }` 静态规则,复用 P3a Task 1 已建的 7 个 `--grad-sk-*` token(见下方复核结论)。 |

## 新增/复用的 token

- **复用**:`--text-on-accent`(×2 处)、`--danger`(color-mix 底色)、`--success`(color-mix 底色)、
  7 个 `--grad-sk-*`(blue/purple/pink/orange/green/teal/slate,P3a Task 1 已建)。
- **新增 1 个**:`--gloss-inset-dot: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)`。
  - 理由:`.sk-color-dot` 的内描边发光与已有 `--gloss-inset`(`.sk-tile`/McpCallCard 用)是
    同一「彩色色块 + 白色内描边发光」语义族,但 Vue2 两处字面量透明度不同(约 20% 对约
    18%),不是同一个值。按本仓已有先例(`tokens.scss:175-180` 的 `--modal-scrim-soft`
    相对 `--modal-scrim` 就是同族不同值各开一个 token 的做法)新增独立 token 以精确保留
    Vue2 原值,不与 `--gloss-inset` 合并复用引入可见漂移。
  - 浅色块与暗色块均给出**相同**字面量(理由与 `--gloss-inset`/`--paper-surface`/
    `--switch-thumb` 等既有「皮肤无关 chrome 细节」token 同款:两套主题都该长一样)。
  - **未登记进 `tokens.scss` 头部例外清单 / `docs/THEMING.md`** —— 因为它不是「豁免」
    (跳过 token 系统),而是一个正常 token,在浅色块与暗色块都显式给了值,和
    `--gloss-inset`/`--paper-surface`/`--switch-thumb` 这批已有的、同样从未被登记进
    例外清单的「主题无关 chrome 细节」token 属于同一类。已核对 `tokens.scss` 头部例外
    清单与 `docs/THEMING.md` §6 表,两处均只登记「完全不受 CSS 变量管辖的原始字面量」
    (PALETTES 数组、DRIVE_PALETTE、`.ic-*`、第三方库主题),不含这类正常 token,故不
    需要追加登记。

## 偏离申报(公共约束 §3 命中项)

- **偏离 8**(`.sk-color-dot` 不用内联 `:style` 传色)—— brief §1.2 已预先授权,本任务
  在 scss 侧落地为 `data-color` 属性 + 7 条静态规则,组件侧(Task 5)负责写
  `:data-color="c.id"`。三件套:①本档 :697-703 行内注释已注明 Vue2 `AddSkillModal.vue:61`
  的问题与本处改法 ②本报告本节申报 ③台账由协调者据此登记。
- **偏离 10**(`.sk-toast` 不移植)—— 本任务未新触碰该逻辑,只是保留了 P3a 已写好的
  既有申报注释(:713-714),未重复展开。
- **协调者预先解歧义①**(`.sk-add-btn` 需要前景色声明)—— 已在上表说明:Vue2 原文本身
  就有 `color: #fff`,不是缺失,只是脱色;非「新增」偏离,是正常移植 + 配色纪律脱色。
- **协调者预先解歧义②**(`--grad-sk-*` 7 个 token 是否存在)—— 已 `grep tokens.scss`
  逐个核对,7 个 token(`--grad-sk-blue/purple/pink/orange/green/teal/slate`)确实存在
  于 :228-234,拼写与本仓 `SkillTile.vue` 的 `SKILL_COLOR_IDS`(`['blue','purple','pink',
  'orange','green','teal','slate']`)完全一致,与 Vue2 `SkillTile.vue:18-26` 的 COLORS key
  顺序也一致。**按现状办,未新增/未改名**。

## 开工第一步的两条 grep 复核结论(brief 要求)

- `.sw`:存在,`src/ai/styles/sk-shared.scss:66-88`(SP8-P2a Task 6)。
- `.sk-toast`:存在(作为「永不移植」的既有决定,不是需要复核存在与否的移植目标;
  `.sk-toast` 本身**没有**被移植到任何本仓文件,已按公共约束确认改用全局 toast)。

## 验收结果

```
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|\b(white|black|red)\b' src/ai/styles/skills-styles.scss
```
命中仅 2 处,均为既有 `white-space` CSS 属性名(`\bwhite\b` 对 `white-space` 的误命中,
非新增,非颜色字面量):第 132、260 行(均是 P3a 已有的 `.sk-item-name`/`.sk-pill-try` 里的
`white-space: nowrap`)。**新增行零命中。**

（首次落笔时曾在解释性注释里直接写出 Vue2 原始 `rgba(...)`/`#fff`/`white` 字样,复查
P3a 既有惯例后发现这违反「注释里也不许出现 Vue2 原始色字面量」的规则，已全部改写成
中文措辞的透明度描述，例如「iOS 红色约 8% 透明度」，不再含可疑字面量。）

## 三门终值

```
pnpm test                    exit=0   Test Files 291 passed (291)   Tests 2418 passed (2418)
pnpm exec vue-tsc --noEmit    exit=0   （无输出,无类型错误）
pnpm build                    exit=0   仅 >500KB chunk 警告(既有,非本任务引入)
```

用例数与基线 2418 完全持平(本任务未新增任何 `.vue` 文件,符合验收预期)。
`persist.test.ts` 已知 flaky 未出现红。

## RED 验证

本任务是纯 CSS + 图标表新增,没有写任何新的自动化断言,因此不存在「削弱现有断言」
或「空转用例」的风险,但仍做了一次针对性 RED 探针,验证「本任务改动是否真的被某条自动
化守卫覆盖」:

- **探针**:临时把新增的 `pause` 图标改成 `pause: '<path d="M7 4v12M13 4v12"
  fill="#ff00ff"/>'`(注入一个具名十六进制色字面量),单独跑
  `pnpm exec vitest run src/styles/color-guard.test.ts`。
- **结果**:**165 例全绿,守卫未报红。**
- **结论/顾虑**:`color-guard.test.ts` 只扫 `.vue` 的 `<style>` 块;`AgentIcon.vue`
  **没有** `<style>` 块(颜色走 SVG 属性字符串,活在 `<script>` 里),因此这条守卫对
  图标表里的颜色字面量**完全没有覆盖**——与 `.scss` 同样,`pause` 图标"不传具名色、
  走 currentColor"这条纪律目前只能靠评审人肉扫,不在任何回归网内。已把探针还原
  (`git diff` 显示 `AgentIcon.vue` 只剩 3 行新增,即预期的 `pause` 条目本身)。
- 已用 `git diff src/ai/components/icons/AgentIcon.vue` 确认还原干净,随后重跑
  `pnpm test` 复核为 291/2418 全绿(与探针前一致)。

## i18n

本任务不涉及文案,零新增/复用键。

## 偏离清单汇总(公共约束 §2 三件套齐全性自查)

| 偏离 | ①代码注释 | ②本报告 | ③台账 |
|---|---|---|---|
| `.sk-color-dot` 改 `data-color`+SCSS(偏离 8) | ✅ :697-703 | ✅ 上节 | 待协调者登记 |
| 新增 `--gloss-inset-dot` token | ✅ :684-689(scss)+ tokens.scss 注释 | ✅ 上节 | 视协调者判断是否需登记(本报告已论证非「豁免」) |

无其它未申报偏离。

## 自查

`git status` / `git show --stat` 待提交后自查,改动范围应仅含：
`src/ai/styles/skills-styles.scss`、`src/ai/components/icons/AgentIcon.vue`、
`src/ai/styles/tokens.scss` 三个文件。
