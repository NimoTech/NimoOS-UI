<script setup lang="ts">
// SP7-P7a-T14: SearchSaveSmartView.vue —— search page "Save as smart view" overlay (D12 real wiring).
// Structure corresponds to Vue2 PhotosSearchView.vue:159-210 (template, excludes :153-158 trigger button .save-smart ——
// that button not part of this task, handed to T16, see handoff note at end of file), :798-804 (openSave reset logic),
// :806-812 (confirmSave, but Vue2 version is fake —— only sets local state + toast, zero store/service calls;
// D12 requires this task to wire it as real createSmartView call). Styles correspond to photos.scss:2795-2815
// (.save-pop* full group, checked line by line) + C5 ruling on .sv-switch/.sv-btn-ghost/.sv-btn-primary (takes
// higher priority from photos-smartview.scss, maintains same values as T5/T8 existing implementation, doesn't copy
// suppressed values from photos.scss:2817-2825).
//
// Persistent mount + prop show/hide (unlike T13 relying on host v-if remount to reset internal state) —— C13
// ruled intentional difference: this component same as T5's SmartViewCreateDialog, uses watch(() => props.open) to reset,
// not onMounted (persistent mount pitfall, same as T5 file header comment).
//
// fix round 1 · I1 (review-verified missed rendering): Vue2 `mounted()` `_onDoc` (full :819-832,
// condition for this overlay at :820-822) is a `mousedown` condition ——
// `pop && !pop.contains(target) && btn && !btn.contains(target)` to close,
// `pop` is `savePop` (this component's root), `btn` is `saveBtn` (trigger button, T16/C6). Before only
// implemented document-level Esc, missed this half. Added here: bind root to `rootRef`, add optional prop
// `ignoreEl` (host passes `.save-smart` trigger button element, defaults to `null`) —— condition becomes
// "close if both root container and ignoreEl don't contain target", corresponds exactly to Vue2; without `ignoreEl`
// degrades to "only check root container" (still works, but clicking trigger button gets judged as "outside" causing false close ——
// this side effect only occurs when host doesn't pass `ignoreEl`, noted in report handoff that T16 must pass it).
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePhotosSmartViews } from '../stores/smartViews'
import { useToast } from '../../stores/toast'
import PhotosThreshSlider from './PhotosThreshSlider.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    query: string
    conditions: string[]
    defaultName: string
    ignoreEl?: HTMLElement | null
  }>(),
  { ignoreEl: null },
)

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  // fix wave F1: add extra name parameter —— host (PhotosSearch.vue) needs it to compose success toast copy
  // "{name} saved as smart view" (copied from Vue2 confirmSave() saveToast = { name }, :806-812),
  // previously only passed id, host couldn't get the name.
  (e: 'saved', id: string, name: string): void
}>()

const { t } = useI18n()
const store = usePhotosSmartViews()
const toast = useToast()

const name = ref('')
// Default threshold 75 (matches Vue2 openSave :801), different from T5 create dialog's default 80 ——
// verified carefully, not a copy mistake (brief structure spec clause 6 explicitly states this difference).
const thresh = ref(75)
const live = ref(true)
const nameInputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)

function close(): void {
  emit('update:open', false)
}

// Overlay Esc uses document-level listener + watch(open) to attach/detach (Global Constraints
// "overlay Esc always document-level listener"). This component does no early return in onDocKeydown,
// doesn't call stopPropagation —— search page may have filter overlay and this overlay open simultaneously,
// both handlers process same Escape press independently without interference (P5-T10 lesson: early return/blocking
// prevents other layer from receiving event).
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  close()
}

// fix round 1 · I1 (fix round 2 · N1 corrected label): close on outside mousedown (copies Vue2 `_onDoc`
// save overlay half of condition —— savePop/saveBtn contains check, :820-822; people/filterbar half
// at :824-830, not this component's concern).
// Condition is "close if both root container and ignoreEl don't contain target" —— must complete both `contains`
// calls before deciding, not written as "check first one, early return if match" pattern (Global Constraints
// "no early return in onDocMousedown", P5-T10 real bug was this early return missing second branch check in
// multi-layer shared condition function; this function only serves one overlay, still follow same discipline
// "complete both conditions before deciding", avoiding future landmine when copied to multi-layer scenario).
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  const insideRoot = rootRef.value !== null && rootRef.value.contains(target)
  const insideIgnore = props.ignoreEl !== null && props.ignoreEl.contains(target)
  if (!insideRoot && !insideIgnore) close()
}

