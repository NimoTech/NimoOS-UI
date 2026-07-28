<script setup lang="ts">
// Task 10 (SP7-P5 人物): PersonHero.vue —— 人物详情页 hero 区(封面 + 头像 + 姓名/收藏 +
// Edit 菜单 + 关系分组下拉 + 四项统计 + 两个操作钮)。逐段照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue:3-91(模板)、:492-529(cover/heroBg/
// heroIsFallback/firstYear/firstMonthShort)、:586-590(relationLabel)、:782-840
// (两个菜单的开关与定位)移植;样式段照 photos-people.scss:277-460。
//
// 纯展示 + emit,不碰 store、不发请求 —— 所有副作用在 T14 容器里(brief 明确分工)。
// Ask Nimo 按钮(Vue2 :85-87)不渲染(spec D1 已推迟 SP8)。
//
// 实现方式偏离登记(已批准,brief 明确要求):Vue2 用 getBoundingClientRect 手算
// fixed 坐标 + document mousedown + closest('.relation-menu') 判定两个菜单的开关/定位
// (:598-617,782-831)。这里改成组件内 position:absolute 相对触发按钮锚定(同本仓已确立的
// PhotosPeople.vue :352-358,412-424 的 people-pop-wrap/people-menu 先例),关闭仍走
// document 级 mousedown + keydown(Esc),onMounted 挂 / onUnmounted 摘,成对。视觉位置
// 保持一致(菜单出现在触发按钮正下方)。
//
// 偏离登记 9(brief 明确要求改对,不照抄 Vue2 的 bug):Vue2 :528 把月份短名写死
// toLocaleDateString('en', {month:'short'}) —— 这里改用 useI18n().locale 派生的 BCP-47
// tag(照 PhotosPeople.vue:157 formatIndexedDate 的既有先例:locale.value.replace('_','-')),
// 跟随当前语言渲染月份缩写。同时**不**照抄 Vue2 手动拼接的尾随 "."(:528 的
// `+ '.'`)——那个句点只在英文缩写("Jan.")下是惯用排版,中文短月份格式(如"3月")
// 本身没有这个标点习惯,强行拼接会变成"3月."这种不通顺的结果;改为完全信任
// Intl.DateTimeFormat 按当前 locale 给出的本地化短月份,不再手动拼接标点(同 T6
// formatIndexedDate 的既有做法:交给 Intl,不自己拼字符串)。
//
// 配色红线(本任务最高危,brief 原文强调"本阶段已因为这个坑返工两次"):hero 上叠在
// 暗化后的封面照片之上的一切前景(返回按钮/头像环外的姓名/统计数字与标签/收藏按钮/
// Edit·关系分组触发按钮/两个操作钮的文字与图标)全部**钉死浅色**(theme-exception),
// 不使用任何随主题变化的 --fg/--fg-muted/--fg-subtle(浅色主题下这些是深色,叠在暗化
// 照片上会出现深底深字),更不用 --on-accent(它只在 var(--accent) 饱和实底上可用,
// 这里背景是不可控的人脸照片,不满足前提)。两个下拉菜单本体(Edit 菜单/关系菜单)是
// 例外——它们各自有 var(--popup-bg) 不透明底,不再叠在照片上,菜单内文字/高亮走正常
// 随主题 token(--fg/--fg-muted/--accent-soft/--accent-text/--remove-fg),不钉死。
//
// 暗化遮罩偏离登记(与 brief 建议公式不同,已在任务报告详细登记理由):brief 建议
// New-UI 缺 --hero-scrim 时改用 linear-gradient(180deg, transparent, var(--bg) 95%)。
// 但本仓浅色主题 --bg 接近纯白(#f7f5ef)——把遮罩混向 var(--bg) 会在 hero 中段(头像/
// 姓名/统计恰好所在的垂直居中区域)洗成浅灰甚至近白,钉死的浅色文字在那一段恰恰读不清,
// 与本任务最高优先级的"红线"目标直接矛盾。改用与主题无关的固定黑色渐变(同本仓已有的
// PhotosAlbumDetail.vue .album-hero-bg::after 先例:那个类似的"照片 hero + 钉死浅色前景"
// 场景就是用固定黑色渐变,不跟随 var(--bg)),两套主题下都能保证钉死的浅色文字有稳定对比度。
//
// 铁律:按 id 比较一律 String(a) === String(b)。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import PersonAvatar from './PersonAvatar.vue'
import type { Person } from '../util/peopleView'

