import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// SP8-P2b Task 10 —— 承接 Vue2 sections/__tests__/McpTokensSection.spec.js 的 5 条
// 组件级用例(1 load 三条 + createToken + doDelete + onRevealClosed 共 6 条,brief 数了
// 5 条时把 load 的 3 条算成 1 组;这里按 Vue2 蓝本的 it() 数量,逐条落地为下面 1-6),
// 另加 brief 新增的 11 条(7-17)。纯函数断言(endpointUrl/buildInstruction/buildJson/
// fmtCreated/fmtLastUsed)已被 Task 9 的 mcpConnect.test.ts 承接,不在此重复。

const h = vi.hoisted(() => ({
  listMCPTokens: vi.fn(),
  createMCPToken: vi.fn(),
  deleteMCPToken: vi.fn(),
  copyText: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      listMCPTokens: h.listMCPTokens,
      createMCPToken: h.createMCPToken,
      deleteMCPToken: h.deleteMCPToken,
    },
  },
}))
vi.mock('../../../../files/util/clipboard', () => ({ copyText: h.copyText }))

import McpTokensSection from './McpTokensSection.vue'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import { mcpEndpointUrl } from '../../../util/mcpConnect'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSection() {
  return mount(McpTokensSection, { global: { plugins: [i18n] }, attachTo: document.body })
}

const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

/** Click the reka-ui AlertDialogAction whose visible text matches `label`
 *  (excludes PromptDialog's data-testid buttons, same手法 as ProvidersSection.test.ts). */
function clickAlertAction(label: string) {
  const btn = Array.from(document.body.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label && b.className.includes('ui-btn') && !b.dataset.testid,
  ) as HTMLButtonElement | undefined
  expect(btn).toBeTruthy()
  btn!.click()
}

function typePromptValue(value: string) {
  const input = document.body.querySelector('.ui-dialog-input') as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
}

function clickPromptConfirm() {
  const btn = document.body.querySelector('[data-testid="prompt-confirm"]') as HTMLButtonElement | null
  expect(btn).toBeTruthy()
  btn!.click()
}

function clickPromptCancel() {
  const btn = document.body.querySelector('[data-testid="prompt-cancel"]') as HTMLButtonElement | null
  expect(btn).toBeTruthy()
  btn!.click()
}

