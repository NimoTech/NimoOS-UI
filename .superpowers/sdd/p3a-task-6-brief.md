# SP8-P3a Task 6 —— `SkillsSection.vue`

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

## Task 6 —— `SkillsSection.vue`

**产出**:`src/ai/components/settings/sections/SkillsSection.vue` + `.test.ts`。

Vue2 蓝本 `SkillsSection.vue`(226 行)—— 本期只取只读部分。

### 6.1 模板

根 `<div class="set-split">`(Vue2 `:2`)。左列 `.sk-col`:

- `.sk-col-head` > `.sk-col-actions` > **只有**刷新按钮(`.icon-btn`,`AgentIcon refresh`
  size 15,`:title="t('aiCfgRefresh')"`)。`+` 按钮属 P3b,留注释标位。
- `.sk-col-search`:`AgentIcon search`(size 13)+ `<input v-model="query">`
  (`:placeholder="t('aiSkSearchPlaceholder')"`)+ 有 query 时的清空按钮
  (Vue2 `:17-24` 那个内联 `style="width:18px;height:18px"` 照抄 —— 是尺寸不是颜色,
  不违反 color-guard)。
- `.sk-list`:`loading` 时 `.sk-spinner`(Vue2 `:27-29` 的内联 grid 定位照抄);
  否则两个 `SkillGroup`(内置 / 我的,各自 `v-if="…length"`)+ `filtered.length===0`
  时的 `.sk-col-empty`(有 query → `aiSkNoMatch` + `<code>{{query}}</code>`;
  无 query → `aiSkEmpty`)。

右侧 `<SkillDetail :skill="activeSkill" />`。**不渲染** `AddSkillModal` 与 `.sk-toast`。

### 6.2 脚本

```ts
const skills = ref<Skill[]>([])
const loading = ref(true)
const activeId = ref<string | null>(null)
const query = ref('')
```

四个 computed 照 Vue2 `:105-118`。`setActive(id)`。`onMounted(() => reload())`。

`reload()` —— **本期最关键的一段**:

```ts
async function reload() {
  loading.value = true
  try {
    // Vue2 SkillsSection.vue:134 写的是 `resp.data`,那是 axios 层。共享包
    // service.ai.listSkills() 已 return res.data,而后端 route/v2/skills.go:37
    // 是 c.JSON(200, <slice>) 裸数组 —— 再取一次 .data 恒为 undefined,列表永远空。
    // 同 SP8-P2a 验收修的 loadAvailableModels(a942196)。见计划 §Task 6 / 设计 §2.2。
    const list = (await service.ai.listSkills()) as Skill[]
    skills.value = Array.isArray(list) ? list : []
    if (!activeId.value || !skills.value.find((s) => s.id === activeId.value)) {
      activeId.value = skills.value[0]?.id ?? null
    }
  } catch (e) {
    toast.show(t('aiSkLoadFailed'), 3000, 'danger')
  } finally {
    loading.value = false
  }
}
```

Vue2 `:139` 那句 `console.error` 不照抄(本仓无此惯例;三个兄弟分区都没有)。
失败走 `danger` 层 + 3000ms —— Vue2 用自己的 `.sk-toast` 且**失败也配绿 ✓**
(`:74` 无条件渲染 check 图标),这是它的缺陷,不照抄(设计 §6 偏离 3)。

### 6.3 测试(mock 一律裸数组)

```ts
const h = vi.hoisted(() => ({ listSkills: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
h.listSkills.mockResolvedValue([ /* 裸数组,不是 { data: [...] } */ ])
```

覆盖:挂载即加载并渲染两组;**单层取数口径**(给裸数组 → 列表非空。再给
`{ data: [...] }` → 断言列表为空,证明本仓口径是单层,防止将来有人"顺手"加回 `.data`);
搜索过滤三字段;两种空态文案;点条目切 `activeSkill`;选中项被过滤掉后不崩;
`reload` 失败弹 danger toast 且 `loading` 复位;刷新按钮触发重新加载。

---
