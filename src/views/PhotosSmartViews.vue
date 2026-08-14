<script setup lang="ts">
// SP7-P7a-T4: PhotosSmartViews.vue —— 智能视图列表页(壳 + AI 横幅 + hero + 网格 + 新建卡)。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewsView.vue:14-38(列表部分,
// 详情/弹窗部分归其余任务)、内联横幅 :15-19、hero :22-30、网格 :31-38 移植;
// 样式照 photos-smartview.scss:4-25(hero/create-btn/grid)+ :118-145(create-card)。
// Plan C Task 2(公共换壳):壳从 AreaShell + `.photos-layout` flex-row 换成 Photos.vue 的
// Vue2 结构 `.photos-root[themeClass] > .app[data-collapsed] > PhotosSidebar + main.main`
// ——`collapsed` 改用共享 composable useSidebarCollapse(）。随手修复了
// photosLayoutHeightCap.test.ts 里挂账的 EXEMPT 项:这页此前 `.photos-main` 没有任何内层
// 滚动容器,靠 AreaShell 的 `.area-body { overflow: auto }` 兜底整页滚动——脱壳后 `.app` 网格
// 强制 `height:100vh; overflow:hidden`(parity scss photos.scss:116-129,与视图无关的全局
// 祖先选择器,本页无法单独豁免),不补内层滚动容器就会真裁内容(超一屏的 moment 卡片再也
// 够不着)。这里把 `.mo-section`(本页唯一内容块)升格成 flex:1+overflow-y:auto 的滚动容器,
// 与 PhotosAlbums.vue 的 `.albums-scroll` 同一形状——从 EXEMPT 移进等效于 CAPPED(源码里
// 已不含 `.photos-layout` 规则字面量,自动退出该测试文件的扫描范围)。
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
//  2) Moments · For You section -- the page's sole content. The section and its hero render
//     UNCONDITIONALLY (Vue2 939a7d3a:PhotosSmartViewsView.vue:18-23 puts no v-if on either);
//     only the card grid is gated by showMoments (Vue2 :24). Getting this wrong makes the
//     whole page blank on a device with zero moments -- see the deviation registry note 5.
//  3) Slim settings hint (v-else-if="aiSmartViewOff", Vue2 :31, a sibling of the grid INSIDE
//     the section): with the grid hidden the page would otherwise be just a heading, so a
//     one-line pointer to Settings replaces the old full AI banner (the banner moved to the
//     Albums page along with the smart-view grid).
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
//  5) [SP15-P2b final fix wave] Not a deviation, a corrected port: this file used to gate the
//     whole `.mo-section` (hero included) on showMoments, carried over from P1 when the page
//     still had its own `sv-hero` above it -- harmless then, a completely blank page once this
//     phase deleted that hero, which is exactly the state the acceptance device is in
//     (moments table = 0 rows). Vue 2's target renders section + hero unconditionally and
//     gates only the grid; the gate now sits where Vue 2 has it.
import '../photos/styles/vue2-parity'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import MomentCard from '../photos/components/MomentCard.vue'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { usePhotosMoments } from '../photos/stores/moments'
import { useAlbumDragSort } from '../photos/composables/useAlbumDragSort'
import { useToast } from '../stores/toast'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
// Fix-1 item 1 (owner acceptance, 2026-08-13): `toggle` wires the topbar's collapse button
// (same as Photos.vue/PhotosAlbums.vue). title = topbarTitle's 'smart' branch ('For You',
// PhotosTimeline.vue:190); sub is left to PhotosTopbar's own default (topbarSubContext's
// navMap has no 'smart' entry, PhotosTimeline.vue:229-234, so it falls through to the same
// full-library photoCount/videoCount line the topbar already computes on its own).
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
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

