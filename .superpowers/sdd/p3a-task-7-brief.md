# SP8-P3a Task 7 —— 接线

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

## Task 7 —— 接线

**产出**:`SettingsPage.vue` · `sections.ts` · `sections.test.ts` · `SettingsPage.test.ts`。

1. `sections.ts:94` → `export const DEFERRED_SECTIONS: SectionId[] = ['mcp']`,注释更新
   (`skills` 已于 P3a 实现,`mcp` 仍待 P4)。
2. `SettingsPage.vue`:import `SkillsSection`,映射表 `skills: SkillsSection`(替掉
   `SectionPlaceholder`),并更新文件头注释里"只剩 skills / mcp 渲染 SectionPlaceholder"
   那句(`:71`)与 `:30` 的 toast 说明。
3. `sections.test.ts:57-59`:`DEFERRED_SECTIONS` 契约改为 `['mcp']`。
4. `SettingsPage.test.ts:404`(第 19 条):原断言「选中 skills 弹一条 toast」。改为断言
   **选中 skills 渲染 `SkillsSection` 且不弹 toast**;另补/保留一条 `mcp` 仍弹 toast 的用例,
   保证占位契约没被整个删掉。
5. `SPLIT_SECTIONS` **不动**(`['skills','mcp']` 本来就对 —— 它描述布局,与是否实现无关)。

**注意**:`SettingsPage.test.ts` 里可能有其它用例间接依赖 skills 是占位。跑全量后
逐条归因,**不许为了让测试变绿而削弱既有断言**。

---
