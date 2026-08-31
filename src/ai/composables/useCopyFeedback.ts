import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '../../files/util/clipboard'
import { useToast } from '../../stores/toast'

/**
 * Copy button "copied" checkmark state.
 *
 * Original requirement: "After clicking copy, mark the corresponding copy button with a checkmark
 * to show it's been copied, reset when clicking to copy something else". In other words: **at most
 * one button is checked at any time** (copying something else → previous one auto-unchecks). So state
 * is a single "which key is currently checked" value, not a bunch of booleans — reset logic therefore
 * naturally holds, no manual cleanup needed.
 *
 * `.set-copybtn.done` (green text/border/light green bg) style already exists in `settings-styles.scss:115`,
 * but **has never been used in either repo** (Vue2 `settings-styles.scss:101` is also dead code, grep confirmed).
 * So this is new functionality not a porting miss, no Vue2 1:1 divergence declaration needed; reuse existing style.
 *
 * No auto-timeout uncheck: user wants "reset when copying something else", not timed disappearance.
 * One fewer timer means one fewer unmount cleanup pitfall.
 */
export function useCopyFeedback() {
  const { t } = useI18n()
  const toast = useToast()

  /** Currently checked button key; null = no button is checked. */
  const copiedKey = ref<string | null>(null)

  /**
   * Copy and check. `key` is a stable identifier the caller assigns to each button (e.g. 'endpoint' / 'json').
   * **Only check if copy truly succeeds**; on failure uncheck the old one too — otherwise user would think
   * this click succeeded (previous button still has green check while toast says failed, signals contradict).
   */
  async function copy(text: string, key: string): Promise<void> {
    try {
      await copyText(text)
      copiedKey.value = key
      toast.show(t('aiCopied'))
    } catch {
      copiedKey.value = null
      toast.show(t('aiCfgCopyFailed'), 3000, 'warning')
    }
  }

  /** Uncheck all. Called when dialog closes, avoids keeping last check on next open. */
  function resetCopied(): void {
    copiedKey.value = null
  }

  return { copiedKey, copy, resetCopied }
}
