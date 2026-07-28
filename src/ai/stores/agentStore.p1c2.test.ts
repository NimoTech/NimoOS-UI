import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// SP8-P1c2 Task 2 —— 右栏折叠态 + 当前 tab 的最小状态/动作集。
// vi.hoisted() 服务 mock + setActivePinia 模式抄自 agentStore.p1c.test.ts。
const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(), createAgentSession: vi.fn(), deleteAgentSession: vi.fn(),
  listAgentMessages: vi.fn(), updateAgentSessionTitle: vi.fn(), regenerateAgentSessionTitle: vi.fn(),
  listModels: vi.fn(), listProviders: vi.fn(), cancelAgentRun: vi.fn(), confirmAgentAction: vi.fn(),
  listVisibleResources: vi.fn(), addVisibleResource: vi.fn(), removeVisibleResource: vi.fn(),
  listAttachments: vi.fn(), deleteAttachment: vi.fn(),
  listStagedChanges: vi.fn(), commitStagedChanges: vi.fn(),
  revertStagedRun: vi.fn(), revertStagedBatch: vi.fn(), revertStagedItems: vi.fn(),
  // SP8-P1c2 Task 3 —— thinking 域(agentStore.js:656-687)。
  getThinkingDefaults: vi.fn(), getSessionThinking: vi.fn(), patchSessionThinking: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))
vi.mock('../services/agentTransport', () => ({
  runAgentRun: vi.fn().mockResolvedValue(undefined),
  attachAgentStream: vi.fn().mockResolvedValue({ attached: false }),
}))

import { useAgentStore } from './agentStore'

describe('agentStore P1c2 Task2:右栏折叠态 + tab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  it('默认值:rightCollapsed=false(展开)、rightTab="activity"(agentStore.js:37-38)', () => {
    const s = useAgentStore('p1c2-a')
    expect(s.rightCollapsed).toBe(false)
    expect(s.rightTab).toBe('activity')
  })

  it('setRightTab:切换当前激活 tab(agentStore.js:158)', () => {
    const s = useAgentStore('p1c2-b')
    s.setRightTab('context')
    expect(s.rightTab).toBe('context')
    s.setRightTab('system')
    expect(s.rightTab).toBe('system')
    s.setRightTab('resources')
    expect(s.rightTab).toBe('resources')
  })

  it('toggleRight:翻转 rightCollapsed(agentStore.js:157)', () => {
    const s = useAgentStore('p1c2-c')
    expect(s.rightCollapsed).toBe(false)
    s.toggleRight()
    expect(s.rightCollapsed).toBe(true)
    s.toggleRight()
    expect(s.rightCollapsed).toBe(false)
  })

  it('tab 选择不持久化:切 tab 后不写 localStorage(与 theme/selectedModel 不同)', () => {
    const s = useAgentStore('p1c2-d')
    s.setRightTab('system')
    expect(localStorage.length).toBe(0)
  })
})

// SP8-P1c2 Task 3 —— store thinking 域(agentStore.js:656-698)。
describe('agentStore P1c2 Task3:thinking 域(loaders/setters)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
  })

  it('loadThinkingDefaults:成功时写入 defaults(agentStore.js:656-660)', async () => {
    const s = useAgentStore('p1c2-e1')
    svc.getThinkingDefaults.mockResolvedValue({ enabled: false, level: 'high' })
    await s.loadThinkingDefaults()
    expect(s.thinking.defaults).toEqual({ enabled: false, level: 'high' })
  })

  it('loadThinkingDefaults:吞错保留硬编码兜底(agentStore.js:656-660,**吞错**)', async () => {
    const s = useAgentStore('p1c2-e2')
    const before = { ...s.thinking.defaults }
    svc.getThinkingDefaults.mockRejectedValue(new Error('boom'))
    await expect(s.loadThinkingDefaults()).resolves.toBeUndefined()
    expect(s.thinking.defaults).toEqual(before)
  })

  it('loadSessionThinking:无 id 直接返回,不发请求(agentStore.js:664)', async () => {
    const s = useAgentStore('p1c2-e3')
    await s.loadSessionThinking(null as unknown as string)
    expect(svc.getSessionThinking).not.toHaveBeenCalled()
  })

  it('loadSessionThinking:getSessionThinking 返回 null(无覆盖)时回落到 defaults(agentStore.js:666)', async () => {
    const s = useAgentStore('p1c2-e4')
    s.thinking.defaults = { enabled: false, level: 'low' }
    svc.getSessionThinking.mockResolvedValue(null)
    await s.loadSessionThinking('sess-1')
    expect(s.thinking.enabled).toBe(false)
    expect(s.thinking.level).toBe('low')
  })

  it('loadSessionThinking:getSessionThinking 有值时只写 enabled/level(agentStore.js:667-668)', async () => {
    const s = useAgentStore('p1c2-e5')
    svc.getSessionThinking.mockResolvedValue({ enabled: true, level: 'high' })
    await s.loadSessionThinking('sess-2')
    expect(svc.getSessionThinking).toHaveBeenCalledWith('sess-2')
    expect(s.thinking.enabled).toBe(true)
    expect(s.thinking.level).toBe('high')
  })

  it('setThinkingEnabled:无会话只改本地,不发 patch 请求(agentStore.js:671-677)', async () => {
    const s = useAgentStore('p1c2-e6')
    await s.setThinkingEnabled(false)
    expect(s.thinking.enabled).toBe(false)
    expect(svc.patchSessionThinking).not.toHaveBeenCalled()
  })

  it('setThinkingEnabled:有会话先乐观改本地再 patch,失败**不回滚**(agentStore.js:671-677,故意保留)', async () => {
    const s = useAgentStore('p1c2-e7')
    s.activeSessionId = 'sess-3'
    s.thinking.level = 'medium'
    svc.patchSessionThinking.mockRejectedValue(new Error('network'))
    await expect(s.setThinkingEnabled(false)).rejects.toThrow('network')
    // 本地状态已经改了,且没有因为 patch 失败被回滚回去
    expect(s.thinking.enabled).toBe(false)
    expect(svc.patchSessionThinking).toHaveBeenCalledWith('sess-3', { enabled: false, level: 'medium' })
  })

  it('setThinkingLevel:无会话只改本地,不发 patch 请求(agentStore.js:680-686)', async () => {
    const s = useAgentStore('p1c2-e8')
    await s.setThinkingLevel('high')
    expect(s.thinking.level).toBe('high')
    expect(svc.patchSessionThinking).not.toHaveBeenCalled()
  })

  it('setThinkingLevel:有会话先乐观改本地再 patch,失败**不回滚**(agentStore.js:680-686,故意保留)', async () => {
    const s = useAgentStore('p1c2-e9')
    s.activeSessionId = 'sess-4'
    s.thinking.enabled = true
    svc.patchSessionThinking.mockRejectedValue(new Error('network'))
    await expect(s.setThinkingLevel('low')).rejects.toThrow('network')
    expect(s.thinking.level).toBe('low')
    expect(svc.patchSessionThinking).toHaveBeenCalledWith('sess-4', { enabled: true, level: 'low' })
  })

  it('setThinkingLevel:有会话且 patch 成功时正常 resolve', async () => {
    const s = useAgentStore('p1c2-e10')
    s.activeSessionId = 'sess-5'
    svc.patchSessionThinking.mockResolvedValue(undefined)
    await s.setThinkingLevel('high')
    expect(s.thinking.level).toBe('high')
    expect(svc.patchSessionThinking).toHaveBeenCalledWith('sess-5', { enabled: true, level: 'high' })
  })
})
