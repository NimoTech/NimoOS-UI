<script setup lang="ts">
// SP15-P1-T7: PhotosMomentDetail.vue — the moment detail page (route /photos/moments/:id).
// Ported section by section from Vue 2 NimoOS-UI 899af59b:src/views/Photos/PhotosMomentDetail.vue
// (template :1-121, computed :203-291, distStyle :418-421) and photos-smartview.scss.
// It reuses the sv-detail-* two-column skeleton already established by
// PhotosSmartViewDetail.vue — Vue 2 did the same, its top bar is literally commented
// "same as sv-detail-bar". Scoped styles do not cross component boundaries in this repo, so the
// handful of sv-* rules needed here are restated (same technique as MomentCard.vue, which
// restates SmartViewCard.vue's rules).
//
// ★★★ The structural difference from Vue 2 — read this before changing anything ★★★
// In Vue 2 this is an inline child component of PhotosSmartViewsView and the moment object
// arrives as a prop, so it has no "what if that id does not exist" path and never needs one.
// Here it is a real route: the user can edit the address bar, follow a stale bookmark, or deep
// link while the Moments band is hidden. And the backend has **no GET /moments/:id**
// (NimoOS-Photos/route/router.go only has GET /moments for the whole list and
// GET /moments/:id/assets), so a cold deep link can only fetch the full list and look the id up
// in it — that is where ensureLoaded() + byId() come from.
//
// Deviations from the Vue 2 original:
//  1) The "not found" empty state is new in New-UI (reason above); Vue 2 has no counterpart.
//     The loading gate ahead of it is new for the same reason — with no moment in the store yet
//     there is nothing to render, and a blank flash is not acceptable on a route.
//  2) The backend's momentResponse carries **no updated_at** (verified against
//     NimoOS-Photos/route/v1/moments.go:39-73), so Vue 2's `lastUpdated` has always rendered
//     '—' and its relTime branch has never once executed. The rendered result is reproduced
//     exactly — a dash — but the dead formatting branch is not ported. The field stays in the
//     Moment type so no type change is needed if the backend ever adds it.
//  3) typeLabel resolves to a translated string here rather than returning a bare English key
//     for the template to feed to `$t` (Vue 2 :215-221 + `{{ $t(typeLabel) }}`). It reuses the
//     photosMoType{Trip,Pets,Family,Theme} keys MomentCard.vue already added in T4 — same
//     branch order, same wording, no new keys, no cross-file import (Vue 2 also kept two
//     independent copies of this ladder on purpose).
//  4) Every toLocale*String call is handed an explicit BCP-47 tag derived from the i18n locale.
//     Vue 2 did this for the dates but left the counts on a bare `toLocaleString()` (browser
//     locale, unpredictable); here both follow the app's language setting. This repo's locales
//     are `zh_cn`/`en_us`, which are not valid BCP-47 — passing one raw throws a RangeError, so
//     the underscore must be replaced (precedent: SmartViewCard.vue).
//  5) The action bar (Add photos / Select / Save as Album / more menu), the two photo grids, the
//     selection bar, the delete confirmation and the library picker are NOT here: they are
//     Tasks 8/9/10. The `featuredAssets` / `allAssets` / `allLoading` / `manualIds` / `places`
//     state they need is already loaded and exposed by this task, since Stats and the By-month
//     histogram read it too. Consequently Vue 2's `document.mousedown` listener that closes the
//     more menu is also deferred to Task 10 — there is no menu here yet to close.
//
// Fix round 1 added three more:
// 10) The two asset requests fail independently (see load()). An earlier revision put them in
//     one Promise.all under one catch, which discarded an already-resolved detail response
//     whenever the all-assets one rejected. Vue 2 runs them as two separate statements with two
//     try/catch blocks (:307-338) and never loses one to the other; this restores that.
// 11) Switching :id clears the previous moment's assets before refetching. Vue 2's detail
//     component was v-if'd by its parent, so a switch remounted it and reset everything for
//     free. A route does not remount on a params-only change, so the reset is explicit.
// 12) A failed list fetch renders its own state, separate from "not found". Vue 2 could not
//     reach this page without a moment object, so it had neither state. Having only one of them
//     meant a network blip told the user their moment had been deleted — wrong, and stated with
//     confidence. Needs `listError` on the store, added in the same round.
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import { usePhotosMoments, type MomentMember, type MomentPlace } from '../photos/stores/moments'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const store = usePhotosMoments()

/** The placeholder every empty key/value cell falls back to (Vue 2 used this same em dash
 *  literal inline in five places). */
const DASH = '—'