// Controller addition (C13): when open becomes true, reset name/thresh/live + focus, must be in
// watch(() => props.open), cannot use onMounted —— this component always mounted, relies on prop to show/hide,
// onMounted only runs once at component creation.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      name.value = props.defaultName
      thresh.value = 75
      live.value = true
      document.addEventListener('keydown', onDocKeydown)
      document.addEventListener('mousedown', onDocMousedown)
      void nextTick(() => {
        nameInputRef.value?.focus()
        nameInputRef.value?.select()
      })
    } else {
      document.removeEventListener('keydown', onDocKeydown)
      document.removeEventListener('mousedown', onDocMousedown)
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('mousedown', onDocMousedown)
})

function onThreshInput(v: number): void {
  thresh.value = v
}

function toggleLive(): void {
  live.value = !live.value
}

// D12 real wiring (C8): Vue2 confirmSave (:806-812) only sets saved=true + writes unreferenced savedSv +
// shows "saved" toast, zero store/service calls —— this button is fake in Vue2. Here actually calls createSmartView,
// and must wrap in try/catch (store.createSmartView throws on failure, brief structure spec 7 code snippet missed this layer).
//
// description: mapping rationale for props.query.trim() || undefined (brief structure spec 7 gave inference,
// restated here): Vue2 savedSv stores { query, filters }, while backend createSmartView semantics is
// "use description as semantic fallback when conds empty" (Vue2 PhotosSmartViewsView.vue:426 comment).
// Original query string into description is the only defensible mapping between these two contracts.
//
// fix round 1 · M5: trim + `|| undefined` cannot be omitted —— `CreateSmartViewInput.description?`
// established semantics is "empty description don't send field" (T5 SmartViewCreateDialog.vue confirm() same protocol,
// `draft.desc.trim() || undefined`), passing `props.query` directly on empty query would send empty string field
// instead of "don't send", inconsistent with another caller of same store.
//
// createBusy boundary returning early (C8 registration): primary button already
// `:disabled="!name.trim() || store.createBusy"`, this path basically unreachable, no extra UI,
// only registered here in comment —— same boundary handling protocol as T5/T6.
async function confirm(): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed || store.createBusy) return
  try {
    const created = await store.createSmartView({
      name: trimmed,
      description: props.query.trim() || undefined,
      conds: [...props.conditions],
      threshold: thresh.value,
      live: live.value,
      includeVideos: false,
    })
    if (created) {
      emit('saved', created.id, trimmed)
      emit('update:open', false)
    }
  } catch (e) {
    console.error('[search-save-smart-view] confirm', e)
    // Reuses existing generic key (same as T5 SmartViewCreateDialog.vue choice), this task doesn't add new i18n keys.
    toast.show(t('photosAlbumCreateFailed'))
  }
}
</script>