// SP15-P1-T5(Vue2 939a7d3a:PhotosSmartViewsView.vue:24 + :455) —— the Moments **grid** is
// hidden outright when there are no moments, and follows the same aiFeatures.smartview switch
// as the settings hint below (reusing aiSmartViewOff, not a second computed). It gates the
// grid only: the section and its hero render unconditionally, exactly as Vue 2 :18-23 does.
// **On real devices the moments table is 0 rows for now (see spec §2), so "opening the page
// and seeing the heading with no cards under it" is expected, not a bug.**
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
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <!-- Fix-1 item 1 (owner acceptance, 2026-08-13): same narrow-mode coordination as
           Photos.vue/PhotosAlbums.vue. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="t('photosMoForYou')"
          :show-search="false"
          @toggle-collapse="onToggleCollapse"
        />
       <div class="photos-main">
        <!-- ── Moments · For You (Vue2 939a7d3a :18-32) -- now this page's sole content.
             The section and the hero carry NO v-if, matching Vue2 :18-19: this page has no
             other heading since the smart-view hero moved to Albums, so gating them would
             leave a device with zero moments looking at an empty page. ── -->
        <div class="mo-section" data-test="mo-section">
          <div class="mo-hero">
            <div>
              <h1>{{ t('photosMoHeroTitle') }}</h1>
              <p>{{ t('photosMoHeroDesc') }}</p>
            </div>
          </div>
          <div v-if="showMoments" ref="moGrid" class="sv-grid mo-grid" data-test="mo-grid">
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

          <!-- Vue2 :31 — a sibling of the grid, inside .mo-section: with the grid hidden the
               page would be just a heading, so a one-line pointer to Settings takes its place.
               The full stop-updates banner moved to the Albums page along with the smart
               albums; it is not duplicated here. -->
          <div v-else-if="aiSmartViewOff" class="mo-off-hint" data-test="mo-off-hint">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            <span>
              {{ t('photosMoFollowsSmartViewSetting') }}
              <RouterLink class="mo-off-hint-link" to="/photos/settings?section=ai">{{ t('photosPeopleFacesOffLink') }}</RouterLink>
            </span>
          </div>
        </div>
       </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Plan C Task 2: `.photos-layout` flex-row + the transitional `.sidebar { flex... }` width
   pin are gone — the `.app` CSS Grid (parity scss photos.scss:116-129) now owns both the
   sidebar's width and the height cap. `.photos-layout` no longer appears anywhere in this
   file's source — photosLayoutHeightCap.test.ts's EXEMPT entry for this page has been
   removed accordingly (see this file's header comment for why the height cap no longer
   clips content: `.mo-section` below picked up the scroll container it never had). */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── Moments · For You band (Vue2 photos-smartview.scss:144-186, all globally imported via
   Plan C Task 1's `import '../photos/styles/vue2-parity'`) ──
   Plan C Task 6 cleanup: went through every selector below against the now-globally-imported
   `photos-smartview.scss` (same doctrine as Task 3/4/5's own passes on the sibling pages) --
   any selector whose text and values already match a parity rule exactly is deleted outright,
   parity now governs it directly; only genuine New-UI additions/overrides/token substitutions
   survive, trimmed to just what parity doesn't already provide. See task-6-report.md for the
   full deviation table.
   Plan C Task 2: promoted to this page's scroll container (flex:1 1 auto + min-height:0 +
   overflow-y:auto) — same shape as PhotosAlbums.vue's `.albums-scroll`. Previously this page
   relied on AreaShell's `.area-body { overflow: auto }` for whole-page scroll; now that
   `.app`/`.main` cap height at 100vh with overflow:hidden (see header comment), something
   inside `.photos-main` has to own the scroll instead, and this is the only content block.
   (`margin-bottom: 36px` used to be restated here too -- deleted, parity's own
   `.photos-root .mo-section` rule already sets it identically.) */
.mo-section { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
/* `.mo-hero`/`.mo-hero p` deleted outright (Task 6): parity's own `.photos-root .mo-hero`/
   `.photos-root .mo-hero p` already match these shapes property-for-property (the only
   difference is parity's own token names, `--text-3` etc., vs this repo's `--fg-muted` --
   same "tokens vs literals/token-family, identical shape -> deleted, parity wins" verdict
   T3/T4/T5 already applied dozens of times on the sibling pages). */
/* `.mo-hero h1`'s font-size/weight/letter-spacing/margin duplicated parity's own
   `.photos-root .mo-hero h1` (same values) -- deleted. Parity's rule also sets
   `font-family: var(--font-display)`; the previous "this repo's theme.css has no such
   token" comment here only checked theme.css -- photos.scss's own `.photos-root` block
   (Task 6 grep) *does* define `--font-display` for both light/dark, so that font-family
   was never actually inert, it just wasn't documented correctly. Only `color: var(--fg)`
   survives: parity sets no color on this selector at all, and this repo's own ambient
   default for a bare `h1` outside `.photos-root`'s own component rules isn't guaranteed,
   so the explicit colour is kept rather than gambled on inheritance. */
.mo-hero h1 { color: var(--fg); }

/* .mo-grid coexists with .sv-grid, only layering mosaic-specific rules on top — it never
   touches .sv-grid itself. Dense packing plus a fixed row height: a card's rendered height
   works out to its row span multiplied by 132px, plus its span minus one multiplied by the
   16px gap.
   Task 6: `.mo-grid` itself and its three `.mo-card`/`.mo-card-wide`/`.mo-card-tall` span
   rules (plus the narrow-container media query) are deleted entirely -- parity's own
   `.photos-root .mo-grid .mo-card`/`-wide`/`.mo-card.mo-card-tall` rules (photos-smartview.scss
   :132-158) already match these values exactly and, being plain unscoped selectors, already
   reach MomentCard's root element regardless of Vue's scoped-CSS boundary -- the local
   `:deep()` wrapping that used to be needed here was pure duplication, not a requirement for
   reachability. */

/* Drag states (Vue2 photos-smartview.scss:289-297: `.photos-root .mo-drag-ghost`/
   `.mo-drag-chosen`). Vue2 uses an inline purple color literal there; this repo forbids bare
   color literals in authored component code, so these use the --accent family via color-mix
   instead (same technique as SmartViewCard's .sv-collage-badge) — token-based, not a literal,
   so no theme-exception comment is needed. Kept (not deleted): unlike the shape-only
   duplicates above, this is a genuine, still-needed value substitution over parity's own
   literal, matching the same "kept, real token substitution" verdict as MomentCard.vue's
   type-pill tokens. */
.mo-grid :deep(.mo-drag-ghost) {
  opacity: 0.4;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  outline: 2px dashed color-mix(in srgb, var(--accent) 60%, transparent);
}
.mo-grid :deep(.mo-drag-chosen) { cursor: grabbing; }

/* `.sv-grid`'s base shape (display/grid-template-columns/gap) duplicated parity's own
   `.photos-root .sv-grid` (photos-smartview.scss:6-10) -- deleted. `flex: 1 1 auto` survives:
   parity has no equivalent (this page's own flex-column scroll container needs the grid to
   grow/shrink inside `.mo-section`, a New-UI structural addition unrelated to Vue2's layout). */
.sv-grid { flex: 1 1 auto; }

/* ── Slim settings hint (SP15-P2b Task 5, replaces the entire old .svs-banner) -- reuses
   the same --dem-fg family as the banner (precedent: PhotosTrash.vue .trash-bucket-dot
   [data-tone="warn"]).
   SP15-P2b final fix wave: geometry now matches Vue2's own slim hint (939a7d3a:
   PhotosSmartViewsView.vue:31 inline style -- padding:12px 14px, no margin, centred) instead
   of the deleted full banner's (24px/32px margin, 14px/16px padding, flex-start). The hint is
   one line of text, so it never needed the banner's icon-above-two-lines alignment, and the
   32px side margin indented it past everything else on the page. Token family unchanged. */
.mo-off-hint {
  padding: 12px 14px;
  background: var(--dem-bg); border: 1px solid var(--dem-bd); border-radius: 10px;
  display: flex; gap: 8px; align-items: center;
  color: var(--dem-fg); font-size: 12.5px; line-height: 1.4;
}
.mo-off-hint svg { flex-shrink: 0; }
.mo-off-hint-link { color: var(--accent-text); text-decoration: underline; cursor: pointer; }

/* New-UI mobile enhancement (Vue2 has no responsive drawer here — same registered deviation
   as Photos.vue's own copy of this rule): once the sidebar switches into is-drawer mode at
   ≤768px, collapse `.app`'s sidebar column too, so `.main` doesn't leave a dead
   var(--sidebar-w) gutter where the now-floating sidebar used to sit. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}
</style>