describe('McpTokensSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.listMCPTokens.mockReset()
    h.createMCPToken.mockReset()
    h.deleteMCPToken.mockReset()
    h.copyText.mockReset()
    h.listMCPTokens.mockResolvedValue({ tokens: [] })
    // SkModal 的明文弹窗 portal 目标默认是 '.set-app'(见 SkModal.vue 头注释 D1)。
    // 目标元素必须在组件挂载前就存在于 DOM,同 SkModal.test.ts 的 withHost() 手法。
    const host = document.createElement('div')
    host.className = 'set-app'
    document.body.appendChild(host)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  // ---- 承接 Vue2 6 条 ----

  it('1. load() 用 res.tokens 填充列表（本仓 service.ai.* 已剥掉 Vue2 axios 那层 .data，见组件头注释）', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [{ id: 'a', label: 'laptop', created_at: 1710000000000, last_used_at: null }],
    })
    const w = mountSection()
    await flush()
    const rows = w.findAll('.tok-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.tok-name').text()).toBe('laptop')
    expect(w.find('.set-note').exists()).toBe(false)
  })

  it('2. tokens 键缺失时归一为空数组，渲染空态文案', async () => {
    h.listMCPTokens.mockResolvedValue({})
    const w = mountSection()
    await flush()
    expect(w.findAll('.tok-row')).toHaveLength(0)
    expect(w.find('.set-note').text()).toBe('还没有令牌。创建一个,让外部 AI agent 能连接你的 NAS。')
  })

  it('3. load() 失败渲染「加载失败。」', async () => {
    h.listMCPTokens.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    expect(w.find('.set-note').text()).toBe('加载失败。')
  })

  it('4. createToken() 一次性展示明文、不进列表、不重拉列表', async () => {
    h.createMCPToken.mockResolvedValue({ id: 'b', token: 'nimoos_mcp_secret', label: 'x' })
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    typePromptValue('x')
    await nextTick()
    h.listMCPTokens.mockClear()
    clickPromptConfirm()
    await flush()
    expect(h.createMCPToken).toHaveBeenCalledWith({ label: 'x' })
    expect(h.listMCPTokens).not.toHaveBeenCalled()
    // 明文落在 <input readonly> 的 .value 属性上,不是文本节点,不能用 textContent 抓
    const revealInput = document.querySelector('.sk-modal input.set-input.full.mono') as HTMLInputElement
    expect(revealInput.value).toBe('nimoos_mcp_secret')
    // 组件自身子树(不含 teleport 到 .set-app 的弹窗内容)不含明文,证明列表没被写入
    expect(w.html()).not.toContain('nimoos_mcp_secret')
  })

  it('5. doDelete() 调用接口并移除该行，另一行保留', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [{ id: 'a', label: 'one' }, { id: 'b', label: 'two' }],
    })
    h.deleteMCPToken.mockResolvedValue({ revoked: true })
    const w = mountSection()
    await flush()
    await w.findAll('.tok-del')[0].trigger('click')
    await flush()
    clickAlertAction('删除')
    await flush()
    expect(h.deleteMCPToken).toHaveBeenCalledWith('a')
    expect(w.findAll('.tok-name').map((el) => el.text())).toEqual(['two'])
  })

  it('6. onRevealClose()（完成按钮）清明文并重新拉取列表', async () => {
    h.createMCPToken.mockResolvedValue({ id: 'b', token: 'nimoos_mcp_secret', label: 'x' })
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    typePromptValue('x')
    await nextTick()
    clickPromptConfirm()
    await flush()
    let revealInput = document.querySelector('.sk-modal input.set-input.full.mono') as HTMLInputElement
    expect(revealInput.value).toBe('nimoos_mcp_secret')

    h.listMCPTokens.mockResolvedValueOnce({
      tokens: [{ id: 'b', label: 'x', created_at: 2, last_used_at: null }],
    })
    const doneBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '完成' && b.className.includes('sk-btn'),
    ) as HTMLButtonElement
    expect(doneBtn).toBeTruthy()
    doneBtn.click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull() // 弹窗已关闭,明文连 DOM 都不在了
    expect(h.listMCPTokens).toHaveBeenCalledTimes(2) // 挂载时一次 + 关闭弹窗后重拉一次
    expect(w.findAll('.tok-name').map((el) => el.text())).toEqual(['x'])
  })

  // ---- 新增 11 条 ----

  it('7. 端点 URL 只读输入框展示 mcpEndpointUrl() 的值', async () => {
    const w = mountSection()
    await flush()
    const input = w.find('.set-row.top .set-input.full.mono')
    expect((input.element as HTMLInputElement).value).toBe(mcpEndpointUrl())
    expect(input.attributes('readonly')).toBeDefined()
  })

  it('8. 端点复制按钮调用 copyText(endpointUrl) 并弹「已复制」', async () => {
    h.copyText.mockResolvedValue(undefined)
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.findAll('.set-copybtn')[0].trigger('click')
    await flush()
    expect(h.copyText).toHaveBeenCalledWith(mcpEndpointUrl())
    expect(show).toHaveBeenCalledWith('已复制')
  })

  // 【SP8-P2b 验收第 5 轮,用户 2026-07-30 需求】「点击 copy 完之后把对应的 copy 打勾,
  // 表示已经复制过了,在点击复制其他东西时重置」。同时只有一个按钮打勾。
  // 打勾态复用 settings-styles.scss:115 的 `.set-copybtn.done`(两个仓库里原本都是死样式,
  // 见 useCopyFeedback.ts 头注释),图标由 copy 换成 check。
  it('8b. 复制成功后该按钮打勾(.done + check 图标);复制别的按钮时勾转移过去', async () => {
    h.copyText.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    const btns = () => w.findAll('.set-copybtn')
    const iconName = (i: number) =>
      btns()[i].findComponent(AgentIcon).props('name')

    // 初始:谁都不打勾,图标都是 copy
    expect(btns()[0].classes()).not.toContain('done')
    expect(iconName(0)).toBe('copy')

    await btns()[0].trigger('click')
    await flush()
    expect(btns()[0].classes()).toContain('done')
    expect(iconName(0)).toBe('check')
    expect(btns()[1].classes()).not.toContain('done')

    // 复制别的东西 → 勾转移,旧的撤销
    await btns()[1].trigger('click')
    await flush()
    expect(btns()[1].classes()).toContain('done')
    expect(iconName(1)).toBe('check')
    expect(btns()[0].classes()).not.toContain('done')
    expect(iconName(0)).toBe('copy')
  })

  it('8c. 复制失败不打勾,并把旧的勾撤掉', async () => {
    h.copyText.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    await w.findAll('.set-copybtn')[0].trigger('click')
    await flush()
    expect(w.findAll('.set-copybtn')[0].classes()).toContain('done')

    h.copyText.mockRejectedValueOnce(new Error('trap'))
    await w.findAll('.set-copybtn')[1].trigger('click')
    await flush()
    const btns = w.findAll('.set-copybtn')
    expect(btns[0].classes()).not.toContain('done')
    expect(btns[1].classes()).not.toContain('done')
  })

  it('9. 常驻接入说明框用占位令牌 <YOUR_TOKEN>（不是真令牌）', async () => {
    const w = mountSection()
    await flush()
    const textareas = w.findAll('textarea.set-input.code')
    expect(textareas).toHaveLength(2)
    expect((textareas[0].element as HTMLTextAreaElement).value).toContain('<YOUR_TOKEN>')
    expect((textareas[1].element as HTMLTextAreaElement).value).toContain('<YOUR_TOKEN>')
  })

  it('10. 两个常驻复制按钮分别复制说明文本（模板开头）与合法配置 JSON', async () => {
    h.copyText.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    const copyBtns = w.findAll('.set-copybtn')
    await copyBtns[1].trigger('click')
    await flush()
    const instrArg = h.copyText.mock.calls[0][0] as string
    expect(instrArg.startsWith('你将获得一台 NimoOS 个人云 MCP 服务器的访问权限')).toBe(true)

    h.copyText.mockClear()
    await copyBtns[2].trigger('click')
    await flush()
    const jsonArg = h.copyText.mock.calls[0][0] as string
    const parsed = JSON.parse(jsonArg)
    expect(parsed.mcpServers.nimoos.url).toBe(mcpEndpointUrl())
  })

  it('11. copyText 失败弹「复制失败,请手动选择」warning toast', async () => {
    h.copyText.mockRejectedValue(new Error('denied'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.findAll('.set-copybtn')[0].trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('复制失败,请手动选择', 3000, 'warning')
  })

  it('12. 令牌行元信息：创建于 / 从未使用(.never) / 最近使用', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [
        { id: 'a', label: 'never-one', created_at: 1710000000000, last_used_at: null },
        { id: 'b', label: 'used-one', created_at: 1710000000000, last_used_at: 1720000000000 },
      ],
    })
    const w = mountSection()
    await flush()
    const rows = w.findAll('.tok-row')

    expect(rows[0].findAll('.tok-meta span')[0].text()).toBe(`创建于: ${new Date(1710000000000).toLocaleString()}`)
    const neverSpan = rows[0].find('.tok-meta .never')
    expect(neverSpan.exists()).toBe(true)
    expect(neverSpan.text()).toBe('从未使用')

    const usedSpans = rows[1].findAll('.tok-meta span')
    const usedSpan = usedSpans[usedSpans.length - 1]
    expect(usedSpan.text()).toBe(`最近使用: ${new Date(1720000000000).toLocaleString()}`)
    expect(usedSpan.classes()).not.toContain('never')
  })

  it('13. label 为空时显示「(无标签)」', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [{ id: 'a', label: '', created_at: 1, last_used_at: null }],
    })
    const w = mountSection()
    await flush()
    expect(w.find('.tok-name').text()).toBe('(无标签)')
  })

  it('14. 令牌数量渲染在 .sk-section-hint', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [{ id: 'a', label: 'x' }, { id: 'b', label: 'y' }],
    })
    const w = mountSection()
    await flush()
    expect(w.find('.sk-section-hint').text()).toBe('2')
  })

  it('15. 创建令牌弹窗点取消 -> createMCPToken 不被调', async () => {
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    clickPromptCancel()
    await flush()
    expect(h.createMCPToken).not.toHaveBeenCalled()
  })

  it('16. PromptDialog 输入前后有空格 -> 传给接口的 label 被 trim', async () => {
    h.createMCPToken.mockResolvedValue({ id: 'c', token: 'sek', label: 'x' })
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    typePromptValue('  x  ')
    await nextTick()
    clickPromptConfirm()
    await flush()
    expect(h.createMCPToken).toHaveBeenCalledWith({ label: 'x' })
  })

  it('17. 创建/删除失败分别弹 danger toast（后端消息优先，兜底文案）', async () => {
    h.listMCPTokens.mockResolvedValue({ tokens: [{ id: 'a', label: 'one' }] })
    h.createMCPToken.mockRejectedValueOnce({ response: { data: { message: '名额已满' } } })
    h.deleteMCPToken.mockRejectedValueOnce({}) // 无 response.data.message、无 .message -> 走兜底文案
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    typePromptValue('x')
    await nextTick()
    clickPromptConfirm()
    await flush()
    expect(show).toHaveBeenCalledWith('名额已满', 3000, 'danger')

    show.mockClear()
    await w.find('.tok-del').trigger('click')
    await flush()
    clickAlertAction('删除')
    await flush()
    expect(show).toHaveBeenCalledWith('删除失败', 3000, 'danger')
  })
})
