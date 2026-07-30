import { describe, it, expect, afterEach, vi } from 'vitest'
import { copyText } from './clipboard'

describe('copyText', () => {
  const origClipboard = (navigator as unknown as { clipboard: unknown }).clipboard
  const origExec = document.execCommand

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, configurable: true, writable: true })
    document.execCommand = origExec
    vi.restoreAllMocks()
  })

  it('uses navigator.clipboard.writeText in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await copyText('/NimoOS-HD/a')
    expect(writeText).toHaveBeenCalledWith('/NimoOS-HD/a')
  })

  it('falls back to execCommand when navigator.clipboard is undefined (insecure HTTP context)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    let copied = ''
    document.execCommand = vi.fn(() => {
      copied = document.querySelector('textarea')?.value ?? ''
      return true
    }) as typeof document.execCommand
    await copyText('/NimoOS-HD/Gallery/x.jpg')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(copied).toBe('/NimoOS-HD/Gallery/x.jpg')
    // temporary textarea is cleaned up afterwards
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back to execCommand when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    document.execCommand = vi.fn(() => true) as typeof document.execCommand
    await copyText('abc')
    expect(writeText).toHaveBeenCalled()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('throws when both clipboard API and execCommand fail (so the caller can surface an error)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn(() => false) as typeof document.execCommand
    await expect(copyText('x')).rejects.toThrow()
  })
})

// 【SP8-P2b 验收第 4 轮,2026-07-30】用户实测:AI 设置页**页面上**的复制正常,**「创建令牌」
// 弹窗里的三个复制全部失败(剪贴板里什么都没有)**。
//
// 根因从 reka 源码定死(reka-ui/dist/FocusScope/FocusScope.js:57-62):DialogContent 的
// FocusScope(trapped)在 **document 上**挂了 focusin 监听 ——
//     if (container.contains(target)) lastFocusedElementRef.value = target
//     else focus(lastFocusedElementRef.value, { select: true })
// 兜底方案把临时 <textarea> 挂到 document.body 上再 focus(),这个 textarea 不在弹窗容器内
// → 焦点被**立刻抢回**弹窗里上一个焦点元素,而且 `{select: true}` 还会去选中那个元素的文本
// → 我们刚做的 ta.select() 选区在 execCommand('copy') 之前就被销毁 → 复制不到任何东西。
// 页面上的复制没有弹窗、没有 FocusScope,所以一直是好的 —— 与用户的现象完全对上。
//
// 修法:临时 textarea **挂进当前打开的弹窗容器内**(role="dialog"),这样
// `container.contains(target)` 成立,焦点陷阱不再干预。
describe('copyText —— 弹窗(焦点陷阱)内的兜底路径', () => {
  const origClipboard = (navigator as unknown as { clipboard: unknown }).clipboard
  const origExec = document.execCommand

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, configurable: true, writable: true })
    document.execCommand = origExec
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('弹窗打开且焦点在弹窗内时,临时 textarea 挂进弹窗容器(不是 body)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    const btn = document.createElement('button')
    dialog.appendChild(btn)
    document.body.appendChild(dialog)
    btn.focus()

    let parentAtCopyTime: Element | null = null
    let copied = ''
    document.execCommand = vi.fn(() => {
      const ta = document.querySelector('textarea')
      parentAtCopyTime = ta?.parentElement ?? null
      copied = ta?.value ?? ''
      return true
    }) as typeof document.execCommand

    await copyText('mcp-token-abc')
    expect(copied).toBe('mcp-token-abc')
    expect(parentAtCopyTime).toBe(dialog) // 关键:在弹窗里,不是 body
    expect(document.querySelector('textarea')).toBeNull() // 用完清掉
  })

  it('焦点不在弹窗内(例如点击没让按钮取得焦点)也能找到打开的弹窗,取最后一个(嵌套弹窗)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const outer = document.createElement('div')
    outer.setAttribute('role', 'dialog')
    outer.setAttribute('data-state', 'open')
    const inner = document.createElement('div')
    inner.setAttribute('role', 'dialog')
    inner.setAttribute('data-state', 'open')
    document.body.append(outer, inner)

    let parentAtCopyTime: Element | null = null
    document.execCommand = vi.fn(() => {
      parentAtCopyTime = document.querySelector('textarea')?.parentElement ?? null
      return true
    }) as typeof document.execCommand

    await copyText('x')
    expect(parentAtCopyTime).toBe(inner)
  })

  it('已关闭的弹窗不算(data-state=closed 时仍挂 body)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'closed')
    document.body.appendChild(dialog)

    let parentAtCopyTime: Element | null = null
    document.execCommand = vi.fn(() => {
      parentAtCopyTime = document.querySelector('textarea')?.parentElement ?? null
      return true
    }) as typeof document.execCommand

    await copyText('x')
    expect(parentAtCopyTime).toBe(document.body)
  })

  it('没有弹窗时行为不变:仍挂 body(页面上的复制路径不受影响)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    let parentAtCopyTime: Element | null = null
    document.execCommand = vi.fn(() => {
      parentAtCopyTime = document.querySelector('textarea')?.parentElement ?? null
      return true
    }) as typeof document.execCommand

    await copyText('x')
    expect(parentAtCopyTime).toBe(document.body)
  })

  it('复制完把焦点还给原来的元素(不把用户的焦点丢在已删除的节点上)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('data-state', 'open')
    const btn = document.createElement('button')
    dialog.appendChild(btn)
    document.body.appendChild(dialog)
    btn.focus()
    document.execCommand = vi.fn(() => true) as typeof document.execCommand

    await copyText('x')
    expect(document.activeElement).toBe(btn)
  })
})
