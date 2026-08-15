<script setup lang="ts">
// Task 10 (SP7-P5 人物): PersonHero.vue —— 人物详情页 hero 区(封面 + 头像 + 姓名/收藏 +
// Edit 菜单 + 关系分组下拉 + 四项统计 + 两个操作钮)。逐段照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue:3-91(模板)、:492-529(cover/heroBg/
// heroIsFallback/firstYear/firstMonthShort)、:586-590(relationLabel)、:782-840
// (两个菜单的开关与定位)移植;样式段照 photos-people.scss:277-460。
//
// 纯展示 + emit,不碰 store、不发请求 —— 所有副作用在 T14 容器里(brief 明确分工)。
// Task 8 (Plan D): the Ask about {name} button (Vue2 :89-92 `.btn-ai`) was previously deferred
// to SP8 and unrendered; now added back in Vue2's own order (first in the actions row). The
// click is a no-op — wiring the real Ask Nimo call belongs to Plan G; this task only adds the
// copy + visuals + an empty placeholder function (see onAskNimo below).
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
// 暗化后的封面照片之上、且**没有自己不透明底色**的前景(头像环外的姓名/统计数字与
// 标签、收藏按钮图标)钉死浅色(theme-exception),不使用任何随主题变化的
// --fg/--fg-muted/--fg-subtle(浅色主题下这些是深色,叠在暗化照片上会出现深底深字),
// 更不用 --on-accent(它只在 var(--accent) 饱和实底上可用,这里背景是不可控的人脸照片,
// 不满足前提)。两个下拉菜单本体(Edit 菜单/关系菜单)是例外——它们各自有
// var(--popup-bg) 不透明底,不再叠在照片上,菜单内文字/高亮走正常随主题 token
// (--fg/--fg-muted/--accent-soft/--accent-text/--remove-fg),不钉死。
//
// Owner acceptance Fix-1 (2026-08-14) 更正:返回按钮 `.back`、Edit/关系分组触发按钮
// `.edit-btn`/`.relation-trigger`、以及两个操作钮 `.actions .btn`(Ask about 除外)
// 曾被错误地划进上面这条"钉死浅色"红线——但它们其实**都带 var(--float-bg) 胶囊底色**
// (parity 供给,backdrop-filter 磨砂玻璃),不是裸叠在照片上的文字。Vue2 真身
// (NimoOS-UI src/views/Photos/photos-people.scss:320/327,350/360,406;
// PhotosPersonDetail.vue:1133,1175/1183,1197)对这几个元素从未钉死颜色,一律用主题
// token `var(--text-2)`/`var(--text-1)` 配同样主题化的 `var(--float-bg)` 胶囊底——两者
// 同步换挡,浅色主题下自然是"深字配浅底",从不需要专门的 `is-light` 分支
// (photos-people.scss 全文只有 4 处 is-light/data-fallback 分支,没有一处碰按钮)。
// 本组件之前把这三处也钉成 `#fff`,配上同样主题化、浅色主题下会变近白的
// `var(--float-bg)` 胶囊底,就是"白字配白底"——2026-08-14 机主验收反馈"亮色主题下按键
// 和字看不清"命中的正是这个组合。修法:退回这三处为主题化 var(--text-2)/var(--text-1),
// 让它跟随同样主题化的胶囊底一起换挡,同 Vue2。`.name-text`/`.stat .v`/`.stat .k`/
// `.fav-toggle` 图标依旧裸叠在照片上(无胶囊底),红线钉死浅色的判断对它们仍然成立,
// 未改动。
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
import nimoLogoUrl from '../assets/nimo-logo.png'
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

