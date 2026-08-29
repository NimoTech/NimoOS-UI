<script setup lang="ts">
// SP11 wallpaper picker. Opened from four places (topbar theme menu, settings
// general row, desktop context menu, and indirectly the files context menu),
// so it is an app-level singleton mounted in App.vue next to AppToast.
//
// Deliberately NOT built on components/ui/Dialog.vue: that wrapper's overlay
// carries `backdrop-filter: var(--overlay-blur)`, which would blur the very
// wallpaper this dialog previews. Following SearchDialog.vue instead --
// reka-ui DialogRoot with :modal="false", anchored to the bottom, no overlay,
// so the top of the screen keeps showing the real desktop.
//
// Task 5 shipped the preset tiles + apply/cancel and the two source buttons
// with their final labels and data-test hooks. Task 6 wired the hidden file
// input (upload) and the NAS sub-view onto them.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogContent, DialogTitle } from 'reka-ui'
import { useWallpaperStore, BUILTIN_IDS, NONE, builtinUrl, type BuiltinId } from '../stores/wallpaper'
import { useThemeStore, type Theme } from '../stores/theme'
// Cross-area import, registered in spec section 4.5: NasImagePicker stays under
// settings/ because it depends on settings.css, and dragging that stylesheet into
// the global bundle would cost more than this one import.
import NasImagePicker from '../settings/panels/account/NasImagePicker.vue'

const { t } = useI18n()
const wp = useWallpaperStore()
const theme = useThemeStore()
const error = ref('')
const saving = ref(false)
const fileEl = ref<HTMLInputElement | null>(null)
const nasOpen = ref(false)

const activeId = computed<string>(() => {
  const r = wp.record
  if (r.kind === 'builtin') return r.id
  if (r.kind === 'image') return 'image'
  return theme.theme === 'light' ? 'light' : 'blue'
})

function pickBase(which: Theme) {
  error.value = ''
  wp.preview(NONE)
  // I2 (final review): preview only -- in-memory + DOM, no localStorage write.
  // apply() below is what persists it, so a theme bundled into a preset pick
  // can be discarded by Cancel like everything else this dialog previews.
  // Deliberately NOT wp.commit()'s job (round 2 of the same review): commit()
  // is also called by setFromNasPath(), which this dialog's own "from NAS"
  // sub-view can reach without ever confirming a theme -- see apply()'s comment.
  theme.previewTheme(which)
}

function pickBuiltin(id: BuiltinId) {
  error.value = ''
  wp.preview({ kind: 'builtin', id }) // theme untouched on purpose
}

async function apply() {
  error.value = ''
  saving.value = true
  try {
    await wp.commit()
    // I2 follow-up (final review round 2): confirming a previewed theme used
    // to happen inside wp.commit() itself, on the reasoning that it was "the
    // one point every caller of commit() shares" -- but setFromNasPath() is
    // also a caller (this dialog's own "from NAS" sub-view, and independently
    // Files.vue's context menu with no dialog at all), and neither of those
    // ever offers a theme to confirm. That let a preset's previewed theme
    // (previewTheme() in pickBase, in-memory + DOM only) get silently
    // persisted as a side effect of picking "from NAS" in the same session,
    // with no Apply click in between -- exactly what I2 exists to prevent.
    // apply() is the only caller that ever previews a theme, so it is the one
    // that persists it; only re-confirms the same value when the theme was
    // never touched during this preview.
    theme.setTheme(theme.theme)
    wp.closeDialog()
  } catch {
    error.value = t('wpSaveFailed')
  } finally {
    saving.value = false
  }
}

function cancel() {
  error.value = ''
  wp.cancelPreview()
  wp.closeDialog()
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  error.value = ''
  try {
    await wp.uploadAndPreview(file)
  } catch (err) {
    // The size check throws before any request; anything else is a real upload failure.
    error.value = /too large/i.test(String(err)) ? t('wpTooLarge') : t('wpUploadFailed')
  } finally {
    input.value = ''   // allow re-picking the same file after a failure
  }
}

async function onNasPick(picked: { path: string; src: string }) {
  error.value = ''
  try {
    await wp.setFromNasPath(picked.path)
    // setFromNasPath already persisted on the backend (it also serves the files
    // context-menu one-shot path with no dialog to confirm in), so a later
    // Cancel must not pretend to roll this back -- reset the snapshot to now.
    wp.beginPreview()
    nasOpen.value = false
  } catch (err) {
    // The backend caps this path at 10 MB and reports it as HTTP 200 + success!=200;
    // show its message rather than a generic one.
    error.value = String((err as Error)?.message || t('wpUploadFailed'))
  }
}

