# SP8-P3a Task 3 —— `SkillTile.vue`

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

## Task 3 —— `SkillTile.vue`

**产出**:`src/ai/components/settings/skills/SkillTile.vue` + `.test.ts`。

Vue2 蓝本 `SkillTile.vue`(43 行)。`<script setup lang="ts">`。

- props:`color = 'blue'` · `icon = 'sparkle'` · `size = 30` · `radius = 9`。
- 颜色查表从 Vue2 的 `COLORS` 常量改成 token 名查表:
  `blue|purple|pink|orange|green|teal|slate` → `var(--grad-sk-<id>)`,未知 id 回落 `blue`
  (Vue2 `:37` 同款兜底)。
- 内部图标改用 `AgentIcon`(`../../icons/AgentIcon.vue`),`:size="Math.round(size*0.5)"`,
  `color="white"` —— **注意**:`color="white"` 是具名色,若 `AgentIcon` 的 color prop 直接
  进 `style`,color-guard 会拦。先读 `AgentIcon.vue` 看它怎么处理 color,按它既有的用法办;
  若确需 token,用现成的「恒白前景」token,找不到就**停下来报告**。
- `SKILL_COLORS` 在 Vue2 是具名导出(供 `AddSkillModal` 的取色盘用)。P3a 无消费方,
  **仍然导出**这张 id 列表(`export const SKILL_COLOR_IDS`),P3b 直接用 —— 但不要导出
  颜色字面量。

`.test.ts`:七个 id 各渲染一次断言拿到对应 token 名;未知 id 回落 blue;size/radius 生效。

---
