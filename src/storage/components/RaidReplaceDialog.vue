<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { fmtSize } from '../../home/util/format'
import type { RaidDisk } from '../util/raidLevels'

// 迁移自 NimoOS-UI/src/components/Storage/raid/RaidReplaceDisk.vue(96 行)。
// 逐字对齐:故障盘只读展示(:9-15)、新盘单选下拉排除故障盘(:18-28)、黄色警告(:31-33)、
// footer danger 按钮直接执行——无二次确认弹层(:36-40)。
// store 调用留给父视图(StorageRaidDetail.vue),本组件只 emit confirm(newDiskPath)。
const props = defineProps<{
  open: boolean
  raidId: number | string
  faultyDiskPath: string
  availableDisks: RaidDisk[]
  busy?: boolean
}>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', newDiskPath: string): void }>()
const { t } = useI18n()
const newDiskPath = ref('')

// 开/关都清空选择:对齐 RaidDeleteDialog/FormatDialog 同款教训——不重新打开也须已清空,
// 避免下一次打开残留上一块盘的选中。
watch(
  () => props.open,
  () => {
    newDiskPath.value = ''
  },
)
</script>

<template>
  <Dialog :open="open" :title="t('raidReplaceTitle')" @update:open="emit('update:open', $event)">
    <div class="rrd-field">
      <label class="rrd-label">{{ t('raidReplaceFaulty') }}</label>
      <input class="rrd-input" type="text" :value="faultyDiskPath" disabled />
      <p class="rrd-hint">{{ t('raidReplaceRemoveHint') }}</p>
    </div>
    <div class="rrd-field">
      <label class="rrd-label">{{ t('raidReplaceNew') }}</label>
      <select v-model="newDiskPath" class="rrd-select">
        <option value="" disabled>{{ t('raidReplaceSelect') }}</option>
        <option
          v-for="disk in availableDisks.filter((d) => d.path !== faultyDiskPath)"
          :key="disk.path"
          :value="disk.path"
        >
          {{ disk.path }} — {{ fmtSize(disk.size) }}
        </option>
      </select>
    </div>
    <p class="rrd-warning">⚠️ {{ t('raidReplaceWarning') }}</p>
    <template #footer>
      <button class="rrd-cancel" type="button" :disabled="busy" @click="emit('update:open', false)">
        {{ t('storageCancel') }}
      </button>
      <button class="rrd-ok danger" type="button" :disabled="!newDiskPath || busy" @click="emit('confirm', newDiskPath)">
        {{ t('raidReplace') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.rrd-field { margin-bottom: 12px; }
.rrd-label { display: block; font-size: 12px; color: var(--fg-muted); margin-bottom: 4px; }
.rrd-input {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg-muted); outline: none;
}
.rrd-select {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); outline: none;
}
.rrd-select:focus { border-color: var(--accent); }
.rrd-hint { margin: 4px 0 0; font-size: 12px; color: var(--remove-fg); }
.rrd-warning { margin: 0 0 12px; font-size: 12px; color: var(--dem-fg); }
.rrd-cancel, .rrd-ok {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.rrd-cancel:disabled, .rrd-ok:disabled { opacity: 0.45; cursor: not-allowed; }
.rrd-ok.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
