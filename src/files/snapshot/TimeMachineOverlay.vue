<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../../storage/stores/snapshot'
import { groupSnapshotsByDay } from '../../storage/util/snapshotView'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { buildVisibleStack, stepSelectedIndex } from '../util/timeMachineMath'
import { useDeckPreview } from '../composables/useDeckPreview'
import TimeMachineBar from './TimeMachineBar.vue'
import TimeMachineDeck from './TimeMachineDeck.vue'
import TimeMachineRail from './TimeMachineRail.vue'

const props = defineProps<{
  volumeUuid: string
  mountPoint: string
  /** 当前目录相对卷根的路径,空串表示就在卷根 */
  relPath: string
  /** 顶部那行给人看的路径(虚拟路径,带磁盘显示名) */
  folderLabel: string
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'select', path: string): void; (e: 'open-settings'): void }>()

const { t } = useI18n()
const store = useSnapshotStore()
const selectedIndex = ref(0)

// 分组复用 SP6-P5 已验收的 groupSnapshotsByDay(不重写一套),再摊平成带 flatIndex 的列表:
// 卡堆、键盘步进、刻度尺全都在这个跨天的扁平下标上工作。
// label.i18nKey 本身就是本仓库的键名('snapToday' / 'snapYesterday',见 storage/util/snapshotView.ts
// snapshotDayLabel),直接 t() 即可 —— 与 storage/components/SnapshotTimeline.vue 的写法一致,
// 不要再搬一层 'Today'/'Yesterday' 映射(那是两套不同的取值,搬了反而恒判假、恒吞成"昨天")。
const groups = computed(() => {
  let i = 0
  return groupSnapshotsByDay(store.snapshots).map((g) => ({
    dayKey: g.dayKey,
    labelText: g.label.i18nKey ? t(g.label.i18nKey) : (g.label.text ?? ''),
    items: g.items.map((item) => ({ ...item, flatIndex: i++ })),
  }))
})
const flatItems = computed(() => groups.value.flatMap((g) => g.items.map((it) => ({ ...it, dayLabelText: g.labelText }))))
const selectedItem = computed(() => flatItems.value[selectedIndex.value] ?? null)
const momentText = computed(() => (selectedItem.value ? `${selectedItem.value.dayLabelText} ${selectedItem.value.time}` : ''))

// 只给卡堆窗口里那几张拉预览(卡片显示"那一刻这个文件夹长什么样")—— 与 TimeMachineDeck
// 内部渲染可见窗口用的是同一个 buildVisibleStack,窗口大小(5+2)必须一致。
const visibleNames = computed(() =>
  buildVisibleStack(flatItems.value, selectedIndex.value, 5, 2).map((e) => e.item.name))
const { previews } = useDeckPreview({
  mountPoint: () => props.mountPoint,
  relPath: () => props.relPath,
  visibleNames: () => visibleNames.value,
})

async function load() {
  if (!props.volumeUuid) return
  await store.loadSnapshots(props.volumeUuid)
  // 每次(重新)拉列表都回到最新一张 —— 旧的下标在新列表里未必还指同一个快照
  selectedIndex.value = 0
}
defineExpose({ reload: load })

function enterSnapshot() {
  if (!props.mountPoint || !selectedItem.value) return
  const root = snapshotBrowsePath(props.mountPoint, selectedItem.value.name)
  // ⚠️ 对 Vue2 的有意改正(spec §4 第 1 条):Vue2 的 enterSnapshot 只跳快照根,用户在
  // /Photos/2024 打开时间机器、进去后被扔回卷根还得一层层点回来。卡片展示的就是当前
  // 文件夹在那一刻的样子,进入自然应落在同一个相对路径。
  emit('select', props.relPath ? `${root}/${props.relPath}` : root)
}

function onKeyup(e: KeyboardEvent) {
  const code = e.code || e.key
  if (code === 'Escape') { emit('close'); return }
  // 与真 Time Machine 一致:↑ 往过去(下标更大,列表是 newest-first),↓ 回到现在
  if (code === 'ArrowUp') { selectedIndex.value = stepSelectedIndex(selectedIndex.value, 1, flatItems.value.length); return }
  if (code === 'ArrowDown') { selectedIndex.value = stepSelectedIndex(selectedIndex.value, -1, flatItems.value.length); return }
  if (code === 'Enter') enterSnapshot()
}

