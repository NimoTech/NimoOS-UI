<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PortRow } from '../../util/composeSettings'
const props = defineProps<{ rows: PortRow[]; conflicts?: string[] }>()
const { t } = useI18n()
function isConflict(r: PortRow) { return (props.conflicts ?? []).includes(`${r.published}/${r.protocol}`) }
function add() { props.rows.push({ published: '', target: '', protocol: 'tcp' }) }
function del(i: number) { props.rows.splice(i, 1) }
</script>

<template>
  <div class="pair-editor">
    <div class="port-head"><span>{{ t('appsSettingsPortHost') }}</span><span>{{ t('appsSettingsPortContainer') }}</span><span>{{ t('appsSettingsPortProtocol') }}</span><span /></div>
    <div v-for="(r, i) in rows" :key="i" class="port-row" :class="{ conflict: isConflict(r) }" data-test="port-row">
      <input v-model="r.published" class="set-input" type="text" inputmode="numeric" />
      <input v-model="r.target" class="set-input" type="text" inputmode="numeric" />
      <select v-model="r.protocol" class="set-input"><option value="tcp">TCP</option><option value="udp">UDP</option></select>
      <button class="row-del" type="button" :aria-label="t('appsSettingsRemove')" @click="del(i)">✕</button>
    </div>
    <button class="row-add" type="button" data-test="port-add" @click="add">+ {{ t('appsSettingsAdd') }}</button>
  </div>
</template>

<style scoped>
.pair-editor { display: flex; flex-direction: column; gap: 8px; }
.port-head, .port-row { display: grid; grid-template-columns: 1fr 1fr 88px 28px; gap: 8px; align-items: center; }
.port-head { font-size: 11px; color: var(--fg-muted); letter-spacing: 0.05em; text-transform: uppercase; }
.set-input {
  width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 13px;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; outline: none;
}
.set-input:focus { border-color: var(--accent); }
.port-row.conflict .set-input { border-color: var(--remove-fg); }
.row-del { width: 28px; height: 28px; border: none; border-radius: 8px; cursor: pointer; background: transparent; color: var(--fg-muted); }
.row-del:hover { background: var(--chip-bg-hi); color: var(--remove-fg); }
.row-add { align-self: flex-start; padding: 6px 12px; font-size: 12.5px; cursor: pointer; color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; }
.row-add:hover { background: var(--chip-bg-hi); }
</style>
