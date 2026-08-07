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
// Task 5 scope: preset tiles + apply/cancel only. The upload and "choose from
// NAS" buttons render here with their final labels and data-test hooks, but
// have no click behaviour yet -- Task 6 wires the hidden file input and the
// NAS sub-view onto them.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogContent, DialogTitle } from 'reka-ui'
import { useWallpaperStore, BUILTIN_IDS, NONE, builtinUrl, type BuiltinId } from '../stores/wallpaper'
import { useThemeStore, type Theme } from '../stores/theme'

const { t } = useI18n()
const wp = useWallpaperStore()
const theme = useThemeStore()
const error = ref('')
const saving = ref(false)

const activeId = computed<string>(() => {
  const r = wp.record
  if (r.kind === 'builtin') return r.id
  if (r.kind === 'image') return 'image'
  return theme.theme === 'light' ? 'light' : 'blue'
})

function pickBase(which: Theme) {
  error.value = ''
  wp.preview(NONE)
  theme.setTheme(which)
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

        <div class="wp-actions">
          <button type="button" class="bar-btn" data-test="wp-upload">{{ t('wpUpload') }}</button>
          <button type="button" class="bar-btn" data-test="wp-nas">{{ t('wpFromNas') }}</button>
        </div>

        <p v-if="error" class="wp-error" data-test="wp-error">{{ error }}</p>

        <div class="wp-foot">
          <button type="button" class="bar-btn" data-test="wp-cancel" @click="cancel">{{ t('wpCancel') }}</button>
          <button
            type="button" class="bar-btn wp-primary" data-test="wp-apply" :disabled="saving"
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
.wp-error { margin: 12px 0 0; font-size: 13px; color: var(--remove-fg); }
.wp-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.wp-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.wp-primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.08); }
</style>
