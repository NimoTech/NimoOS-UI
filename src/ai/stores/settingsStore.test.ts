// SP8-P2a Task 5 — settingsStore tests. Each corresponds to the 36 test cases
// in brief Step 1's list (Models / download polling / Providers / Policy /
// Services status / D2 reset – six groups).
//
// Mock and beforeEach skeleton taken from brief, but `const ai = {...}` wrapped
// with `vi.hoisted()` — brief's original skeleton (`const ai = {...}` followed
// by `vi.mock(...)`) fails in practice with "Cannot access 'ai' before
// initialization": `vi.mock` is hoisted by vitest to the file top, and in ESM
// all import statements (including the `import { useSettingsStore } from
// './settingsStore'` below) are also hoisted before all non-import statements —
// so the mock factory triggered by `import './settingsStore'` runs before
// `const ai = {...}` is truly assigned, hitting the TDZ. `vi.hoisted()` is the
// established pattern already used in this repo's `agentStore.test.ts:4-19` to
// solve this same problem; replicating that precedent here rather than brief's
// skeleton that fails in practice.

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
  it('1. loadModels puts body directly into installedModels (bare array, no extra .data unpacking)', async () => {
    const store = useSettingsStore()
    const raw = [{ name: 'llama3:8b', size_bytes: 123 }]
    ai.listModels.mockResolvedValue(raw)
    await store.loadModels()
    expect(store.installedModels).toEqual(raw)
  })

  it('2. loadModels sets modelsLoading false in finally, even if request rejects', async () => {
    const store = useSettingsStore()
    ai.listModels.mockRejectedValue(new Error('boom'))
    await expect(store.loadModels()).rejects.toThrow('boom')
    expect(store.modelsLoading).toBe(false)
  })

  it('3. pullModel with blank input returns immediately, does not send request', async () => {
    const store = useSettingsStore()
    store.pullModelInput = '   '
    await store.pullModel()
    expect(ai.pullModel).not.toHaveBeenCalled()
  })

  it('4. pullModel clears pullModelInput on success, pullingModels empty after finally', async () => {
    const store = useSettingsStore()
    ai.pullModel.mockResolvedValue(undefined)
    store.pullModelInput = 'llama3:8b'
    const p = store.pullModel()
    // Observation item (settingsStore.js:58-68): while request is in flight,
    // pullingModels is briefly true — this assertion pins down "will eventually
    // be cleared"; does not mean the hint semantics are accurate.
    await p
    expect(store.pullModelInput).toBe('')
    expect(store.pullingModels).toEqual({})
  })

  it('5. deleteModel re-fetches listModels after success', async () => {
    const store = useSettingsStore()
    ai.deleteModel.mockResolvedValue(undefined)
    ai.listModels.mockResolvedValue([])
    await store.deleteModel('llama3:8b')
    expect(ai.listModels).toHaveBeenCalledTimes(1)
  })

  it('6. searchHF with blank query does not send request; non-blank clears results first then requests', async () => {
    const store = useSettingsStore()
    store.hfQuery = '   '
    await store.searchHF()
    expect(ai.searchHFModels).not.toHaveBeenCalled()

    // Pre-set stale state to prove searchHF clears first then requests
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

  it('7. selectHFRepo sets repo and clears hfFiles', () => {
    const store = useSettingsStore()
    store.hfFiles = ['a.gguf', 'b.gguf']
    store.selectHFRepo('qwen/Qwen2.5')
    expect(store.hfSelectedRepo).toBe('qwen/Qwen2.5')
    expect(store.hfFiles).toEqual([])
  })

  it('8. loadHFFiles does not send request when no repo is selected', async () => {
    const store = useSettingsStore()
    store.hfSelectedRepo = null
    await store.loadHFFiles()
    expect(ai.listHFFiles).not.toHaveBeenCalled()
  })

  it('9. importHF does not send request when no repo selected; if selected, calls importHFModel then startImportJob', async () => {
    const store = useSettingsStore()
    await store.importHF('model.gguf')
    expect(ai.importHFModel).not.toHaveBeenCalled()

    store.hfSelectedRepo = 'qwen/Qwen2.5'
    ai.importHFModel.mockResolvedValue(undefined)
    await store.importHF('model.gguf')
    expect(ai.importHFModel).toHaveBeenCalledWith('qwen/Qwen2.5', 'model.gguf')
    expect(store.hfImportJobs['model.gguf']).toBeTruthy()
    expect(store.hfImportJobs['model.gguf'].status).toBe('downloading')
    // Clean up timer to avoid polluting next test
    store.dismissImportJob('model.gguf')
  })
})

