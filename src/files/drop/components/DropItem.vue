<!-- src/files/drop/components/DropItem.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ContextMenuItem } from 'reka-ui'
import ContextMenu from '../../../components/ui/ContextMenu.vue'
import { dropIconUrl } from '../dropIcons'
import type { PeerInfo } from '../protocol'
import type { TransferState } from '../stores/drop'

const props = defineProps<{
  device: PeerInfo
  isSelf: boolean
  isFloat: boolean
  position?: { left: string; top: string }
  transfer?: TransferState
  suspended?: boolean
}>()
const emit = defineEmits<{ 'select-files': [files: File[]] }>()
const { t } = useI18n()

const inputEl = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
// suspended = 重连窗口(spec §7):store.connected 为假时禁互动,menu/picker/drop 一并失效
const disabled = computed(() => props.isSelf || !!props.device.offline || !!props.suspended)
const icon = computed(() => dropIconUrl(props.device.name.model, !!props.device.offline, props.isSelf))
const tip = computed(() => {
  if (props.isSelf) return t('filesDropSelfTip')
  if (props.device.offline) return t('filesDropOfflineTip')
  if (props.transfer) {
    return props.transfer.sending
      ? t('filesDropSending', { num: props.transfer.count })
      : t('filesDropReceiving', { num: props.transfer.count })
  }
  return t('filesDropSendTip')
})
// SVG 进度环参数(r=38, 周长 2πr)
const CIRC = 2 * Math.PI * 38
const dash = computed(() => props.transfer ? (props.transfer.progress / 100) * CIRC : 0)

function onChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (files.length) emit('select-files', files)
  if (inputEl.value) inputEl.value.value = ''
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  if (disabled.value) return
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) emit('select-files', files)
}
function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (!disabled.value) dragOver.value = true
}
function pick() { if (!disabled.value) inputEl.value?.click() }
</script>

<template>
  <div
    class="drop-item"
    :class="{ floating: isFloat, offline: device.offline, self: isSelf }"
    :style="isFloat ? position : undefined"
    @drop="onDrop"
    @dragover="onDragOver"
    @dragleave="dragOver = false"
  >
    <!-- ContextMenu 包装(components/ui/ContextMenu.vue,已核实 API):默认 slot=触发区、#menu=菜单项、无 disabled prop。
         self/离线不包菜单(对齐 Vue2 showContextMenu 的 early-return),v-if 分流。 -->
    <ContextMenu v-if="!disabled">
      <button
        class="drop-bubble"
        :class="{ 'drag-over': dragOver }"
        :title="tip"
        @click="pick"
      >
        <img class="drop-ic" :src="icon" alt="" />
        <span class="drop-dot" />
        <svg v-if="transfer" class="drop-ring" viewBox="0 0 84 84">
          <circle class="ring-track" cx="42" cy="42" r="38" />
          <circle class="ring-bar" cx="42" cy="42" r="38"
            :stroke-dasharray="`${dash} ${CIRC}`" transform="rotate(-90 42 42)" />
        </svg>
      </button>
      <template #menu>
        <ContextMenuItem class="ui-ctx-item" @select="pick">{{ t('filesDropMenuSend') }}</ContextMenuItem>
      </template>
    </ContextMenu>
    <button v-else class="drop-bubble" :class="{ offline: device.offline }" :title="tip" disabled>
      <img class="drop-ic" :src="icon" alt="" />
    </button>
    <span v-if="transfer" class="drop-count">{{ tip }}</span>
    <span class="drop-name">{{ device.name.displayName }}</span>
    <input ref="inputEl" type="file" multiple hidden :disabled="disabled" @change="onChange" />
  </div>
</template>

<style scoped>
.drop-item { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 96px; }
.drop-item.floating { position: absolute; transform: translate(-50%, -50%); z-index: 10; }
.drop-bubble {
  position: relative; width: 80px; height: 80px; border-radius: 50%;
  background: var(--card-bg); border: 1px solid var(--card-border);
  display: grid; place-items: center; cursor: pointer;
  animation: pop 0.4s ease both;
  transition: transform 0.2s ease;
}
.drop-bubble:not(:disabled):hover, .drop-bubble.drag-over { transform: scale(1.12); }
.drop-bubble:disabled { cursor: default; }
.drop-bubble.offline { opacity: 0.45; }
.drop-ic { width: 44px; height: 44px; pointer-events: none; }
.drop-dot {
  position: absolute; top: 4px; right: 4px; width: 8px; height: 8px;
  border-radius: 50%; background: var(--good);
}
.drop-ring { position: absolute; inset: -3px; pointer-events: none; }
.ring-track { fill: none; stroke: var(--card-border); stroke-width: 2; }
.ring-bar { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; }
.drop-count { font-size: 12px; color: var(--fg-muted); }
.drop-name {
  max-width: 96px; font-size: 13px; color: var(--fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;
}

@keyframes pop {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
