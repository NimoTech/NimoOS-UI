import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// SP8-P2b Task 12 —— 承接 Vue2 src/views/AI/Settings/__tests__/ChannelsSection.spec.js
// 的 7 条组件级用例(编号 1-7,注释里标出对应 spec.js 的 it() 标题),另加 brief 新增的
// 16 条(编号 8/10-24;编号 9 是「Vue2 watch:isAdmin 在本仓不可能触发」的未移植项,不写
// 测试,见 ChannelsSection.vue 头注释与下方 8 号用例后的说明)。
//
// Vue2 spec.js 断言的是 `w.vm.*` 内部状态(pairable/revealedCode/showCode/codeInstance/
// bindings/…)与 mock 调用参数;Vue3 <script setup> 不暴露任何内部状态给外部,故这里把每条
// 断言改成「渲染出的 DOM + service mock 的调用」这两类可观察事实,断言的仍是同一件事实
// (承接清单见组件头/任务报告,不在此重复贴)。

const h = vi.hoisted(() => ({
  listPairableChannelInstances: vi.fn(),
  listChannelBindings: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
  listChannelInstances: vi.fn(),
  createChannelInstance: vi.fn(),
  setChannelInstanceEnabled: vi.fn(),
  deleteChannelInstance: vi.fn(),
  createChannelPairingCode: vi.fn(),
  setChannelBindingModel: vi.fn(),
  setChannelBindingDownloadDir: vi.fn(),
  deleteChannelBinding: vi.fn(),
  copyText: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      listPairableChannelInstances: h.listPairableChannelInstances,
      listChannelBindings: h.listChannelBindings,
      listModels: h.listModels,
      listProviders: h.listProviders,
      listChannelInstances: h.listChannelInstances,
      createChannelInstance: h.createChannelInstance,
      setChannelInstanceEnabled: h.setChannelInstanceEnabled,
      deleteChannelInstance: h.deleteChannelInstance,
      createChannelPairingCode: h.createChannelPairingCode,
      setChannelBindingModel: h.setChannelBindingModel,
      setChannelBindingDownloadDir: h.setChannelBindingDownloadDir,
      deleteChannelBinding: h.deleteChannelBinding,
    },
  },
}))
vi.mock('../../../../files/util/clipboard', () => ({ copyText: h.copyText }))

import ChannelsSection from './ChannelsSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function asAdmin() { localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' })) }
function asUser() { localStorage.setItem('user', JSON.stringify({ username: 'guest', role: 'user' })) }

function mountSection() {
  return mount(ChannelsSection, { global: { plugins: [i18n] }, attachTo: document.body })
}

const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

/** Click the reka-ui AlertDialogAction/Cancel whose visible text matches `label`
 *  (excludes PromptDialog-style data-testid buttons; same手法 as McpTokensSection.test.ts). */
