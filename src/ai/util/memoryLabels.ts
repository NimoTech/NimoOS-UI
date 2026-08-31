// Extracted from Vue2 src/views/AI/Settings/sections/MemorySection.vue:78-79/98-99
// KIND_LABELS / SOURCE_LABELS mappings + kindLabel/sourceLabel methods. Extracted as pure
// functions to enable isolated testing of the 'return unknown values unchanged' fallback
// (brief Step 2 #14); <script setup> has no methods object to leverage, so unit tests
// must rely on direct calls to exported pure functions. Same approach as Task 9 formatModelSize.ts.
//
// Values changed from Vue2's literal English strings (e.g. 'Preference') to i18n key names
// (e.g. 'aiCfgMemKindPreference') — passed through t() once more in the component. Unknown
// values still return unchanged; vue-i18n 9's behavior for non-existent keys is to render
// the key itself (with 'missing key' warning in console), visually identical to Vue2
// `$t('weird')` → 'weird'.

/** Aligns with Vue2 MemorySection.vue:78 KIND_LABELS. */
export const KIND_LABEL_KEYS: Record<string, string> = {
  preference: 'aiCfgMemKindPreference',
  fact: 'aiCfgMemKindFact',
  goal: 'aiCfgMemKindGoal',
}

/** Aligns with Vue2 MemorySection.vue:79 SOURCE_LABELS. */
export const SOURCE_LABEL_KEYS: Record<string, string> = {
  auto: 'aiCfgMemSourceAuto',
  tool: 'aiCfgMemSourceTool',
  user: 'aiCfgMemSourceUser',
}

/** Aligns with Vue2 MemorySection.vue:98 (`kindLabel`). */
export function kindLabel(k: string): string {
  return KIND_LABEL_KEYS[k] || k
}

/** Aligns with Vue2 MemorySection.vue:99 (`sourceLabel`). */
export function sourceLabel(s: string): string {
  return SOURCE_LABEL_KEYS[s] || s
}
