import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// App-level toast (single source of truth). Toasts STACK: each show() pushes a
// new toast that removes itself after its own duration (default 1500ms; callers
// may pass a longer one, e.g. uploads use 5000ms). `msg` is kept as a
// backward-compatible computed = the latest toast's text for legacy readers.
//
// `action` (Task 9, SP7-P3 photos trash view): optional inline affordance (e.g.
// "Undo") rendered as a clickable pill inside the toast by AppToast.vue.
// Third, optional `show()` param — fully backward compatible with the dozens
// of existing `toast.show(text[, duration])` call sites across the app.
//
// SP8-P1c2 Task 6: added a `tier` so severity can be styled distinctly
// (info/warning/danger) — see AppToast.vue's `data-tier`. Backward
// compatibility is a hard requirement: `tier` defaults to 'info', so every
// existing `show(text)` / `show(text, ms)` call site across the repo
// (files/apps/home areas) keeps working unchanged, same appearance
// (the 'info' tier renders identically to the pre-tier pill).
//
// 【SP8-P6-T3 合流】sp7 与 sp8 各自把**第三个位置参数**占用了:master 侧是 `action`
// 对象,sp8 侧是 `tier` 字符串。两边都已有实际调用点(tier ~48 处、action 4 处),
// 谁改签名都要动几十个调用点,所以这里把第三参做成**判别联合**:
//   typeof === 'string' → 当 tier;否则当 action 对象。
// 两侧全部既有调用点因此一行都不用改,类型上也仍然精确。
export type ToastTier = 'info' | 'warning' | 'danger'
export interface ToastAction { label: string; onClick: () => void }
export interface ToastItem { id: number; text: string; tier: ToastTier; action?: ToastAction }

export const useToast = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])
  let seq = 0
  function show(text: string, duration = 1500, tierOrAction: ToastTier | ToastAction = 'info') {
    const id = ++seq
    const tier = typeof tierOrAction === 'string' ? tierOrAction : 'info'
    const action = typeof tierOrAction === 'string' ? undefined : tierOrAction
    toasts.value.push({ id, text, tier, action })
    setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id) }, duration)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  const msg = computed(() => (toasts.value.length ? toasts.value[toasts.value.length - 1].text : ''))
  return { toasts, msg, show, dismiss }
})
