<script setup lang="ts">
// SP7-P7a-T4: PhotosSmartViews.vue —— 智能视图列表页(壳 + AI 横幅 + hero + 网格 + 新建卡)。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewsView.vue:14-38(列表部分,
// 详情/弹窗部分归其余任务)、内联横幅 :15-19、hero :22-30、网格 :31-38 移植;
// 样式照 photos-smartview.scss:4-25(hero/create-btn/grid)+ :118-145(create-card)。
// 壳照 PhotosPeople.vue 头部注释的既定形态复制(AreaShell/.photos-layout/PhotosSidebar/
// .photos-main,含 ≤768px 的 gap:0),不抽公共(P3/P4 既定)。
//
// SP15-P2b Task 5 (Vue2 939a7d3a:src/views/Photos/PhotosSmartViewsView.vue, the whole
// 317-line file): the smart-view grid, its hero, the create tile, and the create dialog all
// moved to PhotosAlbums.vue in this branch's Tasks 3/4 — smart albums now live mixed into
// the Albums grid. What is left on this route is Moments-only: a "For You" page. The
// smart-view list store (usePhotosSmartViews) is no longer imported here at all; this file
// no longer fetches or renders anything about smart views themselves.
//
// This task's scope (brief structural spec items 1-9, now narrowed):
//  1) Shell (AreaShell/PhotosSidebar/.photos-main, unchanged)
//  2) Moments · For You band -- gated by showMoments, the page's sole content
//  3) Slim settings hint (v-else-if="aiSmartViewOff"): with the band hidden the page would
//     be nearly blank, so a one-line pointer to Settings replaces the old full AI banner
//     (the banner moved to the Albums page along with the smart-view grid).
//
// Deviation registry:
//  1) [P8a-T6 already wired, historical record] Vue 2 :15's original banner link was
//     <a href="javascript:void(0)">, clicking it emitted $emit('open-settings', 'ai'). Once
//     the settings page landed this became a real <RouterLink> -- that behavior has since
//     been folded into the slim hint below and is no longer a standalone banner.
//  2) Vue 2 :19 has a bare English period after the link text (`</a>.`), which would mix
//     Chinese and English typography in the Chinese UI and sits outside any translatable
//     string -- not copied (same precedent as PhotosPeople.vue's deviation 7).
//  3) The slim hint's amber reuses the --dem-fg/--dem-bg/--dem-bd family (grep of theme.css
//     confirms both themes define values; PhotosTrash.vue's warn semantics are already an
//     established precedent for this token family -- no new token added).
//  4) [SP15-P1 final fix wave] A reorder drag no longer also opens the moment it dragged.
//     Vue 2's Moments band has no such guard and does open it; the album grid's guard is
//     copied here instead. Full rationale, including why Sortable's own `ignoreNextClick`
//     does not cover the reordering case, sits above `onMomentOpen` below.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import MomentCard from '../photos/components/MomentCard.vue'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { usePhotosMoments } from '../photos/stores/moments'
import { useAlbumDragSort } from '../photos/composables/useAlbumDragSort'
import { useToast } from '../stores/toast'

const { t } = useI18n()
const router = useRouter()
const settings = usePhotosSettingsStore()
const moments = usePhotosMoments()
const toast = useToast()

// P8a-T6(§7e-10):aiFeatures.smartview 曾经是本页自己 onMounted 直读一次 /photos/config
// 的临时实现(P8 归属前没有共享 store)。现在改读 T1 的 photosSettings store —— 语义不变:
// missing field / request failure is always treated as "on" (no banner/hint, does not
// scare the user) -- this defensive semantics already lives in store.fetchAiFeatures();
// this line only consumes it.
const aiSmartViewOff = computed(() => settings.aiFeatures.smartview === false)

// SP15-P1-T5(Vue2 899af59b:PhotosSmartViewsView.vue:455) —— the Moments band is hidden
// outright when there are no moments, and follows the same aiFeatures.smartview switch as
// the settings hint below (reusing aiSmartViewOff, not a second computed). **On real devices
// the moments table is 0 rows for now (see spec §2), so "opening the page and not seeing
// this band" is expected, not a bug.**
const showMoments = computed(() => !aiSmartViewOff.value && moments.moments.length > 0)
const moGrid = ref<HTMLElement | null>(null)