const props = defineProps<{
  person: Person
  relationCount: number
  placesCount: number
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'toggle-fav'): void
  (e: 'rename'): void
  (e: 'merge'): void
  (e: 'delete'): void
  (e: 'pick-relation', relation: string): void
  (e: 'make-album'): void
  (e: 'open-hero-picker'): void
}>()

const { t, locale } = useI18n()

// ── 背景层(Vue2 :497-506)──────────────────────────────────────────────
// heroAssetId 优先;否则用人脸缩略图当背景;两者都无 → 渐变兜底(isFallback)。
const heroBg = computed(() => {
  if (props.person.heroAssetId) return service.photos.thumbnailUrl(props.person.heroAssetId, 'large')
  return service.photos.personFaceThumbnailUrl(props.person.id, props.person.coverFaceId)
})
const isFallback = computed(() => !props.person.coverFaceId && !props.person.heroAssetId)

// ── 最早出现(Vue2 :522-529,偏离登记 9 见文件头注释)────────────────────
function parsedFirstSeen(): Date | null {
  if (!props.person.firstSeen) return null
  const d = new Date(props.person.firstSeen)
  return Number.isNaN(d.getTime()) ? null : d
}
const firstYear = computed(() => {
  const d = parsedFirstSeen()
  return d ? String(d.getFullYear()) : ''
})
const firstMonthShort = computed(() => {
  const d = parsedFirstSeen()
  if (!d) return ''
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { month: 'short' }).format(d)
})

// ── 关系分组(Vue2 :586-590)────────────────────────────────────────────
const relationOptions = [
  { value: '', labelKey: 'photosPersonRelationNone' },
  { value: 'family', labelKey: 'photosPersonRelationFamily' },
  { value: 'friend', labelKey: 'photosPersonRelationFriend' },
  { value: 'work', labelKey: 'photosPersonRelationWork' },
] as const

const relationLabelKey = computed(() => {
  const cur = props.person.relation || ''
  const opt = relationOptions.find((o) => o.value === cur)
  return opt ? opt.labelKey : 'photosPersonRelationNone'
})

// ── 两个菜单(Vue2 :782-840,实现方式偏离见文件头注释)───────────────────
const editOpen = ref(false)
const relationOpen = ref(false)
const editWrapRef = ref<HTMLElement | null>(null)
const relationWrapRef = ref<HTMLElement | null>(null)

function pickEdit(action: 'rename' | 'merge' | 'delete'): void {
  editOpen.value = false
  if (action === 'rename') emit('rename')
  else if (action === 'merge') emit('merge')
  else emit('delete')
}

function pickRelation(value: string): void {
  relationOpen.value = false
  emit('pick-relation', value)
}

