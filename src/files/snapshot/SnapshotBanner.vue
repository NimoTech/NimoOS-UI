<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSnapshotBannerTime, type SnapshotBrowseInfo } from '../util/snapshotPath'

const props = defineProps<{
  info: SnapshotBrowseInfo | null
  /** 恢复在途:禁用按钮,防重复提交 */
  restoring: boolean
  /** 当前有没有可恢复的选中项 */
  canRestore: boolean
}>()
const emit = defineEmits<{ (e: 'exit'): void; (e: 'restore'): void }>()
const { t } = useI18n()

const bannerTime = computed(() => (props.info ? formatSnapshotBannerTime(props.info.snapshotName) : ''))
const restoreDisabled = computed(() => props.restoring || !props.canRestore)

function onRestore() {
  if (restoreDisabled.value) return
  emit('restore')
}
</script>

<template>
  <div v-if="props.info" class="snap-banner">
    <div class="snap-banner-row">
      <span class="snap-banner-text">{{ t('snapBrowseBanner', { time: bannerTime }) }}</span>
      <button
        class="snap-banner-btn snap-banner-restore"
        :class="{ 'is-busy': props.restoring }"
        :disabled="restoreDisabled"
        @click="onRestore"
      >{{ t('snapBrowseRestore') }}</button>
      <button class="snap-banner-btn snap-banner-exit" @click="emit('exit')">{{ t('snapBrowseExit') }}</button>
    </div>
    <!-- 常驻提示,不是一次性 toast:Vue2 M2-F2 的教训是一闪而过的提示没人看见,
         而"选中之后还要点恢复"这一步不说清楚,用户会以为进来就能改。 -->
    <div class="snap-banner-hint">{{ t('snapBrowseHint') }}</div>
  </div>
</template>

<style scoped>
/* 配色复用既有的"值得注意但不是错误"语义 token(--dem-*),与存储区快照时间线的
   preop 徽章同一套色,不新造一个黄色。 */
.snap-banner {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 12px; margin-bottom: 10px;
  border: 1px solid var(--dem-bd); border-radius: 12px;
  background: var(--dem-bg); color: var(--dem-fg); font-size: 13px;
}
.snap-banner-row { display: flex; align-items: center; gap: 8px; }
.snap-banner-text { flex: 1 1 auto; min-width: 0; }
.snap-banner-btn {
  flex: 0 0 auto; padding: 4px 12px; border-radius: 999px;
  border: 1px solid var(--dem-bd); background: transparent; color: var(--dem-fg);
  cursor: pointer; font-size: 12px;
}
.snap-banner-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--dem-fg) 14%, transparent); }
.snap-banner-btn:disabled { opacity: 0.5; cursor: default; }
.snap-banner-hint { font-size: 12px; opacity: 0.8; }
@media (max-width: 768px) {
  .snap-banner-row { flex-wrap: wrap; row-gap: 6px; }
  .snap-banner-text { flex: 1 1 100%; }
}
</style>
