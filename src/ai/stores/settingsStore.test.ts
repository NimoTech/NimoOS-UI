// SP8-P2a Task 5 —— settingsStore 测试。逐条对应 brief Step 1 的 36 条用例清单
// (Models / 下载轮询 / Providers / Policy / Services status / D2 重置 六组)。
//
// mock 与 beforeEach 骨架取自 brief,但 `const ai = {...}` 改用 `vi.hoisted()`
// 包一层——brief 原样骨架(`const ai = {...}` 后紧跟 `vi.mock(...)`)在本仓实测
// 会报 "Cannot access 'ai' before initialization":`vi.mock` 调用被 vitest
// 提升到文件最顶部,而 ESM 里所有 import 语句(含下面的
// `import { useSettingsStore } from './settingsStore'`)本身也会被提升到所有
// 非 import 语句之前执行——于是 `import './settingsStore'` 触发的 mock 工厂
// 会在 `const ai = {...}` 真正赋值之前就跑,踩中 TDZ。`vi.hoisted()` 是本仓
// `agentStore.test.ts:4-19` 已经用来解决同一问题的既定写法,这里照搬那个先例,
// 而不是 brief 里那段实测会炸的骨架。

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const ai = vi.hoisted(() => ({
  listModels: vi.fn(),
  pullModel: vi.fn(),
  deleteModel: vi.fn(),
  searchHFModels: vi.fn(),
  listHFFiles: vi.fn(),
  importHFModel: vi.fn(),
  getImportStatus: vi.fn(),
  cancelImport: vi.fn(),
  listProviders: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  deleteProvider: vi.fn(),
  listProviderModels: vi.fn(),
  refreshProviderModels: vi.fn(),
  updateProviderModels: vi.fn(),
  getPolicy: vi.fn(),
  updatePolicy: vi.fn(),
  getServicesStatus: vi.fn(),
  listBlacklist: vi.fn(),
  addBlacklistPattern: vi.fn(),
  removeBlacklistPattern: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

import { useSettingsStore } from './settingsStore'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('settingsStore — Models', () => {
  it('1. loadModels 把 body 直接放进 installedModels(裸数组,未多剥一层 .data)', async () => {
    const store = useSettingsStore()
    const raw = [{ name: 'llama3:8b', size_bytes: 123 }]
    ai.listModels.mockResolvedValue(raw)
    await store.loadModels()
    expect(store.installedModels).toEqual(raw)
  })

  it('2. loadModels 在 finally 里放下 modelsLoading,即使请求 reject', async () => {
    const store = useSettingsStore()
    ai.listModels.mockRejectedValue(new Error('boom'))
    await expect(store.loadModels()).rejects.toThrow('boom')
    expect(store.modelsLoading).toBe(false)
  })

  it('3. pullModel 空白输入直接返回,不发请求', async () => {
    const store = useSettingsStore()
    store.pullModelInput = '   '
    await store.pullModel()
    expect(ai.pullModel).not.toHaveBeenCalled()
  })

  it('4. pullModel 成功后清空 pullModelInput,pullingModels 在 finally 后为空', async () => {
    const store = useSettingsStore()
    ai.pullModel.mockResolvedValue(undefined)
    store.pullModelInput = 'llama3:8b'
    const p = store.pullModel()
    // 观察项(settingsStore.js:58-68):请求在途期间 pullingModels 短暂为真——
    // 这条断言钉住"最终会被清空"这个现状,不代表提示语义准确。
    await p
    expect(store.pullModelInput).toBe('')
    expect(store.pullingModels).toEqual({})
  })

  it('5. deleteModel 成功后重新拉一次 listModels', async () => {
    const store = useSettingsStore()
    ai.deleteModel.mockResolvedValue(undefined)
    ai.listModels.mockResolvedValue([])
    await store.deleteModel('llama3:8b')
    expect(ai.listModels).toHaveBeenCalledTimes(1)
  })

  it('6. searchHF 空白 query 不发请求;非空时先清空结果再请求', async () => {
    const store = useSettingsStore()
    store.hfQuery = '   '
    await store.searchHF()
    expect(ai.searchHFModels).not.toHaveBeenCalled()

    // 预置陈旧状态,证明 searchHF 会先清空再请求
    store.hfResults = [{ id: 'stale/repo' }]
    store.hfSelectedRepo = 'stale/repo'
    store.hfFiles = ['stale.gguf']
    let capturedAtCallTime: { results: unknown; repo: unknown; files: unknown } | null = null
    ai.searchHFModels.mockImplementation(async () => {
      capturedAtCallTime = {
        results: [...store.hfResults],
        repo: store.hfSelectedRepo,
        files: [...store.hfFiles],
      }
      return [{ id: 'qwen/Qwen2.5' }]
    })
    store.hfQuery = 'qwen'
    await store.searchHF()
    expect(capturedAtCallTime).toEqual({ results: [], repo: null, files: [] })
    expect(store.hfResults).toEqual([{ id: 'qwen/Qwen2.5' }])
  })

  it('7. selectHFRepo 设置 repo 并清空 hfFiles', () => {
    const store = useSettingsStore()
    store.hfFiles = ['a.gguf', 'b.gguf']
    store.selectHFRepo('qwen/Qwen2.5')
    expect(store.hfSelectedRepo).toBe('qwen/Qwen2.5')
    expect(store.hfFiles).toEqual([])
  })

  it('8. loadHFFiles 无选中 repo 时不发请求', async () => {
    const store = useSettingsStore()
    store.hfSelectedRepo = null
    await store.loadHFFiles()
    expect(ai.listHFFiles).not.toHaveBeenCalled()
  })

  it('9. importHF 无选中 repo 时不发请求;有则调 importHFModel 后 startImportJob', async () => {
    const store = useSettingsStore()
    await store.importHF('model.gguf')
    expect(ai.importHFModel).not.toHaveBeenCalled()

    store.hfSelectedRepo = 'qwen/Qwen2.5'
    ai.importHFModel.mockResolvedValue(undefined)
    await store.importHF('model.gguf')
    expect(ai.importHFModel).toHaveBeenCalledWith('qwen/Qwen2.5', 'model.gguf')
    expect(store.hfImportJobs['model.gguf']).toBeTruthy()
    expect(store.hfImportJobs['model.gguf'].status).toBe('downloading')
    // 清理定时器,避免污染下一个用例
    store.dismissImportJob('model.gguf')
  })
})

describe('settingsStore — 下载进度轮询', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('10. startImportJob 建条目,状态 downloading,_timer 非 null', () => {
    const store = useSettingsStore()
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    const job = store.hfImportJobs['model.gguf']
    expect(job.status).toBe('downloading')
    expect(job._timer).not.toBeNull()
    store.dismissImportJob('model.gguf')
  })

  it('11. 推进 2000ms 后拉一次 getImportStatus,把 completed/total/status 写回条目', async () => {
    const store = useSettingsStore()
    ai.getImportStatus.mockResolvedValue({ completed: 100, total: 1000, status: 'downloading' })
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    await vi.advanceTimersByTimeAsync(2000)
    expect(ai.getImportStatus).toHaveBeenCalledTimes(1)
    const job = store.hfImportJobs['model.gguf']
    expect(job.completed).toBe(100)
    expect(job.total).toBe(1000)
    expect(job.status).toBe('downloading')
    store.dismissImportJob('model.gguf')
  })

  it('12. 速度与 ETA:completed 增长 → speed > 0;speed 极小时 etaSecs 为 null', async () => {
    const store = useSettingsStore()
    ai.getImportStatus
      .mockResolvedValueOnce({ completed: 0, total: 1000, status: 'downloading' })
      .mockResolvedValueOnce({
        completed: 10 * 1024 * 1024,
        total: 1000 * 1024 * 1024,
        status: 'downloading',
      })
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    // 第一次轮询:completed 未变化(0 → 0),speed 应仍为极小/0,故 etaSecs 为 null
    await vi.advanceTimersByTimeAsync(2000)
    const jobAfterFirst = store.hfImportJobs['model.gguf']
    expect(jobAfterFirst.etaSecs).toBeNull()

    // 第二次轮询:completed 从 0 跳到 10MB,两秒内增长 → speed > 0
    await vi.advanceTimersByTimeAsync(2000)
    const jobAfterSecond = store.hfImportJobs['model.gguf']
    expect(jobAfterSecond.speed).toBeGreaterThan(0)
    store.dismissImportJob('model.gguf')
  })

  it('13. status success → 清定时器 + 重拉 listModels;再推进 3000ms → 条目被移除', async () => {
    const store = useSettingsStore()
    ai.getImportStatus.mockResolvedValue({ completed: 1000, total: 1000, status: 'success' })
    ai.listModels.mockResolvedValue([{ name: 'model.gguf' }])
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    await vi.advanceTimersByTimeAsync(2000)
    expect(ai.listModels).toHaveBeenCalledTimes(1)
    expect(store.hfImportJobs['model.gguf']).toBeTruthy() // 尚未到 3000ms dismiss

    await vi.advanceTimersByTimeAsync(3000)
    expect(store.hfImportJobs['model.gguf']).toBeUndefined()

    // 对照组:定时器确已被清——继续推进不会再触发 getImportStatus
    const callsBefore = ai.getImportStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(ai.getImportStatus.mock.calls.length).toBe(callsBefore)
  })

  it('14. status error → 清定时器,条目保留(用户要能看到错误)', async () => {
    const store = useSettingsStore()
    ai.getImportStatus.mockResolvedValue({ completed: 50, total: 1000, status: 'error', error: 'disk full' })
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    await vi.advanceTimersByTimeAsync(2000)
    const job = store.hfImportJobs['model.gguf']
    expect(job).toBeTruthy()
    expect(job.status).toBe('error')
    expect(job.error).toBe('disk full')

    // 对照组:定时器确已被清——继续推进不会再触发 getImportStatus
    const callsBefore = ai.getImportStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(ai.getImportStatus.mock.calls.length).toBe(callsBefore)
    store.dismissImportJob('model.gguf')
  })

  it('15. getImportStatus 抛 404 → 清定时器 + 移除条目;抛非 404 → 条目保留、定时器继续(对照组)', async () => {
    const store = useSettingsStore()

    // 分支 A:404
    ai.getImportStatus.mockRejectedValueOnce({ response: { status: 404 } })
    store.startImportJob('qwen/Qwen2.5', 'gone.gguf')
    await vi.advanceTimersByTimeAsync(2000)
    expect(store.hfImportJobs['gone.gguf']).toBeUndefined()

    // 分支 B(对照组):非 404 错误 → 条目保留、定时器继续触发下一轮
    ai.getImportStatus.mockRejectedValue({ response: { status: 500 } })
    store.startImportJob('qwen/Qwen2.5', 'flaky.gguf')
    await vi.advanceTimersByTimeAsync(2000)
    expect(store.hfImportJobs['flaky.gguf']).toBeTruthy()
    const callsAfterFirst = ai.getImportStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(2000)
    expect(ai.getImportStatus.mock.calls.length).toBeGreaterThan(callsAfterFirst)
    expect(store.hfImportJobs['flaky.gguf']).toBeTruthy()
    store.dismissImportJob('flaky.gguf')
  })

  it('16. dismissImportJob / cancelImportJob 都清定时器并移除条目;cancelImportJob 的 cancelImport 失败被吞掉', async () => {
    const store = useSettingsStore()
    ai.getImportStatus.mockResolvedValue({ completed: 0, total: 1000, status: 'downloading' })

    store.startImportJob('qwen/Qwen2.5', 'a.gguf')
    store.dismissImportJob('a.gguf')
    expect(store.hfImportJobs['a.gguf']).toBeUndefined()

    store.startImportJob('qwen/Qwen2.5', 'b.gguf')
    ai.cancelImport.mockRejectedValue(new Error('network down'))
    await expect(store.cancelImportJob('b.gguf')).resolves.toBeUndefined()
    expect(store.hfImportJobs['b.gguf']).toBeUndefined()
    expect(ai.cancelImport).toHaveBeenCalledWith('b.gguf')
  })
})

describe('settingsStore — Providers', () => {
  it('17. showProviderForm(p) 编辑态不回填 api_key', () => {
    const store = useSettingsStore()
    store.showProviderForm({ id: 1, name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: 'sk-xxx' })
    expect(store.providerForm.data.api_key).toBe('')
    expect(store.providerForm.data.name).toBe('OpenAI')
    expect(store.providerForm.data.base_url).toBe('https://api.openai.com/v1')
  })

  it('18. showProviderForm() 无参 → 全空表单 + editing === null', () => {
    const store = useSettingsStore()
    store.showProviderForm({ id: 1, name: 'OpenAI', base_url: 'https://api.openai.com/v1' })
    store.showProviderForm()
    expect(store.providerForm.editing).toBeNull()
    expect(store.providerForm.data).toEqual({
      name: '',
      base_url: '',
      api_key: '',
      default_model: '',
      protocol: 'openai',
    })
  })

  it('19. applyProviderPreset 覆盖 name/base_url/default_model/protocol,不动 api_key', () => {
    const store = useSettingsStore()
    store.showProviderForm()
    store.providerForm.data.api_key = 'sk-untouched'
    store.applyProviderPreset({
      name: 'DeepSeek',
      base_url: 'https://api.deepseek.com/v1',
      default_model: 'deepseek-chat',
      protocol: 'openai',
    })
    expect(store.providerForm.data.name).toBe('DeepSeek')
    expect(store.providerForm.data.base_url).toBe('https://api.deepseek.com/v1')
    expect(store.providerForm.data.default_model).toBe('deepseek-chat')
    expect(store.providerForm.data.protocol).toBe('openai')
    expect(store.providerForm.data.api_key).toBe('sk-untouched')
  })

  it('20. saveProvider name 或 base_url 空白 → 抛错且不发请求(两条)', async () => {
    const store = useSettingsStore()

    store.showProviderForm()
    store.providerForm.data.name = '   '
    store.providerForm.data.base_url = 'https://api.example.com/v1'
    await expect(store.saveProvider()).rejects.toThrow()
    expect(ai.createProvider).not.toHaveBeenCalled()
    expect(ai.updateProvider).not.toHaveBeenCalled()

    store.providerForm.data.name = 'Example'
    store.providerForm.data.base_url = '   '
    await expect(store.saveProvider()).rejects.toThrow()
    expect(ai.createProvider).not.toHaveBeenCalled()
    expect(ai.updateProvider).not.toHaveBeenCalled()
  })

  it('21. saveProvider 编辑态且 api_key 为空 → payload 里不含 api_key 键', async () => {
    const store = useSettingsStore()
    ai.updateProvider.mockResolvedValue(undefined)
    ai.listProviders.mockResolvedValue([])
    store.showProviderForm({ id: 42, name: 'OpenAI', base_url: 'https://api.openai.com/v1' })
    store.providerForm.data.api_key = ''
    await store.saveProvider()
    const payload = ai.updateProvider.mock.calls[0][1]
    expect(payload).not.toHaveProperty('api_key')
  })

  it('22. saveProvider 编辑态且 api_key 非空 → payload 含 api_key', async () => {
    const store = useSettingsStore()
    ai.updateProvider.mockResolvedValue(undefined)
    ai.listProviders.mockResolvedValue([])
    store.showProviderForm({ id: 42, name: 'OpenAI', base_url: 'https://api.openai.com/v1' })
    store.providerForm.data.api_key = 'sk-new'
    await store.saveProvider()
    const payload = ai.updateProvider.mock.calls[0][1]
    expect(payload).toHaveProperty('api_key', 'sk-new')
  })

  it('23. saveProvider 成功后收起表单 + 重拉 listProviders', async () => {
    const store = useSettingsStore()
    ai.createProvider.mockResolvedValue(undefined)
    ai.listProviders.mockResolvedValue([{ id: 1, name: 'OpenAI', base_url: 'https://api.openai.com/v1' }])
    store.showProviderForm()
    store.providerForm.data.name = 'OpenAI'
    store.providerForm.data.base_url = 'https://api.openai.com/v1'
    await store.saveProvider()
    expect(store.providerForm.visible).toBe(false)
    expect(ai.listProviders).toHaveBeenCalledTimes(1)
  })

  it('24. toggleProvider 成功 → 就地替换那一项的 enabled,其它项不动', async () => {
    const store = useSettingsStore()
    store.providers = [
      { id: 1, name: 'A', base_url: 'u1', enabled: false },
      { id: 2, name: 'B', base_url: 'u2', enabled: true },
    ]
    ai.updateProvider.mockResolvedValue(undefined)
    await store.toggleProvider(1, true)
    expect(store.providers[0]).toEqual({ id: 1, name: 'A', base_url: 'u1', enabled: true })
    expect(store.providers[1]).toEqual({ id: 2, name: 'B', base_url: 'u2', enabled: true })
  })

  it('25. toggleProvider 失败 → providers 回滚到调用前的快照且重新抛出', async () => {
    const store = useSettingsStore()
    const before = [
      { id: 1, name: 'A', base_url: 'u1', enabled: false },
      { id: 2, name: 'B', base_url: 'u2', enabled: true },
    ]
    store.providers = before.map((p) => ({ ...p }))
    // 生产代码里 `providers.value` 只在 `ai.updateProvider` 成功之后才被 splice
    // 改动,所以若请求一开始就 reject,catch 里的回滚行其实是在把 providers
    // 赋回一个内容本就没变过的数组——这样测不出回滚行被删掉。要让这条断言真正
    // 有判别力,必须在请求"在途"期间制造一次外部改动(例如另一处并发操作、或
    // loadProviders 的刷新撞车),再让请求失败,断言 catch 把 providers 拉回
    // **调用前**的快照、而不是停在这次在途期间的外部改动上。
    let rejectUpdate: (e: unknown) => void = () => {}
    ai.updateProvider.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectUpdate = reject
        }),
    )
    const pending = store.toggleProvider(1, true)
    store.providers = [
      { id: 1, name: 'A', base_url: 'u1', enabled: true },
      { id: 2, name: 'B', base_url: 'u2', enabled: false },
    ]
    rejectUpdate(new Error('network'))
    await expect(pending).rejects.toThrow('network')
    expect(store.providers).toEqual(before)
  })

  it('26. loadProviderModels 失败 → loading 置回 false、保留上次的 models,且重新抛出', async () => {
    const store = useSettingsStore()
    store.providerModels[1] = { loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true }] }
    ai.listProviderModels.mockRejectedValue(new Error('down'))
    await expect(store.loadProviderModels(1)).rejects.toThrow('down')
    expect(store.providerModels[1].loading).toBe(false)
    expect(store.providerModels[1].models).toEqual([{ name: 'gpt-4o', source: 'auto', favorite: true }])
  })

  it('27. toggleModelFavorite 只翻目标项、其余项原样,且只带 name/favorite 两字段', async () => {
    const store = useSettingsStore()
    store.providerModels[1] = {
      loading: false,
      models: [
        { name: 'gpt-4o', source: 'auto', favorite: false },
        { name: 'gpt-4o-mini', source: 'manual', favorite: true },
      ],
    }
    ai.updateProviderModels.mockResolvedValue([])
    await store.toggleModelFavorite(1, 'gpt-4o', true)
    const payload = ai.updateProviderModels.mock.calls[0][1]
    expect(payload).toEqual([
      { name: 'gpt-4o', favorite: true },
      { name: 'gpt-4o-mini', favorite: true },
    ])
  })

  it('28. addManualModel 对已存在的同名模型直接返回、不发请求', async () => {
    const store = useSettingsStore()
    store.providerModels[1] = {
      loading: false,
      models: [{ name: 'gpt-4o', source: 'auto', favorite: false }],
    }
    await store.addManualModel(1, 'gpt-4o')
    expect(ai.updateProviderModels).not.toHaveBeenCalled()
  })

  it('29. removeManualModel 只删 source===manual 的同名项;同名但非 manual 的保留(对照组)', async () => {
    const store = useSettingsStore()
    store.providerModels[1] = {
      loading: false,
      models: [
        { name: 'gpt-4o', source: 'manual', favorite: true },
        { name: 'gpt-4o', source: 'auto', favorite: false },
        { name: 'other', source: 'manual', favorite: false },
      ],
    }
    ai.updateProviderModels.mockResolvedValue([])
    await store.removeManualModel(1, 'gpt-4o')
    const payload = ai.updateProviderModels.mock.calls[0][1]
    // manual 的 gpt-4o 被删,auto 的 gpt-4o 保留(对照组:证明过滤是精确按 source 判断,不是按 name 一刀切)
    expect(payload).toEqual([
      { name: 'gpt-4o', favorite: false },
      { name: 'other', favorite: false },
    ])
  })
})