// Task 8 (Plan D): Vue2 :89 emits 'ask-nimo' with a canned prompt string; this component's
// own ask-nimo wiring lands in Plan G (per this task's brief). Kept as a real no-op function
// (not an inline no-op in the template) so it reads as a deliberate placeholder, not a
// forgotten handler.
// wired in Plan G (Ask Nimo)
function onAskNimo(): void {}

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
    <!-- Final review Important 5: the clip layer. The blurred background and the darkening scrim
         are contained here, `overflow: hidden` is this element's own responsibility —
         .detail-hero no longer clips, otherwise the two hero dropdown menus (absolute) would be
         cut off by an ancestor. -->
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
              <!-- Task 7 (Plan D): "Hide person" — per Vue2 PhotosPersonDetail.vue:43-46, only
                   shows when hiddenPeopleSupported, with an explanatory title; the click executes
                   immediately, the container owns the actual hide + toast + navigation (this
                   component never touches the store, same division of labor as the file-header
                   comment). -->
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
        <!-- Task 8 (Plan D): Ask about {name} — Vue2 :89-92 `.btn-ai`, first in actions order.
             Click is a no-op (onAskNimo) — wiring in Plan G. -->
        <button type="button" class="btn btn-ai" data-test="hero-ask-nimo" @click="onAskNimo">
          <span class="ask-nimo-icon" :style="{ backgroundImage: `url(${nimoLogoUrl})` }" />
          {{ t('photosPersonAskAbout', { name: heroTitle }) }}
        </button>
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
   deviations); (2) the hero's "pinned light foreground" theme-exception family — captions/
   labels/icons that sit *directly* over the (possibly light-themed) blurred cover photo with
   no opaque backing of their own (`.name-text`, `.stat .v`/`.stat .k`, the `.fav-toggle`
   icon) keep an explicit `color` override here, because parity itself uses *themed* tokens
   (`--text-1`/`--text-2`) for these captions and relies on a light-theme text-shadow halo
   instead of a fixed light color — a real design difference from this app's already-reviewed
   "pinned foreground color" red-line decision (see file-header comment), not something this
   cleanup should undo.

   Owner acceptance Fix-1 (2026-08-14): `.back`, `.edit-btn`/`.relation-trigger`, and
   `.actions .btn` (excluding `.btn-ai`) were previously miscategorized into that same "pinned
   light foreground" family and hardcoded to a fixed white. They don't belong there — all three carry
   their own themed `var(--float-bg)` pill background (parity-supplied, not overridden here),
   so in the light theme that pill goes near-white while the text stayed pinned white too:
   white-on-white, exactly the owner-reported "hero pills/text hard to read in light theme"
   defect. Vue2's own rules for these three (photos-people.scss:320/327, 350/360, 406;
   PhotosPersonDetail.vue:1133, 1175/1183, 1197) were never pinned — they use themed
   `var(--text-2)`/`var(--text-1)`, which stays correctly paired with the themed pill
   background across both themes, with no `is-light` branch needed at all. Reverted below to
   match.

   These color survivors are written as full parity-matching selector paths (not bare class
   names) specifically so the scoped-attribute specificity bump reliably beats parity's own
   rules for the same element regardless of stylesheet load order — a bare `.back { color }`
   would tie parity's `.detail-hero .back` in specificity, which is exactly the kind of
   coin-flip this technique avoids. */
.detail-hero {
  position: relative;
  /* Final review Important 5: overflow: hidden is deliberately absent here (parity's own
     .detail-hero has it). The two dropdown menus are absolute-anchored (see the file-header
     "implementation deviation" note); any ancestor clip would remove them entirely — z-index is
     useless once the ancestor already clips, and there's no scrollbar to save it. A long name
     wrapping `.name` pushes the trigger down, clipping off roughly half of the menu's last item.
     Clipping responsibility moved down to .hero-clip. When adding new absolutely-positioned
     children here, note this element no longer clips them at the hero's own bounds.
     min-height/border-bottom/background all now come from parity's own `.detail-hero` rule
     (duplicates deleted); flex:none is Vue2's own component-scoped supplement
     (PhotosPersonDetail.vue:1104), not transcribed into the shared parity file yet. */
  overflow: visible;
  flex: none;
}
/* Clip only what actually needs clipping: the blurred cover image + the darkening scrim.
   Why this must be a **separate ancestor container** rather than letting `.bg` clip itself
   (the literal fix a reviewer suggested): `filter: blur(40px)`'s output is painted **outside**
   the element's own box per spec (up to roughly 120px of bleed here), and `transform: scale(1.2)`
   then enlarges the whole thing by 20% on top of that — an element's own `overflow` can't clip
   its own filter output, only an **ancestor's** `overflow` can. Without this, the blur edges
   would bleed into the tabs/grid below and the page's sides.
   The other candidate fix was reverting the menus to Vue2's own position:fixed +
   getBoundingClientRect coordinate math; not chosen because that reintroduces coordinate
   calculation, and Vue2's own version loses its anchor on page scroll/window resize (it never
   wires up scroll/resize recalculation) — that would just trade one known defect for another. */
