<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/KindIcon.vue
  (未在 Task 3 brief 文件清单中点名,但 UserMessage 蓝本的文件 chip 直接依赖它——
  作为必要的叶子依赖一并逐字移植;放在 shell/ 与 Vue2 原路径对齐,Task 4 的
  AgentSidebar/AgentTopbar 也会落在同一目录下。)
-->
<script setup lang="ts">
import { computed } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

const EXT_COLORS: Record<string, string> = {
  pdf: '#FF3B30', md: '#1a1a1a', txt: '#1a1a1a',
  doc: '#007AFF', docx: '#007AFF',
  xls: '#1D6F42', xlsx: '#1D6F42', xlsm: '#1D6F42',
  ppt: '#D24726', pptx: '#D24726',
  json: '#FF9500', yaml: '#FF9500', yml: '#FF9500', toml: '#FF9500', xml: '#FF9500',
  zip: '#FF9500', tar: '#FF9500', gz: '#FF9500',
  heic: '#AF52DE', jpg: '#AF52DE', jpeg: '#AF52DE', png: '#AF52DE', gif: '#AF52DE', webp: '#AF52DE',
  mov: '#FF2D55', mp4: '#FF2D55', mkv: '#FF2D55', avi: '#FF2D55', webm: '#FF2D55',
  mp3: '#34C759', flac: '#34C759', wav: '#34C759', m4a: '#34C759',
  dmg: '#8E8E93', iso: '#8E8E93',
  py: '#3776AB', go: '#00ADD8', js: '#F7DF1E', ts: '#3178C6', vue: '#41B883',
  c: '#A8B9CC', cpp: '#00599C', h: '#A8B9CC', rs: '#CE412B', rb: '#CC342D',
}

const props = withDefaults(
  defineProps<{ kind: string; ext?: string; color?: string; size?: number }>(),
  { ext: '', color: '', size: 16 },
)

const extLabel = computed(() => (props.ext || 'f').slice(0, 3).toUpperCase())
const extColor = computed(() => EXT_COLORS[(props.ext || '').toLowerCase()] || '#8E8E93')

const rootStyle = computed(() => {
  const w = props.size + 6
  const r = props.size + 6
  if (props.kind === 'drive') {
    const c = props.color || '#007AFF'
    return {
      width: `${w}px`, height: `${r}px`,
      borderRadius: '7px',
      background: `linear-gradient(135deg, ${c}, ${c}dd)`,
      boxShadow: `0 2px 6px ${c}40, inset 0 0 0 0.5px rgba(255,255,255,0.3)`,
    }
  }
  if (props.kind === 'folder') {
    return {
      width: `${w}px`, height: `${r}px`,
      borderRadius: '6px',
      background: 'rgba(0,122,255,0.12)',
    }
  }
  const c = extColor.value
  return {
    width: `${w}px`, height: `${r}px`,
    borderRadius: '5px',
    background: `${c}1F`,
    color: c,
  }
})
</script>

<template>
  <div class="kind-icon" :data-kind="kind" :style="rootStyle">
    <AgentIcon
      v-if="kind === 'drive'"
      name="drive"
      :size="size - 2"
      color="white"
      :stroke-width="1.8"
    />
    <AgentIcon
      v-else-if="kind === 'folder'"
      name="folder"
      :size="size - 2"
      color="var(--accent)"
    />
    <span v-else class="kind-ext">{{ extLabel }}</span>
  </div>
</template>

<style scoped>
.kind-icon {
  display: grid; place-items: center; flex-shrink: 0;
}
.kind-ext {
  font-size: 8px; font-weight: 700; letter-spacing: 0.02em;
  text-transform: uppercase; color: inherit;
}
</style>