describe('settingsStore — download progress polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('10. startImportJob creates entry with status downloading, _timer non-null', () => {
    const store = useSettingsStore()
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    const job = store.hfImportJobs['model.gguf']
    expect(job.status).toBe('downloading')
    expect(job._timer).not.toBeNull()
    store.dismissImportJob('model.gguf')
  })

  it('11. after advancing 2000ms, fetches getImportStatus once, writes completed/total/status back to entry', async () => {
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

  it('12. speed and ETA: completed growth → speed > 0; when speed very small, etaSecs is null', async () => {
    const store = useSettingsStore()
    ai.getImportStatus
      .mockResolvedValueOnce({ completed: 0, total: 1000, status: 'downloading' })
      .mockResolvedValueOnce({
        completed: 10 * 1024 * 1024,
        total: 1000 * 1024 * 1024,
        status: 'downloading',
      })
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    // First poll: completed unchanged (0 → 0), speed should remain very small/0, so etaSecs is null
    await vi.advanceTimersByTimeAsync(2000)
    const jobAfterFirst = store.hfImportJobs['model.gguf']
    expect(jobAfterFirst.etaSecs).toBeNull()

    // Second poll: completed jumps from 0 to 10MB, growth in two seconds → speed > 0
    await vi.advanceTimersByTimeAsync(2000)
    const jobAfterSecond = store.hfImportJobs['model.gguf']
    expect(jobAfterSecond.speed).toBeGreaterThan(0)
    store.dismissImportJob('model.gguf')
  })

  it('13. status success → clear timer + re-fetch listModels; advance 3000ms more → entry removed', async () => {
    const store = useSettingsStore()
    ai.getImportStatus.mockResolvedValue({ completed: 1000, total: 1000, status: 'success' })
    ai.listModels.mockResolvedValue([{ name: 'model.gguf' }])
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    await vi.advanceTimersByTimeAsync(2000)
    expect(ai.listModels).toHaveBeenCalledTimes(1)
    expect(store.hfImportJobs['model.gguf']).toBeTruthy() // not yet 3000ms for dismiss

    await vi.advanceTimersByTimeAsync(3000)
    expect(store.hfImportJobs['model.gguf']).toBeUndefined()

    // Control group: timer is indeed cleared — advancing further does not trigger getImportStatus again
    const callsBefore = ai.getImportStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(ai.getImportStatus.mock.calls.length).toBe(callsBefore)
  })

  it('14. status error → clear timer, keep entry (user must see error)', async () => {
    const store = useSettingsStore()
    ai.getImportStatus.mockResolvedValue({ completed: 50, total: 1000, status: 'error', error: 'disk full' })
    store.startImportJob('qwen/Qwen2.5', 'model.gguf')
    await vi.advanceTimersByTimeAsync(2000)
    const job = store.hfImportJobs['model.gguf']
    expect(job).toBeTruthy()
    expect(job.status).toBe('error')
    expect(job.error).toBe('disk full')

    // Control group: timer is indeed cleared — advancing further does not trigger getImportStatus again
    const callsBefore = ai.getImportStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(ai.getImportStatus.mock.calls.length).toBe(callsBefore)
    store.dismissImportJob('model.gguf')
  })

  it('15. getImportStatus throws 404 → clear timer + remove entry; throws non-404 → keep entry, timer continues (control)', async () => {
    const store = useSettingsStore()

    // Branch A: 404
    ai.getImportStatus.mockRejectedValueOnce({ response: { status: 404 } })
    store.startImportJob('qwen/Qwen2.5', 'gone.gguf')
    await vi.advanceTimersByTimeAsync(2000)
    expect(store.hfImportJobs['gone.gguf']).toBeUndefined()

    // Branch B (control): non-404 error → keep entry, timer continues triggering next round
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

  it('16. dismissImportJob / cancelImportJob both clear timer and remove entry; cancelImportJob failures swallowed', async () => {
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
  it('17. showProviderForm(p) edit mode does not pre-fill api_key', () => {
    const store = useSettingsStore()
    store.showProviderForm({ id: 1, name: 'OpenAI', base_url: 'https://api.openai.com/v1', api_key: 'sk-xxx' })
    expect(store.providerForm.data.api_key).toBe('')
    expect(store.providerForm.data.name).toBe('OpenAI')
    expect(store.providerForm.data.base_url).toBe('https://api.openai.com/v1')
  })

  it('18. showProviderForm() with no args → all-empty form + editing === null', () => {
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

  it('19. applyProviderPreset overwrites name/base_url/default_model/protocol, leaves api_key alone', () => {
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

  it('20. saveProvider with blank name or base_url → throw error and don\'t send requests, message uses i18n', async () => {
    const store = useSettingsStore()
    // Review Important (Task 5 fix) — e.message will be shown verbatim to user by
    // ProvidersSection.vue:175-182, must use i18n, cannot be hardcoded English.
    // Default locale is zh_cn, assert Chinese translation, not just "threw some error".
    const expectedMessage = '名称和 Base URL 为必填项'

    store.showProviderForm()
    store.providerForm.data.name = '   '
    store.providerForm.data.base_url = 'https://api.example.com/v1'
    await expect(store.saveProvider()).rejects.toThrow(expectedMessage)
    expect(ai.createProvider).not.toHaveBeenCalled()
    expect(ai.updateProvider).not.toHaveBeenCalled()

    store.providerForm.data.name = 'Example'
    store.providerForm.data.base_url = '   '
    await expect(store.saveProvider()).rejects.toThrow(expectedMessage)
    expect(ai.createProvider).not.toHaveBeenCalled()
    expect(ai.updateProvider).not.toHaveBeenCalled()
  })

  it('21. saveProvider in edit mode with blank api_key → payload has no api_key key', async () => {
    const store = useSettingsStore()
    ai.updateProvider.mockResolvedValue(undefined)
    ai.listProviders.mockResolvedValue([])
    store.showProviderForm({ id: 42, name: 'OpenAI', base_url: 'https://api.openai.com/v1' })
    store.providerForm.data.api_key = ''
    await store.saveProvider()
    const payload = ai.updateProvider.mock.calls[0][1]
    expect(payload).not.toHaveProperty('api_key')
  })

  it('22. saveProvider in edit mode with non-empty api_key → payload contains api_key', async () => {
    const store = useSettingsStore()
    ai.updateProvider.mockResolvedValue(undefined)
    ai.listProviders.mockResolvedValue([])
    store.showProviderForm({ id: 42, name: 'OpenAI', base_url: 'https://api.openai.com/v1' })
    store.providerForm.data.api_key = 'sk-new'
    await store.saveProvider()
    const payload = ai.updateProvider.mock.calls[0][1]
    expect(payload).toHaveProperty('api_key', 'sk-new')
  })

  it('23. saveProvider collects form after success + re-fetches listProviders', async () => {
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

  it('24. toggleProvider success → replace that item\'s enabled in-place, others untouched', async () => {
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

  it('25. toggleProvider failure → providers rollback to pre-call snapshot and re-throw', async () => {
    const store = useSettingsStore()
    const before = [
      { id: 1, name: 'A', base_url: 'u1', enabled: false },
      { id: 2, name: 'B', base_url: 'u2', enabled: true },
    ]
    store.providers = before.map((p) => ({ ...p }))
    // In production code, `providers.value` is only spliced after `ai.updateProvider`
    // succeeds, so if the request rejects immediately, the catch rollback is actually
    // reassigning to an array that never changed — can't detect if rollback is deleted.
    // For this assertion to be truly discriminative, must create an external mutation
    // while request is "in-flight" (e.g., concurrent operation elsewhere, or
    // loadProviders refresh collision), then let request fail, assert that catch
    // pulls providers back to **pre-call** snapshot, not left at the in-flight mutation.
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

  it('26. loadProviderModels failure → set loading back to false, keep previous models, re-throw', async () => {
    const store = useSettingsStore()
    store.providerModels[1] = { loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true }] }
    ai.listProviderModels.mockRejectedValue(new Error('down'))
    await expect(store.loadProviderModels(1)).rejects.toThrow('down')
    expect(store.providerModels[1].loading).toBe(false)
    expect(store.providerModels[1].models).toEqual([{ name: 'gpt-4o', source: 'auto', favorite: true }])
  })

  it('27. toggleModelFavorite flips only target item, others unchanged, sends only name/favorite fields', async () => {
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

  it('28. addManualModel with existing same-name model returns directly, no request', async () => {
    const store = useSettingsStore()
    store.providerModels[1] = {
      loading: false,
      models: [{ name: 'gpt-4o', source: 'auto', favorite: false }],
    }
    await store.addManualModel(1, 'gpt-4o')
    expect(ai.updateProviderModels).not.toHaveBeenCalled()
  })

  it('29. removeManualModel deletes only same-name items where source===manual; same-name non-manual kept (control)', async () => {
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
    // manual gpt-4o is deleted, auto gpt-4o is kept (control: proves filtering is exact by source, not blanket by name)
    expect(payload).toEqual([
      { name: 'gpt-4o', favorite: false },
      { name: 'other', favorite: false },
    ])
  })
})

describe('settingsStore — Policy', () => {
  it('30. updatePolicyField optimistic update: change local first, then send request', async () => {
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

  it('31. updatePolicyField failure → rollback to old object and re-throw', async () => {
    const store = useSettingsStore()
    const original = { allow_remote: false, default_backend: 'local', escalation_prompt: false }
    store.policy = { ...original }
    ai.updatePolicy.mockRejectedValue(new Error('save failed'))
    await expect(store.updatePolicyField('allow_remote', true)).rejects.toThrow('save failed')
    expect(store.policy).toEqual(original)
  })

  it('32. updatePolicyField when policy is null, fill defaults first then modify', async () => {
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
  it('33. loadServicesStatus success → three booleans normalized with ?? false', async () => {
    const store = useSettingsStore()
    ai.getServicesStatus.mockResolvedValue({ ollama: {} })
    await store.loadServicesStatus()
    expect(store.servicesStatus.ollama).toBe(false)
    expect(store.servicesStatus.openvino).toBe(false)
    expect(store.servicesStatus.agent).toBe(false)
  })

  it('34. loadServicesStatus overall failure swallowed, all three status groups fall to off defaults', async () => {
    const store = useSettingsStore()
    ai.getServicesStatus.mockRejectedValue(new Error('down'))
    await expect(store.loadServicesStatus()).resolves.toBeUndefined()
    expect(store.servicesStatus).toEqual({ ollama: false, openvino: false, agent: false })
    expect(store.searchStatus).toEqual({ running: false })
    expect(store.parserStatus).toEqual({ running: false, paused: false, pending: 0, concurrency: 2 })
  })
})

describe('settingsStore — D2 resetTransientUi', () => {
  it('35. resetTransientUi resets activeSection / providerForm / hf search four states', () => {
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

  it('36. resetTransientUi leaves alone hfImportJobs / installedModels / providers / policy (control)', () => {
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