const momentId = computed(() => String(route.params.id ?? ''))
const moment = computed(() => store.byId(momentId.value))
// The three no-content outcomes are mutually exclusive and all require `!moment`, so a moment
// we do hold is always rendered — even if a later list refresh failed underneath it.
const loadFailed = computed(() => store.listLoaded && !moment.value && store.listError)
const notFound = computed(() => store.listLoaded && !moment.value && !store.listError)

const featuredAssets = ref<Photo[]>([])
const allAssets = ref<Photo[]>([])
const allLoading = ref(false)
const manualIds = ref<Set<string>>(new Set())
const places = ref<MomentPlace[]>([])

// BCP-47 tag for the Intl APIs — `zh_cn` / `en_us` are not valid tags (see deviation 4).
const localeTag = computed(() => locale.value.replace('_', '-'))
function fmtNum(n: number): string {
  return n.toLocaleString(localeTag.value)
}

// Staleness guard (plan Global Constraints §6): switching :id can leave an older request in
// flight that resolves after the newer one and clobbers it.
let loadEpoch = 0

async function load(): Promise<void> {
  const epoch = ++loadEpoch
  await store.ensureLoaded()
  if (epoch !== loadEpoch || !moment.value) return
  const id = momentId.value
  allLoading.value = true
  // Two independently failable requests, each with its own catch and its own epoch check.
  // The T3 store rethrows where Vue 2's equivalents swallowed and toasted internally, so the
  // catch lives here now — but it has to stay per-request: a single Promise.all + single catch
  // throws away an already-resolved detail response just because the all-assets one rejected,
  // blanking the Featured count, About→Place and manualIds for no reason. Vue 2 never did that;
  // its loadFeatured() and loadAll() are two separate statements with two try/catch blocks
  // (899af59b:PhotosMomentDetail.vue:307-338). See deviation 10.
  const detailDone = store.loadDetail(id).then(
    (detail) => {
      if (epoch !== loadEpoch) return
      featuredAssets.value = detail.assets
      manualIds.value = new Set(detail.members.filter((m: MomentMember) => m.manual).map((m) => m.assetId))
      places.value = detail.places
    },
    (e: unknown) => { console.error('[photos-moments] loadDetail', e) },
  )
  const allDone = store.loadAll(id).then(
    (all) => {
      if (epoch !== loadEpoch) return
      allAssets.value = all
    },
    (e: unknown) => { console.error('[photos-moments] loadAll', e) },
  )
  // Neither handler can reject, so this settles once both are done either way.
  await Promise.all([detailDone, allDone])
  if (epoch === loadEpoch) allLoading.value = false
}

/** The error state's only way out. ensureLoaded() would short-circuit here (listLoaded is
 *  already true), so the list has to be refetched explicitly before reloading the page's data. */
async function retry(): Promise<void> {
  await store.fetchMoments()
  await load()
}

onMounted(load)
// Changing only the params does not remount — the watcher is mandatory, writing this in
// onMounted alone is a known recurring defect in this repo.
watch(momentId, () => {
  // Drop the previous moment's assets first: they are keyed to the old id, and leaving them up
  // shows one moment's photos, Featured count and Place under another moment's title until the
  // new responses land. Vue 2 could not hit this — its detail component was v-if'd, so switching
  // moments remounted it and reset everything. Ours does not remount (that is the whole point of
  // the watcher), so the reset has to be explicit. See deviation 11.
  featuredAssets.value = []
  allAssets.value = []
  manualIds.value = new Set()
  places.value = []
  void load()
})

// ── computed, ported one by one from Vue 2 :203-291 ────────────────────────────────────────
const momentAssetCount = computed(() => moment.value?.assetCount ?? 0)

// Same ladder and same order as MomentCard.vue:54-60 (Vue 2 kept two independent copies of it
// too — :215-221 here and MomentCard.typeLabel in the list view).
const typeLabel = computed(() => {
  const key = moment.value?.recipeKey || ''
  if (key.startsWith('trip')) return t('photosMoTypeTrip')
  if (key.includes('pets')) return t('photosMoTypePets')
  if (key.includes('family')) return t('photosMoTypeFamily')
  return t('photosMoTypeTheme')
})

// Deviation 2: constant by construction. momentResponse has no updated_at, so this is the exact
// result Vue 2 renders too — without carrying a relTime branch that can never be reached.
const lastUpdated = DASH

