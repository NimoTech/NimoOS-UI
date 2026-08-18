<script setup lang="ts">
// Pixel counterpart of Vue2's body-mounted `window.PhotosToast`
// (src/views/Photos/photosToast.js in NimoOS-UI, read only for the visual
// parameters below — nothing in that file is transcribed here). Mount this
// once per photos view; it Teleports to <body> so toasts float above any
// view's own scroll/overflow, exactly like the Vue2 portal did.
//
// The Teleport target itself carries `photos-root` + the shared themeClass
// (usePhotosTheme) so the parity scss tokens (--accent, --accent-rgb, …)
// resolve here even though this subtree lives outside the normal
// `.photos-root` DOM ancestry — mirrors how Vue2's own portals re-applied
// `photos-root` to their portal host.
import { usePhotosTheme } from '../composables/usePhotosTheme'
import { usePhotosToast } from '../composables/usePhotosToast'

const { toasts } = usePhotosToast()
const { themeClass } = usePhotosTheme()

// Icon glyphs, pixel reference: Vue2 photosToast.js:24-40 (svgIcon()) —
// 24x24 viewBox, stroke-based, rendered at 14x14 tinted by the accent
// color via `currentColor` (see .photos-toast-icon below). Only the icon
// names actually consumed by a photos caller are ported here as they come
// up (currently the delete-toast's 'trash', PhotosTimeline.vue:704-718 in
// Vue2; Fix-10's 'sparkles' -- the duplicate-success toast both
// PhotosAlbumDetail.vue's `duplicateAlbum()` and PhotosSmartViewDetail.vue's
// `duplicateSv()` show; and Fix-10's 'album' -- the smart-view-to-album
// convert-success toast, PhotosSmartViewDetail.vue's `doConvertToAlbum()`.
// All three verbatim path data from Vue2 photosToast.js:24) — an unmapped
// `icon` renders nothing rather than falling back to a generic glyph like
// Vue2 did, so a typo'd name is visibly silent instead of silently
// substituting the wrong picture.
const ICON_PATHS: Record<string, string> = {
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13',
  // Vue2's 'sparkles' glyph is a path + a circle, and 'album' is a rect + a
  // path (photosToast.js:24) -- the second shape of each is rendered as a
  // separate <circle>/<rect> element in the template below, gated on the
  // matching icon name, since this component's single-`<path d>` model
  // can't express an ellipse/rect as path data without an ugly
  // arc/line-command approximation.
  sparkles: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  album: 'M3 14l5-4 4 3 3-2 6 5',
}

function iconPath(icon?: string): string | undefined {
  return icon ? ICON_PATHS[icon] : undefined
}
</script>

<template>
  <Teleport to="body">
    <div class="photos-toast-host photos-root" :class="themeClass">
      <TransitionGroup name="photos-toast" tag="div" class="photos-toast-stack">
        <div v-for="toast in toasts" :key="toast.id" class="photos-toast">
          <svg
            v-if="iconPath(toast.icon)"
            class="photos-toast-icon"
            data-role="photos-toast-icon"
            :data-icon="toast.icon"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
          ><rect
              v-if="toast.icon === 'album'" x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2" fill="none"
            /><path :d="iconPath(toast.icon)" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" /><circle
              v-if="toast.icon === 'sparkles'" cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" fill="none"
            /></svg>
          <span class="photos-toast-text">{{ toast.text }}</span>
          <button
            v-if="toast.action"
            type="button"
            data-role="photos-toast-action"
            class="photos-toast-action"
            @click="toast.action.onClick()"
          >{{ toast.action.label }}</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
/* Pixel reference: Vue2 photosToast.js:10-117 (visual parameters only, see
   header comment). Container: fixed, centered at left:50% bottom:28px,
   column-reverse stack with 8px gap. */
.photos-toast-host {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
}
.photos-toast-stack {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 8px;
}

/* Single pill: border-radius 99px, accent-at-35%-alpha border (--accent-glow
   is an exact match for that value), 12px backdrop-blur. The two
   theme-dependent surfaces below have no equivalent parity token (closest is
   --pop-bg, whose channel/alpha values differ from Vue2's literals) —
   registered per color-guard.test.ts's theme-exception convention. */
.photos-toast {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px 10px 14px;
  border-radius: 99px;
  border: 1px solid var(--accent-glow);
  color: var(--text-1);
  font: 500 12.5px/1 var(--font-sans);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(20, 18, 32, 0.92); /* theme-exception: Vue2 parity literal, photos toast surface (dark) */
}
.photos-toast-host.is-light .photos-toast {
  background: rgba(255, 255, 255, 0.94); /* theme-exception: Vue2 parity literal, photos toast surface (light) */
}

/* Icon glyph: 14x14, tinted by the accent color via currentColor (Vue2
   photosToast.js:39's `color:${color}` on the <svg> style, ported as a CSS
   `color` so the stroke inherits it). */
.photos-toast-icon {
  flex-shrink: 0;
  color: var(--accent);
}

/* Undo/action button: 4px 11px padding, 99px pill, accent-at-20%-alpha
   fill — same channel values as --accent-rgb, but no 20%-alpha token
   exists, so this is a literal exempted the same way as the pill-surface
   backgrounds above (registered per color-guard.test.ts's convention). */
.photos-toast-action {
  padding: 4px 11px;
  margin-left: 2px;
  border-radius: 99px;
  border: 1px solid var(--accent-glow);
  background: rgba(110, 91, 255, 0.2); /* theme-exception: Vue2 parity literal, photos toast undo fill */
  color: var(--accent);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

/* Enter opacity+translateY(8px) over .2s/.22s; leave over 240ms — same
   timing as Vue2, expressed as a Vue3 TransitionGroup instead of the
   original's manual RAF + setTimeout. */
.photos-toast-enter-from,
.photos-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.photos-toast-enter-active {
  transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.photos-toast-leave-active {
  transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}
</style>