.hero-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
/* `.bg`'s own base rule (position/inset/background-size/position/filter/transform/opacity)
   duplicated parity's `.detail-hero .bg` byte-for-byte and has been deleted. Only the
   fallback modifier survives: the plain-gradient fallback for when there is no cover photo and no
   face thumbnail — it doesn't layer on blur/scale/opacity (those three are designed for "a
   blurred photo"; stacked on a flat-color gradient they'd just wash it out into a 45%-opacity
   pale haze, not the saturated gradient block PersonAvatar's own three-tier fallback uses).
   Parity's own [data-fallback] override rule likewise never lifts the parent rule's
   filter/opacity — judged here as an unintentional visual dilution on Vue2's part, not copied;
   same gradient token, rendered as a full-strength opaque color block instead). */
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
  /* theme-exception: a fixed darkening gradient layered over the person's cover photo, giving
     the pinned-light foreground text/icons below it cross-theme-constant readable contrast — see
     this file's header comment for the full reasoning, not repeated here. */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.5) 45%, rgba(0, 0, 0, 0.68) 100%);
}

/* Owner acceptance Fix-1: this button has its own themed `var(--float-bg)` pill background
   (parity-supplied), so it should NOT join the "pinned light foreground" family — pinning its
   text white while its background is themed (and goes near-white in the light theme) produced
   the reported white-on-white washout. Matches Vue2's own `.back`/`.back:hover`
   (photos-people.scss:320/327), which have always used themed var(--text-2)/var(--text-1) —
   correctly paired with the same themed pill background in both themes, no `is-light` branch
   needed. Everything else about this button — position/padding/border-radius/background/
   backdrop-filter/border/hover background — still comes straight from parity, duplicates
   deleted. */
.detail-hero .back { color: var(--text-2); }
.detail-hero .back:hover { color: var(--text-1); }

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
  /* Deviation 10 (already registered in the file header): flex-wrap:wrap is a New-UI addition —
     parity/Vue2's own `.name` doesn't have it, and a long name would squeeze and overflow the
     Edit/relation-group pills. display/align-items/gap/font/color all come from parity's
     `.detail-hero .name`; this is the only local override left. */
  flex-wrap: wrap;
}
/* theme-exception: the name sits directly over the darkened cover photo, so it needs a
   cross-theme-constant light color (not --fg — in the light theme --fg is near-black, which
   would render dark-on-dark over the darkened photo). font-family/size/weight/letter-spacing all
   come from parity's `.detail-hero .name` — only color needs overriding here. */
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
   themed-dark-in-light-theme value this whole component's "pinned foreground color" red-line
   section already exists to keep out from here — not a fresh decision, the same established
   policy applied consistently. */
