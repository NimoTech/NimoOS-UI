# SP8-P3a 整期终审(whole-branch review)

- 范围:`105e6bb..4e871fb`(8 提交,19 文件,+1935/-22)
- 分支:`sp8-ai` @ `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`
- 蓝本:`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/`(7 组件 + `skills-styles.scss` 782 行)
- 纪律声明:**未采信任何 task report / task review**。所有结论来自自读源文件、自 grep、
  自比 Vue2 蓝本与 Vue2 生产语言包、自查 `dist/assets/index-CVFAZmQD.css` 构建产物。
- **仓库未改动**:终审末 `git status --porcelain` 空(见 §9 RED 探针说明)。

**总判定:需修后合并** —— 1 条 Important(跨文件 CSS 优先级碰撞,视觉 1:1 破坏),
7 条 Minor。0 Critical。只读性、i18n、配色、单层取数口径四条主线全部干净。

---

## 1. 只读性审计(整期是否真的"只读")

### 1.1 写操作 API 路径

```
grep -rn "createSkill|updateSkill|deleteSkill|streamSkillTest|exportSkillURL|getSkill" src/
→ 零命中(全仓,不只是新文件)
```

共享包 `../NimoOS-Service/dist/ai.d.ts:75-83` 确实导出了这 6 个方法(且 `streamSkillTest`
**尚不存在**,与设计 §10 一致 —— P3b 要跨仓补)。P3a 只用了 `listSkills()`
(`SkillsSection.vue:93`)。**通篇零写操作路径。**

### 1.2 死控件普查

7 个新文件里全部可交互元素,逐个核 handler:

| 元素 | 坐标 | handler | 活/死 |
|---|---|---|---|
| 刷新按钮 `.icon-btn` | SkillsSection.vue:118 | `@click="reload"` | 活 |
| 清空搜索 `.icon-btn` | SkillsSection.vue:126-133 | `@click="query = ''"`,`v-if="query"` | 活 |
| 组标题折叠 `.sk-group-label` | SkillGroup.vue:70-74 | `@click="collapsed = !collapsed"` | 活 |
| 条目 `.sk-item` | SkillGroup.vue:80-87 | `@click="emit('pick', s.id)"` | 活 |
| 「在对话中试用」`.sk-pill-try` | SkillDetail.vue:116 | `@click="tryInChat"` → `/ai/agent?skill=` | 活 |
| 搜索 `<input>` | SkillsSection.vue:125 | `v-model="query"` | 活 |

**零死控件。** 另核:`.sw` / `.sk-pill-more` / `.sk-menu` / `.sk-add-btn` / `TestPanel` /
`AddSkillModal` / `.sk-confirm*` 在 7 个新文件里**一次都没出现**(SkillDetail.test.ts:64-66、
:148-149 有常驻反向断言钉住)。

跳转目标不是死链:`src/router/index.ts:34` 有 `/ai/agent`,`src/ai/views/AgentPage.vue:269`
读 `route.query.skill`。已核。

### 1.3 唯一的"文案指向不存在的控件"

`aiSkEmpty` = 「还没有技能,点击 + 添加一个。」—— P3a **没有 + 按钮**。
这是 Vue2 逐字文案(设计 §9.3 点名要求),不算实现缺陷;**但真机验收时别当 bug 报**,
P3b 补上 `.sk-add-btn` 后自动消解。记为 **Minor M7**。

---

## 2. 跨文件一致性

### 2.1 🟡 Important I1 —— `.empty-title` / `.empty-sub` 与 `agent-styles.scss` 同优先级碰撞

**这是本次终审唯一一条只有整期视角才能发现的实质缺陷。**

- `skills-styles.scss:404-424` 把 `.empty-title` / `.empty-sub` 嵌在 `.sk-detail-empty-inner` 下
  → 选择器 `.sk-detail-empty-inner .empty-title`,优先级 **(0,2,0)**。
- `src/ai/styles/agent-styles.scss:496-497`(整档嵌在 `.agent-app {` 下,该文件唯一顶层规则
  在 :8)→ 选择器 `.agent-app .empty-title`,优先级同样 **(0,2,0)**。
- **New-UI 的 `SettingsPage.vue:371` 根节点是 `class="agent-app set-app"`** ——
  两条选择器**同时命中同一个元素**。
- **Vue2 不会碰撞**:Vue2 `Settings/Settings.vue:2` 根节点只有 `class="set-app"`,
  没有 `agent-app`(New-UI 加 `agent-app` 是因为本仓 token 定义在 `.agent-app` 作用域)。
  → 这是**移植引入的新碰撞**,不是照抄 Vue2。

构建产物实证(`dist/assets/index-CVFAZmQD.css`,mtime 15:48 晚于 HEAD 15:41):