function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (editOpen.value && editWrapRef.value && !editWrapRef.value.contains(target)) editOpen.value = false
  if (relationOpen.value && relationWrapRef.value && !relationWrapRef.value.contains(target)) relationOpen.value = false
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  // 两个菜单独立判断、都关——不能像早期实现那样第一个 if 命中就 return,那样如果两个菜单
  // 同时开着,Esc 只会关掉先判断的那一个(本组件自己的测试删码验证抓到过这个真实回归)。
  editOpen.value = false
  relationOpen.value = false
}
onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div class="person-hero" data-test="hero-root" :data-fallback="isFallback ? 'true' : 'false'">
    <div
      class="hero-bg"
      data-test="hero-bg"
      :class="{ 'is-fallback': isFallback }"
      :style="isFallback ? {} : { backgroundImage: `url(${heroBg})` }"
    />
    <div v-if="!isFallback" class="hero-scrim" data-test="hero-scrim" />

    <button type="button" class="hero-back" data-test="hero-back" :aria-label="t('photosPersonBack')" @click="emit('back')">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      {{ t('photosPersonBack') }}
    </button>

    <div class="hero-inner">
      <div class="hero-avatar" data-test="hero-avatar">
        <PersonAvatar :person-id="person.id" :name="person.name" :ver="person.coverFaceId" :size="200" />
      </div>

      <div class="hero-info">
        <div class="hero-name-row">
          <span class="hero-name" data-test="hero-name">{{ person.name }}</span>

          <button
            type="button"
            class="hero-fav"
            data-test="hero-fav"
            :class="{ 'is-fav': person.favorite }"
            :aria-label="t(person.favorite ? 'photosUnfavorite' : 'photosFavorite')"
            :title="t(person.favorite ? 'photosUnfavorite' : 'photosFavorite')"
            @click="emit('toggle-fav')"
          >
            <svg v-if="person.favorite" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
          </button>

          <div ref="editWrapRef" class="hero-menu-wrap" data-test="hero-edit-wrap">
            <button type="button" class="hero-trigger" data-test="hero-edit-trigger" @click.stop="editOpen = !editOpen">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
              {{ t('photosPersonEdit') }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div v-if="editOpen" class="hero-menu" data-test="hero-edit-menu">
              <button type="button" class="hero-menu-item" data-test="hero-edit-rename" @click="pickEdit('rename')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                {{ t('photosPersonRename') }}
              </button>
              <button type="button" class="hero-menu-item" data-test="hero-edit-merge" @click="pickEdit('merge')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" /></svg>
                {{ t('photosPersonMergeInto') }}
              </button>
              <button type="button" class="hero-menu-item hero-menu-danger" data-test="hero-edit-delete" @click="pickEdit('delete')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                {{ t('photosPersonDelete') }}
              </button>
            </div>
          </div>

          <div ref="relationWrapRef" class="hero-menu-wrap" data-test="hero-relation-wrap">
            <button type="button" class="hero-trigger" data-test="hero-relation-trigger" @click.stop="relationOpen = !relationOpen">
              {{ t(relationLabelKey) }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div v-if="relationOpen" class="hero-menu" data-test="hero-relation-menu">
              <button
                v-for="opt in relationOptions"
                :key="opt.value"
                type="button"
                class="hero-menu-item"
                data-test="hero-relation-option"
                :data-value="opt.value"
                :data-active="(person.relation || '') === opt.value"
                @click="pickRelation(opt.value)"
              >
                {{ t(opt.labelKey) }}
                <svg v-if="(person.relation || '') === opt.value" data-test="hero-relation-check" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="hero-stats" data-test="hero-stats">
          <div class="hero-stat" data-test="hero-stat-photos">
            <div class="v">{{ person.count ? person.count.toLocaleString() : 0 }}</div>
            <div class="k">{{ t('photosPersonStatPhotos') }}</div>
          </div>
          <div class="hero-stat" data-test="hero-stat-places">
            <div class="v">{{ placesCount }}</div>
            <div class="k">{{ t('photosPersonStatPlaces') }}</div>
          </div>
          <div class="hero-stat" data-test="hero-stat-appears">
            <div class="v">{{ relationCount }}</div>
            <div class="k">{{ t('photosPersonStatAppearsWith') }}</div>
          </div>
          <div class="hero-stat" data-test="hero-stat-first-seen">
            <div class="v">{{ firstYear }}<span class="hero-stat-month">{{ firstMonthShort }}</span></div>
            <div class="k">{{ t('photosPersonStatFirstSeen') }}</div>
          </div>
        </div>
      </div>

      <div class="hero-actions">
        <button type="button" class="hero-action-btn" data-test="hero-make-album" @click="emit('make-album')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          {{ t('photosPersonMakeAlbum') }}
        </button>
        <button type="button" class="hero-action-btn" data-test="hero-background" @click="emit('open-hero-picker')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          {{ t('photosPersonBackground') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.person-hero {
  position: relative;
  min-height: 280px;
  overflow: hidden;
  flex: none;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(40px) saturate(1.4);
  transform: scale(1.2);
  opacity: 0.45;
}
/* 无封面/无人脸缩略图时的纯渐变兜底——不叠 blur/scale/opacity(那三条是为"模糊照片"设计的,
   套在纯色渐变上只会把它洗成一片 45% 透明度的浅雾,而不是 PersonAvatar 三级兜底同款的
   饱和渐变色块;Vue2 :1420-1422 的 [data-fallback] 覆盖规则没有解除父规则的 filter/opacity,
   这里判定为无意的视觉稀释,不照抄——按同一渐变 token 但用满血不透明色块渲染)。 */
.hero-bg.is-fallback {
  filter: none;
  transform: none;
  opacity: 1;
  background: var(--avatar-fallback);
}
.hero-scrim {
  position: absolute;
  inset: 0;
  /* theme-exception: 叠在人物封面照片之上的固定暗化渐变,专为下方钉死的浅色前景文字/
     图标提供跨主题恒定的可读对比度——理由与不采用 brief 建议的 var(--bg) 混合公式的
     完整说明见本文件顶部注释,这里不重复。 */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.5) 45%, rgba(0, 0, 0, 0.68) 100%);
}

.hero-back {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  padding: 6px 12px 6px 8px;
  border-radius: 999px;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  border: 1px solid var(--card-border);
  cursor: pointer;
  color: #fff; /* theme-exception: hero 顶部 chrome 按钮,恒叠在暗化封面照片之上,需跨主题
    恒定浅色前景(见文件头"配色红线"说明) */
}
/* theme-exception: hover 态往 --overlay-bg 里掺一点白提亮,掺入量是固定观感调校值,
   与主题无关（同 .hero-back 本身钉死浅色前景的道理一致，见上方声明） */
