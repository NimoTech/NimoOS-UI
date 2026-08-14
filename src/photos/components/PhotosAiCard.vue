<!--
  SP7-P8a-T4: Settings page AI card.
  Source coordinates: Vue2 PhotosSettings.vue:129-192 (template), :283-291 (rebuildTask watcher),
  :332-370 (rebuildTask/indexing/indexedPct/coverageCount/lastBuiltText/featureRows),
  :458-486 (rebuildIndex/doRecluster).

  Card does not emit toast itself — @toast unified by T5 container, same division of labor as PhotosStorageCard.vue (T3).

  Interface boundary notes (for T5 implementer):
  - `about` not fetched in this card by fetchAbout() — reuse T3's division of labor, T5 container fetches once unified.
    Before fetch completes, lastBuiltText shows 'never', coverageCount shows 0 (see computed below).
  - `rebuildTask` read from timeline store's `tasks`, card does not start separate task polling
    (consistent with settings.ts header comment "useTimelineStore() must be called inside setup").

  Deviation logging (per project rule "Vue2's bugs not copied, correct logic and comment logging"):
  1. lastBuiltText locale defect — Vue2 :346 `new Date(iso).toLocaleString()` does not pass
     locale parameter, result follows browser/system language not app's chosen language, Chinese UI shows English month abbreviations
     (same defect type as spec §7c-2/§7e-4). Changed to explicitly follow i18n locale (adopting
     src/photos/util/relTime.ts:18-22, PlacesRail.vue:84, PlaceDetailPanel.vue:120,
     PersonHero.vue:113 existing pattern: locale.replace('_','-') convert to BCP-47 tag, pass to
     Intl.DateTimeFormat). Retained toLocaleString()'s "date+time" semantics (not
     toLocaleDateString()'s date-only), so Intl options include hour/minute.
  2. rebuildTask's "state change" criteria (:283-284) — only when old.status==='running' &&
     new.status==='done' emit "rebuilt" toast, not "current state is done emit". Copy this state change
     criteria, else each task list refresh (polling/deep link open) repeats same toast.

  Color tokens: card adds zero new tokens — all reuse existing semantic tokens (--accent/--accent2/
  --accent-soft/--sem-bg/--sem-fg/--sem-bd/--chip-bg/--chip-bg-hi/--border/--fg/
  --on-accent/--divider/--fg-muted). Privacy banner original color Vue2 is exact iOS green
  rgba(52,199,89,α)/#34C759, but this repo has generic "success/positive" semantic token --sem-*
  (success badges, RAID health state used multiple places, hue is teal-green not Apple green) — following T3's precedent
  of mapping Vue2 literal #6E5BFF closest to existing --accent-soft/--accent without adding token,
  here similarly map to existing --sem-* triplet, not reinventing nearly-duplicate token for same "success/safety" semantic.
  Progress bar gradient original Vue2 is linear-gradient(#6E5BFF,#B8AAFF), here use
  linear-gradient(var(--accent), var(--accent2)) replicate "accent gradient" appearance, similarly no new tokens.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePhotosSettingsStore, type PhotosAiFeatures } from '../stores/settings'
import { useTimelineStore } from '../stores/timeline'

const emit = defineEmits<{ toast: [{ icon: string; text: string }] }>()

const { t, locale } = useI18n()
const store = usePhotosSettingsStore()
const timeline = useTimelineStore()

// Vue2 PhotosSettings.vue:363-369 — order fixed: faces → scenes → ocr → smartview.
const featureRows = computed(() => [
  { id: 'faces' as const, label: t('photosSettingsFeatFaces'), desc: t('photosSettingsFeatFacesDesc') },
  { id: 'scenes' as const, label: t('photosSettingsFeatScenes'), desc: t('photosSettingsFeatScenesDesc') },
  { id: 'ocr' as const, label: t('photosSettingsFeatOcr'), desc: t('photosSettingsFeatOcrDesc') },
  { id: 'smartview' as const, label: t('photosSettingsFeatSmartview'), desc: t('photosSettingsFeatSmartviewDesc') },
])

async function toggleFeature(id: keyof PhotosAiFeatures): Promise<void> {
  const next = !store.aiFeatures[id]
  const ok = await store.setAiFeature(id, next)
  if (!ok) {
    emit('toast', { icon: 'shield', text: t('photosSettingsFeatSaveFailed') })
  }
}

// Vue2 :332-337 — rebuildTaskId locally remembered task takes priority, if not found then find any task with type==='rebuild',
// if not found then null. id iron law: backend id may be string|number, uniformly convert to String for comparison
// (same precedent as PlacesRail.vue "id iron law").
const rebuildTaskId = ref('')
const rebuildTask = computed(() => {
  const tasks = timeline.tasks
  const byId = rebuildTaskId.value
    ? tasks.find(x => String(x.id) === rebuildTaskId.value)
    : undefined
  return byId ?? tasks.find(x => x.type === 'rebuild') ?? null
})

