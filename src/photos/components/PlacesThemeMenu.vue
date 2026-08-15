<script setup lang="ts">
// Task 10(SP7-P6a 地点·地图主视图):PlacesThemeMenu.vue —— 地图工具栏「地图主题」胶囊
// 按钮 + 下拉弹层(4 预设 + 自定义两取色器)。逐段照 Vue2 NimoOS-UI src/views/Photos/
// PhotosPlacesView.vue:907-947(模板)移植;色值/resolveMapTheme 语义已在同任务落到
// src/photos/util/placesMapThemes.ts,本组件只消费 MAP_THEME_PRESETS + swatchColors,
// 不重复定义色值、也不需要 resolveMapTheme/mapThemeStyleVars(那两个是 PlacesMap.vue 用
// 来渲染地图本体的,本组件只画预览色块)。样式段照 photos-places.scss:964-1025。
//
// 写口径(同 T9/T5/T8 既定):props.selection 不许就地改——一律 emit update:selection
// 传整体替换后的新对象。选预设:emit 新 selection(仅 mapTheme 变)+ emit update:open(false)
// 关闭弹层。取色器 @input:emit 新 selection(mapTheme 强制置 'custom' + 对应颜色字段更新,
// 另一个颜色字段原样保留),不关闭弹层——照 Vue2 :940/:944 的 `@input="mapTheme = 'custom'"`,
// 取色器本身没有伴随关闭动作。是否真的调用 store.setMapTheme/setCustomColors 落盘,
// 由 T11 容器接住这两个 emit 后决定(brief 消歧义 1:读可直连 store、写走 emit)。
//
// isLight 的来源(D5 相对 Vue2 的信号替换):不读相册私有 store,改由调用方(T11 容器)
// 从全局 src/stores/theme.ts 的响应式 theme ref 算出 `theme === 'light'` 传进来
// (该 store 已是响应式,不必新造 MutationObserver——本组件不直接依赖任何 store,
// 保持纯 props/emit 的展示组件)。
//
// 浮层规范(同 T9 PlacesFilterMenu.vue 的既定模式):open 为 prop,document 级
// mousedown(容器外点击关闭)+ keydown(Esc 关闭),watch(open) 挂/摘监听,不用
// stopImmediatePropagation。onDocKeydown 内唯一的早退是「非 Escape 键跳过」——本组件
// 自己只管一个 open 状态,没有第二个分支可早退,不是 P5-T10 那种两弹层共享判定函数漏检
// 第二个分支的早退 bug;那个场景要等 T11 把本组件与 PlacesFilterMenu 一起装进容器才会
// 出现,集成断言归 T11。
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAP_THEME_PRESETS, swatchColors } from '../util/placesMapThemes'

export interface MapThemeSelection {
  mapTheme: string // 'default' | 'ocean' | 'sand' | 'mono' | 'custom'
  customDotColor: string
  customGridColor: string
}

const props = defineProps<{
  selection: MapThemeSelection
  isLight: boolean
  open: boolean
}>()
const emit = defineEmits<{
  (e: 'update:selection', next: MapThemeSelection): void
  (e: 'update:open', open: boolean): void
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)

function toggleOpen(): void {
  emit('update:open', !props.open)
}

// Vue2 :919 `@click="mapTheme = t.id; themeOpen = false"`。
function pickPreset(id: string): void {
  emit('update:selection', { ...props.selection, mapTheme: id })
  emit('update:open', false)
}

// Vue2 :940 `@input="mapTheme = 'custom'"`(v-model 已负责把 customDotColor 写成新值,
// 这里两件事一起 emit 成一个整体替换对象)。
function onDotInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:selection', { ...props.selection, mapTheme: 'custom', customDotColor: value })
}
// Vue2 :944,同上,换成 customGridColor。
function onGridInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:selection', { ...props.selection, mapTheme: 'custom', customGridColor: value })
}

