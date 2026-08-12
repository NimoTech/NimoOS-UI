<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { fmtSize } from '../../home/util/format'
import { filterReplacementCandidates, type ReplaceTarget, type CandidateDiskLike } from '../util/raidReplace'

// 迁移自 NimoOS-UI/src/components/Storage/raid/RaidReplaceDisk.vue(2026-08-11 serial 语义版)。
// 与首版(按 path 传盘)的差异:
// - 故障盘展示 target.label(在位 faulty 盘是实时 path,拔掉的盘是 serial —— 它的
//   缓存路径可能已属于另一块物理盘,绝不当身份展示);请求体由父视图从 target 取
//   old_disk_path + old_disk_serial。
// - 候选盘经 filterReplacementCandidates 过滤(按 serial 排除被换盘自身,路径撞车不清空列表)。
// - 候选盘带 RAID 残留(role:"residue")时选项打警告标;确认时插入第二步确认,点名
//   残留阵列与其创建/最后活动时间,确认后才 emit wipeResidue: true。
//   ⚠️ array_name/created_at/updated_at 来自盘上 mdadm 超块,是不可信文本 ——
//   只能经模板插值({{ }})渲染,绝不能拼 HTML。
// store 调用留给父视图(StorageRaidDetail.vue),本组件只 emit confirm。
const props = defineProps<{
  open: boolean
  raidId: number | string
  target: ReplaceTarget | null
  disks: CandidateDiskLike[]
  busy?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', payload: { newDiskPath: string; wipeResidue: boolean }): void
}>()
const { t } = useI18n()
const newDiskPath = ref('')
// 残留二次确认步:true 时整个弹窗内容切换成清除确认
const residueConfirm = ref(false)

const candidates = computed(() => filterReplacementCandidates(props.disks, props.target))
const selectedResidue = computed(() => {
  const d = candidates.value.find((x) => x.path === newDiskPath.value)
  return d?.raid?.role === 'residue' ? d.raid : null
})

// 开/关都清空选择与确认步:对齐 RaidDeleteDialog/FormatDialog 同款教训——不重新打开
// 也须已清空,避免下一次打开残留上一块盘的选中/上一步的确认态。
watch(
  () => props.open,
  () => {
    newDiskPath.value = ''
    residueConfirm.value = false
  },
)

function onConfirm(): void {
  if (!newDiskPath.value) return
  if (selectedResidue.value) {
    // 选中的盘带外来阵列残留超块 —— 先把是谁的、什么时候的说清楚,确认了才清
    residueConfirm.value = true
    return
  }
  emit('confirm', { newDiskPath: newDiskPath.value, wipeResidue: false })
}
function onWipeConfirm(): void {
  emit('confirm', { newDiskPath: newDiskPath.value, wipeResidue: true })
}
</script>

<template>
  <Dialog :open="open" :title="residueConfirm ? t('raidResidue') : t('raidReplaceTitle')" @update:open="emit('update:open', $event)">
    <template v-if="!residueConfirm">
      <div class="rrd-field">
        <label class="rrd-label">{{ t('raidReplaceFaulty') }}</label>
        <input class="rrd-input" type="text" :value="target?.label ?? ''" disabled />
        <p class="rrd-hint">{{ t('raidReplaceRemoveHint') }}</p>
      </div>
      <div class="rrd-field">
        <label class="rrd-label">{{ t('raidReplaceNew') }}</label>
        <select v-model="newDiskPath" class="rrd-select">
          <option value="" disabled>{{ t('raidReplaceSelect') }}</option>
          <option v-for="disk in candidates" :key="disk.path" :value="disk.path">
            {{ disk.path }} — {{ fmtSize(disk.size) }}{{ disk.raid?.role === 'residue' ? ` — ⚠ ${t('raidResidue')}` : '' }}
          </option>
        </select>
        <p v-if="selectedResidue" class="rrd-residue-hint">
          ⚠ {{ t('raidResidueExplain', { name: selectedResidue.array_name }) }}
        </p>
      </div>
      <p class="rrd-warning">⚠️ {{ t('raidReplaceWarning') }}</p>
    </template>
    <template v-else>
      <p class="rrd-wipe-msg">
        {{ t('raidResidueWipeConfirm', {
          array: selectedResidue?.array_name || '?',
          created: selectedResidue?.created_at || '—',
          updated: selectedResidue?.updated_at || '—',
        }) }}
      </p>
    </template>
    <template #footer>
      <template v-if="!residueConfirm">
        <button class="rrd-cancel" type="button" :disabled="busy" @click="emit('update:open', false)">
          {{ t('storageCancel') }}
        </button>
        <button class="rrd-ok danger" type="button" :disabled="!newDiskPath || busy" @click="onConfirm">
          {{ t('raidReplace') }}
        </button>
      </template>
      <template v-else>
        <button class="rrd-cancel" type="button" :disabled="busy" @click="residueConfirm = false">
          {{ t('storageCancel') }}
        </button>
        <button class="rrd-wipe danger" type="button" :disabled="busy" @click="onWipeConfirm">
          {{ t('raidResidueWipeOk') }}
        </button>
      </template>
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
/* 上面那条把 background 设成了 var(--chip-bg) —— 深色主题下它是**半透明白的渐变**。
 * 作者一旦给 <select> 指定背景,Chrome 就把它带到弹出列表上,而原生 option **不渲染 gradient**
 * (退回浏览器默认白底),配上近白的 --fg 就是白底白字。根节点的 color-scheme: dark 救不了
 * (作者背景优先)。所以这里显式钉住实心底色与字色。守卫:styles/selectPopup.test.ts。 */
.rrd-select option,
.rrd-select optgroup {
  background-color: var(--set-option-bg);
  color: var(--set-option-fg);
}
.rrd-hint { margin: 4px 0 0; font-size: 12px; color: var(--remove-fg); }
.rrd-residue-hint { margin: 6px 0 0; font-size: 12px; color: var(--dem-fg); }
.rrd-warning { margin: 0 0 12px; font-size: 12px; color: var(--dem-fg); }
.rrd-wipe-msg { margin: 0 0 12px; font-size: 13px; line-height: 1.6; color: var(--fg); max-width: 420px; }
.rrd-cancel, .rrd-ok, .rrd-wipe {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.rrd-cancel:disabled, .rrd-ok:disabled, .rrd-wipe:disabled { opacity: 0.45; cursor: not-allowed; }
.rrd-ok.danger, .rrd-wipe.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
