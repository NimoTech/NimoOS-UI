<!--
  SP8-P3a Task 4 —— 1:1 移植自 Vue2 src/views/AI/Skills/SkillGroup.vue(64 行)。

  【偏离 2(公共约束 §3.2)】Vue2 :43 `SkillIcon` 不移植,统一用
  `../../icons/AgentIcon.vue`(chevDown 图标 AgentIcon.vue:19 已有)。

  【触发标签短键,brief 明确点名】本组件的 `.sk-item-tag` 短标签用
  `aiSkTagAuto`/`aiSkTagSlash`/`aiSkTagManual`(左栏卡片上的紧凑标签),
  **不** 复用 `skillsFormat.ts` 的 `triggerLabel()`(那个映射到
  `aiSkTriggerAutomatic`/`aiSkTriggerSlash`/`aiSkTagManual`,是右栏详情面板的
  长文案,manual 分支两处共用同一个键但 auto/slash 分支键不同)。两组标签在
  Vue2 生产语言包里本就是不同的串,故不得统一,这里就地写一个短键映射
  (对齐 Vue2 :56-61 的 triggerKind/triggerLabel 方法,但方法体不同)。

  【作者本地化】`authorLabel()`(../../../util/skillsFormat.ts)把后端硬编码的
  字面量 `'You'` 映射到 i18n 键 `aiSkAuthorYou`(「你」);映射不到时(`null`)
  原样显示 `s.author`(真实人名/系统作者数据,不经过 t()）。

  【data-active / data-disabled】照 Vue2 :17-18 写成字符串 `'true'`/`'false'`,
  不改成布尔 —— 供 .sk-item[data-active="true"] 等 CSS 属性选择器命中
  (skills-styles.scss:83-89)。

  零 <style> 块:用到的类均已在 skills-styles.scss 里(.sk-group-label/-chev/
  -count、.sk-item*、.sk-item-meta .sep）,本文件不新增 CSS。
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

// 本地折叠状态,默认展开——对齐 Vue2 :54 `data() { return { collapsed: false } }`。
const collapsed = ref(false)

// 对齐 Vue2 :56 `triggerKind(t)`:非 auto/slash 一律落 manual(不会返回 null)。
function triggerKind(trigger: string): 'auto' | 'slash' | 'manual' {
  return trigger === 'auto' ? 'auto' : trigger === 'slash' ? 'slash' : 'manual'
}

// 短键映射,见文件头注释——与 skillsFormat.ts 的 triggerLabel() 是两套独立文案。
function triggerTagKey(trigger: string): string {
  const kind = triggerKind(trigger)
  return kind === 'auto' ? 'aiSkTagAuto' : kind === 'slash' ? 'aiSkTagSlash' : 'aiSkTagManual'
}

function displayAuthor(author: string): string {
  const ref = authorLabel(author)
  return ref ? t(ref.key) : author
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