```
偏移 191760  .agent-app .empty-title{font-size:28px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
偏移 252840  .sk-detail-empty-inner .empty-title{font-size:15px;font-weight:600;color:var(--text-primary)}
```

同优先级 → **源序决胜**。当前 `agent-styles` 在前(因 `router/index.ts:31` 先 import
`AgentPage`、:32 才 import `SettingsPage`),skills 在后 **侥幸赢下它声明的属性**。
但 skills **没有声明的属性会漏下来**:

| 属性 | Vue2 效果 | New-UI 实际效果 | 差异 |
|---|---|---|---|
| `.empty-title letter-spacing` | 无 | `-0.02em`(agent 漏下) | ❌ |
| `.empty-title margin` | 无 | `0 0 6px`(agent 漏下) | ❌ |
| `.empty-sub color` | 继承父级 `--text-tertiary` | `--text-secondary`(agent 直接命中元素,压过继承) | ❌ |
| `.empty-sub margin` | 无 | `0 0 28px`(agent 漏下,末元素 → 整块视觉上移 ~14px) | ❌ |
| `.empty-title font-size` | 15px | 15px(skills 靠源序赢) | ✅ 但**脆弱** |

**两重问题**:①4 个属性当场就错;②赢下的那几个靠的是 `router/index.ts` 的
import 顺序,任何人调换那两行 import、或改 Vite 分包策略,标题会**突然变成 28px**。

**触发面**:`.sk-detail-empty` 在 `skill == null` 时渲染 —— 即 ① 技能库为空,
② **每次进入分区、`listSkills()` 返回前的那一帧**(左列转圈时右侧就是空态)。不是罕见路径。

**修法(二选一,建议 A)**:
- A. `skills-styles.scss` 把这两条提到更高优先级并补齐属性,例如
  `.sk-detail .sk-detail-empty-inner { .empty-title { … letter-spacing: normal; margin: 0; } .empty-sub { … color: var(--text-tertiary); margin: 0; } }`。
- B. 给这两个元素换成 `.sk-empty-title` / `.sk-empty-sub` 专属类名。
  —— B 更彻底但破坏与 Vue2 的 class 1:1,按 §2 移植纪律应选 A。

其余类名碰撞已全量排查:`skills-styles.scss` 的类集合 ∩ `sk-shared.scss` = ∅,
∩ `settings-styles.scss` = ∅,∩ `agent-styles.scss` = {`.empty-title`, `.empty-sub`} 仅此两条。
嵌套短类名(`.dot`/`.total`/`.val`/`.lbl`/`.ico`/`.name`/`.size`/`.sep`/`.orb`)在构建产物里
逐个查过竞争规则,均无同优先级对手(`.set-row .val` / `.set-row .lbl` / `.set-nav-item .ico` /
`.tok-meta .sep` 都挂在别的父级下,不可能同时命中)。

### 2.2 Minor M3 —— 偏离编号跨文件不自洽

公共约束 §3 的编号是:1=`reload()` 单层取数 · 2=`SkillIcon` 不移植 · 3=`.sk-toast` 不移植。

| 文件 | 写法 | 对不对 |
|---|---|---|
| `SkillDetail.vue:7` | 「偏离 2(公共约束 §3.2)」SkillIcon | ✅ |
| `SkillGroup.vue:4` | 「偏离 2(公共约束 §3.2)」SkillIcon | ✅ |
| `SkillsSection.vue:27` | 「3(公共约束 §3 偏离 2)」SkillIcon | ✅(编号是本文件内序号,指向正确) |
| **`SkillTile.vue:4`** | **「偏离 3(公共约束 §3.2)」SkillIcon** | ❌ 自相矛盾:标 3 却指 §3 第 2 条;§3 第 3 条是 `.sk-toast` |

纯注释瑕疵,不影响运行。但 P3b 会照这些注释找上下文,建议顺手改成 2。

### 2.3 Minor M4 —— `const ref = …` 遮蔽 Vue 的 `ref`

`SkillGroup.vue:27` `import { ref } from 'vue'`,`SkillGroup.vue:59`
`const ref = authorLabel(author)` —— 函数内局部遮蔽。当前无害(该函数不用响应式),
但是标准踩坑点。`SkillDetail.vue:61/69/87` 用同样的 `const ref =` 命名,只是那个文件恰好
没 import `ref`。**两处命名风格一致但一处有雷** —— 建议统一改成 `labelRef` / `lr`。

### 2.4 Minor M6 —— 错误提示口径与 5 个兄弟分区不一致

| 分区 | 失败 toast |
|---|---|
| Blacklist / Execution / Memory / Channels(共 12 处) | `toast.show(apiErrorMessage(e, t('aiCfg…')), 3000, 'danger')` |
| **SkillsSection.vue:102** | `toast.show(t('aiSkLoadFailed'), 3000, 'danger')`(裸 `t()`) |

