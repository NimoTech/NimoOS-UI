<!--
  SP8-P4 Task 5 —— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerGroup.vue`(47 行)。
  结构上的孪生兄弟是 `../skills/SkillGroup.vue`(109 行,SP8-P3a Task 4,已评审通过)——
  本文件的 `<script setup>` 写法、`.sk-group-*`/`.sk-item*` 外壳用法照它抄,不引入第三种模式。

  【偏离 D3(公共约束 §3 第 3 条)】Vue2 `:29`/`:4` 的 `SkillIcon` 不移植,统一用
  `../../icons/AgentIcon.vue`(chevDown 图标 AgentIcon.vue:19 已有)——承 P3a 先例,
  与 SkillGroup.vue 头部注释同一条偏离。

  【i18n 复用,非新增】Vue2 `:20` `$t('Off')` → 本仓 `aiSkOff`(值「已关闭」,
  已在 T4 核实与 Vue2 zh 值逐字相同)。这是**跨域复用既有键**(该键定义在 skills 域),
  不是本任务新增——分组标题 `label` 由父组件 T9 `McpSection.vue` 以 prop 传入
  (对应 `aiMcpSrvGroupEnabled`/`aiMcpSrvGroupDisabled`),本组件不 `t()` 它。

  【data-active / data-disabled】照 Vue2 :10-11 写成字符串 'true'/'false'(不用布尔)——
  供 CSS 属性选择器命中(skills-styles.scss:95 起的 `.sk-item[data-active="true"]` 等)。

  【色板与字形】Vue2 `:43` `color(n)`/`label2(t)` 方法体分别转发给
  `serverColor`/`transportLabel`(`../../../util/mcpServerVisual.ts`,T2);`glyph` 是
  Vue2 `:41` `data(){ glyph: SERVER_GLYPH }` 的等价物——本仓用常量直接引用,不放进
  `data()`(无响应式需求,`<script setup>` 里没有等价的 `data()` 概念)。

  零 <style> 块:用到的类均已在既有 scss 里 ——
  `.sk-group-label`/`-chev`/`-count`、`.sk-item`/`-body`/`-head`/`-name`/`-desc`/`-meta`/`-off`
  在 skills-styles.scss(:61,70,77,95,112,127-170);`.mcp-transport`(含三个 data-t 变体)
  在 mcp-styles.scss(T1,:23-30)。
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { McpServer } from '../../../types/mcpServer'
import { serverColor, transportLabel, SERVER_GLYPH } from '../../../util/mcpServerVisual'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillTile from '../skills/SkillTile.vue'

const props = defineProps<{
  label: string
  items: McpServer[]
  activeId: number | null
}>()

const emit = defineEmits<{ pick: [id: number] }>()

const { t } = useI18n()

// 本地折叠状态,默认展开——对齐 Vue2 :41 `data() { return { collapsed: false, ... } }`。
const collapsed = ref(false)

// Vue2 :41 `glyph: SERVER_GLYPH`——后端没有图标字段,全部 MCP 服务统一用这个字形,
// 无响应式需求,不放进 ref。
const glyph = SERVER_GLYPH
</script>

<template>
  <div>
    <div
      class="sk-group-label"
      :data-collapsed="collapsed"
      @click="collapsed = !collapsed"
    >
      <span class="sk-group-chev"><AgentIcon name="chevDown" :size="11" /></span>
      <span>{{ props.label }}</span>
      <span class="sk-group-count">{{ props.items.length }}</span>
    </div>
    <template v-if="!collapsed">
      <div
        v-for="s in props.items"
        :key="s.id"
        class="sk-item"
        :data-active="s.id === props.activeId ? 'true' : 'false'"
        :data-disabled="!s.enabled ? 'true' : 'false'"
        @click="emit('pick', s.id)"
      >
        <SkillTile :color="serverColor(s.name)" :icon="glyph" />
        <div class="sk-item-body">
          <div class="sk-item-head">
            <div class="sk-item-name">{{ s.name }}</div>
            <div class="mcp-transport" :data-t="s.transport">{{ transportLabel(s.transport) }}</div>
          </div>
          <div class="sk-item-desc">{{ s.url }}</div>
          <div class="sk-item-meta">
            <span v-if="!s.enabled" class="sk-item-off">{{ t('aiSkOff') }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
