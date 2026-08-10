<!-- src/files/drop/components/DropPage.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../../components/shell/AreaShell.vue'
import FilesSidebar from '../../components/FilesSidebar.vue'
import DropItem from './DropItem.vue'
import DropCenter from './DropCenter.vue'
import DropAddButton from './DropAddButton.vue'
import ReceivePrompt from './ReceivePrompt.vue'
import { useDropStore } from '../stores/drop'
import { useFilesStore } from '../../stores/files'
import { contentsBox, positionFor, DISPLAY_ORDER } from '../dropLayout'
import { virtualPathToRouteParam } from '../../util/pathUtils'

const router = useRouter()
const { t } = useI18n()
const drop = useDropStore()
const files = useFilesStore()

const areaEl = ref<HTMLElement | null>(null)
const box = ref(contentsBox(1200, 700))
const isNarrow = ref(false)

function resize() {
  const el = areaEl.value
  if (!el) return
  isNarrow.value = el.clientWidth < 720 // 窄屏流式(替代 vue-breakpoint-mixin)
  box.value = contentsBox(el.clientWidth, el.clientHeight)
}

function goVirtual(virtualPath: string) {
  router.push('/files/' + virtualPathToRouteParam(virtualPath))
}

// self 已由 store 置顶(index 0);展示顺序表决定圆环占位(Vue2 initIndexArray)
const placed = computed(() =>
  drop.peers.map((p, i) => ({
    peer: p,
    isSelf: p.id === drop.selfId,
    position: positionFor(DISPLAY_ORDER[i] ?? i, box.value.radius, box.value.center),
  })),
)

onMounted(() => {
  window.addEventListener('resize', resize)
  resize()
  drop.init()
  if (!files.disks.length) files.loadRoots() // 侧栏盘符列表(对齐 SharesPage;漏掉则 DISKS 区恒空)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  drop.destroy()
})
</script>

<template>
  <AreaShell :title="t('filesTitle')">
    <div class="files-layout">
      <FilesSidebar @navigate="goVirtual" />
      <main ref="areaEl" class="drop-main" :class="{ narrow: isNarrow }">
        <h2 class="drop-title">{{ t('filesDropTitle') }}</h2>
        <div class="drop-pulse" aria-hidden="true"><i /><i /><i /></div>
        <div class="drop-area" :style="!isNarrow ? { width: box.width + 'px', height: box.height + 'px' } : undefined">
          <DropItem
            v-for="p in placed"
            :key="p.peer.id"
            :device="p.peer"
            :is-self="p.isSelf"
            :is-float="!isNarrow"
            :position="p.position"
            :transfer="drop.transfers[p.peer.id]"
            :suspended="!drop.connected"
            @select-files="(files) => drop.sendFiles(p.peer.id, files)"
            @cancel-transfer="drop.cancelTransfer(p.peer.id)"
          />
        </div>
        <DropCenter v-if="!isNarrow" />
        <DropAddButton />
        <ReceivePrompt />
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
/* Drop 页与 SharesPage 的关键差异:本页主区内容全是绝对定位(不撑高度),
   容器必须给出确定高度——height:100%(而非 min-height)+ drop-main 拉伸,
   否则 .drop-main 塌缩到标题高,resize() 量出 ~56px,contentsBox 算出负几何,气泡全部飞出可视区。 */
.files-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.drop-main { position: relative; flex: 1; align-self: stretch; overflow: hidden; display: flex; flex-direction: column; align-items: center; }
.drop-title { align-self: flex-start; margin: 16px 20px; font-size: 18px; color: var(--fg); }
.drop-area { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); }
.drop-main.narrow .drop-area {
  position: relative; left: auto; bottom: auto; transform: none;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; padding: 24px; width: 100%;
}
/* 脉冲波纹背景:CSS 替代 Vue2 GSAP DropBg */
.drop-pulse { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); pointer-events: none; }
.drop-pulse i {
  position: absolute; left: 50%; bottom: -40px; transform: translateX(-50%);
  border: 1px solid var(--card-border); border-radius: 50%;
  animation: dropPulse 6s linear infinite; opacity: 0;
}
.drop-pulse i:nth-child(1) { width: 300px; height: 300px; }
.drop-pulse i:nth-child(2) { width: 300px; height: 300px; animation-delay: 2s; }
.drop-pulse i:nth-child(3) { width: 300px; height: 300px; animation-delay: 4s; }
@keyframes dropPulse {
  0% { transform: translateX(-50%) scale(0.4); opacity: 0; }
  20% { opacity: 0.6; }
  100% { transform: translateX(-50%) scale(3.2); opacity: 0; }
}
@media (max-width: 768px) {
  .files-layout { gap: 0; }
}
</style>