`apiErrorMessage`(`src/ai/util/apiError.ts:21-37`)会回显后端 `message`/`detail`,
兜底才用本地化串。**本期这样写更对**:Vue2 `SkillsSection.vue:140` 就是固定文案,
且约束「界面永不回显后端原文」。但**这是一处未被任何文档登记的口径分叉** ——
P3b 加启停/删除/新建时必须先拍板走哪套,否则同一个分区里会同时出现两种错误文案风格
(Vue2 `onCreate`:197-198 恰恰是**读** `e.response.data.message` 的,直接照抄就分叉了)。
建议现在就把这条写进 P3b 交接。

### 2.5 已核清、**不是**发现的项(避免误报)

- **`.sk-pill-try` 静息态背景被吃掉**:`settings-styles.scss:344` 的
  `.set-app button { background: transparent }` 优先级 (0,1,1) > `.sk-pill-try` (0,1,0),
  静息态的 `background: var(--accent-soft)` 不生效(只剩边框+强调色文字);
  `:hover` (0,2,0) 能赢,所以悬停会变实底。**Vue2 `Settings/settings-styles.scss:278`
  一模一样**(Vue2 正是为此才把 `.sk-add-btn` 特意写成 `.set-app .sk-add-btn`)。
  → 1:1 照搬,属 Vue2 视觉缺陷,按 §2「界面严格 1:1」不改。真机验收别报。
- **`--grad-sk-*` 用 `#hex` 字面量**(`tokens.scss:228-234`):tokens.scss 是 token 定义处,
  且属「装饰性品牌识别渐变、两套主题同值」既有例外(同 `--grad-iri:119`、
  `--grad-photo/-file:220-221`),设计 §5 明文授权。不违规。
- **`--purple` / `--grad-iri` 在 `[data-theme="dark"]` 块里没有覆写**:该块是**增量覆盖层**
  (与浅色块同选择器 `.agent-app`),浅色块是基底,所以暗色下这两个 token 有值。
  既有约定,非本期引入。
- **`aiSkTriggerManual` 未建键**:设计 §4.4 伪码写的是 `manual → aiSkTriggerManual`,
  实现改成复用 `aiSkTagManual`。**实现是对的,设计错了** —— Vue2 左栏
  `SkillGroup.vue:60` 是 `$t('Manual')`,右栏 `trigger_human` 后端也吐 `"Manual"` →
  `$t('Manual')`,**Vue2 本来就是同一个 key**。复用等于 1:1,新建反而会造重复键。
- **`aiCfgSkills` 作 h1**:设计 §7 说复用它作 h1;实际 split 分区没有 h1
  (`SettingsPage.vue:416-435` 对 `stack:false` 组直接渲染 `<component :is>`,不套标题),
  Vue2 `Settings.vue` 同款。所以 `aiCfgSkills` 只作导航标签 —— 设计文字不准,代码正确,
  也没有因此产生死键。

---

## 3. P3b 接续面

| 交接物 | 坐标 | 判定 |
|---|---|---|
| TestPanel 插回位置注释 | `SkillDetail.vue:159-160` | ✅ 位置精确(Vue2 `SkillDetail.vue:108-112`,夹在「描述」与「SKILL.md」之间),已回比蓝本确认 |
| `SKILL_COLOR_IDS` 导出 | `SkillTile.vue:27` | ✅ 够用。Vue2 `AddSkillModal.vue:141` 是 `Object.keys(SKILL_COLORS).map(id => ({id, bg: SKILL_COLORS[id]}))`;P3b 写成 `SKILL_COLOR_IDS.map(id => ({id, bg: \`var(--grad-sk-${id})\`}))` 等价。顺序与 Vue2 `COLORS` key 顺序一致(有常驻用例 SkillTile.test.ts:11 钉住) |
| `Skill.trigger_human` 保留 | `types/skill.ts:21-25` | ✅ 注释明确「本仓弃用,不得在界面上渲染」,且 SkillDetail.test.ts:120-126 有常驻陷阱用例(`trigger_human='WRONG'`)钉死。不误导 |
| `.sw` / `.sk-menu` / `.sk-toast` / `.sk-add-btn` 等样式归属 | `skills-styles.scss:180 / 249-250 / 426-432` | ✅ 逐条标了「不移植/留 P3b/已在 sk-shared」,回比 Vue2 行号全对 |
| `+` 按钮插入位置注释 | `SkillsSection.vue:116-117` | ❌ **Minor M1**(见下) |
| `.sw` / `.sk-pill-more` 插入位置 | SkillDetail 顶栏 | ⚠️ **Minor M5**(见下) |
| 共享包缺 `streamSkillTest` | `../NimoOS-Service/dist/ai.d.ts:75-83` | ✅ 已核实确实缺,设计 §10 有登记 |

### Minor M1 —— `+` 按钮占位注释会让 P3b 把顺序做反