<template>
  <Transition name="save-pop">
    <div v-if="open" ref="rootRef" class="save-pop" data-test="ssv-root">
      <!-- Deviation registration (fix round 1 · M8): these three svgs' `stroke-width="2"` is additive change
           relative to Vue2 `PhotosIcon.vue` default 1.6 (:185) —— Vue2 template these three `<photos-icon>` calls
           don't pass `stroke-width`, using default 1.6. Here reuses same choice established in T5
           SmartViewCreateDialog.vue (that file's similar inline svgs all stroke-width="2", not this task's new pick),
           registered here per discipline. -->
      <div class="save-pop-head">
        <div class="save-pop-icon">
          <svg
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
        </div>
        <div class="save-pop-head-text">
          <div class="save-pop-title">{{ t('photosSearchSaveSmartView') }}</div>
          <div class="save-pop-sub">{{ t('photosSvSavedSearchKeepsItself') }}</div>
        </div>
        <button
          type="button" class="icon-btn" data-test="ssv-close-btn" :aria-label="t('photosClose')"
          @click="close"
        >
          <svg
            viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div class="save-pop-body">
        <label class="save-pop-field">
          <span class="save-pop-label">{{ t('photosSvName') }}</span>
          <!-- Deviation registration (fix round 1 · M4 rationale corrected + self-checked line numbers): brief
               structure spec clause 40 literally requires name input also bind @keydown.esc.prevent="close" (copy Vue2 :175).
               Not binding again here —— but reason is not "Vue2 has no higher-level Esc handling" (that's wrong:
               Vue2 mounted() does attach document-level `_onKey`, assignment+mount at :834-835, only its effect
               when overlay not open is "exit whole search page" `exitSearch()`, not close this save overlay). Real reason:
               this component per Global Constraints hard constraint added dedicated document-level Esc listener for this overlay
               (onDocKeydown), keydown bubbles from input to document by default, binding inline again would trigger
               same keypress twice for close()/twice emit('update:open', false). Same as T5 SmartViewCreateDialog.vue
               established practice (its name input also only binds keydown.enter, not duplicating esc). -->
          <input
            ref="nameInputRef" v-model="name" class="save-pop-input" data-test="ssv-name-input"
            :placeholder="t('photosSvEGSaraTokyo')" @keydown.enter.prevent="confirm"
          >
        </label>

        <div class="save-pop-field">
          <span class="save-pop-label">{{ t('photosSvConditions') }}</span>
          <div class="save-pop-conds">
            <span v-for="c in conditions" :key="c" class="save-pop-cond">{{ c }}</span>
            <span v-if="conditions.length === 0" class="save-pop-conds-empty">
              {{ t('photosSearchNoActiveFiltersSaves') }}
            </span>
          </div>
        </div>

        <div class="save-pop-field">
          <span class="save-pop-label save-pop-thresh-label">
            {{ t('photosSvQualityThreshold') }}
            <span class="save-pop-thresh-val">&ge; {{ thresh }}%</span>
          </span>
          <PhotosThreshSlider :value="thresh" @input="onThreshInput" />
        </div>

        <label class="save-pop-toggle">
          <div class="save-pop-toggle-text">
            <div class="save-pop-toggle-label">{{ t('photosSvKeepLive') }}</div>
            <div class="save-pop-toggle-desc">{{ t('photosSvAutoAddMatchesPhotos') }}</div>
          </div>
          <!-- Deviation registration (fix round 1 · M8): `tabindex="0"` + `@keydown.enter`/`@keydown.space`
               is additive change, Vue2 :198-199 `.sv-switch` only has `@click.prevent`, no keyboard accessibility.
               Reuses same type of addition already defined in T5 SmartViewCreateDialog.vue (registered in that file's
               same fix round as "filling Vue2 gap"), continuing same a11y baseline here, not new decision by this task ——
               but still registered here per discipline "additions under strict 1:1 interface must be registered". -->
          <div
            class="sv-switch" role="switch" tabindex="0" data-test="ssv-switch-live"
            :aria-checked="live" :aria-label="t('photosSvKeepLive')" :data-on="live"
            @click.prevent="toggleLive" @keydown.enter.prevent="toggleLive" @keydown.space.prevent="toggleLive"
          />
        </label>
      </div>

      <div class="save-pop-foot">
        <button type="button" class="sv-btn-ghost" data-test="ssv-cancel-btn" @click="close">
          {{ t('photosCancel') }}
        </button>
        <button
          type="button" class="sv-btn-primary" data-test="ssv-confirm-btn"
          :disabled="!name.trim() || store.createBusy" @click="confirm"
        >
          <svg
            viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
          {{ t('photosSvCreateSmartView') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* token mapping (same as T5/T12/T13 established table, not expanding each line): --surface-1 → --popup-bg;
   --line → --card-border; --text-1/2/3/4 → --fg/--fg-muted/--fg-faint/--fg-subtle;
   --surface-2 → --chip-bg; --accent-hi → --accent-text; semi-transparent accent border (0.3 alpha) nearby takes
   --accent-soft-bd (this repo has no component-wise accent-rgb token, Global Constraints §33). Shadows unified to
   --card-shadow-hi (this repo's established combo for "opaque floating panel", precedents see PhotosFilterPopover.vue/
   SearchDatePopover.vue/SmartViewCreateDialog.vue head comments —— doesn't replicate Vue2's extra
   0 0 0 1px faint accent border, all three precedents uniformly omitted this layer, not new deviation by this task). */
.save-pop {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 360px;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  box-shadow: var(--card-shadow-hi);
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.save-pop-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--card-border);
}
/* C11: 28×28, border-radius:9px (not T5's .sv-modal-icon 32×32 —— two sizes independently verified,
   cannot be interchanged). Vue2 original background was hardcoded purple gradient, changed to --accent solid background,
   now foreground satisfies "background is definitely --accent saturated solid", --on-accent is valid
   (same as T5's established handling for .sv-modal-icon). */
.save-pop-icon {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
  flex-shrink: 0;
}
.save-pop-head-text {
  flex: 1;
}
.save-pop-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg);
}
.save-pop-sub {
  font-size: 11px;
  color: var(--fg-faint);
  margin-top: 1px;
}
/* Deviation registration (fix round 1 · M1 wording corrected, previously mistakenly "equivalent"): Vue2 global `.icon-btn`
   (`photos.scss:216-223`) true values are 32×32, `color: var(--text-2)`, hover `background: var(--surface-3); color: var(--text-1)`
   —— not the 28×28 / `--fg-subtle` / hover `--chip-bg`/`--fg` landed here. This repo has no global class (scoped isolation, each component
   defines its own), here reuses precedent established in T5 SmartViewCreateDialog.vue —— defines scaled-down version per this overlay's
   28px scale, not copying Vue2's original 32×32, intentional size deviation (maintains visual consistency with this component's
   .save-pop-icon 28×28 overall scale), color mapping (--fg-subtle normal / --chip-bg+--fg hover) word-for-word same as T5,
   not new set defined by this task. */
