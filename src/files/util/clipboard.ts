// 复制文本到剪贴板。
// navigator.clipboard 仅在安全上下文(HTTPS 或 localhost)可用;当设备经局域网 IP 走
// 明文 HTTP 访问(如 http://192.168.x.x/app/)时它为 undefined,直调会抛错。此时降级到
// document.execCommand('copy')。两条路径都失败才抛错,由调用方决定如何提示。
// 【SP8-P2b 验收第 4 轮,2026-07-30】临时 textarea 该挂在哪。
//
// 原本一律挂 document.body,结果**弹窗里的复制全部失败**(用户实测:AI 设置页页面上的复制
// 正常,「创建令牌」弹窗里三个都复制不到东西)。根因在 reka 的焦点陷阱
// (reka-ui/dist/FocusScope/FocusScope.js:57-62):DialogContent 在 **document** 上挂 focusin,
// 一旦焦点落到弹窗容器外面就 `focus(lastFocusedElement, { select: true })` 抢回去 ——
// 挂在 body 上的 textarea 正好在外面,于是我们的 select() 选区在 execCommand('copy') 之前
// 就被销毁。把 textarea 挂进弹窗容器内,`container.contains(target)` 成立,陷阱就不再干预。
//
// 找宿主的顺序:①当前焦点所在的弹窗(最准,复制按钮本身就在弹窗里)②文档里最后一个**打开**
// 的弹窗(嵌套弹窗取最内层;`data-state="open"` 是 reka DialogContentImpl.js:86 写的)
// ③都没有就还是 body —— 页面上那条本来就好使的路径行为完全不变。
function copyHost(): HTMLElement {
  const focused = document.activeElement as HTMLElement | null
  const nearest = focused?.closest?.('[role="dialog"][data-state="open"]')
  if (nearest) return nearest as HTMLElement
  const open = document.querySelectorAll('[role="dialog"][data-state="open"]')
  if (open.length) return open[open.length - 1] as HTMLElement
  return document.body
}

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
  const host = copyHost()
  // 复制完把焦点还回去:否则焦点留在一个马上被删掉的节点上,弹窗的 FocusScope 会因为
  // MutationObserver 看到节点消失而把焦点重置到弹窗容器本身(用户的按钮焦点无端丢失)。
  const prevFocus = document.activeElement as HTMLElement | null
  host.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    if (!document.execCommand('copy')) throw new Error('execCommand copy failed')
  } finally {
    host.removeChild(ta)
    if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus()
  }
}
