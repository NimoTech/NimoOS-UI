<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ContextMenuItem } from 'reka-ui'
import ContextMenu from '../../components/ui/ContextMenu.vue'
import { iconUrl } from '../util/icons'
import type { ShareRow } from '../stores/shares'

const props = defineProps<{ row: ShareRow; selected?: boolean }>()
const emit = defineEmits<{ (e: 'get-link', row: ShareRow): void; (e: 'goto', row: ShareRow): void; (e: 'unshare', row: ShareRow): void; (e: 'toggle-select', row: ShareRow): void }>()
const { t } = useI18n()
</script>

<template>
  <li class="share-row">
    <ContextMenu>
      <div class="share-row-main" :class="{ selected: props.selected }">
        <span class="share-check" @click.stop>
          <input
            type="checkbox"
            class="share-check-box"
            :checked="props.selected"
            :aria-label="props.row.name"
            @change="emit('toggle-select', props.row)"
          />
        </span>
        <img class="share-icon" :src="iconUrl('folder-default')" alt="" />
        <span class="share-name">{{ props.row.name }}</span>
        <span class="share-actions">
          <button class="share-act" @click="emit('get-link', props.row)">{{ t('filesShareGetLink') }}</button>
          <button class="share-act" @click="emit('goto', props.row)">{{ t('filesShareGoto') }}</button>
          <button class="share-act danger" @click="emit('unshare', props.row)">{{ t('filesUnshare') }}</button>
        </span>
      </div>
      <template #menu>
        <ContextMenuItem class="ui-ctx-item" @select="emit('get-link', props.row)">{{ t('filesShareGetLink') }}</ContextMenuItem>
        <ContextMenuItem class="ui-ctx-item" @select="emit('goto', props.row)">{{ t('filesShareGoto') }}</ContextMenuItem>
        <ContextMenuItem class="ui-ctx-item danger" @select="emit('unshare', props.row)">{{ t('filesUnshare') }}</ContextMenuItem>
      </template>
    </ContextMenu>
  </li>
</template>

<style scoped>
.share-row { list-style: none; }
.share-row-main { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; }
.share-row-main:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); }
.share-icon { width: 28px; height: 28px; flex: 0 0 auto; }
.share-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.share-actions { display: flex; gap: 6px; opacity: 0; transition: opacity .12s; }
.share-row-main:hover .share-actions { opacity: 1; }
.share-act { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: transparent; color: var(--fg); cursor: pointer; font-size: 12px; }
.share-act:hover { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.share-act.danger { color: var(--remove-bg); border-color: var(--remove-bg); opacity: 0.7; }
.share-check { flex: 0 0 auto; display: flex; align-items: center; }
.share-check-box { opacity: 0; cursor: pointer; }
.share-row-main:hover .share-check-box, .share-row-main.selected .share-check-box { opacity: 1; }
.share-check-box:focus-visible { opacity: 1; }
.share-row-main.selected { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
</style>
