<!--
  Fix wave C (toolbar redesign, owner-confirmed mockup: .superpowers/sdd/
  2026-08-25-files-time-machine-vue2-parity/files-toolbar-mock.html) -- collapses the four
  standalone topbar chips (New folder / New file / Upload files / Upload folder) into ONE
  accent-purple "New" dropdown button. Follows the house reka-ui DropdownMenu pattern already
  established by ../components/AddMountMenu.vue (Root/Trigger/Portal/Content/Item/Separator used
  directly, no bespoke DropdownMenu.vue wrapper exists in components/ui/ -- see that file's own
  header comment for why: content sent to <body> via Portal cannot see scoped attributes, so its
  styling lives in a NON-scoped style block reusing ../../components/ui/ContextMenu.vue's own
  `.ui-ctx-content`/`.ui-ctx-item`/`.ui-ctx-sep` classes for a reliably-opaque popup background).

  This component owns ONLY the menu chrome + open/closed state; it holds no file-op logic of its
  own -- every item just emits, and the caller (Files.vue) wires each emit to its OWN existing
  handler (openNew('folder'), openNew('file'), triggerFileSelect, triggerFolderSelect), unchanged.

  Icons are hand-copied verbatim from the owner-approved mock's own inline SVG paths (stroke-based,
  `stroke="currentColor"`) -- exact visual parity with what the owner said yes to, not a
  reinterpretation. This is the same "plain monochrome glyph inheriting currentColor" UI-icon
  convention already established elsewhere in this app (e.g. TimeMachineStage.vue's own gear
  button), just stroke-style (matching the mock) rather than MDI fill-style.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from 'reka-ui'

const emit = defineEmits<{
  (e: 'new-folder'): void
  (e: 'new-file'): void
  (e: 'upload-file'): void
  (e: 'upload-folder'): void
}>()
const { t } = useI18n()

// v-model:open (rather than relying purely on reka-ui's own internal state) so the trigger's
// caret can reflect it directly via a plain Vue binding -- reka-ui's own `data-state`
// attribute (set on the Trigger automatically) is ALSO used below as a CSS hook, but keeping an
// explicit ref here matches this repo's other stateful dropdown/menu components and keeps the
// component trivially testable without needing to read DOM attributes in tests.
const open = ref(false)
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger class="files-new-trigger tb-new-menu" :aria-label="t('filesNewMenu')">
      <svg class="files-new-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      {{ t('filesNewMenu') }}
      <svg class="files-new-caret" :class="{ 'is-open': open }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <!-- Reuse non-scoped ui-ctx-* styles (see this file's own header comment for why scoped
           styles cannot reach Portal-teleported content); `.files-new-content`/`.files-new-item`
           layer on top for the mock's own wider min-width + accent-tinted hover (rather than the
           context menu's neutral chip-bg-hi hover). -->
      <DropdownMenuContent class="ui-ctx-content files-new-content" :side-offset="8" align="end">
        <DropdownMenuItem class="ui-ctx-item files-new-item tb-new-folder" @select="emit('new-folder')">
          <svg class="files-new-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M12 11v6M9 14h6" />
          </svg>
          {{ t('filesNewFolder') }}
        </DropdownMenuItem>
        <DropdownMenuItem class="ui-ctx-item files-new-item tb-new-file" @select="emit('new-file')">
          <svg class="files-new-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M12 12v6M9 15h6" />
          </svg>
          {{ t('filesNewFile') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator class="ui-ctx-sep" />
        <DropdownMenuItem class="ui-ctx-item files-new-item tb-upload-file" @select="emit('upload-file')">
          <svg class="files-new-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M12 18v-6m-3 3 3-3 3 3" />
          </svg>
          {{ t('filesCtxUploadFile') }}
        </DropdownMenuItem>
        <!-- Native `title` for the hover hint, ported verbatim from the pre-redesign standalone
             button (Files.vue's own tb-upload-folder comment): the picker silently drops empty
             folders and cannot report it, so the item says up front where empty folders have to
             go. -->
        <DropdownMenuItem
          class="ui-ctx-item files-new-item tb-upload-folder"
          :title="t('filesUploadFolderEmptyHint')"
          @select="emit('upload-folder')"
        >
          <svg class="files-new-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M12 17v-5m-3 2.5 3-3 3 3" />
          </svg>
          {{ t('filesCtxUploadFolder') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
/* Fix wave C re-review: repointed from the app's generic blue --accent onto the DEDICATED
   --purple-accent/--purple-accent-hover/--on-purple-accent triplet (theme.css) -- see that
   token's own header comment for the exact owner-approved literal it pins. The mock's own
   throwaway demo stylesheet just happens to name ITS OWN custom property "--accent" too; that is
   an unrelated coincidence, not an instruction to reuse this app's real (blue) --accent.
   `--on-purple-accent` (not `--on-accent`) is the correct foreground here -- see theme.css's own
   comment on it for why: --on-accent flips with --accent's own per-theme luminance and would put
   unreadable dark-navy text on this always-dark purple in the blue theme. */
.files-new-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 6px 15px;
  font-size: 12.5px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  background: var(--purple-accent);
  color: var(--on-purple-accent);
}
/* Mock's own `.pill.new:hover { background: var(--accent-hover) }`, now a direct 1:1 token
   match -- `--purple-accent-hover` IS this button's own dedicated hover fill (fix wave C
   re-review introduced it precisely for this need), so no `filter`-based approximation is
   needed any more. */
.files-new-trigger:hover { background: var(--purple-accent-hover); }
.files-new-icon { width: 13px; height: 13px; flex: none; }
.files-new-caret { width: 11px; height: 11px; flex: none; transition: transform 0.15s var(--ease, ease); }
.files-new-caret.is-open { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .files-new-caret { transition: none; } }
</style>

<style>
/* Not scoped -- see this file's own header comment (Portal-teleported content cannot see scoped
   attributes; AddMountMenu.vue established the same non-scoped-override-on-top-of-ui-ctx-*
   pattern this reuses). */
.files-new-content { min-width: 190px; }
.files-new-item { gap: 10px; }
.files-new-item-icon { width: 15px; height: 15px; opacity: 0.75; flex: none; }
/* Mock's own purple-tinted hover (`.menu button:hover { background: var(--accent-soft); color:
   var(--accent) }`, its OWN demo `--accent-soft` token -- a 12%-alpha purple tint), overriding
   ui-ctx-item's default neutral chip-bg-hi highlight -- two classes on the item
   (`.ui-ctx-item.files-new-item`) beats the single-class base rule's specificity. Fix wave C
   re-review: `color-mix` off the real `--purple-accent` token (not this app's generic
   `--accent-soft`, a DIFFERENT blue-tinted token with its own unrelated consumers) -- same
   "color-mix a soft tint straight off a fixed accent token" idiom Files.vue's own
   `.tm-real-window-chip` already uses for `--tm-accent`, at the mock's own literal 12% alpha. */
.ui-ctx-item.files-new-item[data-highlighted] {
  background: color-mix(in srgb, var(--purple-accent) 12%, transparent);
  color: var(--purple-accent);
}
</style>
