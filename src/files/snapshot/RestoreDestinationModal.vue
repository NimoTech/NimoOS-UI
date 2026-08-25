<!--
  Restore-destination picker: the shared "choose where to restore into" step every Time Machine
  restore entry point (T14's context-menu single-item restore, and the banner/action-bar's
  selection / no-selection-whole-directory restore) goes through before any actual restore
  network call — Vue2's own FilePanel.vue opens this ONE modal via its own
  openRestoreDestinationPicker helper rather than forking three pickers; this rebuild keeps that
  "one modal, three call sites" shape by exposing a single Promise-based `open()` method (see
  below) that T14 calls from wherever it wires up.

  Two jobs, both surfaced in one dialog (ported 1:1 from Vue2
  NimoOS-UI/src/components/filebrowser/components/RestoreDestinationModal.vue):
  1. A lightweight volume-scoped directory drill-down (breadcrumb down to the item's own mount
     root + a folder list to descend into) — defaulting to the item's own original-location
     directory (see restoreDestination.ts's defaultDestDirForItem/defaultDestDirForChildren,
     computed by the CALLER and passed into `open()` as `defaultDir`). Deliberately scoped to
     the ONE volume the restored item already lives on (no cross-volume "Volumes" root) — same
     reasoning as Vue2's own file-header comment: every real restore-destination request is "put
     it back near where it was, maybe a different folder on the SAME disk", and the backend's
     own `dest_dir` contract doesn't call out cross-volume moves either.
  2. The ".restored marker" on/off switch (`with_marker` in the request body) — a session-only
     preference (this component's own `withMarker` ref, deliberately NOT reset by `open()`, never
     persisted to localStorage), since this modal is mounted once by T14 and reused across every
     restore entry point for the lifetime of the Files view (same "always mounted, only the
     dialog's own open/closed state toggles" convention as SnapshotSettingsModal.vue).

  Promise API (T14 contract): a caller mounts this component once (e.g. `<RestoreDestinationModal
  ref="picker" />`) and calls `pickerRef.value.open(mount, defaultDir)`, which returns
  `Promise<{destDir: string; withMarker: boolean} | null>` — resolving with the chosen
  destination on "Restore here", or `null` on Cancel/Esc/outside-click. The component owns its
  own visibility internally (no `open`/`visible` prop) — unlike FileConflictDialog.vue (which is
  driven by an app-level Pinia store because its queue can span multiple sequential prompts),
  this modal is opened synchronously from a single call site per restore action, so a local
  resolver closure is enough; no store needed (T14 does not need to compute conflicts THROUGH
  this modal — Vue2's own RestoreDestinationModal.vue only ever emits {destDir, withMarker} and
  leaves conflict-checking to the caller, same split kept here: computeRestoreConflicts in
  restoreDestination.ts is a separate step T14 runs AFTER this modal resolves).

  Visual language + z-index tier: same white-glass `--tm-panel-*` token family and the SAME
  1000/1001 shared dialog tier as SnapshotSettingsModal.vue (T11) — per the controller's binding
  amendment, this sits BELOW FileConflictDialog's dedicated 1050/1051 tier (T12), so if T14 opens
  the conflict dialog after this one resolves, it will already be closed (this modal fully
  closes itself before resolving) — no simultaneous-stacking scenario actually occurs, but the
  tier ordering is kept consistent with Vue2's own 4500 (this) vs 4550 (conflict dialog) +50 gap
  regardless. Built directly on reka-ui's Dialog primitives (not the shared components/ui/Dialog.vue
  wrapper), same reason T11/T12 forked off it: the generic wrapper's `.ui-dialog-content` carries
  its own fixed min-width/padding/dark-glass background that scoped CSS here can't override.
