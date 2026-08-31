<script setup lang="ts">
// SearchSaveSmartView.vue — the search page's "save as smart view" popover (wired up to
// actually create one).
// Structure corresponds to Vue2 PhotosSearchView.vue:159-210 (template, not including the
// trigger button .save-smart at :153-158 — that button isn't owned here, it's handed off to a
// downstream component, see the hand-off note at the end of the file), :798-804 (openSave's
// reset logic), :806-812 (confirmSave, though Vue2's version there is fake — it only sets
// local state + a toast, with zero store/service calls; here it's wired up to make it a real
// createSmartView call). Styles correspond to photos.scss:2795-2815 (the whole .save-pop*
// group, individually cross-checked) + a deliberate ruling for
// .sv-switch/.sv-btn-ghost/.sv-btn-primary (using the higher-priority version from
// photos-smartview.scss, matching the values already used by other sibling components'
// implementations, rather than copying the suppressed values in photos.scss:2817-2825).
//
// Persistently mounted + shown/hidden via a prop (unlike some other popovers, which rely on
// the host remounting them with v-if to reset internal state) — a deliberate difference: this
// component is the same shape as SmartViewCreateDialog, resetting via
// watch(() => props.open) rather than onMounted (the persistent-mount pitfall, same as that
// component's file header comment).
//
// A correction (a missed-rendering issue caught during review): Vue2's `mounted()` has an
// `_onDoc` handler (the whole thing spans :819-832; the predicate relevant to this popover is
// at :820-822) — a `mousedown` predicate that only closes when
// `pop && !pop.contains(target) && btn && !btn.contains(target)`, where `pop` is `savePop`
// (this component's root node) and `btn` is `saveBtn` (the trigger button, owned by a
// downstream component). Only the document-level Escape half had been implemented before,
// missing this other half. It's added here: the root node is bound to `rootRef`, and a new
// optional prop `ignoreEl` is added (the host passes in the `.save-smart` trigger button's
// element, defaulting to `null`) — the predicate becomes "only close if neither this
// component's own root container nor ignoreEl contains target", matching Vue2 verbatim; when
// `ignoreEl` isn't passed, it degrades to "only check this component's own container" (still
// usable, just that clicking the trigger button itself also gets judged as "outside" and
// mistakenly closes the popover — this side effect only shows up when the host doesn't wire
// up `ignoreEl`, and downstream work needs to pass it in).
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
  // An additional name parameter — the host (PhotosSearch.vue) needs it to compose the
  // "\"{name}\" has been saved as a smart view" success toast text (following Vue2's
  // confirmSave()'s saveToast = { name }, :806-812); when only id was carried, the host had
  // no way to get this name.
  (e: 'saved', id: string, name: string): void
}>()

const { t } = useI18n()
const store = usePhotosSmartViews()
const toast = useToast()

const name = ref('')
// Default threshold 75 (follows Vue2's openSave :801), different from the create dialog's
// default of 80 — cross-checked, not a copy error (this difference is intentional).
const thresh = ref(75)
const live = ref(true)
const nameInputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)

function close(): void {
  emit('update:open', false)
}

// Overlay Escape handling goes through a document-level listener + watch(open) attach/detach
// (this repo's convention that overlay Escape handling always uses document-level listeners).
// This component performs no early-return checks inside onDocKeydown, nor does it call
// stopPropagation — the search page may have both a filter popover and this popover open at
// the same time, and each one's listener independently handles the same Escape keypress
// without interfering with the other (a lesson learned elsewhere: an early return or a
// stopped event would keep the other layer from receiving the event).
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  close()
}

// Closes on an outside mousedown (following the half of Vue2's `_onDoc` predicate relevant to
// the save popover — the savePop/saveBtn contains checks, :820-822; the other half, for the
// people/filterbar popovers, is at :824-830 and isn't this component's concern).
// The predicate is "neither the root container nor ignoreEl contains target" — both
// `contains` calls run to completion before deciding, rather than "check one, short-circuit
// if it matches" (this repo avoids early returns in onDocMousedown, since a real bug seen
// elsewhere came from exactly this kind of early return missing a second branch when a
// predicate function is shared across multiple layers; even though this function only serves
// a single overlay, it's still written with the same discipline of "evaluate both conditions
// before deciding", so it carries no hidden risk if it's ever copied into a multi-layer
// scenario in the future).
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  const insideRoot = rootRef.value !== null && rootRef.value.contains(target)
  const insideIgnore = props.ignoreEl !== null && props.ignoreEl.contains(target)
  if (!insideRoot && !insideIgnore) close()
}

