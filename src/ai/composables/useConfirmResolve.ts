// SP14 T1 —— 三张确认卡(McpPermissionCard / McpElicitFormCard / McpElicitUrlCard)
// 共用的提交状态机,对齐 Vue2 #136 的最终形态。
//
// 为什么抽出来而不是各卡复制:#136 的要求就是「三卡行为一致」。confirm_id 是一次性的
// (后端 ConfirmManager.resolve 会把它从 _pending 移除),此后每次 POST 都是 409。
// 复制三份判据必漂,而漂掉的后果是用户对着一张永远点不动的卡反复点。
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
    // expired 是单向的:后端已经不认这个 confirm_id 了,再发多少次都是 409。
    if (expired.value || submitting.value) return
    submitting.value = true
    submitError.value = ''
    try {
      await send()
      decision.value = action
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } } | null)?.response?.status
      // 只有 409 是终态。500 或断连时 confirm_id 可能还活在 _pending 里,
      // 卡片保持可用、表单内容不清空,允许用户重试。
      if (status === 409) {
        expired.value = true
        submitError.value = t('aiConfirmExpired')
      } else {
        const detail = (e as Error | null)?.message || t('aiUnknownError')
        submitError.value = t('aiSubmitFailed', { detail })
      }
    } finally {
      submitting.value = false
    }
  }

  // 请求还没发出去就判失败的路径(缺 confirm_id、URL scheme 不在白名单)。
  function fail(msgKey: string): void {
    submitError.value = t(msgKey)
  }

  return { decision, submitting, expired, submitError, run, fail }
}
