<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../../storage/stores/snapshot'
import { groupSnapshotsByDay } from '../../storage/util/snapshotView'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { buildVisibleStack, stepSelectedIndex, DECK_WINDOW } from '../util/timeMachineMath'
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
// 内部渲染可见窗口用的是同一个 buildVisibleStack,窗口大小必须一致 —— 两处都从
// timeMachineMath.ts 的 DECK_WINDOW 取值,不再各写各的字面量(评审修复 Important)。
const visibleNames = computed(() =>
  buildVisibleStack(flatItems.value, selectedIndex.value, DECK_WINDOW.depth, DECK_WINDOW.past).map((e) => e.item.name))
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
  // 评审修复(Important,spec §2.3):那一刻这个快照里根本没有这个目录时(useDeckPreview
  // 拉目录内容 404 → status:'missing',卡片已经在显示"此时还没有这个文件夹")仍然可以
  // 进入,但落到快照根 —— 否则拼一个不存在的子路径,files.load 的 catch 把它悄悄降级成
  // "空文件夹",用户会误以为这个快照什么都没备份。
  const missing = previews.value[selectedItem.value.name]?.status === 'missing'
  emit('select', !missing && props.relPath ? `${root}/${props.relPath}` : root)
}

// 评审修复(Critical,第一轮):这个 handler 挂在 document 上(需要不管焦点具体落在覆盖层内
// 哪个子元素都能收到方向键/Esc/Enter),但这意味着叠在它之上的任何弹窗——典型如齿轮设置弹窗
// (reka-ui DialogContent,Teleport 到 document.body,不是 .tm-overlay 的 DOM 后代)——按键
// 都会一并冒泡到这里:Esc 关设置弹窗的同时把时间机器也关了、备注框里按 Enter 变成"进入
// 快照"、方向键输入框调数值的同时拨走了背后选中的快照。两道防线一起上(单独一道都不够):
// 1) 事件源(e.target)不在覆盖层根元素内 —— 覆盖住"叠着别的弹窗"这整类场景,因为
//    reka-ui 的弹层内容一律 Teleport 出去,天然不是 rootEl 的后代;
// 2) 事件源是原生输入控件(INPUT/TEXTAREA)—— 防御性兜底,哪怕将来覆盖层自己内部长出
//    输入框也不会被这里的方向键/回车吞掉。
// 只在 e.target 是真实 Element 时才做这两道判定:同目录测试沿用的
// `document.dispatchEvent(...)` 写法里 target 就是 document 本身(不是 Element),这类
// 合成事件本就没有"落在哪个元素上"这个信息,直接放行按原逻辑处理,与真实浏览器里
// keydown 事件的 target 恒为某个具体元素(而不是 document)不矛盾。
//
// 评审复核(Critical,第二轮):上面两道防线挂在 **keyup** 上时仍然漏防。真实 reka 弹窗
// 探针实测的时序——
//   keydown: reka 的 DismissableLayer(vueuse onKeyStroke 默认监听 keydown)在这一刻就把
//            设置弹窗关掉,并把焦点还回 .tm-overlay(FocusScope 卸载时 restoreFocus)。
//   keyup:   同一次物理按键的 keyup 到达时,e.target 已经变成 rootEl 自己(因为焦点已经
//            被上一步归还进来)——防线①(rootEl.contains(target))和防线②(不是 INPUT)
//            对这个新 target 都会放行,于是这里又把时间机器自己也关掉了。
// 根治办法:把监听整个从 keyup 换成 keydown。keydown 那一刻,事件源还是设置弹窗自己的
// DialogContent(Teleport 到 body,不是 rootEl 的后代),防线①能正确拦下;reka 自己的
// keydown 监听器晚于我们(document 早于 window 收到冒泡)处理 Escape,只关它自己的弹窗,
// 不会再有第二次"迟到的" keyup 把我们也带着关掉。
//
// 顺带处理复核点名的既有隐患:焦点落在底栏按钮(取消/进入)上按 Enter 时,浏览器会把
// Enter 键的默认动作(点击这个 button)当成 keydown 的一部分触发——如果这里的 Enter 分支
// 还继续往下执行 enterSnapshot(),就会和按钮自己的 @click 处理器各发一次(例如聚焦在
// "取消"按钮上按 Enter,会同时 emit close 又 emit select)。BUTTON 元素自己已经会响应
// Enter,这里对 BUTTON 目标直接不处理 Enter,交给原生 click 做唯一那一件事;Escape/方向键
// 不受影响(它们不会触发按钮的原生 click)。
function onKeydown(e: KeyboardEvent) {
  const target = e.target
  if (target instanceof Element) {
    if (!rootEl.value || !rootEl.value.contains(target)) return
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
  }
  const code = e.code || e.key
  if (code === 'Escape') { emit('close'); return }
  // 与真 Time Machine 一致:↑ 往过去(下标更大,列表是 newest-first),↓ 回到现在
  if (code === 'ArrowUp') { selectedIndex.value = stepSelectedIndex(selectedIndex.value, 1, flatItems.value.length); return }
  if (code === 'ArrowDown') { selectedIndex.value = stepSelectedIndex(selectedIndex.value, -1, flatItems.value.length); return }
  if (code === 'Enter') {
    if (target instanceof Element && target.tagName === 'BUTTON') return // 按钮聚焦:原生 click 已经会做该做的事,这里不重复触发
    enterSnapshot()
  }
}

const rootEl = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

onMounted(() => {
  load()
  document.addEventListener('keydown', onKeydown)
  // 全屏覆盖层接管了整个视口,焦点必须跟着进来 —— 否则键盘用户按 Tab 会在下面那层
  // 看不见的文件区里游走。卸载时归还,回到打开它的那颗按钮上。
  previouslyFocused = document.activeElement as HTMLElement | null
  rootEl.value?.focus()
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
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