```vue
<div class="sk-col-actions">
  <!-- P3b: 添加技能的 + 按钮插在这里(Vue2 SkillsSection.vue:9-11 …)。本期不渲染。 -->
  <button class="icon-btn" @click="reload">…</button>   ← 刷新
</div>
```

Vue2 `SkillsSection.vue:6-11` 的顺序是 **refresh(:6-8) → sk-add-btn(:9-11)**。
注释放在刷新按钮**之前**,照它插会得到 `[+, 刷新]`,与 Vue2 相反。
`.sk-col-actions` 是 `margin-left:auto` 右对齐 flex,顺序颠倒肉眼可见。
建议把注释挪到 `</button>` 之后。

### Minor M5 —— 详情顶栏没标 `.sw` / `.sk-pill-more` 的插回位置

Vue2 `SkillDetail.vue:15-57` 顶栏顺序:`SkillTile` → `.sk-name` → **`.sw`(:21-28)** →
`.sk-pill-try`(:29-32) → **`.sk-pill-more` + `.sk-menu`(:33-56)**。
New-UI 只有 `SkillTile / .sk-name / .sk-pill-try`,文件头 :31-34 列了「不取」清单但
**没给位置**;同一文件的 TestPanel 占位却给了精确坐标。接续面详略不一致,
P3b 容易把开关插到 `.sk-pill-try` 右边。建议补两行占位注释。

---

## 4. 配色纪律整体复核

### 4.1 字面量扫描(含注释行、含具名色)

对 7 个新 `.vue` + `skills-styles.scss` + `types/skill.ts` + `skillsFormat.ts` 跑
`#hex | rgb()/rgba() | hsl()/hsla() | oklch() | 17 个 CSS 具名色(含 white/black)`:

**零违规。** 命中的 14 行全部是误报,逐条核过:
- `white-space: nowrap`(:132/:242)—— 属性名里的 `white`。
- `SkillDetail.vue:16` 注释里的「内联 `:style` 现场拼 `rgba(...)`」—— 是**描述禁用写法**的
  中文说明,没有具体色值。合规(约束 §6 只禁「Vue2 的原始色字面量」)。
- `blue`/`purple`/`slate` 等 —— `SKILL_COLOR_IDS` 的**标识符 id**(`color: 'blue'`),不是 CSS 色值。
- `skills-styles.scss:145/149` 注释里的「--purple / --warning」—— token 名,不是字面量。

`skills-styles.scss` 里 Vue2 的 6 处裸色对照(自己回比 Vue2 原档逐条核):

| Vue2 原文 | 新写法 | 判定 |
|---|---|---|
| `.sk-tile { color: white }`(:97) | `var(--text-on-accent)`(两套主题都有值:tokens.scss:59 / 267) | ✅ |
| `.sk-tile { box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.18) }`(:100) | `var(--gloss-inset)` —— tokens.scss:154/310 **逐位相同**,两块都有 | ✅ 精确 |
| `[data-kind=slash] rgba(175,82,222,0.12)`(:120) | `color-mix(in srgb, var(--purple) 12%, transparent)` —— `--purple: #AF52DE` = `rgb(175,82,222)`,**色相逐位相同、透明度保留** | ✅ 精确 |
| `[data-kind=manual] rgba(255,149,0,0.14)`(:121) | `color-mix(… var(--warning) 14% …)` —— 色相变了(本仓 `--warning:#C8860A` 已改暖色板),透明度保留。已申报 | ✅ 已登记 |
| `.dot` 启用态内联 `rgba(52,199,89,0.18)`(SkillDetail.vue:70) | `color-mix(… var(--success) 18% …)` + 从内联搬进静态 CSS | ✅ 已申报 |
| `[data-disabled] .dot rgba(98,98,98,0.12)`(:332) | `color-mix(… var(--text-quaternary) 12% …)` | ✅ 已申报 |
| `.sk-file-row .ico { background: white }`(:371) | `var(--paper-surface)`(tokens.scss:185/331,两块都有,专为"白纸片"登记的例外 token) | ✅ |

`color-mix(… , transparent)` 派生半透明色的写法先例:`tokens.scss:219 --icon-tile-glow`
—— 自查确认存在。判定可接受。

`skills-styles.scss` 用到的全部 `var(--…)` token 逐个回查 `tokens.scss`:**零缺失**。

### 4.2 内联 `:style` 里的颜色

- `SkillTile.vue:50-55`:`background: bg`(= `var(--grad-sk-*)` 字符串)+ 宽高圆角。
  **无颜色字面量**,且宽高圆角是 props 驱动的必要动态值,Vue2 同款。
- `SkillsSection.vue:129`(`width:18px;height:18px`)、:136(`display:grid;place-items:center;padding:28px 0`)
  —— 纯尺寸/布局,Vue2 :20/:27 逐字照抄。