.icon-btn {
  flex: none;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--fg-subtle);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover {
  background: var(--chip-bg);
  color: var(--fg);
}

.save-pop-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.save-pop-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.save-pop-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-muted);
}
.save-pop-thresh-label {
  display: flex;
  align-items: baseline;
}
.save-pop-thresh-val {
  margin-left: auto;
  color: var(--accent-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
.save-pop-input {
  padding: 8px 10px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 7px;
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.12s, background 0.12s;
}
.save-pop-input:focus {
  border-color: var(--accent);
  background: var(--popup-bg);
}
.save-pop-conds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 7px;
  max-height: 70px;
  overflow-y: auto;
}
.save-pop-cond {
  padding: 2px 9px;
  border-radius: 99px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd);
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 500;
}
.save-pop-conds-empty {
  font-size: 11px;
  color: var(--fg-subtle);
}
.save-pop-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  cursor: pointer;
}
.save-pop-toggle-text {
  flex: 1;
}
.save-pop-toggle-label {
  font-size: 12.5px;
  color: var(--fg);
  font-weight: 500;
}
.save-pop-toggle-desc {
  font-size: 11px;
  color: var(--fg-faint);
  margin-top: 1px;
}
.save-pop-foot {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid var(--card-border);
  background: var(--popup-bg);
}

/* C7: Vue2's <transition name="save-pop"> rules, Vue3 class name is -enter-from not Vue2's -enter
   (T6 fix round lesson: writing -enter silently fails). */
.save-pop-enter-active,
.save-pop-leave-active {
  transition: opacity 0.16s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: top right;
}
.save-pop-enter-from,
.save-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

/* C5 ruling: .sv-switch/.sv-btn-ghost/.sv-btn-primary all follow T5 SmartViewCreateDialog.vue
   already-landed values (high priority `.photos-root .sv-*` from photos-smartview.scss, not
   suppressed version from photos.scss:2817-2825). Includes T8's M1 fix: .sv-switch's transition:
   background 0.15s and ::after shadow —— both from low priority bare rules in photos.scss:2819-2820,
   not overridden by high priority rules, still merge into cascade and take effect. */
.sv-switch {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--chip-bg-hi);
  border-radius: 99px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.sv-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--fg);
  transition: all 0.2s;
  box-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
}
.sv-switch[data-on="true"] { background: var(--accent); }
.sv-switch[data-on="true"]::after { left: 16px; background: var(--on-accent); }

.sv-btn-ghost {
  height: 36px;
  padding: 0 16px;
  border-radius: 9px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.sv-btn-ghost:hover { background: var(--chip-bg-hi); }
.sv-btn-primary {
  height: 36px;
  padding: 0 18px;
  border-radius: 9px;
  background: var(--accent);
  border: 0;
  color: var(--on-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: var(--card-shadow-hi);
  transition: transform 0.12s, box-shadow 0.15s, opacity 0.15s;
}
.sv-btn-primary:hover { background: var(--accent); }
.sv-btn-primary:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.sv-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }
</style>