function clickAlertButton(label: string) {
  const btn = Array.from(document.body.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label && b.className.includes('ui-btn') && !b.dataset.testid,
  ) as HTMLButtonElement | undefined
  expect(btn).toBeTruthy()
  btn!.click()
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  for (const fn of Object.values(h)) fn.mockReset()
  h.listPairableChannelInstances.mockResolvedValue({ instances: [] })
  h.listChannelBindings.mockResolvedValue({ bindings: [] })
  h.listModels.mockResolvedValue({ models: [] })
  h.listProviders.mockResolvedValue([])
  h.listChannelInstances.mockResolvedValue({ instances: [] })
  h.createChannelInstance.mockResolvedValue({})
  h.setChannelInstanceEnabled.mockResolvedValue({})
  h.deleteChannelInstance.mockResolvedValue({})
  h.createChannelPairingCode.mockResolvedValue({ code: '' })
  h.setChannelBindingModel.mockResolvedValue({})
  h.setChannelBindingDownloadDir.mockResolvedValue({})
  h.deleteChannelBinding.mockResolvedValue({})
  h.copyText.mockResolvedValue(undefined)
  // SkModal portal 目标默认是 '.set-app'(见 SkModal.vue 头注释 D1),目标元素必须在组件
  // 挂载前就存在于 DOM,同 SkModal.test.ts / McpTokensSection.test.ts 的 host 手法。
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ChannelsSection', () => {
  // ---- 承接 Vue2 spec.js 7 条 ----

  it('1. loads pairable instances and bindings on create (non-admin)', async () => {
    h.listPairableChannelInstances.mockResolvedValue({
      instances: [{ id: 'i1', channel_type: 'telegram', name: 'fam', bot_username: 'fam_bot' }],
    })
    asUser()
    const w = mountSection()
    await flush()
    expect(h.listPairableChannelInstances).toHaveBeenCalled()
    expect(h.listChannelBindings).toHaveBeenCalled()
    // Vue2 断言 w.vm.pairable 长度为 1 —— 改成断言渲染出的配对行数
    expect(w.findAll('.set-row')).toHaveLength(1)
    expect(w.find('.set-row .lbl').text()).toContain('fam')
    // non-admin 不该加载管理员段数据(否定断言)
    expect(h.listChannelInstances).not.toHaveBeenCalled()
    // Vue2 断言 w.vm.isAdmin === false —— 改成断言管理员段未渲染
    expect(w.find('.sk-section-title').exists() ? w.text().includes('机器人配置') : true).toBe(false)
  })

  it('2. admin also loads channel instances', async () => {
    asAdmin()
    const w = mountSection()
    await flush()
    expect(w.text()).toContain('机器人配置')
    expect(h.listChannelInstances).toHaveBeenCalled()
  })

  it('3. genCode stores the revealed code and opens the modal', async () => {
    h.listPairableChannelInstances.mockResolvedValue({
      instances: [{ id: 'i1', channel_type: 'telegram', name: 'fam', bot_username: 'fam_bot' }],
    })
    h.createChannelPairingCode.mockResolvedValue({ code: '12345678', expires_at: 1 })
    asUser()
    const w = mountSection()
    await flush()
    await w.find('.set-row .sk-btn.primary').trigger('click')
    await flush()
    expect(h.createChannelPairingCode).toHaveBeenCalledWith('i1')
    // Vue2 断言 w.vm.revealedCode / w.vm.showCode —— 改成断言弹窗已挂载且明文码落在只读输入框
    const codeInput = document.querySelector('.sk-modal input.set-input.full.mono') as HTMLInputElement
    expect(codeInput.value).toBe('12345678')
    // codeInstance 驱动配对指引里的 bot 用户名(fillPairInstructions 的 {bot} 替换)
    expect(document.querySelector('.sk-modal')?.textContent).toContain('fam_bot')
  })

  it('4. setModel persists the chosen model key and updates the binding', async () => {
    h.listChannelBindings.mockResolvedValue({ bindings: [{ id: 'b1', default_model: null }] })
    h.listModels.mockResolvedValue({ models: [{ name: 'llama2', size: 500 }] })
    h.setChannelBindingModel.mockResolvedValue({ ok: true })
    asUser()
    const w = mountSection()
    await flush()
    const picker = w.findComponent({ name: 'ModelPicker' })
    expect(picker.exists()).toBe(true)
    expect(picker.props('selectedKey')).toBeNull()
    picker.vm.$emit('select', 'local:llama2')
    await flush()
    expect(h.setChannelBindingModel).toHaveBeenCalledWith('b1', 'local:llama2')
    // Vue2 断言 b.default_model —— 改成断言该行 ModelPicker 收到新 selectedKey 且展示新模型名
    expect(picker.props('selectedKey')).toBe('local:llama2')
    expect(picker.find('.model-pill-name').text()).toBe('llama2')
  })

  it('5. saveDownloadDir persists the folder', async () => {
    h.listChannelBindings.mockResolvedValue({ bindings: [{ id: 'b1', download_dir: '/DATA/Downloads/telegram' }] })
    h.setChannelBindingDownloadDir.mockResolvedValue({ ok: true })
    asUser()
    const w = mountSection()
    await flush()
    const input = w.find('.tok-row input.set-input')
    ;(input.element as HTMLInputElement).value = '/DATA/Downloads/tg2'
    await input.trigger('change')
    await flush()
    expect(h.setChannelBindingDownloadDir).toHaveBeenCalledWith('b1', '/DATA/Downloads/tg2')
    // Vue2 断言 b.download_dir —— 改成断言输入框的受控值确实更新为新目录
    expect((w.find('.tok-row input.set-input').element as HTMLInputElement).value).toBe('/DATA/Downloads/tg2')
  })

  it('6. doUnbind removes the binding from the list', async () => {
    h.listChannelBindings.mockResolvedValue({ bindings: [{ id: 'b1' }, { id: 'b2' }] })
    h.deleteChannelBinding.mockResolvedValue({ revoked: true })
    asUser()
    const w = mountSection()
    await flush()
    expect(w.findAll('.tok-row')).toHaveLength(2)
    await w.findAll('.tok-del')[0].trigger('click')
    await flush()
    clickAlertButton('解绑')
    await flush()
    expect(h.deleteChannelBinding).toHaveBeenCalledWith('b1')
    // Vue2 断言 w.vm.bindings.map(id) —— 改成断言剩余行数与该行从 DOM 消失
    expect(w.findAll('.tok-row')).toHaveLength(1)
  })

  it('7. addBot uses the selected channel type in the create payload', async () => {
    asAdmin()
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    const discordBtn = Array.from(document.querySelectorAll('.chan-type-opt')).find(
      (b) => b.textContent?.trim() === 'Discord',
    ) as HTMLButtonElement
    discordBtn.click()
    await flush()
    const nameInput = document.querySelector('.sk-modal .sk-field:nth-of-type(2) input') as HTMLInputElement
    const tokenInput = document.querySelector('.sk-modal .sk-field:nth-of-type(3) input') as HTMLInputElement
    nameInput.value = 'fam'
    nameInput.dispatchEvent(new Event('input'))
    tokenInput.value = 'disc:token'
    tokenInput.dispatchEvent(new Event('input'))
    await flush()
    const submitBtn = Array.from(document.querySelectorAll('.sk-modal-foot button')).find(
      (b) => b.textContent?.trim() === '添加机器人',
    ) as HTMLButtonElement
    submitBtn.click()
    await flush()
    expect(h.createChannelInstance).toHaveBeenCalledWith({
      channel_type: 'discord', name: 'fam', config: { bot_token: 'disc:token' },
    })
  })

  // ---- 新增(编号对齐 brief;9 号是未移植项,不写测试) ----

  it('8. 非管理员不渲染「机器人配置」段;管理员渲染(对照组)', async () => {
    asUser()
    const wUser = mountSection()
    await flush()
    expect(wUser.text()).not.toContain('机器人配置')

    // useSessionStore().user 是读 localStorage 的 computed,同一 Pinia 实例内首次求值后会
    // 缓存(见 stores/session.ts 头注释:「computed 读 localStorage 不构成响应式依赖」)——
    // 复用上面同一个 active pinia 会让这里读到 wUser 求值时缓存的旧结果。换一个新 Pinia
    // 实例(等价于真实场景的整页重载)才能让第二次挂载读到 asAdmin() 刚写入的新角色。
    asAdmin()
    setActivePinia(createPinia())
    const wAdmin = mountSection()
    await flush()
    expect(wAdmin.text()).toContain('机器人配置')
  })

  it('10. 三个加载各自独立失败,互不影响', async () => {
    h.listPairableChannelInstances.mockRejectedValue(new Error('boom'))
    h.listChannelBindings.mockRejectedValue(new Error('boom'))
    h.listChannelInstances.mockRejectedValue(new Error('boom'))
    asAdmin()
    const w = mountSection()
    await flush()
    expect(w.find('.sk-section-body .set-note').exists()).toBe(true) // 尚未配置聊天机器人
    expect(w.text()).toContain('加载失败。')
    // 管理员段没有崩溃、按钮仍可见(instances 落空数组而非抛出未捕获异常)
    expect(w.text()).toContain('机器人配置')
  })

  it('11. 可配对列表为空 → 渲染「尚未配置聊天机器人，请联系管理员添加。」', async () => {
    asUser()
    const w = mountSection()
    await flush()
    expect(w.text()).toContain('尚未配置聊天机器人，请联系管理员添加。')
  })

  it('12. 绑定列表为空 → 渲染「还没有绑定账号。…」', async () => {
    asUser()
    const w = mountSection()
    await flush()
    expect(w.text()).toContain('还没有绑定账号。在上方生成配对码并发送给机器人即可。')
  })

  it('13. 机器人行显示 @bot_username 与 token 尾号;invite_url 存在才渲染邀请链接(对照组)', async () => {
    h.listChannelInstances.mockResolvedValue({
      instances: [
        { id: 'a', name: 'Fam bot', channel_type: 'telegram', bot_username: 'fam_bot', token_tail: 'ab12', enabled: true, invite_url: 'https://discord.com/invite/xyz' },
        { id: 'b', name: 'No invite', channel_type: 'telegram', token_tail: 'cd34', enabled: false },
      ],
    })
    asAdmin()
    const w = mountSection()
    await flush()
    const rows = w.findAll('.tok-row')
    expect(rows[0].text()).toContain('@fam_bot')
    expect(rows[0].text()).toContain('token ···ab12')
    const link = rows[0].find('a.chan-invite')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener')
    expect(rows[1].find('a.chan-invite').exists()).toBe(false)
    expect(rows[1].text()).toContain('token ···cd34')
  })

  it('14. 切换机器人启用开关成功 → setChannelInstanceEnabled 被调、补拉 listPairableChannelInstances', async () => {
    h.listChannelInstances.mockResolvedValue({
      instances: [{ id: 'a', name: 'Fam bot', channel_type: 'telegram', enabled: false }],
    })
    asAdmin()
    const w = mountSection()
    await flush()
    h.listPairableChannelInstances.mockClear()
    const checkbox = w.find('.chan-switch input[type="checkbox"]')
    ;(checkbox.element as HTMLInputElement).checked = true
    await checkbox.trigger('change')
    await flush()
    expect(h.setChannelInstanceEnabled).toHaveBeenCalledWith('a', true)
    expect(h.listPairableChannelInstances).toHaveBeenCalledTimes(1) // Vue2 :246 成功后补拉一次
  })

  it('15. 启用开关失败 → danger toast,且不改写数据源(inst.enabled 未被写入)', async () => {
    h.listChannelInstances.mockResolvedValue({
      instances: [{ id: 'a', name: 'Fam bot', channel_type: 'telegram', enabled: true }],
    })
    h.setChannelInstanceEnabled.mockRejectedValue({})
    asAdmin()
    const w = mountSection()
    await flush()
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const checkbox = w.find('.chan-switch input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    ;(checkbox.element as HTMLInputElement).checked = false // 模拟用户手动取消勾选
    await checkbox.trigger('change')
    await flush()
    expect(show).toHaveBeenCalledWith('保存失败', 3000, 'danger')
    expect(h.listPairableChannelInstances).not.toHaveBeenCalledTimes(2) // 失败不补拉(只有挂载时那一次)
    // Vue2 :280 与本组件都是「inst.enabled = enabled 写在 await 之后,失败时不改」——但
    // `:checked="inst.enabled"`(非 v-model)这个绑定在 Vue 3(与 Vue2 同理)只有当
    // `next !== prev` 才会真正把值写回 DOM 的 checked 属性(runtime-core patchElement 对
    // 'checked' 没有像 'value' 那样的强制回写例外);inst.enabled 从未改变,意味着就算
    // 强制这个组件整体重渲染,Vue 也不会把我们手动改过的原生 DOM checked 状态纠正回来 ——
    // 这不是本组件的缺陷,是这个绑定模式(Vue2 原文一样的写法)本身的已知局限,不属于
    // 「1:1 照 Vue2」要修的可复现错误行为(constraints §7),不在这里改绑定方式。
    // 因此不测 DOM 残留的 checked 状态,改测「数据源真的没被改写」这件事本身:用同一份
    // (仍返回 enabled:true 的)mock 全新挂载一份组件实例——一次干净的从零渲染,不经历
    // 上面这次失败的 patch 残留,能证明失败路径没有把 false 提交回上层数据源。
    const fresh = mountSection()
    await flush()
    const freshCheckbox = fresh.find('.chan-switch input[type="checkbox"]')
    expect((freshCheckbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('16. 删除机器人:确认后调用接口、行消失、补拉可配对列表;取消不发请求', async () => {
    h.listChannelInstances.mockResolvedValue({
      instances: [{ id: 'a', name: 'Fam bot', channel_type: 'telegram', enabled: true }],
    })
    asAdmin()
    const w = mountSection()
    await flush()
    // 取消路径
    await w.find('.tok-del').trigger('click')
    await flush()
    clickAlertButton('取消')
    await flush()
    expect(h.deleteChannelInstance).not.toHaveBeenCalled()
    expect(w.findAll('.tok-row')).toHaveLength(1)
    // 确认路径
    h.listPairableChannelInstances.mockClear()
    await w.find('.tok-del').trigger('click')
    await flush()
    clickAlertButton('删除')
    await flush()
    expect(h.deleteChannelInstance).toHaveBeenCalledWith('a')
    expect(w.findAll('.tok-row')).toHaveLength(0)
    expect(h.listPairableChannelInstances).toHaveBeenCalledTimes(1)
  })

  it('17. addBot 的 token 为空/纯空格 → 提交按钮 disabled 且不发请求', async () => {
    asAdmin()
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    const submitBtn = Array.from(document.querySelectorAll('.sk-modal-foot button')).find(
      (b) => b.textContent?.trim() === '添加机器人',
    ) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true) // token 为空
    const tokenInput = document.querySelector('.sk-modal .sk-field:nth-of-type(3) input') as HTMLInputElement
    tokenInput.value = '   '
    tokenInput.dispatchEvent(new Event('input'))
    await flush()
    expect(submitBtn.disabled).toBe(true) // 纯空格同样禁用
    submitBtn.click()
    await flush()
    expect(h.createChannelInstance).not.toHaveBeenCalled()
  })

  it('18. addBot 成功:弹窗关闭、表单复位、两个列表各补拉一次', async () => {
    asAdmin()
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    const nameInput = document.querySelector('.sk-modal .sk-field:nth-of-type(2) input') as HTMLInputElement
    const tokenInput = document.querySelector('.sk-modal .sk-field:nth-of-type(3) input') as HTMLInputElement
    nameInput.value = 'fam'
    nameInput.dispatchEvent(new Event('input'))
    tokenInput.value = 'tg:token'
    tokenInput.dispatchEvent(new Event('input'))
    await flush()
    h.listChannelInstances.mockClear()
    h.listPairableChannelInstances.mockClear()
    const submitBtn = Array.from(document.querySelectorAll('.sk-modal-foot button')).find(
      (b) => b.textContent?.trim() === '添加机器人',
    ) as HTMLButtonElement
    submitBtn.click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull() // 弹窗已关闭
    expect(h.listChannelInstances).toHaveBeenCalledTimes(1)
    expect(h.listPairableChannelInstances).toHaveBeenCalledTimes(1)
    // 表单复位:重新打开弹窗,字段应回到初始值
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    const reopenedName = document.querySelector('.sk-modal .sk-field:nth-of-type(2) input') as HTMLInputElement
    const reopenedToken = document.querySelector('.sk-modal .sk-field:nth-of-type(3) input') as HTMLInputElement
    const telegramBtn = Array.from(document.querySelectorAll('.chan-type-opt')).find(
      (b) => b.textContent?.trim() === 'Telegram',
    ) as HTMLButtonElement
    expect(reopenedName.value).toBe('')
    expect(reopenedToken.value).toBe('')
    expect(telegramBtn.dataset.active).toBe('true')
  })

  // 【申报级偏离 Vue2 1:1,用户 2026-07-30 验收时拍板】原用例断言的是 Vue2 的 danger toast
  // (`Vue2 ChannelsSection.vue:270-272`)。用户原话:「添加错误 token 的机器人我希望错误提示
  // 在 token 输入栏上面而不是 toast 的形式,不要用以前 vue2 的模式了」。故本用例整体改写:
  // 错误落在 token 字段上方的行内提示,**且不再弹 toast**。弹窗不关这一点不变。
  it('19. addBot 失败 → token 输入框上方行内报错(本地化文案,认不出的后端原文一律不回显),不弹 toast、弹窗不关', async () => {
    // 后端(agent/main.py:424)真实形状:FastAPI 的 {detail:"bot token rejected"}
    h.createChannelInstance.mockRejectedValueOnce({ response: { data: { detail: 'bot token rejected' } } })
    asAdmin()
    const w = mountSection()
    await flush()
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    const tokenField = document.querySelector('.sk-modal .sk-field:nth-of-type(3)') as HTMLElement
    const tokenInput = tokenField.querySelector('input') as HTMLInputElement
    tokenInput.value = 'tg:token'
    tokenInput.dispatchEvent(new Event('input'))
    await flush()
    const submitBtn = Array.from(document.querySelectorAll('.sk-modal-foot button')).find(
      (b) => b.textContent?.trim() === '添加机器人',
    ) as HTMLButtonElement
    submitBtn.click()
    await flush()

    const err = tokenField.querySelector('.chan-field-err') as HTMLElement
    expect(err).not.toBeNull()
    // 显示的是本地化文案(zh_cn 的 aiCfgChannelsErrTokenRejected),不是后端英文原文
    expect(err.textContent).toBe(zh.aiCfgChannelsErrTokenRejected)
    expect(err.textContent).not.toContain('bot token rejected')
    // 关键回归:界面上永不出现 JSON 片段(用户 2026-07-30 看到过 {"detail":"..."} )
    expect(err.textContent).not.toContain('{')
    expect(err.textContent).not.toContain('detail')
    // 位置:必须在 token <input> **之前**(DOM 顺序 = 视觉上在输入框上方)
    expect(err.compareDocumentPosition(tokenInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // 不再走 toast
    expect(show).not.toHaveBeenCalled()
    expect(document.querySelector('.sk-modal')).not.toBeNull() // 弹窗仍开着

    // 认不出的后端对象 → 通用本地化兜底,且原文不外泄
    h.createChannelInstance.mockRejectedValueOnce({ response: { data: { detail: '机器人名额已满' } } })
    submitBtn.click()
    await flush()
    expect((tokenField.querySelector('.chan-field-err') as HTMLElement).textContent)
      .toBe(zh.aiCfgChannelsAddBotFailed)

    // 完全空的错误 → 同一条兜底
    h.createChannelInstance.mockRejectedValueOnce({})
    submitBtn.click()
    await flush()
    expect((tokenField.querySelector('.chan-field-err') as HTMLElement).textContent)
      .toBe(zh.aiCfgChannelsAddBotFailed)
    expect(show).not.toHaveBeenCalled()
  })

  it('19b. 行内报错在改动 token / 切换平台 / 重开弹窗时都会清除', async () => {
    h.createChannelInstance.mockRejectedValue({ response: { data: { message: '机器人名额已满' } } })
    asAdmin()
    const w = mountSection()
    await flush()
    const openAndFail = async () => {
      await w.find('.sk-btn.primary').trigger('click')
      await flush()
      const field = document.querySelector('.sk-modal .sk-field:nth-of-type(3)') as HTMLElement
      const input = field.querySelector('input') as HTMLInputElement
      input.value = 'tg:token'
      input.dispatchEvent(new Event('input'))
      await flush()
      ;(Array.from(document.querySelectorAll('.sk-modal-foot button')).find(
        (b) => b.textContent?.trim() === '添加机器人',
      ) as HTMLButtonElement).click()
      await flush()
      expect(field.querySelector('.chan-field-err')).not.toBeNull()
      return { field, input }
    }

    // ① 改动 token 后清除
    const a = await openAndFail()
    a.input.value = 'tg:token2'
    a.input.dispatchEvent(new Event('input'))
    await flush()
    expect(a.field.querySelector('.chan-field-err')).toBeNull()

    // ② 切换平台后清除
    const b = await openAndFail()
    ;(Array.from(document.querySelectorAll('.chan-type-opt')).find(
      (x) => x.textContent?.trim() === 'Discord',
    ) as HTMLButtonElement).click()
    await flush()
    expect(b.field.querySelector('.chan-field-err')).toBeNull()

    // ③ 关掉再重开时不残留上一次的错误
    const c = await openAndFail()
    ;(Array.from(document.querySelectorAll('.sk-modal-foot button')).find(
      (x) => x.textContent?.trim() === '取消',
    ) as HTMLButtonElement).click()
    await flush()
    expect(c.field.querySelector('.chan-field-err')).toBeNull()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    expect(document.querySelector('.sk-modal .chan-field-err')).toBeNull()
  })

  it('20. 配对码弹窗指引文案含 bot 用户名与 code;点复制 → copyText(code) + 「已复制」toast', async () => {
    h.listPairableChannelInstances.mockResolvedValue({
      instances: [{ id: 'i1', channel_type: 'telegram', name: 'fam', bot_username: 'fam_bot' }],
    })
    h.createChannelPairingCode.mockResolvedValue({ code: '87654321' })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    asUser()
    const w = mountSection()
    await flush()
    await w.find('.set-row .sk-btn.primary').trigger('click')
    await flush()
    const hint = document.querySelector('.chan-modal-hint') as HTMLElement
    expect(hint.textContent).toContain('@fam_bot')
    expect(hint.textContent).toContain('87654321')
    const copyBtn = Array.from(document.querySelectorAll('.sk-modal .set-copybtn')).find(
      (b) => b.textContent?.includes('复制'),
    ) as HTMLButtonElement
    copyBtn.click()
    await flush()
    expect(h.copyText).toHaveBeenCalledWith('87654321')
    expect(show).toHaveBeenCalledWith('已复制')
  })

  it('21. 配对码弹窗关闭(完成) → code 清空、补拉 listChannelBindings', async () => {
    h.listPairableChannelInstances.mockResolvedValue({
      instances: [{ id: 'i1', channel_type: 'telegram', name: 'fam', bot_username: 'fam_bot' }],
    })
    h.createChannelPairingCode.mockResolvedValue({ code: '87654321' })
    asUser()
    const w = mountSection()
    await flush()
    await w.find('.set-row .sk-btn.primary').trigger('click')
    await flush()
    h.listChannelBindings.mockClear()
    const doneBtn = Array.from(document.querySelectorAll('.sk-modal-foot button')).find(
      (b) => b.textContent?.trim() === '完成',
    ) as HTMLButtonElement
    doneBtn.click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()
    expect(h.listChannelBindings).toHaveBeenCalledTimes(1)
  })

  it('22. setModel / saveDownloadDir 失败 → 各弹 danger toast「保存失败」', async () => {
    h.listChannelBindings.mockResolvedValue({
      bindings: [{ id: 'b1', default_model: null, download_dir: '/DATA/Downloads/telegram' }],
    })
    h.listModels.mockResolvedValue({ models: [{ name: 'llama2' }] })
    h.setChannelBindingModel.mockRejectedValueOnce({})
    h.setChannelBindingDownloadDir.mockRejectedValueOnce({})
    asUser()
    const w = mountSection()
    await flush()
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')

    const picker = w.findComponent({ name: 'ModelPicker' })
    picker.vm.$emit('select', 'local:llama2')
    await flush()
    expect(show).toHaveBeenCalledWith('保存失败', 3000, 'danger')

    show.mockClear()
    const input = w.find('.tok-row input.set-input')
    ;(input.element as HTMLInputElement).value = '/DATA/Downloads/tg2'
    await input.trigger('change')
    await flush()
    expect(show).toHaveBeenCalledWith('保存失败', 3000, 'danger')
  })

  it('23. saveDownloadDir 输入未变化或为空白 → 不发请求', async () => {
    h.listChannelBindings.mockResolvedValue({ bindings: [{ id: 'b1', download_dir: '/DATA/Downloads/telegram' }] })
    asUser()
    const w = mountSection()
    await flush()
    const input = w.find('.tok-row input.set-input')
    ;(input.element as HTMLInputElement).value = '/DATA/Downloads/telegram' // 未变化
    await input.trigger('change')
    await flush()
    expect(h.setChannelBindingDownloadDir).not.toHaveBeenCalled()
    ;(input.element as HTMLInputElement).value = '   ' // 空白
    await input.trigger('change')
    await flush()
    expect(h.setChannelBindingDownloadDir).not.toHaveBeenCalled()
  })

  it('24a. loadModels:listModels 给本地模型(前缀 local:),listProviders 失败不影响本地模型', async () => {
    h.listModels.mockResolvedValue({ models: [{ name: 'llama2', size: 500 }] })
    h.listProviders.mockRejectedValue(new Error('down'))
    h.listChannelBindings.mockResolvedValue({ bindings: [{ id: 'b1', default_model: null }] })
    asUser()
    const w = mountSection()
    await flush()
    const picker = w.findComponent({ name: 'ModelPicker' })
    const models = picker.props('availableModels') as Array<{ key: string; source: string }>
    expect(models).toEqual([{ key: 'local:llama2', source: 'local', displayName: 'llama2', size: 500 }])
  })

  it('24b. loadModels:listProviders 经 buildCloudModelList 追加云端模型,listModels 失败不影响云端模型', async () => {
    h.listModels.mockRejectedValue(new Error('down'))
    h.listProviders.mockResolvedValue([
      { id: 6, name: 'DeepSeek', enabled: true, provider_type: 'deepseek', models: [{ name: 'deepseek-chat', favorite: true, supports_thinking: false }] },
    ])
    h.listChannelBindings.mockResolvedValue({ bindings: [{ id: 'b1', default_model: null }] })
    asUser()
    const w = mountSection()
    await flush()
    const picker = w.findComponent({ name: 'ModelPicker' })
    const models = picker.props('availableModels') as Array<{ key: string; source: string }>
    expect(models).toEqual([{
      key: 'cloud:6:deepseek-chat', source: 'cloud', displayName: 'deepseek-chat',
      providerName: 'DeepSeek', providerId: 6, supports_thinking: false, provider_type: 'deepseek',
    }])
  })
})