// Resets name/thresh/live + focuses when open becomes true; this must hook into
// watch(() => props.open), not onMounted — this component is persistently mounted and
// shown/hidden via a prop, and onMounted only runs once when the component is created.
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

// Actually creates the smart view: Vue2's confirmSave (:806-812) only sets saved=true + writes
// a savedSv field nothing in the repo ever reads again + pops an "already saved" toast, with
// zero store/service calls — this button is fake in Vue2. Here it really calls
// createSmartView, and must wrap it in its own try/catch (store.createSmartView throws on
// failure, a detail that's easy to miss).
//
// The basis for description: props.query.trim() || undefined: Vue2's savedSv stores
// { query, filters }, while the backend createSmartView's semantics are "fall back to
// description for meaning when conds is empty" (per Vue2 PhotosSmartViewsView.vue:426's own
// comment). Putting the raw query term into description is the only sound mapping between
// these two contracts.
//
// trim + `|| undefined` can't be dropped — `CreateSmartViewInput.description?`'s established
// meaning is "an empty description means the field isn't sent at all" (the same convention as
// SmartViewCreateDialog.vue's confirm(), `draft.desc.trim() || undefined`); with an empty
// query string, passing `props.query` directly would send an empty-string field instead of
// omitting it, inconsistent with another caller of the same store.
//
// The edge case where createBusy causes an early return of null: the primary button already
// has `:disabled="!name.trim() || store.createBusy"`, so this path is basically unreachable —
// no extra UI is added, it's only noted here in a comment, matching the same edge-case
// handling convention used by other sibling components.
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
    // Reuses an existing generic key (the same choice already made by SmartViewCreateDialog.vue),
    // no new i18n key added.
    toast.show(t('photosAlbumCreateFailed'))
  }
}
</script>