// Time window: with both ends present (trip-style moments) show a date range; without them
// (theme-style moments) fall back to the existing subtitle, then to the placeholder.
const timeWindowLabel = computed(() => {
  const m = moment.value
  if (!m) return DASH
  if (!m.timeFrom) return m.subtitle || DASH
  const from = new Date(m.timeFrom)
  const to = m.timeTo ? new Date(m.timeTo) : from
  const fmt = (d: Date): string =>
    d.toLocaleDateString(localeTag.value, { month: 'short', day: 'numeric', year: 'numeric' })
  const fromStr = fmt(from)
  const toStr = fmt(to)
  return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`
})

const spanDays = computed<number | null>(() => {
  const m = moment.value
  if (!m || !m.timeFrom || !m.timeTo) return null
  const from = new Date(m.timeFrom).getTime()
  const to = new Date(m.timeTo).getTime()
  return Math.max(1, Math.round((to - from) / 86400000) + 1)
})
const spanLabel = computed(() => (spanDays.value != null ? t('photosMoSpanDays', { n: spanDays.value }) : DASH))

// Month buckets: the full asset list dropped into "YYYY-MM" keys, ascending. Drives the sidebar
// histogram; the first and last months label its x-axis.
interface MonthBucket { key: string; count: number; label: string }
const monthBuckets = computed<MonthBucket[]>(() => {
  if (!allAssets.value.length) return []
  const map = new Map<string, number>()
  for (const p of allAssets.value) {
    if (!p.takenAt) continue
    const d = new Date(p.takenAt)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => {
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1)
        .toLocaleDateString(localeTag.value, { month: 'short', year: 'numeric' })
      return { key, count, label }
    })
})
const distMax = computed(() => Math.max(1, ...monthBuckets.value.map((b) => b.count)))
function distStyle(b: MonthBucket, i: number): { height: string; opacity: number } {
  const n = Math.max(1, monthBuckets.value.length - 1)
  return { height: `${(b.count / distMax.value) * 100}%`, opacity: 0.4 + (i / n) * 0.5 }
}

// About → Place: `places` (already sorted by frequency DESC by the backend) takes its top three
// names joined with " · ", plus "+{n}" for whatever is left over; when it is empty fall back to
// the single moment.place; with neither, the row still renders and shows the placeholder — it is
// never hidden outright, matching the Type/Time rows and the rest of this area's key/value rows.
const placesLabel = computed(() => {
  const list = places.value
  if (list.length) {
    const top = list.slice(0, 3).map((p) => p.name)
    const rest = list.length - top.length
    return rest > 0 ? `${top.join(' · ')} +${rest}` : top.join(' · ')
  }
  return moment.value?.place || DASH
})
// Hover hint: the complete place list with counts, e.g. "Bozeman (323) · Rexburg (76) · …".
// With no places there are no counts to hint at, so no title is attached.
const placesTitle = computed(() =>
  places.value.length ? places.value.map((p) => `${p.name} (${p.count})`).join(' · ') : '',
)

function backToAll(): void {
  void router.push('/photos/smart-views')
}
</script>

<template>
  <AreaShell :title="moment ? moment.title : t('photosMoBackToAll')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- Gate 1: the list has not arrived yet (New-UI only — Vue 2 always had the object). -->
        <div v-if="!store.listLoaded" class="mo-skeleton" data-test="mo-skeleton">
          <div class="mo-skel-bar" />
          <div class="mo-skel-header" />
        </div>

        <!-- Gate 2: the list request failed, so we cannot say anything about this id. Distinct
             from gate 3 on purpose — saying "this moment no longer exists" after a network blip
             is confidently wrong (deviation 12). -->
        <div v-else-if="loadFailed" class="mo-not-found" data-test="mo-load-failed">
          <div class="mo-not-found-title">{{ t('photosMoLoadFailed') }}</div>
          <button
            type="button" class="mo-not-found-back" data-test="mo-load-failed-retry"
            @click="retry"
          >{{ t('photosRetry') }}</button>
        </div>

        <!-- Gate 3: the list arrived clean but byId found nothing (deviation 1). -->
        <div v-else-if="notFound" class="mo-not-found" data-test="mo-not-found">
          <div class="mo-not-found-title">{{ t('photosMoNotFound') }}</div>
          <button
            type="button" class="mo-not-found-back" data-test="mo-not-found-back"
            @click="backToAll"
          >{{ t('photosMoBackToAll') }}</button>
        </div>

        <!-- Gate 4: the real content. `v-else-if="moment"` rather than a bare `v-else`: gates 1
             to 3 have already excluded every other case, so the two are equivalent at runtime,
             but only the explicit test narrows `moment` from `Moment | undefined` to `Moment` for
             vue-tsc. (PhotosSmartViewDetail.vue gets the same narrowing from a bare `v-else`
             because its gate 2 is `v-else-if="!sv"` — a direct negation of the same ref. Ours
             goes through the separate `notFound` computed, which vue-tsc cannot see through.) -->
        <template v-else-if="moment">
          <!-- Vue 2 :3-9, commented there as "same as sv-detail-bar". -->
          <div class="sv-detail-bar">
            <button type="button" class="sv-back-btn" data-test="mo-back" @click="backToAll">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              {{ t('photosMoBackToAll') }}
            </button>
            <div style="flex:1" />
            <span class="sv-last-updated" data-test="mo-last-updated">{{ t('photosMoLastUpdated', { time: lastUpdated }) }}</span>
          </div>

          <div class="sv-detail-layout mo-detail-layout">
            <div class="sv-detail-main">
              <!-- Header (Vue 2 :12-30). The action bar that sits to its right is Task 9/10. -->
              <div class="sv-header">
                <div style="flex:1;min-width:0">
                  <h1>{{ moment.title }}</h1>
                  <div class="sv-header-conds">
                    <span class="sv-cond mo-type-pill">{{ typeLabel }}</span>
                    <span v-if="moment.place" class="sv-cond">
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                      {{ moment.place }}
                    </span>
                  </div>
                  <div class="sv-header-stats">
                    <span v-if="moment.subtitle">{{ moment.subtitle }}</span>
                    <span><b>{{ fmtNum(momentAssetCount) }}</b> {{ t('photosSvPhotosCount') }}</span>
                    <span v-if="moment.addedThisWeek > 0" class="mo-week-badge">{{ t('photosMoAddedThisWeek', { n: moment.addedThisWeek }) }}</span>
                  </div>
                </div>
              </div>
              <!-- Task 8 mounts the Featured and All-photos grids here. -->
            </div>

            <aside class="sv-detail-side">
              <!-- About (Vue 2 :86-92) -->
              <div class="sv-side-section">
                <h3>{{ t('photosMoAbout') }}</h3>
                <div class="mo-about-row"><span>{{ t('photosMoType') }}</span><b>{{ typeLabel }}</b></div>
                <div class="mo-about-row"><span>{{ t('photosMoTime') }}</span><b data-test="mo-about-time">{{ timeWindowLabel }}</b></div>
                <div class="mo-about-row">
                  <span>{{ t('photosMoPlace') }}</span>
                  <b data-test="mo-about-place" :title="placesTitle">{{ placesLabel }}</b>
                </div>
              </div>

              <!-- Stats (Vue 2 :94-115) -->
              <div class="sv-side-section">
                <h3>{{ t('photosMoStats') }}</h3>
                <div class="sv-stat-grid">
                  <div class="sv-stat-cell">
                    <div class="v" data-test="mo-stat-photos">{{ fmtNum(momentAssetCount) }}</div>
                    <div class="l">{{ t('photosMoPhotos') }}</div>
                  </div>
                  <div class="sv-stat-cell">
                    <div class="v" data-test="mo-stat-featured">{{ featuredAssets.length }}</div>
                    <div class="l">{{ t('photosMoFeatured') }}</div>
                  </div>
                  <div class="sv-stat-cell">
                    <div class="v" data-test="mo-stat-span">{{ spanLabel }}</div>
                    <div class="l">{{ t('photosMoSpan') }}</div>
                  </div>
                  <div class="sv-stat-cell">
                    <div class="v" data-test="mo-stat-lastupdate">{{ lastUpdated }}</div>
                    <div class="l">{{ t('photosMoLastUpdate') }}</div>
                  </div>
                </div>
              </div>

              <!-- By month (Vue 2 :117-124) — absent entirely when nothing carries a takenAt. -->
              <div v-if="monthBuckets.length" class="sv-side-section" data-test="mo-dist">
                <h3>{{ t('photosMoByMonth') }}</h3>
                <div class="sv-distribution">
                  <div
                    v-for="(b, i) in monthBuckets" :key="b.key" class="sv-dist-bar"
                    data-test="mo-dist-bar" :style="distStyle(b, i)" :title="b.label + ' · ' + b.count"
                  />
                </div>
                <div class="sv-dist-x">
                  <span>{{ monthBuckets[0].label }}</span>
                  <span>{{ monthBuckets[monthBuckets.length - 1].label }}</span>
                </div>
              </div>
            </aside>
          </div>
        </template>
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
/* height (not min-height): this screen is capped and only the inner containers scroll — same
   fix, and the same Vue 2 source, as the note at the matching rule in src/views/Photos.vue.
   Registered in views/__tests__/photosLayoutHeightCap.test.ts under CAPPED. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Loading gate (New-UI only, deviation 1) — same shape as PhotosSmartViewDetail's .sv-skeleton,
   minus the photo grid, since this task renders no grid yet. */
.mo-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 16px 32px; }
.mo-skel-bar { height: 20px; width: 200px; border-radius: 6px; background: var(--skeleton-bg); }
.mo-skel-header { height: 90px; border-radius: var(--radius-sm); background: var(--skeleton-bg); }

/* Not-found gate (New-UI only, deviation 1) — mirrors .sv-not-found on the sibling page. */
.mo-not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.mo-not-found-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.mo-not-found-back { height: 34px; padding: 0 16px; border-radius: 8px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.mo-not-found-back:hover { background: var(--chip-bg-hi); }

/* ── Top bar (scss:298-311) ── */
.sv-detail-bar { padding: 16px 32px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--divider); }
.sv-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px 6px 8px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted); font: inherit; font-size: 12px; cursor: pointer; }
.sv-back-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-last-updated { font-size: 12px; color: var(--fg-muted); }

/* ── Two-column skeleton (scss:313-345) ── The scrollbar repaint at scss:346-365 is deliberately
   not ported, for the reason already recorded at the same rules in PhotosSmartViewDetail.vue. */
.sv-detail-layout { display: grid; grid-template-columns: 1fr 320px; flex: 1 1 auto; min-height: 0; }
.sv-detail-main { min-width: 0; overflow-y: auto; padding-bottom: 60px; }
.sv-detail-side {
  border-left: 1px solid var(--divider); background: var(--panel-bg);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}

/* ── Header (scss:210-253 via PhotosSmartViewDetail) ── */
.sv-header { padding: 24px 32px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.sv-header h1 { font-family: var(--font-display, var(--font)); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--fg); }
.sv-header-conds { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; align-items: center; min-height: 4px; }
.sv-cond { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; background: var(--chip-bg); color: var(--fg-muted); font-size: 11.5px; }
/* Amber type pill (scss:271-278). Vue 2 wrote an amber literal for both the tint and the text;
   this repo forbids bare colour literals, so it reuses the existing --warn-bg / --warn-fg pair
   (theme.css has values for both in both themes) — same substitution MomentCard.vue made in T4.
   The compound selector keeps it ahead of the plain .sv-cond above without !important. */
.sv-cond.mo-type-pill { background: var(--warn-bg); color: var(--warn-fg); font-weight: 600; }
.sv-header-stats { display: flex; gap: 20px; font-size: 12px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.sv-header-stats b { color: var(--fg); font-weight: 600; }
/* Vue 2 :24 wrote an inline green literal here; --success is this repo's token for it, same
   substitution as MomentCard.vue:209. */
.mo-week-badge { color: var(--success); }

/* ── Sidebar sections (scss:748-756, :846-877) — rule bodies identical to
   SmartViewSidePanel.vue's, which ported the same source. ── */
.sv-side-section { margin-bottom: 24px; }
.sv-side-section h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--fg-faint); margin: 0 0 10px;
}

/* About key/value rows (scss:281-289). The hairline is --divider. */
.mo-about-row {
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  font-size: 12.5px; color: var(--fg-muted); padding: 7px 0;
  border-bottom: 1px solid var(--divider);
}
.mo-about-row:last-child { border-bottom: 0; }
.mo-about-row b { color: var(--fg); font-weight: 600; text-align: right; }

.sv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sv-stat-cell { background: var(--chip-bg); padding: 10px 12px; border-radius: 8px; }
.sv-stat-cell .v { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--fg); }
.sv-stat-cell .l { font-size: 11px; color: var(--fg-faint); margin-top: 2px; }

.sv-distribution { height: 56px; display: flex; align-items: flex-end; gap: 2px; margin-top: 8px; }
.sv-dist-bar {
  flex: 1; min-width: 4px; border-radius: 2px 2px 0 0;
  /* Vue 2 scss:866-871 gradients from accent to a hard-coded pale violet; two steps of the
     accent family stand in for it, as SmartViewSidePanel.vue:274 already does. */
  background: linear-gradient(to top, var(--accent), var(--accent-text));
}
.sv-dist-x { display: flex; justify-content: space-between; font-size: 10px; color: var(--fg-subtle); margin-top: 4px; }

/* ≤768px: the sidebar is already a drawer, so the two columns collapse and the right rail drops
   below the content — same treatment as PhotosSmartViewDetail.vue. */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .sv-detail-layout { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--divider); }
}
</style>