- `SkillDetail.vue:190` `style="color: var(--text-tertiary)"` —— **走 token,不是字面量**,
  Vue2 :146 逐字同款。合规。
- `.dot` 上**零内联样式**(SkillDetail.test.ts:97-102 有常驻断言钉住 `attributes('style')` 为 `undefined`)。

### 4.3 `.scss` 无守卫这件事(deferred minor ①)

自查 `src/styles/color-guard.test.ts:14-17`:

```ts
const files = {
  ...import.meta.glob('../**/*.vue', …),
  ...import.meta.glob('../**/*.css',  …),
}
```

**确认只 glob `.vue` 与 `.css`,`.scss` 完全不在扫描面内。** 台账登记属实。
本期 `skills-styles.scss` 443 行是靠人眼(实现者 + Task 1 评审 + 本次终审共三遍)兜的,
上面 §4.1 是我自己独立的第三遍。当前干净。

---

## 5. i18n 整体

### 5.1 键数与死键

30 个 `aiSk*` 新键,两档各 +32 行(30 键 + 2 行分段注释),`parity` 天然满足。

**逐键 grep 生产代码引用:30/30 全部有真实消费方,零死键。** 复用面:
`aiSkTagManual` 被 `SkillGroup.triggerTagKey`(左栏短标签)与
`skillsFormat.triggerLabel`(右栏详情)**共用** —— 上面 §2.5 已论证这与 Vue2 一致。
`aiSkNFiles` 被段头 hint(`SkillDetail.vue:78`)与文件夹 size(`fileSizeLabel`)共用,
Vue2 段头 :130 用的也是 `{n} files`,一致。
复用既有键:`aiCfgRefresh`(SkillsSection.vue:118 的 title)。

### 5.2 值逐字回比 Vue2 生产语言包

写脚本对 `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` 逐码点比对
(不看任何 task report 的结论,自己跑):

- **zh 29/29 逐字符全中**(`aiSkTriggerSlash: '/{name}'` 无 Vue2 对应键,是偏离 4 新造,
  与后端 `"/" + m.Name` 语义等价)。含易错点:
  - `aiSkEmpty` 的逗号是**半角 U+002C**(`还没有技能,点击 + 添加一个。`)—— 与 Vue2 一致 ✅
  - `aiSkPickLeftSub` 的破折号是 **`——`(两个 U+2014)** —— 与 Vue2 一致 ✅
  - `aiSkSearchPlaceholder` 的省略号是 **`…`(U+2026)** ✅
- **en**:Vue2 `en_US.json` 里这批键**只有 6 个存在**(Auto/Manual/Off/Status/Active/Paused/Description),
  其余缺失 → vue-i18n 未命中返回 key 本身 = 线上实际英文文案。
  New-UI 30 条 en 值**全部等于英文 key 字面量**,与线上行为一致 ✅
- 重复定义检查:两档各 grep 一遍,30 键均只出现一次 ✅
- `messageSyntax` 风险:30 条值里**零 `@`**、零 `|`,`'/{name}'` 的 `/` 不是 vue-i18n 特殊字符 ✅

### 5.3 该本地化而漏用 / 该保留而误译

| 后端英文串(设计 §2.3) | 处理 | 判定 |
|---|---|---|
| `trigger_human`(`Automatic`/`/name`/`Manual`) | 弃用字段,改 `trigger` 枚举映射 | ✅ 两栏都覆盖了(SkillGroup 短标签 + SkillDetail 长文案) |
| `author == "You"` | `authorLabel` → `aiSkAuthorYou`「你」 | ✅ **左右两栏都做了**(SkillGroup.vue:58-61 / SkillDetail.vue:66-71)—— Vue2 左栏 :31 是裸 `{{ s.author }}`,这是设计 §2.3 授权的偏离 |
| `files[].size == "(N files)"` | `fileSizeLabel` → `aiSkNFiles` | ✅(Vue2 :141 裸显示,设计 §4.4 授权) |
| `last_used` | 不映射,`|| '—'` | ✅ 实测恒为语言中立破折号;`SkillDetail.vue:23-25` 注释登记了「若后端将来写英文相对时间串需补映射」 |

**未发现任何界面会漏出后端英文原文的路径。** 唯一会显示原始后端串的两处是**刻意兜底**:
未知 `trigger`(`SkillDetail.vue:62`)与非 `You` 的 `author` —— 后者本就是人名数据。

---

## 6. 设计 §9 十条验收项 · 代码层面可支持性

