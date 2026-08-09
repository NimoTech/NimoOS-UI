// SP14 T1 -- Shared submission state machine for the three confirm cards
// (McpPermissionCard / McpElicitFormCard / McpElicitUrlCard), matching Vue2 #136's
// final shape.
//
// Why extract this instead of copying it into each card: #136's requirement was
// exactly "the three cards must behave identically". confirm_id is single-use (the
// backend's ConfirmManager.resolve removes it from _pending), so every POST after the
// first is a 409. Three hand-copied judgements would inevitably drift, and the
// consequence of drift is a user clicking a card that will never respond again.
import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

export interface ConfirmResolveApi<A extends string> {
  decision: Ref<A | null>
  submitting: Ref<boolean>
  expired: Ref<boolean>
  submitError: Ref<string>
  run: (action: A, send: () => Promise<void>) => Promise<void>
  fail: (msgKey: string) => void
}

export function useConfirmResolve<A extends string>(): ConfirmResolveApi<A> {
  const { t } = useI18n()
  const decision = ref<A | null>(null) as Ref<A | null>
  const submitting = ref(false)
  const expired = ref(false)
  const submitError = ref('')

  async function run(action: A, send: () => Promise<void>): Promise<void> {
    // expired is one-way: the backend no longer recognizes this confirm_id, so any
    // further sends will all be 409.
    if (expired.value || submitting.value) return
    submitting.value = true
    submitError.value = ''
    try {
      await send()
      decision.value = action
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } } | null)?.response?.status
      // Only 409 is terminal. On a 500 or a dropped connection, the confirm_id may
      // still be alive in _pending, so the card stays usable and the form content is
      // not cleared, allowing the user to retry.
      if (status === 409) {
        expired.value = true
        submitError.value = t('aiConfirmExpired')
      } else {
        // Prefer a string detail from the backend's error body over the generic
        // Error#message: `e.message` is usually just the HTTP client's own
        // "Request failed with status code 500", which tells the user nothing the
        // status code didn't already say. response.data.detail is what the backend
        // actually wrote for a human to read, when it wrote anything at all.
        const respDetail = (e as { response?: { data?: { detail?: unknown } } } | null)
          ?.response?.data?.detail
        const detail = (typeof respDetail === 'string' ? respDetail : undefined)
          ?? (e as Error | null)?.message
          ?? t('aiUnknownError')
        submitError.value = t('aiSubmitFailed', { detail })
      }
    } finally {
      submitting.value = false
    }
  }

  // Path for failures decided before the request is even sent (missing confirm_id,
  // URL scheme not in the allowlist).
  function fail(msgKey: string): void {
    submitError.value = t(msgKey)
  }

  return { decision, submitting, expired, submitError, run, fail }
}