.hero-back:hover { background: color-mix(in srgb, var(--overlay-bg) 80%, #fff 8%); }

.hero-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 24px 32px;
  min-height: 280px;
}

.hero-avatar {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: hidden;
  flex: none;
  border: 3px solid var(--panel-bg);
  box-shadow: var(--icon-shadow), 0 0 0 1px var(--card-border);
  position: relative;
}

.hero-info { flex: 1; min-width: 0; }
.hero-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.hero-name {
  font-family: var(--font);
  font-size: 38px;
  font-weight: 600;
  letter-spacing: -0.025em;
  color: #fff; /* theme-exception: 姓名直接叠在暗化封面照片上,需跨主题恒定浅色(见文件头
    "配色红线"说明,不用 --fg——浅色主题下 --fg 是近黑色,叠在暗照片上会深底深字) */
}

.hero-fav {
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--overlay-bg);
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  /* 未收藏态:半透明浅色描边星,同样钉死不随主题(见文件头"配色红线"说明)。
     收藏态见下方 .hero-fav.is-fav 规则,复用本仓已确立的 --star-fg 兜底惯例。 */
  color: rgba(255, 255, 255, 0.72); /* theme-exception */
}
.hero-fav.is-fav {
  /* --star-fg 两套主题都不各自定义具体值,是本仓已确立的先例(PhotosGrid.vue/
     PersonAvatar.vue 均为 var(--star-fg, #ffd60a))——固定金色星标跨皮肤不变,
     用 var(fallback) 形式表达,color-guard 按 token 用法放行,不算裸字面量。 */
  color: var(--star-fg, #ffd60a);
}
/* theme-exception: 同 .hero-back:hover——固定掺白提亮量,与主题无关 */
.hero-fav:hover { background: color-mix(in srgb, var(--overlay-bg) 80%, #fff 8%); }

.hero-menu-wrap { position: relative; display: inline-flex; align-items: center; }
.hero-trigger {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  cursor: pointer;
  font-family: var(--font);
  color: #fff; /* theme-exception: 同 .hero-back——叠在暗化封面照片上的 chrome 按钮 */
}
/* theme-exception: 同 .hero-back:hover——固定掺白提亮量,与主题无关 */
.hero-trigger:hover { background: color-mix(in srgb, var(--overlay-bg) 80%, #fff 8%); }

/* 下拉菜单本体有自己的不透明底(--popup-bg),不再叠在照片上——菜单内文字/高亮走正常
   随主题 token,不钉死(与上方 hero 直接前景的处理刻意不同,理由见文件头"配色红线"说明)。 */
.hero-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 170px;
  z-index: 20;
  padding: 6px;
  border-radius: 10px;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hero-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  font-size: 12.5px;
  color: var(--fg);
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.hero-menu-item:hover { background: var(--hover); }
.hero-menu-item[data-active="true"] {
  /* Vue2 :60 用 var(--accent-hi)——本仓两套主题块均未定义这个 token(已 grep 确认,同
     MergeReviewDialog.vue:249 的既有先例),借用同色调、两套主题都有定义的 --accent-text。 */
  background: var(--accent-soft);
  color: var(--accent-text);
}
.hero-menu-danger { color: var(--remove-fg); }
.hero-menu-danger:hover { background: color-mix(in srgb, var(--remove-fg) 12%, transparent); }

.hero-stats { display: flex; gap: 28px; margin-top: 14px; }
.hero-stat .v {
  font-family: var(--font);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  color: #fff; /* theme-exception: 统计数字叠在暗化封面照片上,见文件头"配色红线"说明 */
}
.hero-stat .k {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.72); /* theme-exception: 统计标签同上,钉死半透明浅色 */
}
.hero-stat-month {
  font-size: 12px;
  margin-left: 4px;
  font-family: var(--font);
  color: rgba(255, 255, 255, 0.72); /* theme-exception: 同 .hero-stat .k */
}

.hero-actions {
  flex: none;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hero-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  border: 1px solid var(--card-border);
  padding: 9px 14px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--font);
  color: #fff; /* theme-exception: 操作钮叠在暗化封面照片上,见文件头"配色红线"说明 */
}
/* theme-exception: 同 .hero-back:hover——固定掺白提亮量,与主题无关 */
.hero-action-btn:hover { background: color-mix(in srgb, var(--overlay-bg) 80%, #fff 8%); }
</style>
