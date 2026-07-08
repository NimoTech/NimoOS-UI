// 复制文本到剪贴板。
// navigator.clipboard 仅在安全上下文(HTTPS 或 localhost)可用;当设备经局域网 IP 走
// 明文 HTTP 访问(如 http://192.168.x.x/app/)时它为 undefined,直调会抛错。此时降级到
// document.execCommand('copy')。两条路径都失败才抛错,由调用方决定如何提示。
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // 安全上下文下仍可能因权限/焦点等原因失败,继续尝试兜底方案
    }
  }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.opacity = '0'
  ta.style.pointerEvents = 'none'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    if (!document.execCommand('copy')) throw new Error('execCommand copy failed')
  } finally {
    document.body.removeChild(ta)
  }
}
