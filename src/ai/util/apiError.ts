// SP8-P2b Task 4 — Backend error message extraction.
//
// Vue2 had 7 settings sections, each manually writing the same fallback chain (e.g.: BlacklistSection.vue:80-84、
// McpTokensSection.vue:186、ChannelsSection.vue:210), this period consolidates them into one place. Value order and
// priority align line-by-line with Vue2: response.data.message → response.data(string direct use /
// object JSON serialization) → error.message → fallback copy provided by caller.
//
// Serves only the 6 new sections written this period. **Do NOT go back to change the 5 existing inline implementations**
// (AgentComposer.vue / GoogleDriveAuthDialog.vue / NetworkStorageDialog.vue /
// files/stores/shares.ts / apps/composables/useInstallFlow.ts) —— that would be unrelated refactoring.
// [SP8-P2b Acceptance round 3 changes, user approved 2026-07-30] Original implementation had two issues, fixing both:
//   ① Only recognized Go service `message`. Python agent(`:8282`,FastAPI) puts errors in **`detail`**,
//      so detail entirely fell into the "object then JSON.stringify" fallback below.
//   ② That JSON.stringify fallback (inherited from Vue2 BlacklistSection.vue:82) echoes the entire response body to
//      the UI —— what the user saw when adding a bot to Channels failed was exactly `{"detail":"bot token rejected"}`.
// Therefore: add `detail` extraction, and **delete JSON.stringify**(if not recognized, continue down, ultimately falling to caller's
// localized fallback copy). Intentionally diverging from Vue2, already logged in apiError.test.ts and ledger.
// Note: the function may still return **backend English original text**(e.g., FastAPI's detail). To ensure the UI is fully localized at
// call sites, should instead use "backend string → i18n key" mapping (precedent: channelsFormat.ts's addBotErrorKey),
// do not directly treat the return value of this function as final copy for end users.
export function apiErrorMessage(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data

  if (data && typeof data === 'object') {
    const msg = (data as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail) return detail
    // Unrecognized objects: **do not** serialize back to display, continue down
  }
  if (typeof data === 'string' && data) return data

  const m = (e as { message?: unknown } | null | undefined)?.message
  if (typeof m === 'string' && m) return m

  return fallback
}