describe('settingsStore — Policy', () => {
  it('30. updatePolicyField 乐观更新:先改本地再发请求', async () => {
    const store = useSettingsStore()
    store.policy = { allow_remote: false, default_backend: 'local', escalation_prompt: false }
    let localValueAtCallTime: boolean | undefined
    ai.updatePolicy.mockImplementation(async () => {
      localValueAtCallTime = store.policy?.allow_remote
      return undefined
    })
    await store.updatePolicyField('allow_remote', true)
    expect(localValueAtCallTime).toBe(true)
    expect(store.policy?.allow_remote).toBe(true)
  })

  it('31. updatePolicyField 失败 → 回滚到旧对象且重新抛出', async () => {
    const store = useSettingsStore()
    const original = { allow_remote: false, default_backend: 'local', escalation_prompt: false }
    store.policy = { ...original }
    ai.updatePolicy.mockRejectedValue(new Error('save failed'))
    await expect(store.updatePolicyField('allow_remote', true)).rejects.toThrow('save failed')
    expect(store.policy).toEqual(original)
  })

  it('32. updatePolicyField 在 policy 为 null 时先填默认值再改', async () => {
    const store = useSettingsStore()
    store.policy = null
    ai.updatePolicy.mockResolvedValue(undefined)
    await store.updatePolicyField('escalation_prompt', true)
    expect(store.policy).toEqual({
      allow_remote: false,
      default_backend: 'local',
      escalation_prompt: true,
    })
  })
})

