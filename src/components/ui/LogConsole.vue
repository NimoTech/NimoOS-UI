<script setup lang="ts">
// Presentational log-console shell: dark console background + rounded corners + floating toolbar
// at the top-right + stick-to-bottom auto-scroll.
// Extracted from src/apps/console/LogsPane.vue (the app console logs page); now shared, with the
// same look and scroll behavior, by it and the settings area's "Terminal & Logs" system-log card
// (src/settings/panels/terminal/LogsCard.vue).
// Contains no data-fetching/polling logic — pure props (text/emptyText) in, slots (tools/default) out.
//
// Callers can override layout details via CSS custom properties (defaults are identical to the
// original LogsPane, guaranteeing zero visual change after the app-console migration):
// --log-console-tools-top/-right (toolbar overlay position),
// --log-console-pad-top (top padding of the log body; the settings area uses it to clear the toolbar),
// --log-console-min-height/-max-height (the settings area is not inside a fixed-height flex layout
// and needs its own height cap).
import { nextTick, ref, watch } from 'vue'

defineOptions({ name: 'LogConsole', inheritAttrs: false })
const props = defineProps<{ text: string; emptyText?: string }>()
const box = ref<HTMLElement | null>(null)

// Stick-to-bottom auto-scroll: only scroll to the tail of new content when the viewport is
// already at (or near) the bottom (40px threshold) — never disturb the scroll position while the
// user is scrolling up through history (carried over from the original LogsPane implementation).
watch(() => props.text, () => {
  const el = box.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  if (atBottom) void nextTick(() => { el.scrollTop = el.scrollHeight })
})
</script>

<template>
  <div class="log-console">
    <div class="log-console-tools"><slot name="tools" /></div>
    <slot />
    <pre ref="box" v-bind="$attrs" class="log-console-pre">{{ text || emptyText }}</pre>
  </div>
</template>

<style scoped>
.log-console {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: var(--log-console-min-height, 320px);
  max-height: var(--log-console-max-height, none);
  border-radius: 12px;
  overflow: hidden;
  background: var(--console-bg);
}
.log-console-tools {
  position: absolute;
  top: var(--log-console-tools-top, 10px);
  right: var(--log-console-tools-right, 28px);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}
/* margin top/right/bottom 10px: the scrollbar hugs the scroll container's edge with no way to
   offset it, so the container itself must be inset to keep it off the rounded frame
   (on-device pitfall 2026-07-22: theme.css sets standard scrollbar-width/color on *, which makes
   Chrome 121+ disable all ::-webkit-scrollbar customization — the earlier width/track margins
   were dead code).
   padding-top is broken out into a variable: the settings area uses it to clear the floating
   toolbar; the app console doesn't override it and keeps the original 10px. */
.log-console-pre {
  flex: 1;
  margin: 10px 10px 10px 0;
  padding: var(--log-console-pad-top, 10px) 14px 10px;
  overflow: auto;
  color: var(--console-fg);
  font: 13px/1.5 Consolas, Monaco, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
/* On the always-dark background the thumb uses a fixed light token: the global scrollbar color
   flips with the theme, and in the light theme a dark thumb is invisible on --console-bg */
.log-console-pre {
  scrollbar-width: thin;
  scrollbar-color: var(--console-scroll-thumb) transparent;
}
</style>
