<script setup lang="ts">
// Ported (Options API -> <script setup> Composition API, logic unchanged) from
// Vue2 NimoOS-UI src/views/Photos/PhotosToolbar.vue (49 lines).
// P1 scope cut (task-7-brief.md): no icon library — tabs/density buttons render as
// plain text with i18n labels. (`after-tabs` 槽位已由 SP7-P7b-T3 补回。)
//
// Plan B Task 5 re-skin(2026-08-12,D19 兄弟任务「工具栏 + FilterBar 重刻」):
// 1) 根类名 `.photos-toolbar` -> `.toolbar`,让 src/photos/styles/vue2-parity/photos.scss
//    里已经原样搬进来的 `.photos-root .toolbar/.tabs/.tab/.density/.muted-text`
//    (对应 Vue2 photos.scss:266-289)直接生效——组件自身不再需要一份平行的
//    <style scoped>(那份是 P1 用通用 app token 写的,数值/配色都跟 Vue2 不是一回事;
//    parity scss 用的是 .photos-root 自己的本地 token,数值逐字对齐 Vue2)。本组件因此
//    完全不带 <style> 块,样式全部交给 parity scss(前提:宿主渲染在 .photos-root 之下,
//    时间线页 Photos.vue:272 与跳库页 PhotosPlaceAssets.vue:173 都满足)。
// 2) P1 当年因为"没有共享图标库"砍掉了 tab/density 的 icon(见上面那条旧注释),这次连带
//    补上——本组件按 PhotosFilterChip.vue/PhotosFilterBar.vue 的先例内联 <svg>,不经由
//    共享的 PhotosIcon.vue 组件(注:T3 已经建了 PhotosIcon.vue,T4/T6/T7 都在消费它——
//    "本仓不存在共享图标库"这个前提到写这段时已经不成立了;这里是本组件自己按已有先例
//    选择继续内联,不是因为没有共享组件可用),glyph 逐字符抄自 Vue2 NimoOS-UI
//    src/views/Photos/PhotosIcon.vue 对应 name 分支(album/ocr/video 用于
//    tab,compact/comfort/loose 用于密度三档),尺寸/描边照 Vue2 <photos-icon> 调用点
//    (tab 12px、density 14px,stroke-width 默认 1.6,fill none,颜色随 currentColor 走
//    .tab/.density button 各自的文字色,与 Vue2 `color` prop 默认值 'currentColor' 一致)。
//    副作用:堵住了旧文本方案 `label.slice(0, 1)` 在英文语言下 "Compact"/"Comfortable"
//    首字母皆为 "C" 无法区分的问题(中文"紧凑"/"舒适"首字不撞,该缺陷此前只在英文界面可见)。
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  tab?: string
  density?: string
  count?: number
}>(), {
  tab: 'all',
  density: 'comfortable',
  count: 0,
})

const emit = defineEmits<{
  (e: 'update:tab', v: string): void
  (e: 'update:density', v: string): void
}>()

const { t } = useI18n()

function setTab(v: string) { emit('update:tab', v) }
function setDensity(v: string) { emit('update:density', v) }
</script>

<template>
  <div class="toolbar">
    <div class="tabs">
      <button class="tab" :data-active="props.tab === 'all'" @click="setTab('all')">{{ t('photosTabAll') }}</button>
      <button class="tab" :data-active="props.tab === 'photo'" @click="setTab('photo')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
        {{ t('photosTabPhotos') }}
      </button>
      <button class="tab" :data-active="props.tab === 'ocr'" @click="setTab('ocr')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
        {{ t('photosTabOcr') }}
      </button>
      <button class="tab" :data-active="props.tab === 'video'" @click="setTab('video')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>
        {{ t('photosTabVideos') }}
      </button>
    </div>
    <!-- P7b-T3:EXIF 筛选条(漏斗 + 内联展开的胶囊)挂在标签页之后 —— 位置照 Vue2
         NimoOS-UI src/views/Photos/PhotosToolbar.vue:15-16。P1 task-7-brief 当年
         明确砍掉过这个槽位,本期按 P7b 补回。 -->
    <slot name="after-tabs" />
    <div style="flex:1"></div>
    <span class="muted-text">{{ t('photosItemsCount', { count: props.count }) }}</span>
    <div class="density">
      <button
        :data-active="props.density === 'compact'" @click="setDensity('compact')"
        :title="t('photosDensityCompact')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" />
          <rect x="3" y="19" width="6" height="2" /><rect x="11" y="19" width="6" height="2" />
        </svg>
      </button>
      <button
        :data-active="props.density === 'comfortable'" @click="setDensity('comfortable')"
        :title="t('photosDensityComfortable')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
      </button>
      <button
        :data-active="props.density === 'loose'" @click="setDensity('loose')"
        :title="t('photosDensityLoose')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      </button>
    </div>
  </div>
</template>
