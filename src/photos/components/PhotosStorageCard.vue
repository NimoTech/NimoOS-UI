<!--
  SP7-P8a-T3: Settings page storage card.
  Source coordinates: Vue2 PhotosSettings.vue:39-126 (template), :299-331 (capGB/freeGB/usedGB/
  prunableBytes/scanIntervalOptions/breakdown/pctOf), :382 (fmt), :405-457
  (fmtBytes/clearCache/rescanNow/setScanInterval).

  Card doesn't emit toast itself — @toast event is uniformly received by the container (T5);
  same as Vue2 placing toast state in the container PhotosSettings.vue, showToast() defined at
  :487-491.

  Interface boundary record (brief's Consumes list doesn't name these, explicitly registered here
  for T5/T4 implementers):
  - `about`/`deviceName` read directly from store.about?.deviceName, card doesn't call fetchAbout()
    — in Vue2 mounted(), loadAbout() and loadStorage() are two parallel calls in the same component;
    after splitting, "who fetches about" has no mandatory owner; by sister component (T5 container,
    footer also needs about.version) fetching once together saves one network round-trip. Before data
    completes, show Vue2's same fallback 'NAS'.
  - retentionDays/scanIntervalMinutes similarly not called via fetchRetention()/fetchScanInterval()
    in this card (brief's Consumes list doesn't name these two action names) — assume T5 fetches once
    when mounting the whole page; before that read store defaults (30/1440); after data lands, update
    reactively with store.
  - fetchStorage() **is** named in Consumes list, so card calls it once on mounted (corresponds to
    Vue2's loadStorage()), does not depend on T5.
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePhotosSettingsStore } from '../stores/settings'
import { fmtGB, fmtBytes, buildBreakdown, type StorageSegKey } from '../util/storagePalette'

const emit = defineEmits<{ toast: [{ icon: string; text: string }] }>()

const { t } = useI18n()
const store = usePhotosSettingsStore()

const deviceName = computed(() => store.about?.deviceName || 'NAS')

const capGB = computed(() => (store.storage ? store.storage.diskTotalBytes / 1024 ** 3 : 0))
const freeGB = computed(() => (store.storage ? store.storage.diskFreeBytes / 1024 ** 3 : 0))
const usedGB = computed(() => Math.max(0, capGB.value - freeGB.value))
const prunableBytes = computed(() => store.storage?.prunableBytes ?? 0)
const breakdown = computed(() => (store.storage ? buildBreakdown(store.storage, usedGB.value) : []))
function pctOf(gb: number): number {
  return capGB.value > 0 ? (gb / capGB.value) * 100 : 0
}

const SEG_LABEL_KEYS: Record<StorageSegKey, string> = {
  photos: 'photosSettingsSegPhotos',
  videos: 'photosSettingsSegVideos',
  raw: 'photosSettingsSegRaw',
  thumbs: 'photosSettingsSegThumbs',
  ai: 'photosSettingsSegAi',
  other: 'photosSettingsSegOther',
}

const RETENTION_OPTIONS = [7, 15, 30, 60, 90] as const

// Vue2 PhotosSettings.vue:304-311's scanIntervalOptions: the four labels 6h/12h/24h/7d are bare
// literals in source, never pass through $t (only the off tier goes through $t('scan_interval_off'))
// — they are time-unit abbreviations (hours/days), not natural language sentences that need
// language translation; copied as literals, no new i18n keys added/reused (task-3-brief.md ruling #1).
//
// Final review Minor 7 (behavior unchanged, just registering): retention (:186,
// photosSettingsRetentionDay) translates to '{n} days', but here the scan interval tiers keep
// 6h/12h/24h/7d literals — in zh these two adjacent segment controls therefore read one as
// '7 days | 15 days | 30 days …' and the other as 'off | 6h | 12h | 24h | 7d'; Vue2 originally
// had consistent internal style in both groups (both 7d.../Off 6h... literals). Both approaches
// make sense individually (retention via $t is this phase's deliberate choice, see previous comment
// chain; scan keeping unit abbreviations also has its reason), but adjacent inconsistency itself
// was never registered — writing here for record, is a decision not an oversight. Whether to unify
// is left for the operator to decide on live acceptance (not in this wave's fix scope).

const scanIntervalOptions = computed(() => [
  { min: 0, label: t('photosSettingsScanIntervalOff') },
  { min: 360, label: '6h' },
  { min: 720, label: '12h' },
  { min: 1440, label: '24h' },
  { min: 10080, label: '7d' },
])

async function selectRetention(d: number): Promise<void> {
  const ok = await store.setRetention(d)
  if (!ok) {
    // Vue2's :254-262 retention watcher failure goes through $buefy.toast (completely different
    // from this card's showToast component, New-UI has no equivalent), not a showToast(icon,...)
    // call, so there's no icon name to copy from source. By semantic analogy to the closest existing
    // showToast call — ":274-279" features save failure is also a 'settings save failed' scenario,
    // uses 'shield' — here also use 'shield'.
    emit('toast', { icon: 'shield', text: t('photosSettingsRetentionFailed') })
  }
}

