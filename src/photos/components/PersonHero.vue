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
// ★ 终审 Important 5 补登记 —— **Vue2 用 fixed 的理由**:它不是随手选的,而是为了绕开
// `.detail-hero { overflow: hidden }`(photos-people.scss:277-281)。fixed 的包含块是视口,
// 不受任何祖先 overflow 裁剪;absolute 的包含块是最近的定位祖先,祖先一裁就没了。
// 改成 absolute 后 z-index 完全失效(裁剪发生在合成之前),而 hero 又没有滚动条可以救,
// 菜单会被**直接切掉**:默认布局菜单底边 ≈279.5px 只差 0.5px 不裁;一旦长人名触发
// `.hero-name-row { flex-wrap: wrap }` 换行,触发按钮下移约 46px、菜单底边到 ≈296px,
// 最后一项「工作/Work」被切掉约一半(放大字号 / 窄视口同理)。
// 修法(评审给了两个选项,这里选前者,理由见样式块里 .hero-clip 的注释):把
// `overflow: hidden` 从 .person-hero 移到专门的 .hero-clip 裁剪层,菜单不再受祖先裁剪,
// 保留 absolute 锚定这条已批准的偏离。
//
// 偏离登记 10(此前未申报,终审顺带补齐):`.hero-name-row` 的 `flex-wrap: wrap` 是本仓新增 ——
// Vue2 `.detail-hero .name`(photos-people.scss:325-331)是 `display:flex; align-items:center;
// gap:12px`,**没有** flex-wrap,长人名会把 Edit/关系分组两个胶囊挤扁并溢出。保留 wrap
// (属于"Vue2 的 bug 不照抄"那一类),但它改变了 hero 的实际高度,因此必须与上面那条一起看:
// 正是 wrap 让菜单越界成为常态路径,而不是边角情况。
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
  // Task 7 (Plan D): gates the "Hide person" edit-menu item, mirroring Vue2's
  // `v-if="hiddenPeopleSupported"` on the same menu item (PhotosPersonDetail.vue:43-46).
  // Owned by the people store (usePhotosPeople().hiddenPeopleSupported) — this component
  // stays a pure prop/emit consumer like every other piece of `person`-derived state here.
  hiddenPeopleSupported: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'toggle-fav'): void
  (e: 'rename'): void
  (e: 'merge'): void
  (e: 'hide'): void
  (e: 'delete'): void
  (e: 'pick-relation', relation: string): void
  (e: 'make-album'): void
  (e: 'open-hero-picker'): void
}>()

const { t, locale } = useI18n()

// 用户验收新增:未命名人物现在有了详情页入口(列表页菜单「查看这些照片」),Vue2 里这条路
// 走不到,所以它 :22 直接渲染 person.name、空名就是空白标题。这里补兜底文案。
// trim 判定:后端可能存下只有空白的名字,渲染成几个空格与空白无异,一并走兜底。
const heroTitle = computed(() => props.person.name.trim() || t('photosPersonUnnamedTitle'))

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

