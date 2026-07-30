import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '../../files/util/clipboard'
import { useToast } from '../../stores/toast'

/**
 * 【SP8-P2b 验收第 5 轮,用户 2026-07-30 提的需求】复制按钮的"已复制"打勾态。
 *
 * 需求原文:「点击 copy 完之后把对应的 copy 打勾,表示已经复制过了,在点击复制其他东西时重置」。
 * 即:**同一时刻最多一个按钮是打勾的**(复制别的东西 → 上一个自动撤勾)。故状态是一个
 * "当前哪个 key 打勾"的单值,不是一堆布尔 —— 重置逻辑因此天然成立,不用手动清别人。
 *
 * `.set-copybtn.done`(绿字/绿边/浅绿底)这条样式 `settings-styles.scss:115` 早就在,
 * 但**两个仓库里从来没人用过**(Vue2 `settings-styles.scss:101` 同样是死样式,已 grep 确认)。
 * 所以这是新增功能而非移植漏接,不涉及 Vue2 1:1 的偏离申报;样式复用现成的那条。
 *
 * 不设自动超时撤勾:用户要的是"复制别的东西时重置",没要求定时消失。少一个定时器少一处
 * 卸载清理的坑。
 */
export function useCopyFeedback() {
  const { t } = useI18n()
  const toast = useToast()

  /** 当前打勾的按钮 key;null = 没有任何按钮打勾。 */
  const copiedKey = ref<string | null>(null)

  /**
   * 复制并打勾。`key` 是调用方给每个按钮起的稳定标识(如 'endpoint' / 'json')。
   * **只有复制真成功才打勾**;失败时把旧的勾一并撤掉 —— 否则用户会以为刚点的这次成功了
   * (上一个按钮还挂着绿勾,而 toast 说失败,两个信号自相矛盾)。
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

  /** 撤掉所有勾。弹窗关闭时调用,避免下次打开还挂着上次的勾。 */
  function resetCopied(): void {
    copiedKey.value = null
  }

  return { copiedKey, copy, resetCopied }
}