.detail-hero .name .fav-toggle {
  background: transparent;
  border: 0;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  /* Unfavorited state: a semi-transparent light outlined star, likewise pinned regardless of
     theme (see the file-header "pinned foreground color" red-line note). The favorited state is
     the `.fav-toggle.is-fav` rule below, reusing this app's already-established --star-fg
     fallback convention. */
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

/* Owner acceptance Fix-1: same reasoning as `.back` above — these two triggers carry their own
   themed `var(--float-bg)` pill background, so pinning their text white produced white-on-
   near-white in the light theme (owner-reported "Edit/No group pills... hard to read"). Vue2's
   own `.edit-btn`/`.relation-select` (photos-people.scss:350/360, 442/452;
   PhotosPersonDetail.vue:1175/1183/1197) have always used themed var(--text-2)/var(--text-1),
   correctly paired with the same themed pill background, no `is-light` branch needed. Base +
   hover still written as parity's own compound selectors so the scoped-attribute specificity
   bump reliably beats parity's `:hover` variant too (parity's hover selector is itself a
   4-class compound, `.detail-hero .name .edit-btn:hover`, so a bare local `.edit-btn:hover`
   would lose outright, not just tie). Height/padding/border-radius/border/background/
   backdrop-filter/font — all still come straight from parity. */
.detail-hero .name .edit-btn,
.detail-hero .name .relation-trigger { color: var(--text-2); }
.detail-hero .name .edit-btn:hover,
.detail-hero .name .relation-trigger:hover { color: var(--text-1); }

/* The popup bodies themselves (`.relation-menu`/`.relation-option`/`.edit-menu-danger`) are
   NOT part of the "pinned light foreground" family — per the file-header "pinned foreground
   color" red-line note, once open they sit on their own opaque `var(--surface-1)` popup
   background, not on the photo, so
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
  color: rgba(255, 255, 255, 0.72); /* theme-exception: same as .stat .k */
}
/* theme-exception: the stat numbers/labels sit over the darkened cover photo and need a
   cross-theme-constant light color — parity's own `.detail-hero .stat .v`/`.stat .k` use themed
   tokens (`.v` doesn't even set color, it inherits; `.k` uses var(--text-3)); font/size/weight
   and other structural properties are all inherited/reused from parity, only color is overridden
   here. */
.detail-hero .stat .v { color: #fff; } /* theme-exception */
.detail-hero .stat .k { color: rgba(255, 255, 255, 0.72); } /* theme-exception */

/* `.actions`'s layout duplicated parity's own `.detail-hero .actions` rule exactly (parity is
   actually a superset — it also sets align-items:stretch, which this component's old local
   rule was missing) and has been deleted. */

/* Owner acceptance Fix-1: same reasoning as `.back` above — "Make album"/"Background" carry
   their own themed `var(--float-bg)` pill background, so pinning their text white produced
   white-on-near-white in the light theme (owner-reported "Make album/Background... washed-out
   translucent white pills with white text"). Vue2's own `.actions .btn`
   (photos-people.scss:397; PhotosPersonDetail.vue:1133) has always used themed var(--text-1),
   correctly paired with the same themed pill background, no `is-light` branch needed; it
   doesn't change color on hover either, so this single declaration survives hover too without
   a separate hover rule. `:not(.btn-ai)` scopes this to the two plain buttons only — `.btn-ai`
   (the purple "Ask about {name}" button, already correct and explicitly out of scope for this
   fix) also carries the `.btn` class, and its own always-white text must stay untouched;
   parity's own `.detail-hero .actions .btn-ai` rule (declared after `.btn` in the same file)
   still wins that tie for it exactly as before. Everything else — padding/border-radius/
   background/backdrop-filter/border/hover background — still comes straight from parity. */
.detail-hero .actions .btn:not(.btn-ai) { color: var(--text-1); }

/* Task 8 (Plan D): Ask-about icon — Vue2 :90 renders this as an inline-styled <span>
   (display:inline-block;width:16px;height:16px;border-radius:99px;background:url(...)
   center/cover no-repeat), not a class, so there is no parity selector to align to or
   delete — values transcribed from that inline style; only the background-image itself
   stays inline (imported asset URL, same technique as PersonRelationsTab.vue's `.hd .orb`). */
.ask-nimo-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 99px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
</style>
