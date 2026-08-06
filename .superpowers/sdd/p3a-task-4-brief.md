# SP8-P3a Task 4 —— `SkillGroup.vue`

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

## Task 4 —— `SkillGroup.vue`

**产出**:`src/ai/components/settings/skills/SkillGroup.vue` + `.test.ts`。

Vue2 蓝本 `SkillGroup.vue`(64 行)。

- props:`label: string` · `items: Skill[]` · `activeId: string | null`。
- emit:`pick(id: string)`。
- 本地 `collapsed = ref(false)`。
- 组标题 `.sk-group-label[data-collapsed]` 点击折叠;`.sk-group-chev` 用 `AgentIcon` 的
  `chevDown`;`.sk-group-count` 显示 `items.length`。
- 条目 `.sk-item[data-active][data-disabled]`,内含 `SkillTile` + 名称 + 触发标签
  `.sk-item-tag[data-kind]` + 描述 + `.sk-item-meta`(作者 · 分隔点 · `{count} 次运行` ·
  未启用时 `已关闭` 徽标)。
- `triggerKind(t)` 照 Vue2 `:52`;标签文案用**短键** `aiSkTagAuto/Slash/Manual`。
- 作者用 `authorLabel()` 映射(`'You'` → 「你」)。
- `{count} runs` 的 `count` 照 Vue2 用 `Number(s.calls||0).toLocaleString()`。

`.test.ts`:折叠切换隐藏/显示条目;点条目 emit `pick`;`data-active` / `data-disabled` 正确;
三种 trigger 的标签与 `data-kind`;`'You'` 作者被本地化;非 `'You'` 原样显示。

---
