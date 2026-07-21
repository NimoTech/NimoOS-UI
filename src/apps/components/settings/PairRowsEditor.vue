<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PairRow } from '../../util/composeSettings'
const props = defineProps<{ rows: PairRow[]; labelA: string; labelB: string }>()
const { t } = useI18n()
function add() { props.rows.push({ a: '', b: '' }) }
function del(i: number) { props.rows.splice(i, 1) }
</script>

<template>
  <div class="pair-editor">
    <div class="pair-head"><span>{{ labelA }}</span><span>{{ labelB }}</span><span /></div>
    <div v-for="(r, i) in rows" :key="i" class="pair-row">
      <input v-model="r.a" class="set-input" type="text" />
      <input v-model="r.b" class="set-input" type="text" />
      <button class="row-del" type="button" data-test="pair-del" :aria-label="t('appsSettingsRemove')" @click="del(i)">✕</button>
    </div>
    <button class="row-add" type="button" data-test="pair-add" @click="add">+ {{ t('appsSettingsAdd') }}</button>
  </div>
</template>

<style scoped>
.pair-editor { display: flex; flex-direction: column; gap: 8px; }
.pair-head, .pair-row { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 8px; align-items: center; }
.pair-head { font-size: 11px; color: var(--fg-muted); letter-spacing: 0.05em; text-transform: uppercase; }
.set-input {
  width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 13px;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; outline: none;
}
.set-input:focus { border-color: var(--accent); }
.row-del { width: 28px; height: 28px; border: none; border-radius: 8px; cursor: pointer; background: transparent; color: var(--fg-muted); }
.row-del:hover { background: var(--chip-bg-hi); color: var(--remove-fg); }
.row-add { align-self: flex-start; padding: 6px 12px; font-size: 12.5px; cursor: pointer; color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; }
.row-add:hover { background: var(--chip-bg-hi); }
</style>
