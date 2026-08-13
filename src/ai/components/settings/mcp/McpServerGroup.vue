<!--
  SP8-P4 Task 5 — 1:1 ported from Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerGroup.vue` (47 lines).
  Structural twin is `../skills/SkillGroup.vue` (109 lines, SP8-P3a Task 4, already reviewed) —
  this file's `<script setup>` syntax and `.sk-group-*`/`.sk-item*` wrapper usage copied from it, no third pattern introduced.

  【Deviation from D3 (public constraint §3 #3)】Vue2 `:29`/`:4` `SkillIcon` not ported, unified to use
  `../../icons/AgentIcon.vue` (chevDown icon exists in AgentIcon.vue:19) — following P3a precedent,
  same deviation noted in SkillGroup.vue header comment.

  【i18n reuse, not new】Vue2 `:20` `$t('Off')` → this repo `aiSkOff` (value "disabled",
  verified in T4 to match Vue2 zh value exactly). This is **cross-domain reuse of existing key**
  (that key defined in skills domain), not new this task — group title `label` passed by parent
  component T9 `McpSection.vue` as prop (corresponds to `aiMcpSrvGroupEnabled`/`aiMcpSrvGroupDisabled`),
  this component does not `t()` it.

  【data-active / data-disabled】following Vue2 :10-11 as string 'true'/'false' (not boolean) —
  for CSS attribute selector matching (skills-styles.scss:95+ `.sk-item[data-active="true"]` etc).

  【Color palette and glyph】Vue2 `:43` `color(n)`/`label2(t)` method bodies forward to
  `serverColor`/`transportLabel` (`../../../util/mcpServerVisual.ts`, T2) respectively; `glyph` is
  equivalent to Vue2 `:41` `data(){ glyph: SERVER_GLYPH }` — this repo directly references the constant,
  not in `data()` (no reactivity needed, `<script setup>` has no equivalent `data()` concept).

  Zero <style> block: all used classes already in existing scss —
  `.sk-group-label`/`-chev`/`-count`, `.sk-item`/`-body`/`-head`/`-name`/`-desc`/`-meta`/`-off`
  in skills-styles.scss (:61,70,77,95,112,127-170); `.mcp-transport` (including three data-t variants)
  in mcp-styles.scss (T1, :23-30).
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

// Local collapse state, default expanded — aligned with Vue2 :41 `data() { return { collapsed: false, ... } }`.
const collapsed = ref(false)

// Vue2 :41 `glyph: SERVER_GLYPH` — backend has no icon field, all MCP services use this glyph uniformly,
// no reactivity needed, not in ref.
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