async function selectScanInterval(min: number): Promise<void> {
  const ok = await store.setScanInterval(min)
  if (!ok) {
    // Vue2's :447-457 failure branch also goes through $buefy.toast; text also reuses retention's
    // 'Failed to save retention' (copy error, not a new defect introduced by this card). T2 didn't
    // create a dedicated failure text key for scanInterval; this task's file list doesn't include
    // i18n (can't add/change keys); so use the same existing key, keeping consistent with Vue2's
    // actual text choice — the real fix is adding a dedicated i18n key, deferring to later tasks.

    emit('toast', { icon: 'shield', text: t('photosSettingsRetentionFailed') })
  }
}

const busy = ref(false)
const cleared = ref(false)
let clearedTimer: ReturnType<typeof setTimeout> | undefined

async function clearCache(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const freed = await store.pruneCache()
    cleared.value = true
    emit('toast', { icon: 'trash', text: t('photosSettingsCacheClearedToast', { size: fmtBytes(freed) }) })
    // Vue2 :423 — must refetch storage after clearing, otherwise capacity bar/large numbers won't
    // reflect the freed space.
    await store.fetchStorage()
    clearTimeout(clearedTimer)
    clearedTimer = setTimeout(() => { cleared.value = false }, 2000)
  } catch {
    emit('toast', { icon: 'trash', text: t('photosSettingsCacheClearFailed') })
  } finally {
    busy.value = false
  }
}

const scanBusy = ref(false)
async function rescanNow(): Promise<void> {
  if (scanBusy.value) return
  scanBusy.value = true
  try {
    await store.triggerScan()
    emit('toast', { icon: 'check', text: t('photosSettingsRescanStarted') })
  } catch {
    // Vue2 :441 same copy defect ('Failed to start rebuild', not dedicated to rescan text); reason
    // same as selectScanInterval comment above — use the existing key from Vue2's actual choice,
    // no new key added.
    emit('toast', { icon: 'trash', text: t('photosSettingsRebuildStartFailed') })
  } finally {
    scanBusy.value = false
  }
}

onMounted(() => {
  void store.fetchStorage()
})
</script>

<template>
  <section class="psc-card" id="storage">
    <header class="psc-head">
      <div class="psc-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <circle cx="7" cy="14" r="1" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div>
        <h2 class="psc-title">{{ t('photosSettingsStorage') }}</h2>
        <div class="psc-sub">{{ deviceName }} &middot; {{ fmtGB(capGB) }} GB {{ t('photosSettingsVolume') }}</div>
      </div>
      <div class="psc-spacer"></div>
      <div class="psc-headline" data-test="storage-headline">
        <div v-if="store.storage" class="big">{{ fmtGB(freeGB) }} GB <span>{{ t('photosSettingsFree') }}</span></div>
        <div v-else class="big">&mdash;</div>
        <div v-if="store.storage" class="sub">{{ fmtGB(usedGB) }} GB {{ t('photosSettingsUsedOf') }} {{ fmtGB(capGB) }} GB</div>
        <div v-else-if="store.storageError" class="sub">{{ t('photosSettingsStorageUnavailable') }}</div>
      </div>
    </header>

    <div class="psc-bar">
      <div
        v-for="seg in breakdown" :key="seg.key" class="psc-bar-seg" data-test="bar-seg"
        :title="`${t(SEG_LABEL_KEYS[seg.key])} · ${fmtGB(seg.gb)} GB`"
        :style="{ width: pctOf(seg.gb) + '%', background: seg.color }"
      ></div>
      <div class="psc-bar-free" data-test="bar-free" :style="{ width: pctOf(freeGB) + '%' }"></div>
    </div>
    <div class="psc-legend">
      <div v-for="seg in breakdown" :key="seg.key" class="psc-legend-row">
        <span class="dot" :style="{ background: seg.color }"></span>
        <span class="lbl">{{ t(SEG_LABEL_KEYS[seg.key]) }}</span>
        <span class="val">{{ fmtGB(seg.gb) }} GB</span>
      </div>
      <div class="psc-legend-row">
        <span class="dot psc-dot-free"></span>
        <span class="lbl">{{ t('photosSettingsSegFree') }}</span>
        <span class="val">{{ fmtGB(freeGB) }} GB</span>
      </div>
    </div>

    <div class="psc-divider"></div>

    <div class="psc-row">
      <div class="psc-row-text">
        <div class="psc-row-label">{{ t('photosSettingsRetentionLabel') }}</div>
        <div class="psc-row-desc">{{ t('photosSettingsRetentionDesc') }}</div>
      </div>
      <div class="psc-seg" data-test="retention-seg">
        <button
          v-for="d in RETENTION_OPTIONS" :key="d" type="button" class="seg-btn"
          :data-active="store.retentionDays === d" @click="selectRetention(d)"
        >{{ t('photosSettingsRetentionDay', { n: d }) }}</button>
      </div>
    </div>

    <div class="psc-row">
      <div class="psc-row-text">
        <div class="psc-row-label">{{ t('photosSettingsRescanLabel') }}</div>
        <div class="psc-row-desc">{{ t('photosSettingsRescanDesc') }}</div>
      </div>
      <button type="button" class="psc-btn" data-test="rescan-now" :disabled="scanBusy" @click="rescanNow">
        <span v-if="scanBusy" class="psc-spinner"></span>
        {{ scanBusy ? t('photosSettingsRescanning') : t('photosSettingsRescanNow') }}
      </button>
    </div>

    <div class="psc-row">
      <div class="psc-row-text">
        <div class="psc-row-label">{{ t('photosSettingsScanIntervalLabel') }}</div>
        <div class="psc-row-desc">{{ t('photosSettingsScanIntervalDesc') }}</div>
      </div>
      <div class="psc-seg" data-test="scan-seg">
        <button
          v-for="opt in scanIntervalOptions" :key="opt.min" type="button" class="seg-btn"
          :data-active="store.scanIntervalMinutes === opt.min" @click="selectScanInterval(opt.min)"
        >{{ opt.label }}</button>
      </div>
    </div>

    <div class="psc-row">
      <div class="psc-row-text">
        <div class="psc-row-label">{{ t('photosSettingsCacheLabel') }}</div>
        <div class="psc-row-desc">{{ t('photosSettingsCacheDesc') }}</div>
      </div>
      <button type="button" class="psc-btn" data-test="clear-cache" :disabled="busy || !prunableBytes" @click="clearCache">
        <svg v-if="!busy && !cleared" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
        <span v-if="busy" class="psc-spinner"></span>
        <svg v-if="cleared" class="psc-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        {{ busy ? t('photosSettingsClearing') : cleared ? t('photosSettingsCleared') : `${t('photosSettingsClearCache')} (${fmtBytes(prunableBytes)})` }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.psc-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--card-shadow);
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
}