function onOpenChange(open: boolean) {
  // Esc / outside-dismiss must behave like Cancel, not like silently keeping an
  // unconfirmed preview.
  if (!open) cancel()
}
</script>

<template>
  <DialogRoot :open="wp.dialogOpen" :modal="false" @update:open="onOpenChange">
    <DialogPortal>
      <DialogContent class="wp-sheet" :aria-describedby="undefined">
        <DialogTitle class="wp-title">{{ t('wpTitle') }}</DialogTitle>

        <div class="wp-grid">
          <button
            type="button" class="wp-tile wp-tile-blue" :class="{ on: activeId === 'blue' }"
            data-test="wp-preset-blue" @click="pickBase('blue')"
          >
            <span class="wp-tile-label">{{ t('wpPresetBlue') }}</span>
          </button>
          <button
            type="button" class="wp-tile wp-tile-light" :class="{ on: activeId === 'light' }"
            data-test="wp-preset-light" @click="pickBase('light')"
          >
            <span class="wp-tile-label">{{ t('wpPresetLight') }}</span>
          </button>
          <button
            v-for="(id, i) in BUILTIN_IDS" :key="id" type="button" class="wp-tile"
            :class="{ on: activeId === id }" :data-test="`wp-preset-${id}`"
            :style="{ backgroundImage: `url(${builtinUrl(id)})` }" @click="pickBuiltin(id)"
          >
            <span class="wp-tile-label">{{ t(i === 0 ? 'wpBuiltin1' : 'wpBuiltin2') }}</span>
          </button>
        </div>

        <div v-if="!nasOpen" class="wp-actions">
          <button type="button" class="bar-btn" data-test="wp-upload" :disabled="wp.busy"
            @click="fileEl?.click()">{{ t('wpUpload') }}</button>
          <!-- Hidden native input rather than a drop zone: mirrors Vue2's single
               "pick a file" affordance, and needs no new dependency. -->
          <input ref="fileEl" class="wp-file" type="file" data-test="wp-file"
            accept="image/png,image/jpeg,image/bmp,image/gif,image/svg+xml" @change="onFile" />
          <button type="button" class="bar-btn" data-test="wp-nas"
            @click="nasOpen = true">{{ t('wpFromNas') }}</button>
        </div>
        <div v-else class="wp-nas" data-test="wp-nas-picker">
          <NasImagePicker @pick="onNasPick" />
        </div>

        <p v-if="error" class="wp-error" data-test="wp-error">{{ error }}</p>

        <div class="wp-foot">
          <button type="button" class="bar-btn" data-test="wp-cancel" @click="cancel">{{ t('wpCancel') }}</button>
          <button
            type="button" class="bar-btn wp-primary" data-test="wp-apply" :disabled="saving || wp.busy"
            @click="apply"
          >{{ t('wpApply') }}</button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Bottom sheet, no overlay: the upper half of the viewport must keep showing the
   live desktop so the preview is meaningful. */
.wp-sheet {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 1001;
  width: min(760px, 94vw); padding: 18px 20px 16px;
  border: 1px solid var(--card-border); border-radius: var(--radius-sm);
  background: var(--popup-bg); backdrop-filter: var(--blur);
  box-shadow: var(--card-shadow-hi); color: var(--fg);
}
.wp-title { margin: 0 0 14px; font-size: 16px; font-weight: 600; }
.wp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.wp-tile {
  position: relative; aspect-ratio: 16 / 10; padding: 0; overflow: hidden; cursor: pointer;
  border: 2px solid transparent; border-radius: var(--radius-xs);
  background-color: var(--card); background-size: cover; background-position: center;
  transition: border-color 0.2s var(--ease);
}
.wp-tile:hover { border-color: var(--accent-soft-bd); }
.wp-tile.on { border-color: var(--accent); }
.wp-tile-blue { background-image: var(--app-bg-preview-blue); }
.wp-tile-light { background-image: var(--app-bg-preview-light); }
.wp-tile-label {
  position: absolute; inset: auto 0 0 0; padding: 4px 6px; font-size: 11px;
  background: var(--wallpaper-tile-label-bg); color: var(--wallpaper-tile-label-fg);
}
.wp-actions { display: flex; gap: 10px; margin-top: 14px; }
.wp-file { display: none; }
.wp-nas { max-height: 46vh; overflow: auto; }
.wp-error { margin: 12px 0 0; font-size: 13px; color: var(--remove-fg); }
.wp-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.wp-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.wp-primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.08); }
</style>
