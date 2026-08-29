// 1:1 Port from Vue2 src/views/AI/Agent/tabs/ActivityTab.vue:47-52 (formatDuration
// function), extracted as a pure function for ActivityTab.vue to consume + independent unit test.
//
// Vue2 original falsy branch returns 'Done' directly (un-i18n'd English literal). Current policy
// (decided 2026-07-27) is to add Chinese keys for these kinds of literals — but translation is
// the rendering layer's responsibility, not this pure function's. So here we use `null` as a
// sentinel for "done" state, which the caller (ActivityTab.vue) maps to `t('aiActivityDone')`
// at render time; millisecond/second number formatting part (ms/s units) is not in this period's
// i18n checklist, so we keep the literal suffix as-is.
export function formatDuration(ms?: number | null): string | null {
  if (!ms && ms !== 0) return null
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`
  const s = ms / 1000
  return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`
}
