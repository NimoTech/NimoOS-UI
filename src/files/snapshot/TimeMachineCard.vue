<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FileThumb from '../components/FileThumb.vue'
import { dateFmt } from '../util/format'
import { fileExt } from '../util/ext'
import type { DeckPreview } from '../composables/useDeckPreview'

export interface TimeMachineCardItem {
  time: string
  dayLabelText: string
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
}

const props = defineProps<{
  item: TimeMachineCardItem
  state: 'front' | 'behind' | 'past'
  depth: number
  preview?: DeckPreview | null
}>()
const { t } = useI18n()

const ready = computed(() => props.preview?.status === 'ready')
const moreCount = computed(() => {
  const p = props.preview
  return p && p.status === 'ready' ? Math.max(0, p.total - p.entries.length) : 0
})
// 只有最前那张(以及刚被翻过去、正在飞出屏幕的那张)才铺文件网格。后面几张被前面这张
// 挡得只剩顶上一条,渲染整屏缩略图纯属浪费 —— 卡堆窗口有 5 张,一张 36 格就是 180 个
// <img>,每个都会真发一次缩略图请求。留 'past' 是为了让翻页时那张卡带着内容一起飞出去,
// 而不是内容先"啪"地消失、空壳再飞。
const showGrid = computed(() => props.state !== 'behind')
// 副标题:与文件区列表视图同一套字段(扩展名大写 + 修改时间),文件夹不显示扩展名
function subLine(entry: { is_dir?: boolean; name: string; date?: string }): string {
  const when = dateFmt(entry.date || '')
  if (entry.is_dir) return when
  const ext = fileExt(entry.name)
  return ext ? `${ext.toUpperCase()} · ${when}` : when
}
</script>

<template>
  <div
    class="tm-card"
    :class="[`is-${props.state}`, `depth-${props.depth}`, `type-${props.item.typeKind}`]"
  >
    <!-- 变换全部由 class 驱动的 CSS 决定(不写内联 transform):同一批 DOM 节点在选中变化时
         只换 class,浏览器就能沿着已声明的 transition 平滑过渡,无需任何 JS 动画循环。
         注:这条注释必须放在根元素内部,不能放在根元素之前——放在外面会让模板变成
         "注释 + div" 的多根 fragment,组件 $el 解析成注释节点,VTU 的 wrapper.classes()
         就会读到空数组(实测踩坑,已在此改正)。 -->
    <div class="tm-card-head">
      <div class="tm-card-when">
        <span class="tm-card-day">{{ props.item.dayLabelText }}</span>
        <span class="tm-card-time">{{ props.item.time }}</span>
      </div>
      <div class="tm-card-meta">
        <span v-if="props.item.label" class="tm-card-label">{{ props.item.label }}</span>
        <span class="tm-card-badge">{{ t(props.item.typeLabelKey) }}</span>
        <span v-if="ready" class="tm-card-count">{{ t('tmItemCount', { n: props.preview!.total }) }}</span>
      </div>
    </div>

    <div class="tm-card-body">
      <div v-if="showGrid && ready && props.preview!.entries.length" class="tm-files">
        <div v-for="entry in props.preview!.entries" :key="entry.path" class="tm-file">
          <FileThumb class="tm-file-icon" :entry="entry" />
          <span class="tm-file-name">{{ entry.name }}</span>
          <span class="tm-file-sub">{{ subLine(entry) }}</span>
        </div>
        <div v-if="moreCount > 0" class="tm-file tm-file-more">+{{ moreCount }}</div>
      </div>
      <span v-else-if="showGrid && ready" class="tm-card-note">{{ t('filesEmpty') }}</span>
      <span v-else-if="showGrid && props.preview?.status === 'missing'" class="tm-card-note">{{ t('tmNoFolderAtTime') }}</span>
    </div>
  </div>
</template>

<style scoped>
.tm-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  padding: 22px 26px 26px; border-radius: 20px; cursor: pointer; overflow: hidden;
  color: var(--tm-fg); background: var(--tm-card-bg);
  border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  transform-origin: center top;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s var(--ease), filter 0.4s var(--ease);
}
/* 选中(最前) */
.is-front { transform: translate3d(0, 0, 0) scale(1); z-index: 50; opacity: 1; }
/* 更老的快照往后退。卡片放大到 3/4 屏后,原先 -16/-30/-42px 那套位移在几百像素高的卡上
   小到看不出层次,整体按新尺寸放大;translateZ 同步加深(perspective 也在 Deck 里调大)。 */
