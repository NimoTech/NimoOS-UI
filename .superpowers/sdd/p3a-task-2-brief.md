# SP8-P3a Task 2 —— 类型、`skillsFormat.ts`、30 个 i18n 键

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

## Task 2 —— 类型、`skillsFormat.ts`、30 个 i18n 键

**产出**:`src/ai/types/skill.ts`(新)· `src/ai/util/skillsFormat.ts`(新)·
`src/ai/util/skillsFormat.test.ts`(新)· `src/i18n/{zh_cn,en_us}.ts`(改)。

### 2.1 `types/skill.ts`

字段逐字照后端 `NimoOS-AI/service/skills.go:11-31` 的 json tag:

```ts
export interface SkillFile { name: string; size: string }

export interface Skill {
  id: string
  name: string
  title: string
  description: string
  trigger: string
  /** 后端会填 "Automatic" / "/name" / "Manual" —— 本仓弃用,改由 trigger 枚举映射。
   *  留字段是为了如实描述后端契约,不得在界面上渲染。见设计 §4.4。 */
  trigger_human: string
  color: string
  icon: string
  enabled: boolean
  system: boolean
  author: string
  last_used: string
  calls: number
  files: SkillFile[]
  examples: string[]
  md: string
}
```

`files` / `examples` 在后端是 `[]SkillFile` / `[]string`,Go 的 nil slice 会序列化成 `null`
—— 组件侧一律用 `(skill.files || [])` 兜底(Vue2 `SkillDetail.vue:135` 同款,**这是必要的
防御,不是可删的冗余**)。

### 2.2 `util/skillsFormat.ts`

纯函数,**不 import `vue-i18n`**。返回 `{ key, params? } | null`,`null` = 调用方原样显示原串。

```ts
export interface LabelRef { key: string; params?: Record<string, unknown> }

export function triggerLabel(trigger: string, name: string): LabelRef | null
export function authorLabel(author: string): LabelRef | null
export function fileSizeLabel(size: string): LabelRef | null
```

- `triggerLabel`:`'auto'` → `{key:'aiSkTriggerAutomatic'}`;`'slash'` → `{key:'aiSkTriggerSlash', params:{name}}`;
  `'manual'` → `{key:'aiSkTagManual'}`(**复用左栏那个键,值同为「手动」**);其它 → `null`。
- `authorLabel`:`'You'` → `{key:'aiSkAuthorYou'}`;其它 → `null`(视作人名数据)。
- `fileSizeLabel`:匹配 `/^\((\d+) files?\)$/` → `{key:'aiSkNFiles', params:{n}}`;其它 → `null`
  (`"12 B"` / `"1.0 KB"` 这类字节单位原样透传)。

头注释登记:后端产出这些串的坐标(`skills.go:191-199` / `:184-190` / `:138-148`),以及
「界面永不回显后端原文」这条用户约定的先例 `channelsFormat.addBotErrorKey`。

### 2.3 i18n(30 键,`aiSk` 前缀)

**值已逐字回查 Vue2 生产语言包,不许改动、不许自行翻译。** `en_US.json` 里缺失的键,
线上实际渲染的就是英文键名本身(vue-i18n 未命中返回 key),故 en 值即下表所列。

| 键 | Vue2 键 | zh_cn | en_us |
|---|---|---|---|
| `aiSkSearchPlaceholder` | `Search skills…` | 搜索技能… | Search skills… |
| `aiSkBuiltIn` | `Built-in skills` | 内置技能 | Built-in skills |
| `aiSkYours` | `Your skills` | 我的技能 | Your skills |
| `aiSkNoMatch` | `No skills match` | 没有匹配的技能 | No skills match |
| `aiSkEmpty` | `No skills yet. Click the + to add one.` | 还没有技能,点击 + 添加一个。 | No skills yet. Click the + to add one. |
| `aiSkLoadFailed` | `Could not load skills` | 无法加载技能列表 | Could not load skills |
| `aiSkTagAuto` | `Auto` | 自动 | Auto |
| `aiSkTagSlash` | `Slash` | 命令 | Slash |
| `aiSkTagManual` | `Manual` | 手动 | Manual |
| `aiSkNRuns` | `{count} runs` | {count} 次运行 | {count} runs |
| `aiSkOff` | `Off` | 已关闭 | Off |
| `aiSkPickLeft` | `Pick a skill on the left` | 在左侧选择一个技能 | Pick a skill on the left |
| `aiSkPickLeftSub` | `Or add a new one — Nimo will use it whenever its trigger fires.` | 或者新建一个 —— Nimo 会在触发器命中时自动调用。 | Or add a new one — Nimo will use it whenever its trigger fires. |
| `aiSkTryInChat` | `Try in chat` | 在对话中试用 | Try in chat |
| `aiSkStatus` | `Status` | 状态 | Status |
| `aiSkActive` | `Active` | 已启用 | Active |
| `aiSkPaused` | `Paused` | 已暂停 | Paused |
| `aiSkTrigger` | `Trigger` | 触发方式 | Trigger |
| `aiSkAddedBy` | `Added by` | 来源 | Added by |
| `aiSkLastRun` | `Last run` | 上次运行 | Last run |
| `aiSkNTotal` | `{count} total` | 共 {count} 次 | {count} total |
| `aiSkDescription` | `Description` | 描述 | Description |
| `aiSkDescHint` | `Nimo reads this to decide when to use the skill.` | Nimo 据此判断何时调用该技能。 | Nimo reads this to decide when to use the skill. |
| `aiSkMdHint` | `The instructions Nimo loads when the skill runs.` | 技能运行时 Nimo 加载的指令文件。 | The instructions Nimo loads when the skill runs. |
| `aiSkBundledFiles` | `Bundled files` | 附带文件 | Bundled files |
| `aiSkNFiles` | `{n} files` | {n} 个文件 | {n} files |
| `aiSkNoBundledFiles` | `No bundled files` | 没有附带文件 | No bundled files |
| `aiSkTriggerAutomatic` | `Automatic` | 自动触发 | Automatic |
| `aiSkAuthorYou` | `You` | 你 | You |
| `aiSkTriggerSlash` | (自造,无 Vue2 对应) | /{name} | /{name} |

**不得统一的近义串**:`aiSkTagAuto`(自动)vs `aiSkTriggerAutomatic`(自动触发)——
Vue2 里是两个不同的串,左栏标签用短的、右栏详情用长的。

复用既有键、**不要重复定义**:`aiCfgRefresh`(刷新 / Refresh)、`aiCfgSkills`(技能 / Skills)。

写入位置:两档文件导出对象最末尾、闭合 `}` 之前,用标记行包起来:

```
  // >>> SP8-P3a —— 技能分区
  aiSkSearchPlaceholder: '搜索技能…',
  …
  // <<< SP8-P3a
```

写之前先 `grep` 确认 30 个键在两档里都不存在(重复属性 = TS 错误)。

### 2.4 测试

`skillsFormat.test.ts` 覆盖:三种 trigger + 未知 trigger 回 `null`;`'You'` vs 任意人名;
`"(3 files)"` / `"(1 file)"` / `"12 B"` / `"1.0 KB"` / 空串。

### 2.5 验收

`pnpm test` 里 `src/i18n/parity.test.ts` 与 `src/i18n/messageSyntax.test.ts` 必须绿;三门全绿。

---