// ── 浮层规范:open 为真时挂 document 级 mousedown/keydown,watch(open) 挂/摘 ─────────
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) emit('update:open', false)
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  emit('update:open', false)
}
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('mousedown', onDocMousedown)
      document.addEventListener('keydown', onDocKeydown)
    }
    else {
      document.removeEventListener('mousedown', onDocMousedown)
      document.removeEventListener('keydown', onDocKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div ref="rootRef" class="mtm-anchor" data-test="mtm-root">
    <button type="button" class="map-chip" data-test="mtm-chip" @click.stop="toggleOpen">
      <svg class="mtm-chip-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-.8c.6.5 1.3.9 2 1.2L10 21h4l.5-2.5c.7-.3 1.4-.7 2-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
      </svg>
      {{ t('photosPlacesMapTheme') }}
      <svg class="mtm-chip-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <div v-if="open" class="map-theme-pop" data-test="mtm-pop">
      <h6>{{ t('photosPlacesMapThemePresets') }}</h6>
      <div class="mtp-list">
        <button
          v-for="preset in MAP_THEME_PRESETS" :key="preset.id" type="button"
          :class="['mtp-item', { 'is-active': selection.mapTheme === preset.id }]"
          data-test="mtm-preset" :data-theme-id="preset.id"
          @click="pickPreset(preset.id)"
        >
          <span class="mtp-swatch" data-test="mtm-swatch" :style="{ backgroundColor: swatchColors(preset, isLight).bg }">
            <span class="mtp-dot" :style="{ background: swatchColors(preset, isLight).dot }" />
          </span>
          <span class="mtp-body">
            <span class="mtp-name">{{ t(preset.nameKey) }}</span>
            <span class="mtp-desc">{{ t(preset.descKey) }}</span>
          </span>
          <svg
            v-if="selection.mapTheme === preset.id" class="mtp-check" data-test="mtm-check"
            viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--accent-text)"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          ><path d="m5 12 5 5L20 7" /></svg>
        </button>
      </div>

      <h6 class="mtp-title-custom">{{ t('photosPlacesMapThemeCustom') }}</h6>
      <label class="mtp-color-row">
        <span>{{ t('photosPlacesLandDotColor') }}</span>
        <input type="color" data-test="mtm-dot-input" :value="selection.customDotColor" @input="onDotInput">
      </label>
      <label class="mtp-color-row">
        <span>{{ t('photosPlacesCityLightColor') }}</span>
        <input type="color" data-test="mtm-grid-input" :value="selection.customGridColor" @input="onGridInput">
      </label>
    </div>
  </div>
</template>

<style scoped>
/* Shadowing cleanup (Plan E Task 3, 2026-08-15): parity `photos-places.scss:964-1025`
   (`.map-theme-pop` family) now governs almost every rule this component used to duplicate,
   for the same reason as PlacesFilterMenu.vue's identical cleanup this same task (see that
   file's header comment for the full argument — same shadowing pattern, same D3 chrome
   ruling, same hover-lock convention, not repeated verbatim here). Three things survive: */

/* Non-color structural necessity, no parity counterpart (same category as
   PlacesFilterMenu.vue's `.pfm-anchor`/`.pfm-chip-icon`). */
.mtm-anchor { position: relative; }
.mtm-chip-icon { vertical-align: -1px; }

/* D3 surface-treatment ruling (same as PlacesFilterMenu.vue's `.map-filter-pop` — see that
   file's full citation, reused here rather than restated): popover chrome (background/
   border/shadow) is New-UI's to reshape, using the established --popup-bg + --card-shadow-hi
   pair instead of Vue2's flat --surface-2 + single box-shadow. */
.map-theme-pop {
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi);
}

/* New-UI-only hover affordance (verified absent from Vue2/parity: parity's own `.mtp-item`
   carries no `:hover` rule at all, only `.is-active`) + its cssCascade hover-lock variant,
   value copied from parity's own `.mtp-item.is-active` so hovering the active preset never
   flips its color. PlacesThemeMenu.test.ts's `winningHoverBackground` assertion pins this
   pair to this file's own `<style>` text (same convention as PlacesFilterMenu.test.ts), so
   it stays local rather than moving to parity. */
.map-theme-pop .mtp-item:hover { background: var(--chip-bg); }
.map-theme-pop .mtp-item.is-active:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}

/* New-UI markup uses `<span class="mtp-body"><span class="mtp-name">…</span><span
   class="mtp-desc">…</span></span>` (inline elements); Vue2's own template
   (PhotosPlacesView.vue:1006-1011) uses `<div class="mtp-body"><div class="mtp-name">…
   </div><div class="mtp-desc">…</div></div>` — block elements that stack vertically for
   free. Parity's `.mtp-body { flex: 1; }` (photos-places.scss:1010) is a faithful port of
   Vue2's own rule (verified: Vue2 has no `display`/`flex-direction` on this selector
   either), so it does *not* stack New-UI's `<span>`s — this is a genuine, New-UI-only
   layout necessity caused by the tag-type difference, not a value to delete in favor of
   parity. */
.map-theme-pop .mtp-body { display: flex; flex-direction: column; }
</style>