// SP15-P1-T6: drag-to-reorder for the Moments band, reusing the album detail page's
// drag-sort composable instead of a second Sortable wrapper.
//
// This is the spot most likely to be copied wrong. Vue2 (899af59b:PhotosSmartViewsView.vue
// :480-497) rebinds Sortable from three watchers: two watch an inline detail view
// collapsing back to the list, one watches showMoments going from hidden to shown. The
// first two have **no counterpart here** — the detail page is its own route, so leaving
// this page unmounts the whole component and returning remounts it; there is no "same
// instance, detail state just collapsed" case to watch for. Copying those two would
// produce watchers that can never fire. Only the third case survives: when the band goes
// from hidden to shown, `.mo-grid` is a freshly mounted DOM node and any prior Sortable
// instance (from before the band was hidden) is stale.
const drag = useAlbumDragSort({
  container: moGrid,
  enabled: () => showMoments.value,
  onOrder: (ids) => { void persistOrder(ids) },
  itemSelector: '.mo-card[data-id]',
  ghostClass: 'mo-drag-ghost',
  chosenClass: 'mo-drag-chosen',
})

async function persistOrder(ids: string[]): Promise<void> {
  const ok = await moments.reorder(ids)
  if (!ok) toast.show(t('photosMoOrderSaveFailed'), 2500, 'danger')
}

// Declared below `drag` on purpose — the drag guard has to be the first thing it does, and
// the album grid puts its own equivalent (PhotosAlbumDetail.vue:161-162, "必须在最前面")
// immediately after its `useAlbumDragSort` call for the same reason.
//
// Deviation from Vue 2 (registered here, not a port miss): Vue 2's Moments band has **no**
// such guard — 899af59b:PhotosSmartViewsView.vue:563-575 creates Sortable without an
// onStart flag and :604-608 onOpenMoment only checks the AI switch — so a reorder there
// also opens the moment. Vue 2's *album* grid does guard (:380-384 `_dragging`), and its
// own comment says the post-drop click misfires selection/lightbox. This port follows the
// branch rule "the interface 1:1, the logic correct" and takes the album grid's version.
//
// Sortable's built-in protection does not cover the reordering case: it sets
// `ignoreNextClick = true` when a fallback drag starts (sortable.esm.js:1596) and a global
// capture-phase click listener consumes one click while that flag is up
// (:1013-1023, commented "issue 1184 fix — Prevent click event on fallback if dragged but item
// not changed position"), but `_onDragOver` clears the flag again (:1741). Any drag that
// actually moves the card past a neighbour fires dragover, so exactly the drags that
// reorder are the ones left unprotected.
function onMomentOpen(id: string): void {
  if (drag.isDragging()) return
  router.push('/photos/moments/' + id)
}

watch(showMoments, (next) => {
  if (next) void nextTick(() => drag.refresh())
  else drag.destroy()
}, { immediate: true })

onBeforeUnmount(() => drag.destroy())

onMounted(() => {
  // 侧栏(PhotosSidebar,本页也挂载它)同帧也会调用 fetchAiFeatures() —— 并发去重收在
  // settings.ts 里,这里不需要关心。
  void settings.fetchAiFeatures()
  void moments.fetchMoments()
})
</script>

<template>
  <AreaShell :title="t('photosTitle')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- ── Moments · For You (Vue2 899af59b :31-44) -- now this page's sole content ── -->
        <div v-if="showMoments" class="mo-section" data-test="mo-section">
          <div class="mo-hero">
            <div>
              <h1>{{ t('photosMoHeroTitle') }}</h1>
              <p>{{ t('photosMoHeroDesc') }}</p>
            </div>
          </div>
          <div ref="moGrid" class="sv-grid mo-grid">
            <!--
              The `??` fallbacks below can never actually fire: sizeMap (moments.ts) is a
              computed derived from this same `moments.moments` list via assignMomentSizes,
              keyed by m.id — every id rendered here is guaranteed to have a sizeMap entry in
              the same tick. Kept only as belt-and-suspenders per the brief; do not mistake it
              for a real code path — a genuinely absent entry would hand MomentCard 'T1' for a
              moment with fewer than 2 featured ids, which MomentCard documents itself as
              relying on never happening (see momentLayout.ts / MomentCard.vue's invariant
              comment).
            -->
            <MomentCard
              v-for="m in moments.moments" :key="m.id" :moment="m"
              :size="moments.sizeMap[m.id]?.size ?? 'standard'"
              :template="moments.sizeMap[m.id]?.template ?? 'T1'"
              @open="onMomentOpen"
            />
          </div>
        </div>

        <!-- Vue2 :26-31: with the band hidden this page is nearly blank, so a one-line
             pointer to Settings replaces it. The full stop-updates banner moved to the
             Albums page along with the smart albums; it is not duplicated here. -->
        <div v-else-if="aiSmartViewOff" class="mo-off-hint" data-test="mo-off-hint">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
          <span>
            {{ t('photosMoFollowsSmartViewSetting') }}
            <RouterLink class="mo-off-hint-link" to="/photos/settings?section=ai">{{ t('photosPeopleFacesOffLink') }}</RouterLink>
          </span>
        </div>
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── Moments · For You band (Vue2 photos-smartview.scss:144-186) ── */
.mo-section { margin-bottom: 36px; }
.mo-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 16px; }
/* Deviation logged: Vue2 uses var(--font-display) — this repo's theme.css has no such token
   (grep turns up zero hits); not adding one, inherits the page's font instead. */