| # | 验收项 | 代码支持 | 自动化覆盖 | 人眼必要性 |
|---|---|---|---|---|
| 1 | 点「技能」进得去,不弹占位 toast | ✅ `sections.ts:95` → `['mcp']`;`SettingsPage.vue:94` → `SkillsSection` | 强(SettingsPage.test.ts:415 断言 `.sk-list` 存在 + `showSpy` 未被调用;:436 用 19b 保住 mcp 占位契约) | 低 |
| 2 | 两组分栏 / 折叠 / 计数 | ✅ `SkillsSection.vue:81-82` + `SkillGroup.vue:45,77` | 强(SkillsSection.test.ts:77-82 直接断言两个 `SkillGroup` 的 `items` props,组装错抓得到;SkillGroup.test.ts:40-58 折叠往返) | 低 |
| 3 | 搜索命中 / 两种空态 | ✅ `SkillsSection.vue:71-80,154-161` | 强(name/title/description 三条独立用例,token 互不为子串) | 低(但见 M7:空态文案指向不存在的 +) |
| 4 | 点条目切换详情 + **选中高亮跟随** | ✅ 数据侧 `data-active` | **切换=强,高亮=零**(`.sk-item[data-active="true"]{background:var(--bg-elevated);box-shadow:var(--shadow-xs)}` 是纯 CSS) | 中 |
| 5 | 四格元信息(**绿点 / 灰点**) | ✅ 文案与 `data-disabled` 全覆盖 | 文案强、`data-disabled` 强、**颜色零** | **高 ← 见下** |
| 6 | SKILL.md 渲染富文本 | ✅ 复用 `renderMarkdown`(P1 已移植,含 DOMPurify) | 中(SkillDetail.test.ts:152-157 断言 `<strong>`) | 中(`.sk-md` 的 pre/code/a/ul 视觉是新档) |
| 7 | 附带文件列表 + 「N 个文件」+ 空态 | ✅ | 强(含 `files: null` 的 Go nil-slice 坑) | 低(`.ico` 纸片 `::after` 折角是新 CSS) |
| 8 | 试用跳 `/ai/agent?skill=` | ✅ 路由与消费端都在 | 强(断言 `push` 参数) | 低 |
| 9 | **明 / 暗两套主题** | ⚠️ **有 I1 + 4 处 color-mix 派生色** | **零**(jsdom 不算样式) | **最高 ← 见下** |
| 10 | 断网时提示条**看得见**且是危险色 | ✅ `SkillsSection.vue:102` | 中(断言 `show(…, 3000, 'danger')` 被调用,**证明不了它真的浮在最上层**) | **高 ← 见下** |

### 最该人眼重点看的 3 条

**① §9.9 明暗双主题(首要)**
理由三重:(a) 上面 **Important I1** 的空态碰撞在两套主题下都在,且当前"赢"得侥幸;
(b) 本期新引入 4 处 `color-mix(… N%, transparent)` 派生半透明色 —— slash 标签
`--purple` 12%、manual 标签 `--warning` 14%、状态点光晕 `--success` 18%、停用点
`--text-quaternary` 12% —— 这些比例是从 Vue2 的**浅色**配色抄来的,叠在暗色
`--bg-elevated: #242426`(tokens.scss 暗色块 :9)上是否还分得出来,**只有眼睛能判**;
(c) `--paper-surface: #ffffff` 在暗色块里也是纯白(:331),文件行那个"纸片"图标在暗底上
会不会刺眼。**这三样一条单测都覆盖不到。**

**② §9.5 状态圆点**
`.sk-meta-cell .val .dot` 的**启用态绿点 + 发光圈是本期从零新写的 CSS 规则** ——
回比 Vue2 `skills-styles.scss:330-334` 证实:Vue2 那边 `.dot` 基础规则**只有宽高圆角、没有背景色**,
颜色全靠 `SkillDetail.vue:67-72` 的内联 `:style` 现拼。也就是说这是全期**唯一一段没有 Vue2 视觉参照物**
的样式(约束 §6 强制去内联化的直接产物)。启用 / 暂停两态各看一眼,重点看发光圈的半径与浓淡。

**③ §9.10 加载失败提示条**
这是本期**唯一一条真·交互偏离**(§3 偏离 3:`.sk-toast` → 全局 `AppToast` 的 `danger` 档)。
单测只能证明 `toast.show(t('aiSkLoadFailed'), 3000, 'danger')` 被调用了,
**证明不了它在 AI 区那个嵌套主题作用域里真的浮在最上层、真的是危险色** ——
而 P2b 刚刚为「AI 区 toast 隐形 / 被弹窗遮住」修过三个独立根因(提交 `057019b`)。
复现方式:`systemctl stop nimoos-ai` 或断开后端后进入分区。

---

## 7. 与需求无关的重构 / 改名 / 顺手优化

**未发现。** 逐提交核 `git show --stat`:

| 提交 | 文件 | 是否都在设计 §3.1/§3.2 清单内 |
|---|---|---|
| `39ca333` | skills-styles.scss / tokens.scss / SettingsPage.vue(+1 行 import) | ✅ |
| `cf24465` | types/skill.ts / skillsFormat{,.test}.ts / i18n ×2 | ✅ |
| `7a0f693` `80e3506` `e5cf0ca` `1a2fec1` | 各自一组件 + 同目录 test | ✅ |
| `9e5c17b` | 只改 `SkillsSection.test.ts`(评审修复轮,生产代码零改动) | ✅ |
| `4e871fb` | sections.ts / sections.test.ts / SettingsPage.{vue,test.ts} | ✅ |

`SettingsPage.vue` 的 24 行改动逐行看过:20 行是注释里「11 个 → 12 个」「skills/mcp → mcp」
的事实更新,4 行是 import + 映射表 + `skills-styles.scss` import。**零无关改动**。
`SPLIT_SECTIONS` 保持 `['skills','mcp']` 未动(它描述布局,与是否实现无关)—— 正确的克制。
`sections.test.ts` 只改了 `DEFERRED_SECTIONS` 那一条断言的期望值与标题,
既有断言**一条没删、一条没弱**;`SettingsPage.test.ts` 的用例 19 从「弹 toast」反转为
3 项更强断言,并**新增 19b 原样保住 mcp 占位 toast 契约** —— 这是加强不是削弱。

---

## 8. 测试质量抽查(整期视角)

- **单层取数口径**:`SkillsSection.test.ts:86-103` 正反双用例(裸数组 → 非空;
  `{data:[…]}` → 空)。这是 P2a `a942196` 那个缺陷模具唯一的自动化护栏,**双向都钉了**,
  质量很高。
- **`trigger_human` 陷阱用例**(`SkillDetail.test.ts:120-126`):fixture 里故意填
  `trigger_human: 'WRONG'` 并断言 `w.text()` 全文不含 `WRONG` —— 强判别力。
- **Go nil-slice 坑**(`SkillDetail.test.ts:199-204`):`files: null` 转型灌进去,
  钉住 `(skill.files || [])` 兜底不许删(约束 §4)。
- **多元素数组纪律**:SkillGroup 全部用 3 条目 fixture 并断言**整个数组的映射**
  (`['false','true','false']`),不是 `.some()`。符合约束 §9。
- ⚠️ **Minor M2 —— 一条近似空转的断言**:`SkillDetail.test.ts:177`
  `expect(w.find('.sk-section-hint').exists()).toBe(true)`。
  `w.find` 返回**第一个**匹配 —— 详情页有 3 个 `.sk-section-hint`(描述 / SKILL.md / 附带文件),
  第一个是**描述段**的 hint。用例名说「段头 hint 显示文件数」,实际**一个字都没验到文件数**。
  → `SkillDetail.vue:78` 的 `filesHint` 计算属性(`t('aiSkNFiles', { n: (files||[]).length })`)
  **零测试覆盖**:把 `n` 写死成任意常数,全套测试仍绿。
  修法:`expect(w.findAll('.sk-section-hint')[2].text()).toBe('2 个文件')`。

---

## 9. RED 探针(须说明)

按约束 §11 尝试做 RED 验证:用 Edit 把 `SkillDetail.vue:78` 的
`filesHint` 改成 `t('aiSkNFiles', { n: 999 })`(用于实证 §8 的 M2 零覆盖),
**但本会话的 Bash 沙箱拦截了一切测试执行命令**
(`pnpm test` / `pnpm exec vitest run <path>` 均被 classifier 拒绝,非命令本身失败)。
探针已**立即精确还原**,`git status --porcelain` 与 `git diff HEAD` 均为空 —— 仓库干净。

因此 M2 的结论改用**静态证据**给出,同样是确定性的:
`grep -rn '个文件|filesHint|sk-section-hint' <三个 test 文件>` 只有 3 处命中,
其中 :180-188 测的是 `.sk-file-row .size`(走 `fileSizeLabel`,与 `filesHint` 是两条独立代码路径),
:177 如上所述命中的是描述段。**没有任何断言触及 `filesHint`。**

同理,§2.1 的 Important I1 也没有依赖测试执行 —— 证据是**构建产物**
`dist/assets/index-CVFAZmQD.css`(mtime 2026-07-30 15:48,晚于 HEAD 的 15:41)里
两条同优先级规则的实际字节偏移,比单测更硬。

测试数字沿用协调者独立复跑:**291 文件 / 2408 例绿 · `vue-tsc` exit 0 · `vite build` exit 0**;
`src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`
为既有 IndexedDB flaky,与本期无关(本期未碰 `src/files/` 任何文件,已 `git show --stat` 核实)。

---

## 10. 台账 3 条 deferred minor 的 triage

### ① `.scss` 文件全无颜色守卫 → **可继续挂着,不阻塞合并 master**

- 事实已复核:`color-guard.test.ts:14-17` 只 `import.meta.glob('../**/*.vue')` 与
  `('../**/*.css')`,`.scss` 完全在扫描面外。