describe('settingsStore — Services status', () => {
  it('33. loadServicesStatus 成功 → 三个布尔用 ?? false 归一', async () => {
    const store = useSettingsStore()
    ai.getServicesStatus.mockResolvedValue({ ollama: {} })
    await store.loadServicesStatus()
    expect(store.servicesStatus.ollama).toBe(false)
    expect(store.servicesStatus.openvino).toBe(false)
    expect(store.servicesStatus.agent).toBe(false)
  })

  it('34. loadServicesStatus 整体失败被吞掉,三组状态全部落到关闭默认值', async () => {
    const store = useSettingsStore()
    ai.getServicesStatus.mockRejectedValue(new Error('down'))
    await expect(store.loadServicesStatus()).resolves.toBeUndefined()
    expect(store.servicesStatus).toEqual({ ollama: false, openvino: false, agent: false })
    expect(store.searchStatus).toEqual({ running: false })
    expect(store.parserStatus).toEqual({ running: false, paused: false, pending: 0, concurrency: 2 })
  })
})

describe('settingsStore — D2 resetTransientUi', () => {
  it('35. resetTransientUi 把 activeSection / providerForm / hf 搜索四态复位', () => {
    const store = useSettingsStore()
    store.setActiveSection('providers')
    store.showProviderForm({ id: 1, name: 'OpenAI', base_url: 'u' })
    store.hfQuery = 'qwen'
    store.hfResults = [{ id: 'qwen/Qwen2.5' }]
    store.hfSelectedRepo = 'qwen/Qwen2.5'
    store.hfFiles = ['a.gguf']

    store.resetTransientUi()

    expect(store.activeSection).toBe('models')
    expect(store.providerForm.visible).toBe(false)
    expect(store.providerForm.editing).toBeNull()
    expect(store.hfQuery).toBe('')
    expect(store.hfResults).toEqual([])
    expect(store.hfSelectedRepo).toBeNull()
    expect(store.hfFiles).toEqual([])
  })

  it('36. resetTransientUi 不动 hfImportJobs / installedModels / providers / policy(对照组)', () => {
    const store = useSettingsStore()
    store.installedModels = [{ name: 'llama3:8b' }]
    store.providers = [{ id: 1, name: 'OpenAI', base_url: 'u' }]
    store.policy = { allow_remote: true, default_backend: 'cloud', escalation_prompt: true }
    vi.useFakeTimers()
    ai.getImportStatus.mockResolvedValue({ completed: 0, total: 100, status: 'downloading' })
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')

    store.resetTransientUi()

    expect(store.installedModels).toEqual([{ name: 'llama3:8b' }])
    expect(store.providers).toEqual([{ id: 1, name: 'OpenAI', base_url: 'u' }])
    expect(store.policy).toEqual({ allow_remote: true, default_backend: 'cloud', escalation_prompt: true })
    expect(store.hfImportJobs['model.gguf']).toBeTruthy()

    store.dismissImportJob('model.gguf')
    vi.useRealTimers()
  })
})
