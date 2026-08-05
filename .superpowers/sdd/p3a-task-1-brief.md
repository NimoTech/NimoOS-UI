# SP8-P3a Task 1 —— `skills-styles.scss` 只读侧 + 7 个渐变 token

> 先读 `.superpowers/sdd/p3a-common-constraints.md`(公共约束,与本文冲突时以它为准)。
|---|
| Vue2 组件蓝本 | `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/*.vue` |
| Vue2 样式蓝本 | `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/skills-styles.scss` |
| Vue2 语言包 | `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` |
| 后端契约 | `/home/nimo/NimoTech/NimoOS-AI/route/v2/skills.go`、`service/skills.go` |
| 共享包签名 | `/home/nimo/NimoTech/.sp8/NimoOS-Service/dist/ai.d.ts` |
| 已移植的兄弟件(照抄风格) | `src/ai/components/settings/sections/{BlacklistSection,ExecutionSection,MemorySection}.vue` |

---


---

## Task 1 —— `skills-styles.scss` 只读侧 + 7 个渐变 token

**产出**:`src/ai/styles/skills-styles.scss`(新)· `src/ai/styles/tokens.scss`(改)·
`src/ai/views/SettingsPage.vue` 加一行 import。

### 1.1 移植范围(Vue2 `skills-styles.scss` 行号 → 本期取舍)

| Vue2 行 | 类 | P3a |
|---|---|---|
| 5-12 | `.sk-col` | ✅ |
| 13-25 | `.sk-col-head` | ✅ |
| 26-31 | `.sk-col-title` | ❌ **不移植**(全仓零引用,Vue2 死 CSS) |
| 32-45 | `.sk-col-search` | ✅ |
| 46-60 | `.sk-group-label` / `.sk-group-chev` / 折叠态旋转 | ✅ |
| 61-70 | `.sk-group-count` | ✅ |
| 71-76 | `.sk-list` | ✅ |
| 77-92 | `.sk-item` | ✅ |
| 93-102 | `.sk-tile` | ✅ |
| 103-152 | `.sk-item-body/head/name/tag/desc/meta/off` | ✅ |
| 153-163 | `.set-app .sk-add-btn` | ❌ → P3b |
| 164-177 | `.sk-col-empty` | ✅ |
| 178-185 | `.sk-detail` | ✅ |
| 186-210 | `.sk-detail-bar` / `.sk-name` | ✅ |
| 211-224 | `.sk-pill-try` | ✅ |
| 225-234 | `.sk-pill-more` | ❌ → P3b |
| 235-259 | `.sw`(开关) | ❌ → P3b |
| 260-288 | `.sk-menu` | ❌ → P3b |
| 289-301 | `.sk-detail-body` / `.sk-detail-inner` | ✅ |
| 302-337 | `.sk-meta-grid` + `@media(max-width:1100px)` + `.sk-meta-cell` | ✅ |
| 338-354 | `.sk-section*` | ❌ **已存在** `sk-shared.scss:12-28`,不得重复定义 |
| 355-361 | `.sk-description` | ✅ |
| 362-391 | `.sk-file-row` | ✅ |
| 392-513 | `.sk-test*` + `@keyframes skill-pulse` | ❌ → P3b |
| 514-547 | `.sk-md` | ✅ |
| 548-574 | `.sk-detail-empty` / `-inner`(含 `.orb`) | ✅ |
| 575-616 | `.sk-modal*` | ❌ 已存在 `sk-shared.scss:96-138` |
| 617-647 | `.sk-field*` | ❌ 已存在 `sk-shared.scss:154-183` |
| 648-685 | `.sk-trig-*` / `.sk-color-*` | ❌ → P3b |
| 686-697 | `.sk-modal-foot` | ❌ 已存在 `sk-shared.scss:139` |
| 698-726 | `.sk-btn` | ❌ 已存在 `sk-shared.scss:29` |
| 727-753 | `.sk-toast` + `@keyframes sk-toast-rise` | ❌ **永不移植**(改用全局 `AppToast`,设计 §6 偏离 3) |
| 754-773 | `.sk-confirm*` | ❌ → P3b |
| 774-781 | `.sk-spinner` + `@keyframes sk-spin` | ✅ |

**开工第一步**:对上表每一个标 ❌「已存在」的类,自己 `grep` 一遍
`src/ai/styles/{sk-shared,settings-styles}.scss` 确认;若实际不存在,**停下来报告**,不要
自行补进本文件(会与 P2b 的归属冲突)。

### 1.2 渐变 token

`tokens.scss` 里紧邻 `--grad-photo`/`--grad-file`(:220-221)追加 7 个,值取自 Vue2
`SkillTile.vue:19-27`:

```
--grad-sk-blue:   linear-gradient(135deg, #5AC8FA, #007AFF);
--grad-sk-purple: linear-gradient(135deg, #C18CFF, #AF52DE);
--grad-sk-pink:   linear-gradient(135deg, #FF6E8A, #FF2D55);
--grad-sk-orange: linear-gradient(135deg, #FFB75A, #FF7A00);
--grad-sk-green:  linear-gradient(135deg, #5DD68A, #2EB05B);
--grad-sk-teal:   linear-gradient(135deg, #5AD2CF, #008C8C);
--grad-sk-slate:  linear-gradient(135deg, #98A2B3, #475467);
```

放在**装饰性渐变**的既有区块(与 `--grad-photo`/`--grad-file` 同处),注释写明「技能方块
识别色,装饰性、皮肤无关,两套主题同值 —— 同 `--grad-photo` 先例」。确认该区块确实对
浅色与 `[data-theme="dark"]` 两套都生效(若 `tokens.scss` 的装饰区只声明一次,照它的现状办,
**不要**为此新建第二个主题块)。

### 1.3 颜色纪律

`skills-styles.scss` 里**所有**颜色必须是 `var(--…)`。Vue2 原文里的字面量要逐个换成本仓
既有 token;找不到语义匹配的 token 时,**停下来报告**,不要自造字面量、也不要擅自新建
token(渐变那 7 个除外,已在 1.2 授权)。

注释里**不许出现 Vue2 的原始色字面量**,改写成「Vue2 `skills-styles.scss:NNN` 原为
<中文描述颜色>」。

### 1.4 import

`SettingsPage.vue:65-66` 已有两行样式 import,在其后追加第三行:

```ts
import '../styles/skills-styles.scss'
```

### 1.5 验收

- 新文件里零 `#hex` / `rgb(` / `rgba(` / 具名色(注释里也没有)。
- 上表所有 ✅ 行都在,所有 ❌ 行都不在。
- 无与 `sk-shared.scss` / `settings-styles.scss` 重复的选择器定义。
- 三门全绿。

---