const rootEl = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

onMounted(() => {
  load()
  document.addEventListener('keyup', onKeyup)
  // 全屏覆盖层接管了整个视口,焦点必须跟着进来 —— 否则键盘用户按 Tab 会在下面那层
  // 看不见的文件区里游走。卸载时归还,回到打开它的那颗按钮上。
  previouslyFocused = document.activeElement as HTMLElement | null
  rootEl.value?.focus()
})
onUnmounted(() => {
  document.removeEventListener('keyup', onKeyup)
  previouslyFocused?.focus?.()
})
watch(() => props.volumeUuid, () => { load() })
</script>

<template>
  <div ref="rootEl" class="tm-overlay" role="dialog" aria-modal="true" tabindex="-1" :aria-label="t('tmEntry')">
    <div class="tm-folder">{{ t('tmViewingFolder', { path: props.folderLabel }) }}</div>
    <button class="tm-gear" :aria-label="t('tmSettings')" @click="emit('open-settings')">⚙</button>

    <div v-if="store.listLoading" class="tm-skeleton" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="tm-skeleton-card" :style="{ transform: `translateY(${(n - 1) * -14}px) scale(${1 - (n - 1) * 0.06})` }"></div>
    </div>

    <div v-else-if="flatItems.length === 0" class="tm-empty">
      <p class="tm-empty-title">{{ t('snapNoneYet') }}</p>
      <p class="tm-empty-sub">{{ t('snapEmptyHint') }}</p>
    </div>

    <template v-else>
      <TimeMachineDeck
        :items="flatItems"
        :selected-index="selectedIndex"
        :previews="previews"
        @select="(i: number) => (selectedIndex = i)"
        @enter="enterSnapshot"
      />
      <TimeMachineRail :groups="groups" :selected-index="selectedIndex" @select="(i: number) => (selectedIndex = i)" />
    </template>

    <TimeMachineBar :moment-text="momentText" :can-enter="!!selectedItem" @cancel="emit('close')" @enter="enterSnapshot" />
  </div>
</template>

<style scoped>
.tm-overlay {
  /* z-index 900:高过文件区里的一切(全库文件区最高是 240),但**低于** Dialog.vue 的
     1000/1001 —— 这样 T11 的齿轮设置弹窗天然叠在时间机器之上,不需要任何 z-index 覆写。
     Vue2 那版把轮盘设到 4000、再想办法把弹窗抬到 4500,结果踩了 `::v-deep .modal` 编译成
     后代选择器却匹配不到 teleport 出去的根节点这个坑(见 Vue2 SnapshotSettingsModal.vue
     的 Fix Round 1 注释)。这里从一开始就不制造那个问题。 */
  position: fixed; inset: 0; z-index: 900; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--tm-bg); color: var(--tm-fg);
  outline: none; /* 编程式聚焦(tabindex="-1"),不需要焦点环——覆盖层本身不是可点的控件 */
}
.tm-folder { position: absolute; top: 22px; left: 28px; font-size: 13px; color: var(--tm-fg-muted); }
.tm-gear {
  position: absolute; top: 16px; right: 24px; z-index: 2;
  border: none; background: none; color: var(--tm-fg-muted);
  font-size: 20px; line-height: 1; cursor: pointer;
  transition: transform 0.2s var(--ease), color 0.2s var(--ease);
}
.tm-gear:hover { color: var(--tm-fg); transform: rotate(45deg); }
.tm-empty { text-align: center; }
.tm-empty-title { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
.tm-empty-sub { font-size: 13px; color: var(--tm-fg-muted); margin: 0; }
.tm-skeleton { position: relative; width: min(420px, 68vw); height: min(240px, 38vh); }
.tm-skeleton-card {
  position: absolute; inset: 0; border-radius: 18px;
  background: var(--tm-card-bg); border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  opacity: 0.6;
}
</style>
