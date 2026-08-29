<script setup lang="ts">
// tmux window tab strip, 1:1 with Vue2 Terminal.vue's .term-tabs block
// (click select / dblclick rename / x close / + create), restyled onto theme
// tokens per spec §1 decision 1 (chrome follows the theme).
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TerminalWindow } from '@nimotech/nimoos-service'

defineProps<{ windows: TerminalWindow[] }>()
const emit = defineEmits<{ select: [i: number]; create: []; close: [i: number]; rename: [i: number, name: string] }>()
const { t } = useI18n()

const renamingIndex = ref(-1)
const renameText = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

// The input lives inside a v-for scope, so a plain string ref would resolve to
// an array; bind it with a callback instead and focus once Vue mounts it.
function setRenameInputRef(el: Element | { $el: Element } | null) {
  renameInput.value = (el as HTMLInputElement) ?? null
}

function beginRename(win: TerminalWindow) {
  renamingIndex.value = win.index
  renameText.value = win.name
  void nextTick(() => renameInput.value?.focus())
}
function commitRename(i: number) {
  if (renamingIndex.value !== i) return // blur after enter already committed
  renamingIndex.value = -1
  emit('rename', i, renameText.value)
}
</script>

<template>
  <div class="term-tabs" role="tablist">
    <div
      v-for="win in windows"
      :key="win.index"
      data-test="win-tab"
      class="term-tab"
      :class="{ 'is-active': win.active }"
      role="tab"
      :aria-selected="win.active"
      @click="emit('select', win.index)"
      @dblclick="beginRename(win)"
    >
      <template v-if="renamingIndex === win.index">
        <input
          :ref="setRenameInputRef"
          v-model="renameText"
          data-test="win-rename"
          class="term-tab-input"
          @click.stop
          @keyup.enter="commitRename(win.index)"
          @blur="commitRename(win.index)"
        />
      </template>
      <template v-else>
        <span class="term-tab-label">{{ win.index }}:{{ win.name }}</span>
        <button
          type="button"
          data-test="win-close"
          class="term-tab-close"
          :title="t('termCloseWin')"
          :aria-label="t('termCloseWin')"
          @click.stop="emit('close', win.index)"
        >×</button>
      </template>
    </div>
    <button type="button" data-test="win-add" class="term-tab-add" :title="t('termNewWin')" :aria-label="t('termNewWin')" @click="emit('create')">＋</button>
  </div>
</template>

<style scoped>
.term-tabs { display: flex; align-items: center; gap: 6px; overflow-x: auto; }
.term-tab {
  display: inline-flex; align-items: center; height: 28px; padding: 0 10px;
  border-radius: 9px; border: 1px solid var(--card-border);
  background: transparent; color: var(--fg-muted);
  cursor: pointer; font-size: 13px; white-space: nowrap;
}
.term-tab.is-active { background: var(--chip-bg-hi); color: var(--fg); }
.term-tab-close {
  margin-left: 6px; border: 0; background: transparent; color: inherit;
  cursor: pointer; opacity: 0.6; font-size: 13px; padding: 0; line-height: 1;
}
.term-tab-close:hover { opacity: 1; }
.term-tab-add {
  height: 28px; min-width: 30px; border: 1px solid var(--card-border); border-radius: 9px;
  background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 13px;
}
.term-tab-add:hover { background: var(--chip-bg-hi); color: var(--fg); }
.term-tab-input {
  width: 90px; font-size: 13px; background: var(--chip-bg); color: var(--fg);
  border: 1px solid var(--accent); border-radius: 6px; outline: none; padding: 2px 6px;
}
</style>
