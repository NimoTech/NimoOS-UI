# SP8-P3a Task 5 —— `SkillDetail.vue`(只读)

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

## Task 5 —— `SkillDetail.vue`(只读)

**产出**:`src/ai/components/settings/skills/SkillDetail.vue` + `.test.ts`。

Vue2 蓝本 `SkillDetail.vue`(271 行)—— **本期只取只读部分**。

### 5.1 取

- props 只有 `skill: Skill | null`(**不要 `busy`**,那是写操作用的)。
- `skill == null` → `.sk-detail-empty` 空态:`.orb` + `aiSkPickLeft` + `aiSkPickLeftSub`
  (Vue2 `:3-13`)。
- `.sk-detail-bar`(Vue2 `:15-57` 的**子集**):`SkillTile`(size 28 / radius 8)+
  `.sk-name`(`{{skill.title}}` + `<code>{{skill.name}}</code>`)+ `.sk-pill-try`
  (`AgentIcon sparkle` + `aiSkTryInChat`,点击 `router.push({path:'/ai/agent', query:{skill: skill.id}})`)。
- `.sk-meta-grid` 四格(Vue2 `:61-94`):
  - 状态:`.dot` 的 `background` / `boxShadow` 在 Vue2 是内联字面量(`:68-71`),**改成
    `data-` 属性 + SCSS 里的 token 规则**(内联 `rgba(...)` 会被 color-guard 拦)。
    Task 1 移植 `.sk-meta-cell` 时已带 `.dot` 的规则,按启用/停用两态写。
  - 触发方式:`triggerLabel(skill.trigger, skill.name)` → 命中则 `t(key, params)`,否则原样
    显示 `skill.trigger`。**不得读 `skill.trigger_human`。**
  - 来源:`authorLabel(skill.author)` 同款。
  - 上次运行:`skill.last_used || '—'` + `.total` 里的 `aiSkNTotal`
    (`Number(skill.calls||0).toLocaleString()`)。
- 描述段 / SKILL.md 段 / 附带文件段(Vue2 `:96-151`),三段都用 `.sk-section` 结构。
  - SKILL.md:`renderMarkdown(skill.md || '')` → `v-html`(`../../../markdown/renderMarkdown`)。
  - 附带文件:`(skill.files||[])` 逐行 `.sk-file-row`;`size` 过 `fileSizeLabel()`;
    空数组显示 `aiSkNoBundledFiles`。段头 hint 用 `aiSkNFiles`。

### 5.2 不取(P3b)

`.sw` 开关 · `.sk-pill-more` + `.sk-menu` 下拉 · `confirm` 删除弹窗 · `TestPanel` ·
`copyMarkdown` / `exportSkill` / `runTest` / `doDelete` / `closeAnd` · `menuOpen` 与那个
`document mousedown` 监听 · `watch 'skill.id'` 里复位菜单/弹窗的逻辑。

**`TestPanel` 在 Vue2 里夹在「描述」与「SKILL.md」之间(`:108-112`)。** P3a 不渲染它,
两段直接相邻;在模板里留一行注释标明 P3b 要插回的位置,免得 P3b 插错顺序。

### 5.3 测试

空态两行文案;有 skill 时四格内容;三种 trigger 在详情格的显示(slash 要断言出 `/技能名`);
`last_used` 为空时显示 `—`;SKILL.md 渲染出 HTML;附带文件列表与空态;目录尺寸
`"(3 files)"` 被本地化;「在对话中试用」push 的路由对象正确(mock router)。
**断言里不许出现 `trigger_human` 的值** —— 反过来:构造一条 `trigger:'auto'` 但
`trigger_human:'WRONG'` 的数据,断言界面显示「自动触发」而非 `WRONG`(这条钉住偏离 4)。

---