function pickEdit(action: 'rename' | 'merge' | 'hide' | 'delete'): void {
  editOpen.value = false
  if (action === 'rename') emit('rename')
  else if (action === 'merge') emit('merge')
  else if (action === 'hide') emit('hide')
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
  <!-- Task 5 (Plan D): root class renamed `person-hero` → `detail-hero` and every descendant
       class below renamed to its parity/Vue2 anchor (see task-5-report.md's rename table) so
       `src/photos/styles/vue2-parity/photos-people.scss` governs directly. data-test attributes,
       props/emits and all logic are unchanged. -->
  <div class="detail-hero" data-test="hero-root" :data-fallback="isFallback ? 'true' : 'false'">
    <!-- 终审 Important 5:裁剪层。模糊背景与暗化遮罩关在这里,`overflow: hidden` 由它自己承担,
         .detail-hero 不再裁 —— 否则两个 hero 下拉菜单(absolute)会被祖先切掉。 -->
    <div class="hero-clip" data-test="hero-clip">
      <div
        class="bg"
        data-test="hero-bg"
        :class="{ 'is-fallback': isFallback }"
        :style="isFallback ? {} : { backgroundImage: `url(${heroBg})` }"
      />
      <div v-if="!isFallback" class="scrim" data-test="hero-scrim" />
    </div>

    <!-- 终审 Minor 7:文案是 t('photosPeople')(「人物」/ "People")—— 照 Vue2 :6 的 $t('People')。
         不用 photosPersonBack(「返回人物」/ "Back to people"):那句是**人物不存在**空态里那个
         返回按钮的文案(PhotosPersonDetail.vue 门控③),两处不是同一句。 -->
    <button type="button" class="back" data-test="hero-back" :aria-label="t('photosPeople')" @click="emit('back')">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      {{ t('photosPeople') }}
    </button>

    <div class="inner">
      <div class="avatar" data-test="hero-avatar">
        <PersonAvatar :person-id="person.id" :name="person.name" :ver="person.coverFaceId" :size="200" />
      </div>

      <div class="info">
        <div class="name">
          <span class="name-text" data-test="hero-name">{{ heroTitle }}</span>

          <!-- 终审 Minor 7:未收藏态的 title/aria 照 Vue2 :26 的 `Mark as favorite`(不是通用的
               `Favorite`);已收藏态复用 photosUnfavorite,其中文与 Vue2 `Remove favorite` 的原译一致。 -->
          <button
            type="button"
            class="fav-toggle"
            data-test="hero-fav"
            :class="{ 'is-fav': person.favorite }"
            :aria-label="t(person.favorite ? 'photosUnfavorite' : 'photosPersonMarkFavorite')"
            :title="t(person.favorite ? 'photosUnfavorite' : 'photosPersonMarkFavorite')"
            @click="emit('toggle-fav')"
          >
            <svg v-if="person.favorite" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
          </button>

          <div ref="editWrapRef" class="relation-picker" data-test="hero-edit-wrap">
            <button type="button" class="edit-btn" data-test="hero-edit-trigger" @click.stop="editOpen = !editOpen">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
              {{ t('photosPersonEdit') }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div v-if="editOpen" class="relation-menu edit-menu" data-test="hero-edit-menu">
              <button type="button" class="relation-option" data-test="hero-edit-rename" @click="pickEdit('rename')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                <!-- 终审 Minor 6:短动词键(照 Vue2 :38 `$t('Rename')`);photosPersonRename
                     是改名弹窗的标题「重命名人物」,不能顶替菜单项。 -->
                {{ t('photosPersonMenuRename') }}
              </button>
              <button type="button" class="relation-option" data-test="hero-edit-merge" @click="pickEdit('merge')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" /></svg>
                <!-- 终审 Minor 6:同上,照 Vue2 :41 `$t('Merge into…')`;photosPersonMergeInto
                     是合并弹窗的标题「合并到另一个人物」。 -->
                {{ t('photosPersonMenuMergeInto') }}
              </button>
              <!-- Task 7 (Plan D): "Hide person"——照 Vue2 PhotosPersonDetail.vue:43-46,只在
                   hiddenPeopleSupported 时出现,带 title 说明文案;点击即时执行,容器负责
                   实际隐藏 + toast + 导航(本组件不碰 store,分工同文件头部注释)。 -->
              <button
                v-if="hiddenPeopleSupported"
                type="button"
                class="relation-option"
                data-test="hero-edit-hide"
                :title="t('photosPersonHideGateTitle')"
                @click="pickEdit('hide')"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9" /><path d="M10 13h4" /></svg>
                {{ t('photosPersonMenuHide') }}
              </button>
              <button type="button" class="relation-option edit-menu-danger" data-test="hero-edit-delete" @click="pickEdit('delete')">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                {{ t('photosPersonDelete') }}
              </button>
            </div>
          </div>

          <div ref="relationWrapRef" class="relation-picker" data-test="hero-relation-wrap">
            <button type="button" class="relation-trigger" data-test="hero-relation-trigger" @click.stop="relationOpen = !relationOpen">
              {{ t(relationLabelKey) }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div v-if="relationOpen" class="relation-menu" data-test="hero-relation-menu">
              <button
                v-for="opt in relationOptions"
                :key="opt.value"
                type="button"
                class="relation-option"
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

        <div class="stats-row" data-test="hero-stats">
          <div class="stat" data-test="hero-stat-photos">
            <div class="v">{{ person.count ? person.count.toLocaleString() : 0 }}</div>
            <div class="k">{{ t('photosPersonStatPhotos') }}</div>
          </div>
          <div class="stat" data-test="hero-stat-places">
            <div class="v">{{ placesCount }}</div>
            <div class="k">{{ t('photosPersonStatPlaces') }}</div>
          </div>
          <div class="stat" data-test="hero-stat-appears">
            <div class="v">{{ relationCount }}</div>
            <div class="k">{{ t('photosPersonStatAppearsWith') }}</div>
          </div>
          <div class="stat" data-test="hero-stat-first-seen">
            <div class="v">{{ firstYear }}<span class="stat-month">{{ firstMonthShort }}</span></div>
            <div class="k">{{ t('photosPersonStatFirstSeen') }}</div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn" data-test="hero-make-album" @click="emit('make-album')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          {{ t('photosPersonMakeAlbum') }}
        </button>
        <button type="button" class="btn" data-test="hero-background" @click="emit('open-hero-picker')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          {{ t('photosPersonBackground') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Task 5 (Plan D) shadowing cleanup — see task-5-report.md for the full per-rule table. The
   short version: every rule below that duplicated a parity anchor under the same selector
   path has been deleted (parity — `src/photos/styles/vue2-parity/photos-people.scss` —
   governs directly, using its own token set). What survives is exactly two kinds of rule:
   (1) structural New-UI-only additions with no Vue2/parity counterpart at all (`.hero-clip`,
   `.scrim`, the `.bg::after` neutralizer, `.stat-month`, the approved `overflow`/`flex-wrap`
   deviations); (2) the hero's "pinned light foreground" theme-exception family — every
   caption/label/icon that sits directly over the (possibly light-themed) blurred cover photo
   keeps an explicit `color` override here, because parity itself uses *themed* tokens
   (`--text-1`/`--text-2`) for these captions and relies on a light-theme text-shadow halo
   instead of a fixed light color — a real design difference from this app's already-reviewed
   "配色红线" decision (see file-header comment), not something this cleanup should undo.
   These color survivors are written as full parity-matching selector paths (not bare class
   names) specifically so the scoped-attribute specificity bump reliably beats parity's own
   rules for the same element regardless of stylesheet load order — a bare `.back { color }`
   would tie parity's `.detail-hero .back` in specificity, which is exactly the kind of
   coin-flip this technique avoids. */
.detail-hero {
  position: relative;
  /* 终审 Important 5:**这里刻意没有 overflow: hidden**(parity 的 .detail-hero 有)。两个
     下拉菜单是 absolute 锚定的(见文件头的实现方式偏离登记),祖先一裁就整块消失、z-index
     无用、也没有滚动条可救 —— 长人名触发 .name 换行后菜单最后一项会被切掉约一半。裁剪
     职责下移到 .hero-clip。加新的绝对定位子元素时留意:它现在**不会**被 hero 边界裁住。
     min-height/border-bottom/background all now come from parity's own `.detail-hero` rule
     (duplicates deleted); flex:none is Vue2's own component-scoped supplement
     (PhotosPersonDetail.vue:1104), not transcribed into the shared parity file yet. */
  overflow: visible;
  flex: none;
}
/* 只裁"该裁的东西":模糊封面图 + 暗化遮罩。
   为什么必须是**独立的祖先容器**,而不是让 .bg 自己 overflow:hidden(评审建议的字面
   写法):`filter: blur(40px)` 的输出按规范画在元素盒子**之外**(此处最多外溢约 120px),
   `transform: scale(1.2)` 又把它整体放大 20% —— 元素自身的 overflow 管不了自己的滤镜输出,
   只有**祖先**的 overflow 才能裁。若不裁,模糊边缘会溢到下方 tabs/网格与页面两侧。
   另一个候选修法是把菜单改回 Vue2 的 position:fixed + getBoundingClientRect 手算坐标;
   没选它,因为那要重新引入坐标计算,且 Vue2 那套在页面滚动/窗口缩放时菜单会脱锚(它没挂
   scroll/resize 重算),等于用一个已知缺陷换另一个。 */
.hero-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
/* `.bg`'s own base rule (position/inset/background-size/position/filter/transform/opacity)
   duplicated parity's `.detail-hero .bg` byte-for-byte and has been deleted. Only the
   fallback modifier survives: 无封面/无人脸缩略图时的纯渐变兜底——不叠 blur/scale/opacity
   (那三条是为"模糊照片"设计的,套在纯色渐变上只会把它洗成一片 45% 透明度的浅雾,而不是
   PersonAvatar 三级兜底同款的饱和渐变色块;parity 的 [data-fallback] 覆盖规则同样没有解除
   父规则的 filter/opacity,这里判定为 Vue2 无意的视觉稀释,不照抄——按同一渐变 token 但用
   满血不透明色块渲染)。 */
.bg.is-fallback {
  filter: none;
  transform: none;
  opacity: 1;
  background: var(--avatar-fallback);
}
/* Parity paints its own scrim as `.bg::after` (mixed toward var(--bg), washes out in the light
   theme exactly where the pinned light text sits — see file-header comment for the full
   reasoning already reviewed twice). This component uses a separate `.scrim` sibling div with
   a fixed black gradient instead (below) — neutralize parity's pseudo-element so the two don't
   stack. Written as the full parity selector path for the specificity reasons noted above. */
.detail-hero .bg::after { content: none; }
.scrim {
  position: absolute;
  inset: 0;
  /* theme-exception: 叠在人物封面照片之上的固定暗化渐变,专为下方钉死的浅色前景文字/
     图标提供跨主题恒定的可读对比度——理由见本文件顶部注释,这里不重复。 */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.5) 45%, rgba(0, 0, 0, 0.68) 100%);
}

/* theme-exception: hero chrome pinned to a light foreground, base + hover (parity's own
   `.back`/`.back:hover` use var(--text-2)/var(--text-1) — themed, not pinned — everything else
   about this button — position/padding/border-radius/background/backdrop-filter/border/hover
   background — now comes straight from parity, duplicates deleted). */
.detail-hero .back,
.detail-hero .back:hover { color: #fff; }

/* `.inner`'s position/display/align-items/gap/padding duplicated parity's own `.detail-hero
   .inner` rule and have been deleted. `z-index`/`min-height` survive: Vue2 itself has TWO
   sources for `.inner` — the shared photos-people.scss rule parity already transcribes, and a
   second, component-scoped supplement in PhotosPersonDetail.vue's own <style> block
   (:1110-1118) that layers z-index:1 and min-height:280px on top — parity hasn't picked up
   that second source yet, so it stays local here rather than going untranscribed silently. */
.inner { z-index: 1; min-height: 280px; }

/* `.avatar`'s sizing/border/shadow duplicated parity's own `.detail-hero .avatar` rule
   (different token names, same concept — border/shadow tokens, not text/icon color, so there
   is no theme-exception concern here) and has been deleted entirely. */

.name {
  /* 偏离登记 10(已在文件头登记):flex-wrap:wrap 是本仓新增,parity/Vue2 的 `.name` 没有
     这条,长人名会把 Edit/关系分组两个胶囊挤扁并溢出。display/align-items/gap/font/color
     全部来自 parity 的 `.detail-hero .name`,只留这一条本地覆盖。 */
  flex-wrap: wrap;
}
/* theme-exception: 姓名直接叠在暗化封面照片上,需跨主题恒定浅色(不用 --fg——浅色主题下
   --fg 是近黑色,叠在暗照片上会深底深字)。font-family/size/weight/letter-spacing 都从
   parity 的 `.detail-hero .name` 继承,这里只需要 color 这一条。 */
.name-text { color: #fff; }

/* Fix round 1 (Important, coordinator review): the previous bare `.fav-toggle { … }` here
   compiled to `.fav-toggle[data-v-hash]` — specificity (0,2,0). Parity's own
   `.detail-hero .name .fav-toggle` (photos-people.scss:420-430) is (0,3,0) and — being an
   unscoped global rule — wins regardless of stylesheet load order, the exact opposite of every
   other survivor in this file (which all use the full compound-path technique explained at the
   top of this block precisely to avoid this). The bare selector was dead code.

   True cascade situation, verified against Vue2's real template (PhotosPersonDetail.vue:23-29):
   this button carries an inline `style="background:transparent;border:0;padding:4px;
   cursor:pointer;display:inline-flex;align-items:center;color:[gold hex]"` — inline style has
   the highest priority for any property it sets, for every pseudo-class state (a `:hover` rule
   cannot override a property the base element's inline style already claims), so parity's own
   `.fav-toggle`/`.fav-toggle:hover` rule (border/background/transition) is fully unreachable in
   real Vue2 rendering — dead in the *source of truth*, not just an artifact of this app's
   token choices like this file's other survivors. That dead rule is left as-is in parity for
   final-review triage, not touched here.

   This app's plain `<svg>` has no equivalent to Vue2's inline-style mechanism, so the real
   values have to be carried by an actual CSS rule here, written as the same full compound path
   parity uses (plus the scoped-attribute bump) so it actually governs: background:transparent,
   border:0, padding:4px, inline-flex, centered — Vue2's real look, not parity's dead-code pill.
   Icon color stays a theme-exception pin (rgba/--star-fg), not Vue2's real per-state inline
   `color` prop (`#FFD60A` favorited / `var(--text-3)` unfavorited): with the pill background
   now gone, the icon sits directly over the photo, and `var(--text-3)` is exactly the kind of
   themed-dark-in-light-theme value this whole component's "配色红线" section already exists to
   keep out from here — not a fresh decision, the same established policy applied consistently. */
.detail-hero .name .fav-toggle {
  background: transparent;
  border: 0;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  /* 未收藏态:半透明浅色描边星,同样钉死不随主题(见文件头"配色红线"说明)。
     收藏态见下方 .fav-toggle.is-fav 规则,复用本仓已确立的 --star-fg 兜底惯例。 */
  color: rgba(255, 255, 255, 0.72); /* theme-exception */
}
.detail-hero .name .fav-toggle.is-fav {
  /* --star-fg 两套主题都不各自定义具体值,是本仓已确立的先例(PhotosGrid.vue/
     PersonAvatar.vue 均为 var(--star-fg, #ffd60a))——固定金色星标跨皮肤不变,
     用 var(fallback) 形式表达,color-guard 按 token 用法放行,不算裸字面量。 */
  color: var(--star-fg, #ffd60a);
}
/* Fix round 2 (coordinator re-review, Important): the previous version of this rule kept a new
   faint hover tint as a "don't copy a Vue2 UX gap" affordance. Ruling: pixel parity governs
   here — this rule shape exists purely to neutralize a specificity problem, not to introduce
   new visuals Vue2 never has. Vue2's real hover state is pixel-identical to its resting state
   (the inline style's transparent background / zero border applies unconditionally — inline
   styles aren't scoped to pseudo-classes, so there's nothing for a `:hover` rule to add or
   change). Reverted to that: same values as the base rule above, no added tint.

   This selector still has to exist, though — it is not a no-op left over from the old version.
   The math: this file's own base rule above is `.detail-hero .name .fav-toggle` + the scoped
   attribute = 4 class-level selectors, (0,4,0). Parity's OWN hover rule
   (photos-people.scss:427-430) is `.detail-hero .name .fav-toggle:hover` = 4 class-level
   selectors too (the `:hover` pseudo-class counts the same as a class) — also (0,4,0). Tied
   specificity between an unscoped global rule and a scoped local one resolves by *stylesheet
   load order*, which this app does not guarantee — so on hover, parity's own darkened,
   dead-in-Vue2 background/border-color pair could win that coin flip and render a pill Vue2
   never shows. Adding this `:hover`-qualified rule (base selector + `:hover` + the scoped
   attribute = 5 class-level selectors, (0,5,0)) reliably beats parity's hover rule regardless of
   load order, the same guaranteed-win technique used by every other survivor in this file — it
   just now carries the *same* values as rest instead of a new tint, so hovering renders
   pixel-identical to resting, matching Vue2. */
.detail-hero .name .fav-toggle:hover { background: transparent; border: 0; }

/* `.relation-picker`'s position/display/align-items duplicated parity's own rule exactly and
   has been deleted. */

/* theme-exception: hero trigger chrome pinned to a light foreground (parity's own rule uses
   var(--text-2), themed) — base + hover written as parity's own compound selectors so the
   scoped-attribute specificity bump reliably beats parity's `:hover` variant too (parity's
   hover selector is itself a 4-class compound, `.detail-hero .name .edit-btn:hover`, so a bare
   local `.edit-btn:hover` would lose outright, not just tie). Height/padding/border-radius/
   border/background/backdrop-filter/font — all now come straight from parity. */
.detail-hero .name .edit-btn,
.detail-hero .name .relation-trigger,
.detail-hero .name .edit-btn:hover,
.detail-hero .name .relation-trigger:hover { color: #fff; }

/* The popup bodies themselves (`.relation-menu`/`.relation-option`/`.edit-menu-danger`) are
   NOT part of the "pinned light foreground" family — per the file-header "配色红线" note, once
   open they sit on their own opaque `var(--surface-1)` popup background, not on the photo, so
   they follow normal theme tokens same as any other popup. Every property parity supplies for
   them (position/sizing/background/border/hover/active/danger colors) duplicated this
   component's old local rules 1:1 in intent (just different token names) and has been deleted
   entirely — no survivors needed here. */

.stat-month {
  /* New-UI addition: Vue2 renders this span with an inline style, not a class
     (PhotosPersonDetail.vue:83), so there is no parity selector to align to or delete —
     values transcribed from that inline style, color pinned per this hero's own convention. */
  font-size: 12px;
  margin-left: 4px;
  font-family: var(--font);
  color: rgba(255, 255, 255, 0.72); /* theme-exception: 同 .stat .k */
}
/* theme-exception: 统计数字/标签叠在暗化封面照片上,需跨主题恒定浅色——parity 自己的
   `.detail-hero .stat .v`/`.stat .k` 用的是随主题 token(.v 甚至没设 color,靠继承;.k 是
   var(--text-3)),字体/字号/字重等结构属性均从 parity 继承/复用,这里只覆盖 color。 */
.detail-hero .stat .v { color: #fff; } /* theme-exception */
.detail-hero .stat .k { color: rgba(255, 255, 255, 0.72); } /* theme-exception */

/* `.actions`'s layout duplicated parity's own `.detail-hero .actions` rule exactly (parity is
   actually a superset — it also sets align-items:stretch, which this component's old local
   rule was missing) and has been deleted. */

/* theme-exception: action button text/icon pinned to a light foreground (parity's own rule
   uses var(--text-1), themed, and doesn't change it on hover — so this single declaration
   survives hover too without a separate hover rule). Everything else — padding/border-radius/
   background/backdrop-filter/border/hover background — now comes straight from parity. */
.detail-hero .actions .btn { color: #fff; }
</style>
