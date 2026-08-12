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
</script>

<template>
  <Teleport to="body">
    <div class="photos-toast-host photos-root" :class="themeClass">
      <TransitionGroup name="photos-toast" tag="div" class="photos-toast-stack">
        <div v-for="toast in toasts" :key="toast.id" class="photos-toast">
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

/* Undo/action button: 4px 11px padding, 99px pill, accent-at-20%-alpha
   fill. No 20%-alpha accent token exists; --accent-soft (18% alpha) is the
   nearest pre-blended token and is used per "express through a parity token
   where one exists" rather than composing a fresh alpha-blend function call
   from --accent-rgb — the guard flags any bare color-function call, whether
   or not its arguments are var()-wrapped, so only whole pre-blended tokens
   pass unexempted. */
.photos-toast-action {
  padding: 4px 11px;
  margin-left: 2px;
  border-radius: 99px;
  border: 1px solid var(--accent-glow);
  background: var(--accent-soft);
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