.psc-head { display: flex; align-items: flex-start; gap: 12px; }

.psc-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
}

.psc-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); }
.psc-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
.psc-spacer { flex: 1; }

.psc-headline { text-align: right; }
.psc-headline .big { font-size: 20px; font-weight: 600; color: var(--fg); font-family: var(--num-font); }
.psc-headline .big span { font-size: 12px; font-weight: 400; color: var(--fg-muted); margin-left: 4px; }
.psc-headline .sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }

.psc-bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--divider);
  margin-top: 14px;
}
.psc-bar-seg { height: 100%; }
.psc-bar-free { height: 100%; background: var(--divider); }

.psc-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; }
.psc-legend-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.psc-dot-free { background: var(--divider); border: 1px solid var(--card-border); }
.val { color: var(--fg); font-weight: 500; }

.psc-divider { height: 1px; background: var(--divider); margin: 16px 0; }

.psc-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; }
.psc-row-label { font-size: 13px; font-weight: 500; color: var(--fg); }
.psc-row-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; max-width: 360px; }

.psc-seg {
  display: inline-flex;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.seg-btn {
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.seg-btn:hover { background: var(--chip-bg-hi); }
.seg-btn[data-active="true"] { background: var(--accent); color: var(--on-accent); }
/* Pit already stumbled into four times in this area: base class `.seg-btn:hover` (specificity 2:
   one class + one pseudo-class) and variant `.seg-btn[data-active="true"]` (specificity 2: one
   class + one attribute selector) are equal — at the same specificity, the [data-active] rule
   declared after .seg-btn:hover in source order can normally win, but when mouse enters the button
   and triggers `.seg-btn:hover`, without a dedicated [data-active]:hover rule, the outcome of two
   same-specificity rules becomes fragile (depends on source order, not semantics). Variant must
   carry its own :hover rule, use a third selector to explicitly raise specificity to 3, not rely
   on tie-break. */
.seg-btn[data-active="true"]:hover { background: var(--accent); color: var(--on-accent); }

.psc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--card-border);
  background: var(--chip-bg);
  color: var(--fg);
  font-size: 12px;
  padding: 7px 12px;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}
.psc-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
.psc-btn:disabled { opacity: 0.5; cursor: default; }
.psc-btn svg { flex-shrink: 0; }
.psc-check { color: var(--success); }

.psc-spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--chip-border);
  border-top-color: var(--accent);
  animation: psc-spin 0.8s linear infinite;
}
@keyframes psc-spin { to { transform: rotate(360deg); } }
</style>