- 但**本期这一档的实际风险已经清零**:`skills-styles.scss` 443 行经三遍人眼
  (实现者 / Task 1 评审 / 本次终审第 §4.1 节独立复扫),零字面量。
- **不该在 P3a 内做**:把 glob 扩到 `.scss` 会一次引爆
  `settings-styles.scss` + `sk-shared.scss` + `agent-styles.scss` + `tokens.scss` 的**存量豁免**
  (tokens.scss 头部 :7-29 那份例外清单登记了至少 5 类、约 20+ 处),需要先设计
  「整档移植件豁免」的机器可读机制(如文件级 `/* color-guard: file-exempt */` 头标记)。
- **动作**:开一张独立票,不进 P3a,也不进 P3b(它是全仓基建,不是技能分区的事)。

### ② `types/skill.ts` 头注释坐标写「10-32」略笼统 → **可继续挂着**

- 复核:后端 `Skill` 是 skills.go:10-27、`SkillFile` 是 :29-32,头注写 `10-32` 把两个 struct
  混成一段。**字段本身逐个核过,与后端 json tag 一一对应、无缺无增。**
- 纯文档瑕疵,零功能影响。**建议顺手改**(一行:`skills.go:10-27` / `SkillFile` 那行本来
  就已经单独标了 `29-32`,只需把开头那句从 `10-32` 改成 `10-27`),但**不构成合并前提**。

### ③ 「点条目切换」用例按 DOM 下标 → **可继续挂着**

- 复核 `SkillsSection.test.ts:182-195`:fixture 是 `[a(system:true), b(system:false)]`,
  用 `findAll('.sk-item')[1]` 点第二条,断言详情变成 `Skill B`。
- **风险方向是"假红"不是"假绿"**:若哪天分组渲染顺序反了(我的技能在前),
  下标 1 会点到 `Skill A`,断言 `Skill B` 直接失败 → 测试会**报红提醒**,而不是悄悄放过缺陷。
  判别力没有损失,只是失败信息会指向错误的方向。
- 与 P2a Task 7 那条"用全局下标反推 DOM、逼实现者改 `v-show`→`v-if`"的教训**性质不同**
  (那条是测试倒逼实现让步;这条只是断言写法不够语义化,不影响生产代码)。
- **动作**:不修。若 P3b 要动这个文件,顺手改成按 `.sk-item-name` 文本定位即可。

---

## 11. 结论与合并前动作清单

**判定:需修后合并。**

| 优先级 | 项 | 坐标 | 合并 master 前必修? |
|---|---|---|---|
| **Important** | I1 `.empty-title`/`.empty-sub` 与 `.agent-app .empty-*` 同优先级碰撞 | `src/ai/styles/skills-styles.scss:422-423` ↔ `src/ai/styles/agent-styles.scss:496-497` | **是** —— 视觉 1:1 破坏 + 依赖 import 顺序的隐性脆弱 |
| Minor | M1 `+` 按钮占位注释位置会让 P3b 把顺序做反 | `SkillsSection.vue:116-117` | 否(建议顺手,两分钟) |
| Minor | M2 `filesHint` 零覆盖 + `.sk-section-hint` 断言命中错元素 | `SkillDetail.test.ts:177` | 否(建议顺手) |
| Minor | M3 `SkillTile.vue` 偏离编号 3↔2 不自洽 | `SkillTile.vue:4` | 否 |
| Minor | M4 `const ref =` 遮蔽 Vue 的 `ref` import | `SkillGroup.vue:27` vs `:59` | 否 |
| Minor | M5 详情顶栏未标 `.sw`/`.sk-pill-more` 插回位置 | `SkillDetail.vue:110-120` | 否(写进 P3b 交接即可) |
| Minor | M6 错误提示口径与 5 个兄弟分区分叉 | `SkillsSection.vue:102` | 否(**但必须写进 P3b 交接**,否则同分区两种风格) |
| Minor | M7 空态文案指向不存在的 `+` 按钮 | `zh_cn.ts aiSkEmpty` | 否(1:1 要求,P3b 自动消解;验收时别误报) |
| deferred ① | `.scss` 无颜色守卫 | `src/styles/color-guard.test.ts:14-17` | 否 —— 独立票 |
| deferred ② | `types/skill.ts` 头注坐标 | `types/skill.ts:1-2` | 否 |
| deferred ③ | 「点条目切换」按 DOM 下标 | `SkillsSection.test.ts:192` | 否 |

**建议**:只修 I1(+ 顺手 M1/M2/M3),重跑三门,即可进入 `:5288` 真机验收;
验收时按 §6 的排序重点看 **§9.9 → §9.5 → §9.10**。
合并 master 仍受既有阻塞约束(与 `sp7-photos` 的合并顺序待用户拍板,设计 §11.4)。