// Vue2 :338 — indexing = has rebuildTask and status is running.
const indexing = computed(() => rebuildTask.value?.status === 'running')
// Vue2 :339 — backend progress is 0-1 decimal, not percentage, so *100 then round.
const indexedPct = computed(() => Math.round(((rebuildTask.value?.progress) || 0) * 100))
// Vue2 :340 — coverageCount from about.indexCoverage, before fetch (null) fallback to 0.
const coverageCount = computed(() => store.about?.indexCoverage ?? 0)

// Vue2 :341-351, deviation logging see file header comment 1.
const lastBuiltText = computed(() => {
  const iso = store.about?.indexLastBuilt
  if (!iso) return t('photosSettingsIndexNever')
  try {
    const tag = locale.value.replace('_', '-')
    return new Intl.DateTimeFormat(tag, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    // Vue2 :348-350 catch branch similarly falls back to raw iso string.
    return iso
  }
})

// Vue2 :283-291 — only emit "rebuilt" toast + refetch about on running→done state change;
// error state emits failure toast (state change not required, consistent with source). Deviation logging see file header comment 2.
watch(rebuildTask, (task, old) => {
  if (old && old.status === 'running' && task && task.status === 'done') {
    const base = t('photosSettingsRebuiltToast')
    emit('toast', { icon: 'sparkles', text: task.total ? `${base} · ${task.total}` : base })
    void store.fetchAbout()
  }
  if (task && task.status === 'error') {
    const base = t('photosSettingsRebuildFailed')
    emit('toast', { icon: 'shield', text: task.error ? `${base}: ${task.error}` : base })
  }
})

// Vue2 :458-473 — settings.ts's rebuildIndex() already handles 409 (refresh task list once and
// return running task's id), here only handle "non-409 failure" branch.
async function doRebuild(): Promise<void> {
  if (indexing.value) return
  try {
    rebuildTaskId.value = await store.rebuildIndex()
  } catch {
    emit('toast', { icon: 'shield', text: t('photosSettingsRebuildStartFailed') })
  }
}

// Vue2 :474-486 — success/failure both re-enable in finally after 3s, prevent rapid clicks.
const reclustering = ref(false)
async function doRecluster(): Promise<void> {
  if (reclustering.value) return
  reclustering.value = true
  try {
    await store.reclusterFaces()
    emit('toast', { icon: 'sparkles', text: t('photosSettingsReclusterStarted') })
  } catch {
    emit('toast', { icon: 'shield', text: t('photosSettingsReclusterFailed') })
  } finally {
    setTimeout(() => { reclustering.value = false }, 3000)
  }
}
</script>

<template>
  <section class="aic-card" id="ai">
    <header class="aic-head">
      <div class="aic-icon">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
      </div>
      <div>
        <h2 class="aic-title">{{ t('photosSettingsAiTitle') }}</h2>
        <div class="aic-sub">{{ t('photosSettingsAiSubtitle') }}</div>
      </div>
    </header>

    <div class="aic-privacy" data-test="privacy-banner">
      <div class="aic-privacy-icon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
      </div>
      <div>
        <div class="aic-privacy-title">{{ t('photosSettingsPrivacyTitle') }}</div>
        <div class="aic-privacy-body">{{ t('photosSettingsPrivacyBody') }}</div>
      </div>
    </div>

    <div class="aic-divider"></div>

    <h3 class="aic-subhead">{{ t('photosSettingsFeaturesTitle') }}</h3>
    <p class="aic-subhead-desc">{{ t('photosSettingsFeaturesDesc') }}</p>
    <div class="aic-features">
      <label v-for="f in featureRows" :key="f.id" class="aic-feature">
        <div class="aic-feature-text">
          <div class="lbl">{{ f.label }}</div>
          <div class="desc">{{ f.desc }}</div>
        </div>
        <!-- final review Minor 6: a11y debt logging — this switch only handles mouse click, no tabindex/keydown,
             keyboard/AT users cannot reach it. Vue2 PhotosSettings.vue:163 is bare div, no role; previously added
             role="switch" here but no keyboard accessibility support, equals telling AT "this is an operable control"
             but cannot operate, worse than saying nothing. Per decision remove role, no keyboard handling added,
             first restore bare div 1:1 from Vue2 — making entire settings page keyboard-navigable is independent
             work outside this cycle scope. -->
        <div
          class="st-switch" :data-on="store.aiFeatures[f.id]" :data-test="`ai-switch-${f.id}`"
          :aria-checked="store.aiFeatures[f.id]" :aria-label="f.label"
          @click="toggleFeature(f.id)"
        ></div>
      </label>
    </div>

    <div class="aic-divider"></div>

    <h3 class="aic-subhead">{{ t('photosSettingsIndexTitle') }}</h3>
    <div class="aic-row" style="padding-top:6px">
      <div class="aic-row-text">
        <div class="aic-row-label" v-if="indexing">{{ t('photosSettingsIndexRebuilding') }}</div>
        <div class="aic-row-label" v-else>{{ t('photosSettingsIndexLastBuilt') }} {{ lastBuiltText }}</div>
        <div class="aic-row-desc">
          <template v-if="indexing">{{ t('photosSettingsIndexPct', { pct: indexedPct }) }}</template>
          <template v-else>{{ t('photosSettingsIndexCoverage', { count: coverageCount }) }}</template>
        </div>
        <div v-if="indexing" class="aic-progress" data-test="index-progress"><div :style="{ width: indexedPct + '%' }"></div></div>
      </div>
      <button type="button" class="aic-btn" data-test="rebuild-index" :disabled="indexing" @click="doRebuild">
        <span v-if="indexing" class="aic-spinner"></span>
        <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
        {{ indexing ? t('photosSettingsIndexRebuilding') : t('photosSettingsRebuildIndex') }}
      </button>
      <button type="button" class="aic-btn" data-test="recluster" :disabled="reclustering" @click="doRecluster" style="margin-left:8px">
        <span v-if="reclustering" class="aic-spinner"></span>
        <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
        {{ t('photosSettingsRecluster') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.aic-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--card-shadow);
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
}

.aic-head { display: flex; align-items: flex-start; gap: 12px; }

.aic-icon {
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

.aic-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); }
.aic-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }

.aic-privacy {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  background: var(--sem-bg);
  border: 1px solid var(--sem-bd);
  border-radius: 10px;
  margin: 14px 0 4px;
}
.aic-privacy-icon {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  margin-top: 1px;
  border-radius: 7px;
  background: var(--sem-bd);
  color: var(--sem-fg);
  display: flex;
  align-items: center;
  justify-content: center;
}
.aic-privacy-title { font-size: 12.5px; font-weight: 600; color: var(--sem-fg); margin-bottom: 4px; }
.aic-privacy-body { font-size: 11.5px; color: var(--fg-muted); line-height: 1.5; }

.aic-divider { height: 1px; background: var(--divider); margin: 16px 0; }

.aic-subhead { font-size: 14px; font-weight: 600; color: var(--fg); margin: 0 0 4px; }
.aic-subhead-desc { font-size: 11.5px; color: var(--fg-muted); line-height: 1.45; margin: 0 0 10px; max-width: 540px; }

.aic-features { display: flex; flex-direction: column; }
.aic-feature { display: flex; align-items: center; gap: 18px; padding: 11px 0; border-bottom: 1px solid var(--divider); cursor: pointer; }
.aic-feature:last-child { border-bottom: 0; }
.aic-feature-text { flex: 1; }
.aic-feature-text .lbl { font-size: 13px; color: var(--fg); font-weight: 500; }
.aic-feature-text .desc { font-size: 11.5px; color: var(--fg-muted); margin-top: 2px; line-height: 1.4; }

/* switch: follow this repo's existing conventions (settings/styles/settings.css .set-switch,
   SnapshotSettingsDialog.vue .ss-switch) — off state outline+chip bg, on state solid accent,
   thumb off state --fg, on state --on-accent ("only usable over solid accent", this is that case). */
.st-switch {
  position: relative;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--chip-bg);
  cursor: pointer;
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.st-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--fg);
  transition: left 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.15s var(--ease);
}
.st-switch[data-on="true"] { background: var(--accent); border-color: var(--accent); }
.st-switch[data-on="true"]::after { left: 18px; background: var(--on-accent); }
.st-switch:hover { background: var(--chip-bg-hi); }
/* This area's four-times trap: base class `.st-switch:hover` (specificity 2) and variant
   `.st-switch[data-on="true"]` (specificity 2) equal weight — mouse enters switch, without dedicated
   `[data-on]:hover` rule, which of two equal-specificity rules wins degrades to "whoever's written later in source",
   not "variant should maintain its own solid bg". Use third selector explicitly raise specificity to 3,
   on-state switch on hover maintains accent solid bg, not overridden by base class's hover bg. */
.st-switch[data-on="true"]:hover { background: var(--accent); border-color: var(--accent); }

.aic-row { display: flex; align-items: center; gap: 16px; }
.aic-row-text { flex: 1; min-width: 0; }
.aic-row-label { font-size: 13px; font-weight: 500; color: var(--fg); }
.aic-row-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }

.aic-progress { height: 4px; border-radius: 99px; background: var(--divider); margin-top: 8px; overflow: hidden; }
.aic-progress > div { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); transition: width 0.2s ease; }

.aic-btn {
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
.aic-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
.aic-btn:disabled { opacity: 0.5; cursor: default; }
.aic-btn svg { flex-shrink: 0; }

.aic-spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--chip-border);
  border-top-color: var(--accent);
  animation: aic-spin 0.8s linear infinite;
}
@keyframes aic-spin { to { transform: rotate(360deg); } }
</style>
