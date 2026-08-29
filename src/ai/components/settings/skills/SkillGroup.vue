<!--
  SP8-P3a Task 4 — 1:1 port from Vue2 src/views/AI/Skills/SkillGroup.vue (64 lines).

  [Deviation 2 (shared constraint §3.2)] Vue2 :43 `SkillIcon` is not ported, uniformly using
  `../../icons/AgentIcon.vue` (the chevDown icon already exists at AgentIcon.vue:19).

  [Trigger tag short keys, explicitly called out in the brief] This component's `.sk-item-tag`
  short label uses `aiSkTagAuto`/`aiSkTagSlash`/`aiSkTagManual` (the compact tag on the
  left-column card), and does **not** reuse `skillsFormat.ts`'s `triggerLabel()` (which maps
  to `aiSkTriggerAutomatic`/`aiSkTriggerSlash`/`aiSkTagManual`, the long-form copy for the
  right-column detail panel — the manual branch shares one key at both spots, but the
  auto/slash branches use different keys). The two label sets are already distinct strings in
  Vue2's production locale pack, so they must not be unified; a short-key mapping is written
  locally here instead (aligned with Vue2 :56-61's triggerKind/triggerLabel methods, but with
  a different method body).

  [Author localization] `authorLabel()` (../../../util/skillsFormat.ts) maps the backend's
  hardcoded literal `'You'` to the i18n key `aiSkAuthorYou` ("你"); when it doesn't map
  (`null`), `s.author` is shown as-is (a real person's name / system author data, not passed
  through t()).

  [data-active / data-disabled] Written as the strings `'true'`/`'false'` per Vue2 :17-18,
  not changed to booleans — so `.sk-item[data-active="true"]` and similar CSS attribute
  selectors can match (skills-styles.scss:83-89).

  Zero <style> blocks: the classes used are all already in skills-styles.scss
  (.sk-group-label/-chev/-count, .sk-item*, .sk-item-meta .sep), this file adds no new CSS.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Skill } from '../../../types/skill'
import { authorLabel } from '../../../util/skillsFormat'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillTile from './SkillTile.vue'

const props = defineProps<{
  label: string
  items: Skill[]
  activeId: string | null
}>()

const emit = defineEmits<{ pick: [id: string] }>()

const { t } = useI18n()

// Local collapse state, expanded by default — aligned with Vue2 :54
// `data() { return { collapsed: false } }`.
const collapsed = ref(false)

// Aligned with Vue2 :56 `triggerKind(t)`: anything other than auto/slash always falls to
// manual (never returns null).
function triggerKind(trigger: string): 'auto' | 'slash' | 'manual' {
  return trigger === 'auto' ? 'auto' : trigger === 'slash' ? 'slash' : 'manual'
}

// Short-key mapping, see the file header comment — an independent copy set from
// skillsFormat.ts's triggerLabel().
function triggerTagKey(trigger: string): string {
  const kind = triggerKind(trigger)
  return kind === 'auto' ? 'aiSkTagAuto' : kind === 'slash' ? 'aiSkTagSlash' : 'aiSkTagManual'
}

function displayAuthor(author: string): string {
  // Final review M4: the local variable's original name `ref` shadowed this file's :27 `ref`
  // imported from vue (currently harmless, since this function doesn't use reactivity, but
  // renaming removes this classic pitfall outright without changing behavior).
  const labelRef = authorLabel(author)
  return labelRef ? t(labelRef.key) : author
}

function runsLabel(calls: number): string {
  return t('aiSkNRuns', { count: Number(calls || 0).toLocaleString() })
}
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
        <SkillTile :color="s.color" :icon="s.icon" />
        <div class="sk-item-body">
          <div class="sk-item-head">
            <div class="sk-item-name">{{ s.name }}</div>
            <div class="sk-item-tag" :data-kind="triggerKind(s.trigger)">
              {{ t(triggerTagKey(s.trigger)) }}
            </div>
          </div>
          <div class="sk-item-desc">{{ s.description }}</div>
          <div class="sk-item-meta">
            <span>{{ displayAuthor(s.author) }}</span>
            <span class="sep" />
            <span>{{ runsLabel(s.calls) }}</span>
            <span v-if="!s.enabled" class="sk-item-off">{{ t('aiSkOff') }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