.is-behind.depth-1 { transform: translate3d(0, -34px, -110px) rotateX(2deg) scale(0.94); z-index: 40; opacity: 0.86; filter: brightness(0.86); }
.is-behind.depth-2 { transform: translate3d(0, -62px, -220px) rotateX(4deg) scale(0.88); z-index: 30; opacity: 0.7; filter: brightness(0.7); }
.is-behind.depth-3 { transform: translate3d(0, -86px, -330px) rotateX(6deg) scale(0.82); z-index: 20; opacity: 0.52; filter: brightness(0.56); }
.is-behind.depth-4 { transform: translate3d(0, -106px, -440px) rotateX(8deg) scale(0.76); z-index: 10; opacity: 0.34; filter: brightness(0.44); }
/* 已经翻过去的(更新的)快照朝观众飞出屏幕下方 —— 参考稿的 isPast 分支。位移改用 vh:
   卡片已经有 3/4 屏高,固定 300px 飞不出视口,会在底栏后面留一层没退干净的残影。 */
.is-past { transform: translate3d(0, 62vh, 300px) rotateX(-20deg) scale(1.3); opacity: 0; z-index: 60; pointer-events: none; }

/* ── 卡片抬头:日期时间在左,备注/类型/项数在右 ─────────────────────────
   放在卡片顶部(而不是像小卡时那样整体居中)有两个理由:一是网格要占满剩下的空间;
   二是后面几张卡只有顶上一条露在外面,把时间放这条里,卡堆就自带"一叠时间"的读法。 */
.tm-card-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding-bottom: 14px; margin-bottom: 16px;
  border-bottom: 1px solid var(--tm-card-divider);
}
/* 后排卡片只露出顶上几十像素,而抬头正好落在那一条里 —— 露出来的是一个被拦腰切掉的
   34px 大号时间数字(实测截图确认),看着像渲染残影,不像"一叠卡片"。后排把抬头整个
   淡掉,只留卡面和描边;换到最前时沿着这条 transition 淡回来。 */
.is-behind .tm-card-head { opacity: 0; transition: opacity 0.3s var(--ease); }
.tm-card-when { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.tm-card-meta { display: flex; align-items: center; gap: 10px; min-width: 0; }

.tm-card-day { font-size: 13px; color: var(--tm-fg-muted); }
.tm-card-time { font-size: 34px; font-weight: 600; line-height: 1.05; }
.tm-card-label {
  font-size: 13px; color: var(--tm-fg-muted); max-width: 260px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-card-badge {
  font-size: 10px; font-weight: 700; letter-spacing: 0.6px; white-space: nowrap;
  padding: 3px 9px; border-radius: 999px;
  background: var(--nrm-bg); color: var(--nrm-fg);
}
.type-manual .tm-card-badge { background: var(--accent-soft); color: var(--accent-text); }
.type-preop .tm-card-badge { background: var(--dem-bg); color: var(--dem-fg); }
/* 类型只给最前那张卡描边着色(与刻度尺、存储区时间线同一套三色系统) */
.is-front.type-manual { border-color: var(--accent-soft-bd); }
.is-front.type-preop { border-color: var(--dem-bd); }
.tm-card-count { font-size: 12px; color: var(--tm-fg-muted); white-space: nowrap; }

/* ── 卡片正文:那一刻这个文件夹里有什么 ─────────────────────────────────
   列宽/间距/图标尺寸/字号都照抄 files/components/FileGridView.vue + FileTile.vue,
   看起来就是"文件区被搬进卡片里"。差别只在颜色走 --tm-* 一族(卡片是深空里的一块面),
   以及这里没有选中框、收藏星、右键菜单 —— 卡片是预览,交互在进入快照之后才有。 */
/* 文件多的时候要能用滚轮往下翻(用户反馈)。滚动条只给最前那张:后排卡不铺网格、
   past 卡正在飞出去,都不该吃掉滚轮事件。min-height:0 是 flex 子项能出现滚动条的前提
   (默认 min-height:auto 会被内容撑开,overflow 永远不触发)。 */
.tm-card-body { flex: 1 1 auto; min-height: 0; overflow: hidden; }
.is-front .tm-card-body { overflow-y: auto; scrollbar-width: thin; }
.tm-files {
  /* 列宽比文件区的 120px 宽一点:这里的副标题多了扩展名(“JPG · 7月20日 22:15”),
     120px 下会被截成“JPG · 7月20…”,反倒读不出是什么时候的 —— 实测截图确认过。 */
  display: grid; grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 14px; align-content: start;
}
.tm-file {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 8px; border-radius: 16px; min-width: 0;
}
.tm-file-icon { width: 64px; height: 64px; flex: 0 0 auto; }
.tm-file-name {
  font-size: 13px; text-align: center; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-file-sub {
  font-size: 11px; color: var(--tm-fg-muted); max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-file-more {
  justify-content: center; font-size: 15px; font-weight: 600;
  color: var(--tm-fg-muted); background: var(--nrm-bg); min-height: 64px;
}
.tm-card-note { display: block; padding-top: 8px; font-size: 13px; color: var(--tm-fg-muted); }
@media (prefers-reduced-motion: reduce) { .tm-card { transition: none; } }
</style>