/* SP15-P2b Task 5 (Vue2 :19): promoted from h2 to h1 -- with the smart-view hero gone from
   this page, this is now the page's only page-level heading. Font size unchanged (32px). */
.mo-hero h1 { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4px; color: var(--fg); }
.mo-hero p { font-size: 13.5px; color: var(--fg-muted); margin: 0; max-width: 520px; line-height: 1.5; }

/* .mo-grid coexists with .sv-grid, only layering mosaic-specific rules on top — it never
   touches .sv-grid itself. Dense packing plus a fixed row height: a card's rendered height
   works out to its row span multiplied by 132px, plus its span minus one multiplied by the
   16px gap. */
.mo-grid { margin-bottom: 4px; grid-auto-flow: row dense; grid-auto-rows: 132px; }
/* Three span tiers. The tall card uses a two-class selector so it outranks the baseline
   single-class selector regardless of source order. */
.mo-grid :deep(.mo-card) { grid-row: span 3; }
.mo-grid :deep(.mo-card-wide) { grid-column: span 2; }
.mo-grid :deep(.mo-card.mo-card-tall) { grid-row: span 5; }

/* Narrow-container fallback: .sv-grid's auto-fill minmax(320px, 1fr) drops to one or two
   columns below the three-column breakpoint, and a wide card spanning two columns would then
   overrun the column count — the media query below drops it back to one column. The tall
   card's vertical span is unaffected by column count. */
@media (max-width: 1055px) {
  .mo-grid :deep(.mo-card-wide) { grid-column: span 1; }
}

/* Drag states (Vue2 photos-smartview.scss:292-299). Vue2 uses an inline purple color
   literal there; this repo forbids bare color literals, so these use the --accent
   family via color-mix instead (same technique as SmartViewCard's .sv-collage-badge) —
   token-based, not a literal, so no theme-exception comment is needed. */
.mo-grid :deep(.mo-drag-ghost) {
  opacity: 0.4;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  outline: 2px dashed color-mix(in srgb, var(--accent) 60%, transparent);
}
.mo-grid :deep(.mo-drag-chosen) { cursor: grabbing; }

/* Base grid used by .mo-grid above -- kept here even though this page no longer has a
   smart-view grid of its own (SP15-P2b Task 5): .mo-grid only layers mosaic-specific rules
   on top of it (see comment above) and still needs this rule to exist. */
.sv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; flex: 1 1 auto; }

/* ── Slim settings hint (SP15-P2b Task 5, replaces the entire old .svs-banner) -- reuses
   the same --dem-fg family as the banner (precedent: PhotosTrash.vue .trash-bucket-dot
   [data-tone="warn"]). */
.mo-off-hint {
  margin: 24px 32px 20px; padding: 14px 16px;
  background: var(--dem-bg); border: 1px solid var(--dem-bd); border-radius: 10px;
  display: flex; gap: 10px; align-items: flex-start;
  color: var(--dem-fg); font-size: 12.5px; line-height: 1.5;
}
.mo-off-hint svg { flex-shrink: 0; margin-top: 1px; }
.mo-off-hint-link { color: var(--accent-text); text-decoration: underline; cursor: pointer; }

/* ≤768px:侧栏已收抽屉,布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