<template>
  <Transition name="save-pop">
    <div v-if="open" ref="rootRef" class="save-pop" data-test="ssv-root">
      <!-- Deviation noted: these three svgs' `stroke-width="2"` is an additive change relative
           to Vue2's `PhotosIcon.vue` default of 1.6 (`:185`) — none of Vue2's three
           `<photos-icon>` calls here pass `stroke-width`, so they use the 1.6 default. This
           follows the same choice already established by SmartViewCreateDialog.vue (all
           inline svgs of this kind in that file are stroke-width="2", not a value newly
           picked here), noted for the record. -->
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
          <!-- Deviation noted: an earlier spec literally called for binding the name input
               with an additional @keydown.esc.prevent="close" (following Vue2 :175). This
               doesn't bind it again here — but not for the reason "Vue2 has no higher-level
               Esc handling" (that claim is wrong: Vue2's mounted() does attach a
               document-level `_onKey`, assigned+attached at :834-835, it's just that its
               effect is "exit the whole search page" via `exitSearch()` when Escape is
               pressed and no lightbox is open, not closing this save popover). The real
               reason is: this component adds its own document-level Esc listener dedicated to
               this popover (onDocKeydown), per this repo's hard rule for overlays; keydown
               bubbles from the input to document by default, so binding an inline one too
               would fire close()/emit('update:open', false) twice for the same keypress. Same
               established approach as SmartViewCreateDialog.vue (its name input also only
               binds keydown.enter, without rebinding esc). -->
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
          <!-- Deviation noted: `tabindex="0"` + `@keydown.enter`/`@keydown.space` is an
               additive change; Vue2's `.sv-switch` at `:198-199` only has `@click.prevent`,
               with no keyboard accessibility. This follows the same kind of addition already
               made in SmartViewCreateDialog.vue (already noted there as "filling a Vue2 gap"),
               continuing the same a11y baseline rather than being a new decision made here —
               still noted for the record, per the discipline that additions get recorded even
               under strict visual 1:1 parity. -->
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
/* 2026-08-13 revert (the owner overturned the EXIF glass exception; this fills that in
   retroactively -- this component had missed that revert round earlier, and now uses the
   same established approach as PhotosFilterPopover.vue/SearchDatePopover.vue/SearchPeoplePopover.vue):
   the paragraph that used to sit here mapped every color in this block onto the generic
   cross-app glass tokens (--surface-1→--popup-bg, --line→--card-border, --text-1/2/3/4→
   --fg/--fg-muted/--fg-faint/--fg-subtle, --surface-2→--chip-bg, --accent-hi→--accent-text,
   shadow→--card-shadow-hi) — the exact aesthetic the owner reverted for the fchip/fpop family.
   `.save-pop`/`.save-pop-head`/`.save-pop-body`/`.save-pop-field`/`.save-pop-label`/
   `.save-pop-sub`/`.save-pop-input`(+:focus)/`.save-pop-conds`/`.save-pop-cond`/
   `.save-pop-toggle`/`.save-pop-foot`/`.save-pop-enter-active,.save-pop-leave-active` are
   deleted below — every one of them was already a byte-for-byte duplicate of
   vue2-parity/photos.scss's own bare rules (:2892-2911) once the wrong generic token names
   were swapped for the local ones parity actually uses, so nothing is lost by handing them
   over outright. One of those "duplicates" was hiding a real bug, not just a naming
   preference: `.save-pop-cond`'s border used `var(--accent-soft-bd)`, a GLOBAL theme.css
   token (blue channel family) that `.photos-root` never locally redefines — parity's own value
   is a Photos-local purple literal instead, matching this file's own `--accent-rgb` (see the
   component test file for the exact numbers). Deleting the rule instead of hand-fixing the
   token also fixes the leak, for free.
   Survivors (kept below, NOT part of this cleanup): `.save-pop-icon` (a deliberate solid
   --accent + --on-accent vs. parity's literal purple gradient, unrelated to the glass-token
   family), `.icon-btn` (a deliberate 28px vs. Vue2's global 32px `.icon-btn`, ditto),
   `.save-pop-head-text`/`.save-pop-thresh-label`/`.save-pop-thresh-val`/
   `.save-pop-conds-empty`/`.save-pop-toggle-text`/`.save-pop-toggle-label`/
   `.save-pop-toggle-desc` (zero parity coverage — Vue2's real markup here is inline style,
   not a class, same registered reasoning as `.fpop-item`/`.fpop-empty` in
   PhotosFilterPopover.vue; their color tokens were already the correct local ones, nothing to
   revert), and `.save-pop-enter-from,.save-pop-leave-to` (Vue3 renamed Vue2's bare
   enter/leave transition classes to an -from-suffixed pair, so parity's own verbatim
   transcription of Vue2's SFC transition selector never matches any real Vue3 transition
   class; this rule cannot be handed over by selector name, only its
   `-active` sibling can). The `.sv-switch`/`.sv-btn-ghost`/`.sv-btn-primary` family further
   below is untouched by this pass — those were deliberately pinned to a different,
   still-standing precedent (SmartViewCreateDialog.vue's own `photos-smartview.scss` values),
   not to the fchip/fpop glass-token family this cleanup is about. */
/* 28x28, border-radius:9px (not SmartViewCreateDialog.vue's .sv-modal-icon's 32x32 — these two
   sizes were verified independently and shouldn't be assumed to match). Vue2's original
   background is a hardcoded purple gradient; once changed to a solid --accent fill, the
   foreground satisfies the "background is genuinely a solid saturated --accent fill"
   condition, so --on-accent is valid (same handling convention already established for
   .sv-modal-icon). */
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
  color: var(--text-1);
}
.save-pop-sub {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 1px;
}
/* Deviation noted (a wording correction — this used to be mistakenly described as
   "equivalent"): Vue2's global `.icon-btn` (`photos.scss:216-223`) is actually 32x32,
   `color: var(--text-2)`, with a hover state of `background: var(--surface-3);
   color: var(--text-1)` — not this file's 28x28 / `--fg-subtle` / hover `--chip-bg`/`--fg`.
   This repo has no such global class (each component is its own scoped island, defining its
   own copy), so this follows the precedent already established by SmartViewCreateDialog.vue —
   defining a scaled-down version at this popover's own 28px scale, rather than copying Vue2's
   original 32x32 value, a deliberate size deviation (kept visually consistent with this
   component's own .save-pop-icon at 28x28 overall). The color-token mapping (--fg-subtle at
   rest / --chip-bg+--fg on hover) matches SmartViewCreateDialog.vue verbatim, it isn't a new
   scheme invented here. */
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
  color: var(--text-4);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover {
  background: var(--surface-2);
  color: var(--text-1);
}

