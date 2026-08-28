<script setup lang="ts">
// Task 7 (SP15-P2b): AlbumConvertToSmartDialog.vue -- opened by the album detail page's more
// menu "Convert to Smart Album" entry (Task 6's `convertOpen` stub). A manual album becomes a
// smart album in place: the backend pins every existing member, deletes the album and hands
// back the new smart view (usePhotosSmartViews().convertFromAlbum, T1).
//
// Ported from Vue2 939a7d3a:PhotosAlbumDetail.vue:142-206 (modal markup), :294-298
// (convertChips), :310-345 (openConvertModal/closeConvert/confirmConvert). Structure follows
// SmartViewCreateDialog.vue's .sv-modal-scrim/.sv-modal/.sv-modal-head/.sv-modal-body/
// .sv-modal-foot idiom -- but single-column (`grid-template-columns: 1fr`): this dialog has no
// live-preview side rail, only a read-only chips preview inline in the form. Scoped styles do
// not cross SFCs in this repo, so every restated rule body below is copied verbatim from its
// named source, not reinvented.
//
// Extracted as its own component per the owner's ruling for this area (every dialog here --
// ClusterActionDialog, MergeReviewDialog, AlbumPickerDialog, PlaceSpotDialog -- lives in its
// own file; PhotosAlbumDetail.vue is already past 1100 lines).
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePhotosSmartViews, type SmartView } from '../stores/smartViews'
import { useToast } from '../../stores/toast'
import { inferChips } from '../util/smartViewSuggest'
import { isConflict } from '../util/httpErrors'
import PhotosThreshSlider from './PhotosThreshSlider.vue'

const props = defineProps<{
  open: boolean
  albumId: string | number
  albumName: string
  albumCount: number
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'converted', sv: SmartView): void
}>()

const { t } = useI18n()
const smartViews = usePhotosSmartViews()
const toast = useToast()

const desc = ref('')
const thresh = ref(80)
const converting = ref(false)
const errorText = ref('')

// Vue2 :294-298. Read-only preview: what actually takes effect is whatever the backend's
// svparser makes of `description` (the same path Create takes), so these chips are not
// editable and are never sent -- presenting them as a promise would be a lie, which is why
// the copy below says "suggests" rather than "will match".
const chips = computed(() => inferChips(desc.value))
const canSubmit = computed(() => desc.value.trim().length > 0 && !converting.value)

// Persistent mount + prop-driven visibility (this component never unmounts while the host
// page is open, only v-if-toggles its own scrim), so the reset lives in watch(open) rather
// than onMounted -- this area's recurring trap (see SmartViewCreateDialog.vue's own header
// comment for the first two occurrences).
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    document.removeEventListener('keydown', onDocumentKeydown)
    return
  }
  desc.value = ''
  thresh.value = 80
  errorText.value = ''
  converting.value = false
  document.addEventListener('keydown', onDocumentKeydown)
}, { immediate: true })
// Component-unmount safety net (e.g. the host page's own v-if unmounts everything while this
// dialog is still open) -- same pattern as SmartViewCreateDialog.vue/AlbumPickerDialog.vue.
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

function close(): void {
  // Vue2 :317-320: no dismissal mid-flight, or the user loses track of whether the request
  // landed. Escape routes through this same guard below instead of setting the flag directly,
  // so the keyboard cannot dismiss what the Cancel button and the scrim click cannot.
  if (converting.value) return
  emit('update:open', false)
}

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  close()
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  converting.value = true
  errorText.value = ''
  try {
    const sv = await smartViews.convertFromAlbum(props.albumId, {
      description: desc.value.trim(),
      threshold: thresh.value,
    })
    emit('converted', sv)
    emit('update:open', false)
    toast.show(t('photosAlbumConvertedToSmart'))
  } catch (e) {
    console.error('[album-convert-to-smart] submit', e)
    // Inline, not a toast: this answers the button the user just pressed, so it belongs next
    // to it and must not time out. A 409 reuses the album pages' existing duplicate-name
    // wording rather than adding a second phrasing of the same thing (Vue2's own final review
    // round made the same call, per its comment at :294-298 above the chips preview).
    errorText.value = isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumConvertFailed')
  } finally {
    // Cleared even on failure -- the dialog stays open precisely so retry is one click.
    converting.value = false
  }
}
</script>

