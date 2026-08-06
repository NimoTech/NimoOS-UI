# P4 Task 5 review package — 2232857..HEAD

## commits
bd3dee2 feat(ai): SP8-P4 T5 McpServerGroup 可折叠分组

## stat
 .../components/settings/mcp/McpServerGroup.test.ts | 77 +++++++++++++++++++
 src/ai/components/settings/mcp/McpServerGroup.vue  | 88 ++++++++++++++++++++++
 2 files changed, 165 insertions(+)

## diff -U10
diff --git a/src/ai/components/settings/mcp/McpServerGroup.test.ts b/src/ai/components/settings/mcp/McpServerGroup.test.ts
new file mode 100644
index 0000000..d24497c
--- /dev/null
+++ b/src/ai/components/settings/mcp/McpServerGroup.test.ts
@@ -0,0 +1,77 @@
+import { describe, it, expect } from 'vitest'
+import { mount } from '@vue/test-utils'
+import { createI18n } from 'vue-i18n'
+import McpServerGroup from './McpServerGroup.vue'
+import zh from '../../../../i18n/zh_cn'
+import type { McpServer } from '../../../types/mcpServer'
+
+// SP8-P4 Task 5 —— 对齐 Vue2 src/views/AI/MCP/McpServerGroup.vue(47 行)。
+// brief Step 1 给的测试逐字照抄(公共约束 §2:brief 测试与 1:1 照 Vue2 冲突才是测试错,
+// 本任务书里的测试与蓝本行为核对无冲突,故不改)。
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+function srv(p: Partial<McpServer> = {}): McpServer {
+  return {
+    id: 1, name: 'brave', transport: 'http', url: 'https://example.com/mcp',
+    command: '', args: [], enabled: true, has_headers: false, has_env: false, ...p,
+  }
+}
+const mountG = (items: McpServer[], activeId: number | null = null) =>
+  mount(McpServerGroup, { props: { label: '已启用服务', items, activeId }, global: { plugins: [i18n] } })
+
+describe('McpServerGroup', () => {
+  it('渲染分组标题与计数', () => {
+    const w = mountG([srv(), srv({ id: 2, name: 'notion' })])
+    expect(w.find('.sk-group-label').text()).toContain('已启用服务')
+    expect(w.find('.sk-group-count').text()).toBe('2')
+  })
+
+  it('每项渲染名称、transport 标签、url', () => {
+    const w = mountG([srv({ name: 'brave', transport: 'sse', url: 'https://x/sse' })])
+    expect(w.find('.sk-item-name').text()).toBe('brave')
+    expect(w.find('.mcp-transport').text()).toBe('SSE')
+    expect(w.find('.mcp-transport').attributes('data-t')).toBe('sse')
+    expect(w.find('.sk-item-desc').text()).toBe('https://x/sse')
+  })
+
+  it('点击条目 emit pick(id)', async () => {
+    const w = mountG([srv({ id: 7 })])
+    await w.find('.sk-item').trigger('click')
+    expect(w.emitted('pick')).toEqual([[7]])
+  })
+
+  // 判别力:两项且只有第二项是 active —— 单元素数组测不出 activeId 是否真的比对了 id。
+  it('只有 id 命中 activeId 的那一项带 data-active=true', () => {
+    const w = mountG([srv({ id: 1 }), srv({ id: 2, name: 'b' })], 2)
+    const items = w.findAll('.sk-item')
+    expect(items[0].attributes('data-active')).toBe('false')
+    expect(items[1].attributes('data-active')).toBe('true')
+  })
+
+  // 判别力:两项一开一关。
+  it('停用项带 data-disabled=true 并显示 Off 角标,启用项不显示', () => {
+    const w = mountG([srv({ id: 1, enabled: true }), srv({ id: 2, name: 'b', enabled: false })])
+    const items = w.findAll('.sk-item')
+    expect(items[0].attributes('data-disabled')).toBe('false')
+    expect(items[1].attributes('data-disabled')).toBe('true')
+    expect(items[0].find('.sk-item-off').exists()).toBe(false)
+    expect(items[1].find('.sk-item-off').text()).toBe(zh.aiSkOff)
+  })
+
+  it('点标题折叠/展开(Vue2 :3 的 collapsed 开关)', async () => {
+    const w = mountG([srv(), srv({ id: 2, name: 'b' })])
+    expect(w.findAll('.sk-item')).toHaveLength(2)
+    await w.find('.sk-group-label').trigger('click')
+    expect(w.findAll('.sk-item')).toHaveLength(0)
+    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('true')
+    await w.find('.sk-group-label').trigger('click')
+    expect(w.findAll('.sk-item')).toHaveLength(2)
+  })
+
+  it('同名服务器拿到同一个色板 id(色块走 SkillTile)', () => {
+    const w = mountG([srv({ id: 1, name: 'same' }), srv({ id: 2, name: 'same' })])
+    const tiles = w.findAll('.sk-tile')
+    expect(tiles[0].attributes('style')).toBe(tiles[1].attributes('style'))
+  })
+})
diff --git a/src/ai/components/settings/mcp/McpServerGroup.vue b/src/ai/components/settings/mcp/McpServerGroup.vue
new file mode 100644
index 0000000..730feda
--- /dev/null
+++ b/src/ai/components/settings/mcp/McpServerGroup.vue
@@ -0,0 +1,88 @@
+<!--
+  SP8-P4 Task 5 —— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerGroup.vue`(47 行)。
+  结构上的孪生兄弟是 `../skills/SkillGroup.vue`(109 行,SP8-P3a Task 4,已评审通过)——
+  本文件的 `<script setup>` 写法、`.sk-group-*`/`.sk-item*` 外壳用法照它抄,不引入第三种模式。
+
+  【偏离 D3(公共约束 §3 第 3 条)】Vue2 `:29`/`:4` 的 `SkillIcon` 不移植,统一用
+  `../../icons/AgentIcon.vue`(chevDown 图标 AgentIcon.vue:19 已有)——承 P3a 先例,
+  与 SkillGroup.vue 头部注释同一条偏离。
+
+  【i18n 复用,非新增】Vue2 `:20` `$t('Off')` → 本仓 `aiSkOff`(值「已关闭」,
+  已在 T4 核实与 Vue2 zh 值逐字相同)。这是**跨域复用既有键**(该键定义在 skills 域),
+  不是本任务新增——分组标题 `label` 由父组件 T9 `McpSection.vue` 以 prop 传入
+  (对应 `aiMcpSrvGroupEnabled`/`aiMcpSrvGroupDisabled`),本组件不 `t()` 它。
+
+  【data-active / data-disabled】照 Vue2 :10-11 写成字符串 'true'/'false'(不用布尔)——
+  供 CSS 属性选择器命中(skills-styles.scss:95 起的 `.sk-item[data-active="true"]` 等)。
+
+  【色板与字形】Vue2 `:43` `color(n)`/`label2(t)` 方法体分别转发给
+  `serverColor`/`transportLabel`(`../../../util/mcpServerVisual.ts`,T2);`glyph` 是
+  Vue2 `:41` `data(){ glyph: SERVER_GLYPH }` 的等价物——本仓用常量直接引用,不放进
+  `data()`(无响应式需求,`<script setup>` 里没有等价的 `data()` 概念)。
+
+  零 <style> 块:用到的类均已在既有 scss 里 ——
+  `.sk-group-label`/`-chev`/`-count`、`.sk-item`/`-body`/`-head`/`-name`/`-desc`/`-meta`/`-off`
+  在 skills-styles.scss(:61,70,77,95,112,127-170);`.mcp-transport`(含三个 data-t 变体)
+  在 mcp-styles.scss(T1,:23-30)。
+-->
+<script setup lang="ts">
+import { ref } from 'vue'
+import { useI18n } from 'vue-i18n'
+import type { McpServer } from '../../../types/mcpServer'
+import { serverColor, transportLabel, SERVER_GLYPH } from '../../../util/mcpServerVisual'
+import AgentIcon from '../../icons/AgentIcon.vue'
+import SkillTile from '../skills/SkillTile.vue'
+
+const props = defineProps<{
+  label: string
+  items: McpServer[]
+  activeId: number | null
+}>()
+
+const emit = defineEmits<{ pick: [id: number] }>()
+
+const { t } = useI18n()
+
+// 本地折叠状态,默认展开——对齐 Vue2 :41 `data() { return { collapsed: false, ... } }`。
+const collapsed = ref(false)
+
+// Vue2 :41 `glyph: SERVER_GLYPH`——后端没有图标字段,全部 MCP 服务统一用这个字形,
+// 无响应式需求,不放进 ref。
+const glyph = SERVER_GLYPH
+</script>
+
+<template>
+  <div>
+    <div
+      class="sk-group-label"
+      :data-collapsed="collapsed"
+      @click="collapsed = !collapsed"
+    >
+      <span class="sk-group-chev"><AgentIcon name="chevDown" :size="11" /></span>
+      <span>{{ props.label }}</span>
+      <span class="sk-group-count">{{ props.items.length }}</span>
+    </div>
+    <template v-if="!collapsed">
+      <div
+        v-for="s in props.items"
+        :key="s.id"
+        class="sk-item"
+        :data-active="s.id === props.activeId ? 'true' : 'false'"
+        :data-disabled="!s.enabled ? 'true' : 'false'"
+        @click="emit('pick', s.id)"
+      >
+        <SkillTile :color="serverColor(s.name)" :icon="glyph" />
+        <div class="sk-item-body">
+          <div class="sk-item-head">
+            <div class="sk-item-name">{{ s.name }}</div>
+            <div class="mcp-transport" :data-t="s.transport">{{ transportLabel(s.transport) }}</div>
+          </div>
+          <div class="sk-item-desc">{{ s.url }}</div>
+          <div class="sk-item-meta">
+            <span v-if="!s.enabled" class="sk-item-off">{{ t('aiSkOff') }}</span>
+          </div>
+        </div>
+      </div>
+    </template>
+  </div>
+</template>
