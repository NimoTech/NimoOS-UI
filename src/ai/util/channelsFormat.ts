// 1:1 taken from Vue2 src/views/AI/Settings/sections/ChannelsSection.vue
// bindingLabel (:304-307) and pairInstructions computed (:185-190), plus template
// channelsBotTokenTail split/join fill (:29, `$t('channelsBotTokenTail').split('{tail}').join(inst.token_tail)`).
//
// Extracted to pure function same as Task 9 (mcpConnect.ts): Vue2's existing tests call
// methods/computed directly via this, <script setup> has no methods object to borrow.
// **But unlike Task 9**: the Vue 2 panel's ChannelsSection.spec.js (read through 2026-07-28)
// has no direct assertions on bindingLabel/pairInstructions — genCode test comment
// explicitly admits "{bot}/{code} substitution is not asserted here". So this file's 7 test
// examples don't inherit from spec.js's existing assertions; they are newly written directly
// from the Vue2 source behavior (0/7 inherited from spec.js's existing assertions).
//
// Three functions all avoid touching i18n — copy template is t()'d by caller then passed in,
// so pure function can test independently of vue-i18n. Task 12 (consumer) decided to use
// **approach two: self split/join + escape braces** (same mechanism as Task 9's
// buildMcpInstruction / Task 10's aiCfgMcpInstructionTemplate, not approach one vue-i18n
// named interpolation t(key, {bot, code})):
//   - i18n values' `{bot}`/`{code}`/`{tail}` must escape to `{'{'}bot{'}'}` etc., else
//     vue-i18n v9 when t(key) without params treats bare `{bot}` as named interpolation,
//     can't find value and eats it to empty (Task 10 lesson, verified in
//     mcpConnect.ts/McpTokensSection.vue).
//   - `channelsPairInstructions`'s literal `@` likewise must escape to `{'@'}` (vue-i18n
//     link syntax), so complete escape is `{'@'}{'{'}bot{'}'}'.
//   - After escape, the string t() parses is the template parameter for
//     fillPairInstructions/fillTokenTail here — it must **literally contain** bare
//     `{bot}`/`{code}`/`{tail}` substrings, then passed to this file's split/join for
//     "component's own" second replacement.
// This decision's landing (escaping i18n values) is outside this task scope — Task 12's
// consumer adds keys and escapes, here only declare and align mechanism, prevent Task 12
// from falling back to vue-i18n named interpolation path that gets eaten empty.
export interface ChannelBinding {
  id: string | number
  external_username?: string
  external_user_id?: string
  instance_name?: string
  channel_type?: string
  default_model?: string | null
  download_dir?: string
}

/** Align with Vue2 ChannelsSection.vue:304 bindingLabel. */
export function bindingLabel(b: ChannelBinding, noLabelText: string): string {
  if (b.external_username) return `@${b.external_username}`
  return b.external_user_id || noLabelText
}

/** Align with Vue2 ChannelsSection.vue:185 pairInstructions computed. */
export function fillPairInstructions(template: string, bot: string, code: string): string {
  return template.split('{bot}').join(bot).split('{code}').join(code)
}

/** Align with Vue2 ChannelsSection.vue:29 template channelsBotTokenTail split/join. */
export function fillTokenTail(template: string, tail: string): string {
  return template.split('{tail}').join(tail)
}

/**
 * SP8-P2b acceptance round 3, user decided 2026-07-30: add bot failure → localized copy
 * i18n **key**.
 *
 * Cause: UI showed backend original `{"detail":"bot token rejected"}` directly. User
 * demanded human-readable copy, no JSON echo, and multi-language.
 *
 * Approach shares same role as rest of this file: **pure function avoids vue-i18n**, only
 * unifies backend error to key, caller uses t() for current language copy. Backend
 * `NimoOS-AI/agent/main.py:417-424` this interface has three 422 details only, mapped one-by-one;
 * **unrecognized ones all fall back to generic key, backend original never displayed**
 * (this is what caused the defect, can't leave a backdoor).
 *
 * Read both `detail` (FastAPI) and `message` (Go service) shapes — this interface is Python agent
 * now, but same entrypoint may later be proxied by Go side, recognizing both adds no cost.
 * Lowercase and trim whitespace before matching.
 */
export function addBotErrorKey(e: unknown): string {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  const raw = data && typeof data === 'object'
    ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
    : data
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''

  if (s === 'bot token rejected') return 'aiCfgChannelsErrTokenRejected'
  if (s === 'bot_token required') return 'aiCfgChannelsErrTokenRequired'
  if (s === 'unsupported channel_type') return 'aiCfgChannelsErrUnsupportedType'
  return 'aiCfgChannelsAddBotFailed'
}