-->
<script setup lang="ts">
import { computed, ref, getCurrentScope, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import { service } from '@nimotech/nimoos-service'
import { destPathBreadcrumbs, listRestoreDirEntries } from '../util/restoreDestination'
import { iconNameFor, iconUrl } from '../util/icons'

defineOptions({ name: 'RestoreDestinationModal' })

const { t } = useI18n()

const visible = ref(false)
const mount = ref('')
const currentDir = ref('')
const entries = ref<{ name: string; path: string }[]>([])
const loading = ref(false)
// Session-only preference — deliberately NOT reset by open() (see file header's job #2) and
// never written to localStorage. Defaults on, matching Vue2's own default.
const withMarker = ref(true)

let resolver: ((v: { destDir: string; withMarker: boolean } | null) => void) | null = null

const breadcrumbs = computed(() => destPathBreadcrumbs(mount.value, currentDir.value))

async function fetchEntries(): Promise<void> {
  loading.value = true
  // Stale-response guard: capture the directory this fetch is FOR before the await, same
  // convention as SnapshotSettingsModal.vue's own per-network-call guards — a fast double-click
  // while a slower fetch is still in flight must not let the earlier response clobber the list
  // for the directory now on screen.
  const dir = currentDir.value
  try {
    const list = await listRestoreDirEntries(dir, (p) => service.folder.getList(p))
    if (dir !== currentDir.value) return
    entries.value = list
  } catch {
    if (dir !== currentDir.value) return
    entries.value = []
  } finally {
    if (dir === currentDir.value) loading.value = false
  }
}

function navigateTo(path: string): void {
  if (!path || path === currentDir.value) return
  currentDir.value = path
  void fetchEntries()
}

/**
 * Opens the picker seeded at `defaultDir` (falling back to the volume mount root itself when
 * empty) under the given volume `mount`, and returns a promise that resolves once the user
 * confirms or cancels. Every call re-seeds `currentDir`/`entries`/`loading` from scratch —
 * nothing from a previous open leaks in (Vue2 parity: the `visible` watcher's `onOpen()`) — but
 * `withMarker` is deliberately left untouched across opens (see file header).
 */
function open(m: string, defaultDir: string): Promise<{ destDir: string; withMarker: boolean } | null> {
  mount.value = m
  currentDir.value = defaultDir || m
  entries.value = []
  visible.value = true
  void fetchEntries()
  return new Promise((resolve) => { resolver = resolve })
}

function settle(result: { destDir: string; withMarker: boolean } | null): void {
  visible.value = false
  const r = resolver
  resolver = null
  r?.(result)
}

function handleCancel(): void {
  settle(null)
}

function handleConfirm(): void {
  settle({ destDir: currentDir.value, withMarker: withMarker.value })
}

function onOpenChange(v: boolean): void {
  if (!v) handleCancel()
}

// The modal lives inside whichever component owns it (T14 mounts it once, e.g. Files.vue), but
// the caller awaiting `open()`'s promise does not necessarily outlive that host — navigating
// away (or the host being torn down) mid-prompt unmounts this component while `open()`'s
// returned promise is still pending. Without this, that promise would never settle: the awaiting
// caller hangs forever. Settling `null` routes it through the exact same path as Cancel/Esc, so
// the caller reports it like any other cancel — same convention as
// useFileConflicts.ts's own onScopeDispose guard (see that file's comment for the identical
// failure mode in the upload-conflict flow). `getCurrentScope()` guard: this component's setup
// is also invoked directly by some tests without a real component scope, where
// onScopeDispose has no scope to attach to and would warn.
if (getCurrentScope()) {
  onScopeDispose(() => { if (resolver) settle(null) })
}

/** Real, per-entry folder icon (not an emoji glyph) — same `iconNameFor`/`iconUrl` util
 *  SnapshotPreviewWindow.vue already uses for its own folder/file rows (which itself picks
 *  different glyphs for well-known folder names like "Documents"/"Media"/"Downloads"), so this
 *  picker's drill-down list matches the rest of the Time Machine area pixel-for-pixel instead of
 *  inventing its own glyph. Vue2's own modal used a real `<b-icon icon="folder" ...>` here too
 *  (not text/emoji), so this is also closer parity, not just an internal-consistency nicety. */
function entryIconUrl(name: string): string {
  return iconUrl(iconNameFor({ name, is_dir: true }))
}

defineExpose({ open })
</script>

<template>
  <DialogRoot :open="visible" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="rdm-overlay" />
      <DialogContent class="rdm-content" :aria-describedby="undefined">
        <header class="rdm-head">
          <DialogTitle class="rdm-title">{{ t('tmRestoreTo') }}</DialogTitle>
          <button type="button" class="rdm-close-x" :aria-label="t('filesViewerClose')" @click="handleCancel">×</button>
        </header>

        <section class="rdm-body">
          <!-- Breadcrumb: click any earlier crumb to jump back up; the last (current) crumb is inert. -->
          <nav class="rdm-breadcrumb">
            <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.path">
              <span v-if="idx > 0" class="rdm-crumb-sep">/</span>
              <button
                type="button"
                class="rdm-crumb"
                :class="{ 'rdm-crumb--current': idx === breadcrumbs.length - 1 }"
                :disabled="idx === breadcrumbs.length - 1"
                @click="navigateTo(crumb.path)"
              >{{ crumb.label }}</button>
            </template>
          </nav>

          <!-- Folder list: subdirectories of the current directory only -- files can't be restore targets. -->
          <div class="rdm-list">
            <div v-if="loading" class="rdm-muted rdm-list-state">{{ t('filesViewerLoading') }}</div>
            <div v-else-if="entries.length === 0" class="rdm-muted rdm-list-state">{{ t('tmNoSubfolders') }}</div>
            <ul v-else class="rdm-entries">
              <li v-for="entry in entries" :key="entry.path" class="rdm-entry" role="button" @click="navigateTo(entry.path)">
                <img class="rdm-entry-icon" :src="entryIconUrl(entry.name)" alt="" />
                <span class="rdm-entry-name">{{ entry.name }}</span>
              </li>
            </ul>
          </div>

          <!-- .restored marker toggle -->
          <div class="rdm-divider"></div>
          <div class="rdm-row">
            <span class="rdm-key">{{ t('tmMarkerToggle') }}</span>
            <button
              type="button"
              class="rdm-switch"
              role="switch"
              :aria-checked="withMarker"
              :aria-label="t('tmMarkerToggle')"
              :class="{ 'rdm-switch--on': withMarker }"
              @click="withMarker = !withMarker"
            ><span class="rdm-switch-thumb"></span></button>
          </div>
          <div v-if="!withMarker" class="rdm-muted rdm-marker-note">{{ t('tmMarkerOffHint') }}</div>
        </section>

        <footer class="rdm-foot">
          <span class="rdm-current-dir" :title="currentDir">{{ currentDir }}</span>
          <div class="rdm-foot-actions">
            <button type="button" class="rdm-cancel" @click="handleCancel">{{ t('filesCancel') }}</button>
            <button type="button" class="rdm-confirm" @click="handleConfirm">{{ t('tmRestoreHere') }}</button>
          </div>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Shared 1000/1001 tier -- see file header: deliberately BELOW FileConflictDialog's 1050/1051. */
.rdm-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }

.rdm-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  width: 480px; max-width: 92vw; height: auto; max-height: 70vh;
  border-radius: 16px;
  background: var(--tm-panel-bg);
  backdrop-filter: var(--tm-panel-blur);
  -webkit-backdrop-filter: var(--tm-panel-blur);
  border: 1px solid var(--tm-panel-border);
  box-shadow: var(--tm-panel-shadow);
  color: var(--tm-text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .rdm-content { background: var(--tm-panel-bg-solid); }
}

.rdm-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 20px 24px 12px; border-bottom: 1px solid var(--tm-hairline); flex-shrink: 0;
}
.rdm-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--tm-text); }
.rdm-close-x {
  flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; padding: 0; color: var(--tm-text-dim); cursor: pointer;
  border-radius: var(--tm-control-radius); font-size: 18px; line-height: 1;
}
.rdm-close-x:hover { background: var(--tm-ghost-hover-bg); color: var(--tm-text); }

.rdm-body { padding: 16px 24px 20px; flex: 1 1 auto; min-height: 0; overflow-y: auto; color: var(--tm-text); }
.rdm-muted { font-size: 0.75rem; color: var(--tm-text-dim); margin: 0; }

.rdm-breadcrumb { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; margin-bottom: 8px; }
.rdm-crumb {
  background: transparent; border: none; padding: 2px 4px; border-radius: 6px; font-size: 12px;
  color: var(--tm-accent); cursor: pointer;
}
.rdm-crumb:hover:not(:disabled) { background: var(--tm-ghost-hover-bg); text-decoration: underline; }
.rdm-crumb--current { color: var(--tm-text); cursor: default; font-weight: 600; }
.rdm-crumb:disabled { cursor: default; }
.rdm-crumb-sep { color: var(--tm-text-dim); font-size: 12px; }

.rdm-list { border: 1px solid var(--tm-ghost-border); border-radius: 10px; min-height: 160px; max-height: 260px; overflow-y: auto; }
.rdm-list-state { padding: 24px 12px; text-align: center; }
.rdm-entries { margin: 0; padding: 4px; list-style: none; }
.rdm-entry {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer;
  font-size: 13px; color: var(--tm-text);
}
.rdm-entry:hover { background: var(--tm-ghost-hover-bg); }
.rdm-entry-icon { width: 18px; height: 18px; object-fit: contain; flex-shrink: 0; }
.rdm-entry-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.rdm-divider { height: 1px; background: var(--tm-hairline); margin: 16px 0 12px; }
.rdm-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rdm-key { font-size: 12px; color: var(--tm-text-dim); }
.rdm-marker-note { margin-top: 6px; }

/* Switch -- same hand-rolled pill idiom as SnapshotSettingsModal.vue's own .ssm-switch (T11). */
.rdm-switch {
  position: relative; width: 38px; height: 21px; flex: none; padding: 0; cursor: pointer;
  border-radius: 9999px; border: none; background: var(--tm-switch-off-bg);
  transition: background 0.15s var(--ease, ease);
}
.rdm-switch--on { background: var(--tm-accent); }
.rdm-switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 9999px;
  background: var(--tm-panel-bg-solid); box-shadow: var(--tm-switch-thumb-shadow); transition: transform 0.15s var(--ease, ease);
}
.rdm-switch--on .rdm-switch-thumb { transform: translateX(17px); }

.rdm-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 24px 18px; border-top: 1px solid var(--tm-hairline); flex-shrink: 0;
}
.rdm-current-dir {
  min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px; color: var(--tm-text-dim);
}
.rdm-foot-actions { display: flex; gap: 8px; flex-shrink: 0; }
.rdm-cancel, .rdm-confirm {
  padding: 7px 16px; border-radius: var(--tm-control-radius); font-size: 13px; cursor: pointer; border: none;
}
.rdm-cancel { background: transparent; border: 1px solid var(--tm-ghost-border); color: var(--tm-text-dim); }
.rdm-cancel:hover { background: var(--tm-ghost-hover-bg); color: var(--tm-text); border-color: var(--tm-ghost-border-hover); }
.rdm-confirm { background: var(--tm-accent); color: var(--tm-chrome-text); }
.rdm-confirm:hover { background: var(--tm-accent-hover); }
</style>