.save-pop-thresh-label {
  display: flex;
  align-items: baseline;
}
.save-pop-thresh-val {
  margin-left: auto;
  color: var(--accent-hi);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
.save-pop-conds-empty {
  font-size: 11px;
  color: var(--text-4);
}
.save-pop-toggle-text {
  flex: 1;
}
.save-pop-toggle-label {
  font-size: 12.5px;
  color: var(--text-1);
  font-weight: 500;
}
.save-pop-toggle-desc {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 1px;
}
/* For Vue2's <transition name="save-pop"> rule, the Vue3 class name is -enter-from, not
   Vue2's -enter (a lesson learned elsewhere: writing -enter silently fails to match).
   `-enter-active`/`-leave-active` (same
   selector name in Vue2 and Vue3 — only the non-`-active` half was renamed) is NOT kept here:
   vue2-parity/photos.scss's own `.save-pop-enter-active, .save-pop-leave-active` (:2911) is a
   byte-identical transition, so it's handed over like every other duplicate above. Only the
   `-enter-from`/`-leave-to` half survives, since parity's corresponding rule uses Vue2's dead
   `.save-pop-enter` name that no Vue3 transition ever applies. */
.save-pop-enter-from,
.save-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

/* A deliberate ruling: .sv-switch/.sv-btn-ghost/.sv-btn-primary all follow the values already
   implemented in SmartViewCreateDialog.vue (the higher-priority `.photos-root .sv-*` version
   in photos-smartview.scss, not the suppressed one in photos.scss:2817-2825). Includes a fix
   carried over from a sibling component: .sv-switch's transition: background 0.15s and
   ::after's drop shadow — both come from the lower-priority bare rules in
   photos.scss:2819-2820, which aren't overridden by the higher-priority rule's declarations,
   so they still merge in and take effect through the cascade. */
.sv-switch {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--surface-3);
  border-radius: 99px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
/* An owner decision (2026-08-14): the knob is literal white in EVERY theme and BOTH on/off
   states -- overrides whatever Vue2's own (non-existent) light theme would have done, an
   explicit owner requirement. An earlier version's `var(--text-1)` got dark-mode legibility
   right but was still a theme-flipping token, going near-black under `.photos-root.is-light`
   -- legible, but not white, which is what the owner wants. `--text-1` is deliberately no
   longer used for the knob.
   Literal white, same theme-exception convention as PhotosToastHost.vue's `.photos-toast`
   background / this repo's other theme-invariant surfaces. The light-mode border + shadow below
   is a matched pair with this rule -- see its own comment. */
.sv-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff; /* theme-exception: owner 2026-08-14 decision -- knob is invariant white in every theme/state */
  transition: all 0.2s;
  box-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
}
/* Owner decision (2026-08-14), paired with the literal-white knob above: a flat white circle has
   no edge against photos light mode's own near-white `--surface-3` off-track, so light mode gets
   a subtle parity-token border plus a lighter drop shadow, same values as
   SmartViewCreateDialog.vue/SmartViewSidePanel.vue's own copies of this rule. Applies to both
   on/off states (neither modifies border/box-shadow), matching the required state-invariant
   requirement. */
.photos-root.is-light .sv-switch::after {
  border: 1px solid var(--line-strong);
  box-shadow: 0 1px 2px color-mix(in srgb, black 12%, transparent);
}
.sv-switch[data-on="true"] { background: var(--accent); }
/* Straight bug fix, not a deviation from Vue2 -- parity's
   own `.photos-root .sv-switch[data-on="true"]::after` (photos-smartview.scss:786-789) only
   moves the knob (`left: 16px`); it never overrides `background`, so Vue2's knob is the exact
   same colour in both states. The `--on-accent` override this rule used to carry (pinned above
   to SmartViewCreateDialog.vue's `.sv-switch` values, which carried the
   same bug) was wrong: it made the knob track the on/off *state* instead of staying constant
   like Vue2's. Deleted here too, same fix as that file and SmartViewSidePanel.vue's own copy --
   the knob now always uses the base rule's background above (the literal white value
   established above), in both states, matching Vue2's own single-value knob exactly. */
.sv-switch[data-on="true"]::after { left: 16px; }

.sv-btn-ghost {
  height: 36px;
  padding: 0 16px;
  border-radius: 9px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.sv-btn-ghost:hover { background: var(--surface-3); }
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