<template>
  <Transition name="act-modal">
    <div
      v-if="open"
      class="sv-modal-scrim"
      data-test="convert-modal-scrim"
      @click.self="close"
    >
      <div class="sv-modal act-modal" role="dialog" :aria-label="`${t('photosAlbumConvertToSmart')}: ${albumName}`">
        <div class="sv-modal-head">
          <div class="sv-modal-icon">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.9L19 9l-4.9 1.8L12 16l-1.8-5.2L5 9l5.2-1.1L12 3zM19 15l.9 2.5L22 18l-2.5.9L19 21l-.9-2.5L16 18l2.5-.9L19 15z" /></svg>
          </div>
          <div class="sv-modal-head-text">
            <div class="sv-modal-title">{{ t('photosAlbumConvertToSmart') }}</div>
            <div class="sv-modal-sub">{{ t('photosAlbumConvertToSmartHint') }}</div>
          </div>
          <button type="button" class="icon-btn" data-test="convert-close" :aria-label="t('photosClose')" @click="close">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="sv-modal-body act-modal-body">
          <div class="sv-modal-form">
            <label class="sv-field">
              <span class="sv-field-label">
                {{ t('photosSvNimoMatch') }}
                <span class="sv-field-hint">{{ t('photosSvDescribePlainEnglishConditions') }}</span>
              </span>
              <textarea
                v-model="desc"
                class="sv-input sv-textarea"
                data-test="convert-desc"
                :placeholder="t('photosSvSunsetsSaraOurTokyo')"
              />
            </label>

            <div v-if="chips.length > 0" class="sv-field" data-test="convert-chips">
              <span class="sv-field-label">{{ t('photosAlbumConvertSuggestHint') }}</span>
              <div class="sv-header-conds">
                <span v-for="c in chips" :key="c" class="sv-cond" data-test="convert-chip">{{ c }}</span>
              </div>
            </div>

            <div class="sv-field">
              <span class="sv-field-label">
                {{ t('photosSvQualityThreshold') }}
                <span class="sv-thresh-val">&ge; {{ thresh }}%</span>
              </span>
              <PhotosThreshSlider :value="thresh" @input="thresh = $event" />
            </div>

            <div class="sv-field-hint act-lock-hint">
              {{ t('photosAlbumConvertLockHint', { n: albumCount }) }}
            </div>

            <div v-if="errorText" class="convert-error" data-test="convert-error">{{ errorText }}</div>
          </div>
        </div>

        <div class="sv-modal-foot">
          <button type="button" class="sv-btn-ghost" data-test="convert-cancel" @click="close">
            {{ t('photosCancel') }}
          </button>
          <button
            type="button" class="sv-btn-primary" data-test="convert-submit"
            :disabled="!canSubmit" @click="submit"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.9L19 9l-4.9 1.8L12 16l-1.8-5.2L5 9l5.2-1.1L12 3zM19 15l.9 2.5L22 18l-2.5.9L19 21l-.9-2.5L16 18l2.5-.9L19 15z" /></svg>
            {{ converting ? t('photosAlbumConverting') : t('photosAlbumConvertToSmart') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Restated from SmartViewCreateDialog.vue (scoped styles do not cross SFCs in this repo;
   that file's own header comment registers the same restatement pattern for its token
   mapping). Rule bodies below are copied verbatim from that file's .sv-modal-scrim /
   .sv-modal / .sv-modal-head / .icon-btn / .sv-modal-body / .sv-modal-form / .sv-field* /
   .sv-input* / .sv-thresh-val / .sv-modal-foot / .sv-btn-ghost / .sv-btn-primary /
   .act-modal-enter-* (there named .sv-modal-enter-*). ── */
/* Note: `--overlay-bg` is a
   *global*, non-`.photos-root`-shadowed token like the others this sweep replaced, but it is
   kept here deliberately, not swapped -- verified safe. It is a modal *scrim* (darkens whatever
   sits behind the dialog), not text: both of New-UI's own global values (theme.css:274/408) are
   a dark, semi-opaque tint, by design, since a scrim's job is to dim the page regardless of
   which theme (app-wide or photos-private) is active. There is no white-on-white/low-contrast
   risk the way there is for a foreground colour, so this is the same category of exception
   already approved for the glass search box (PhotosTopbar.vue's `.search`). */
.sv-modal-scrim {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  -webkit-backdrop-filter: var(--overlay-blur);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}
.sv-modal {
  width: 820px;
  max-width: 100%;
  max-height: calc(100vh - 80px);
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: var(--card-shadow-hi);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* Vue2 :150 gives this modal a literal `style="width:560px"` -- narrower than
   SmartViewCreateDialog's 820px because this body has no preview side rail. Modifier class,
   not an inline style, to match this repo's own convention (SmartViewCreateDialog.vue's own
   .sv-modal-embedded modifier). */
.act-modal {
  width: 560px;
}

.sv-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--line);
}
.sv-modal-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
  box-shadow: var(--card-shadow-hi);
}
.sv-modal-head-text { flex: 1; min-width: 0; }
.sv-modal-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-1); }
.sv-modal-sub { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
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
.icon-btn:hover { background: var(--surface-2); color: var(--text-1); }

.sv-modal-body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
/* Single column -- this dialog has no preview rail (unlike SmartViewCreateDialog's
   1fr/280px), per the brief's explicit structural call. */
.act-modal-body {
  grid-template-columns: 1fr;
}
.sv-modal-form {
  overflow-y: auto;
  padding: 18px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sv-field { display: flex; flex-direction: column; gap: 6px; }
.sv-field-label { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; font-weight: 500; color: var(--text-2); }
.sv-field-hint { font-size: 10.5px; color: var(--text-4); font-weight: 400; }
.sv-input {
  width: 100%;
  padding: 9px 11px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.sv-input:focus { border-color: var(--accent); background: var(--surface-1); }
.sv-textarea { min-height: 60px; resize: vertical; line-height: 1.45; font-size: 12.5px; }

/* ── Restated from PhotosMomentDetail.vue's own .sv-header-conds/.sv-cond (that file's
   header comment registers this same class pair as already restated across
   SmartViewCard.vue/MomentCard.vue/PhotosSmartViewDetail.vue -- Vue2's photos-smartview.scss
   defines the shared source at :81/:362-363). Plain read-only pills; this dialog needs
   neither the removable (`x` button) nor mo-type-pill variants those other files also carry,
   so only the two base rules are restated here. ── */
.sv-header-conds { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; align-items: center; min-height: 4px; }
/* Note: background corrected from `--chip-bg`
   (global, non-shadowed, glass-gradient in dark mode) to parity's own `--surface-3` -- Vue2's
   real base `.sv-cond` background (photos-smartview.scss:91-97), one rung lighter than what was
   here (`--chip-bg`/--surface-2, not `--chip-bg-hi`/--surface-3). Same fix applied to this
   chip's other restatements in PhotosAlbumDetail.vue and MomentCard.vue. */
.sv-cond { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); font-size: 11.5px; }

.sv-thresh-val { margin-left: auto; color: var(--accent-hi); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 13px; }
/* PhotosThreshSlider.vue owns the actual .sv-slider/.sv-slider-marks styles (T5 fix round 1 ·
   I1 extraction) -- nothing to restate here for the slider itself. */

/* Vue2 :303 gives this hint a literal inline style="font-size:11.5px;line-height:1.5" --
   named class instead, same treatment SmartViewCreateDialog.vue gives its own
   .sv-hint-spaced. */
.act-lock-hint { font-size: 11.5px; line-height: 1.5; }

/* Inline failure message next to the submit button (not a toast: see submit()'s comment).
   --remove-fg per the dispatch's explicit color call. */
.convert-error { font-size: 12px; color: var(--danger); line-height: 1.4; }

.sv-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--line);
  background: var(--surface-1);
}
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

.act-modal-enter-active, .act-modal-leave-active { transition: opacity 0.18s ease; }
.act-modal-enter-active .sv-modal, .act-modal-leave-active .sv-modal {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease;
}
.act-modal-enter-from, .act-modal-leave-to { opacity: 0; }
.act-modal-enter-from .sv-modal, .act-modal-leave-to .sv-modal { transform: translateY(8px) scale(0.98); opacity: 0; }

@media (max-width: 768px) {
  .act-modal { width: 100%; }
}
</style>
