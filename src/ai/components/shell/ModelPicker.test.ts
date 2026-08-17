import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ModelPicker from './ModelPicker.vue'
import type { AgentModel } from '../../stores/agentStore'

// 1:1 verbatim port of Vue2 src/views/AI/Agent/shell/ModelPicker.vue (127 lines).
const messages = {
  zh_cn: {
    aiLocalOllama: '本地 Ollama',
    aiCloudModels: '云端',
    aiSearchModelsPlaceholder: '搜索模型…',
    aiModelSelect: '选择模型',
    aiModelNotSelected: '未选择',
    aiModelEmptyText: '还没有可用模型',
    aiGoToSettings: '前往设置',
  },
}
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

function local(key: string, displayName: string, size?: number): AgentModel {
  return { key, source: 'local', displayName, size }
}
function cloud(
  key: string,
  displayName: string,
  providerId: string,
  providerName: string,
  supportsThinking = false,
): AgentModel {
  return {
    key,
    source: 'cloud',
    displayName,
    providerId,
    providerName,
    supports_thinking: supportsThinking,
  }
}

function mountPicker(props: Partial<InstanceType<typeof ModelPicker>['$props']> = {}) {
  return mount(ModelPicker, { props, global: { plugins: [i18n] }, attachTo: document.body })
}

describe('ModelPicker', () => {
  it('when a model is selected, the pill shows its displayName', () => {
    const models = [local('local:llama3', 'Llama 3')]
    const w = mountPicker({ availableModels: models, selectedKey: 'local:llama3' })
    expect(w.find('.model-pill-name').text()).toBe('Llama 3')
  })

  it('with models available but none selected → pill shows "未选择"; with no models at all → pill shows "选择模型"', () => {
    const withModels = mountPicker({ availableModels: [local('a', 'A')], selectedKey: null })
    expect(withModels.find('.model-pill-name').text()).toBe('未选择')

    const noModels = mountPicker({ availableModels: [], selectedKey: null })
    expect(noModels.find('.model-pill-name').text()).toBe('选择模型')
  })

  it('the local group (💻) and cloud group (☁️) render separately, each group\'s full option list appears', async () => {
    const models = [
      local('local:a', 'A模型'),
      cloud('cloud:1:b', 'B模型', 'p1', 'P1'),
    ]
    const w = mountPicker({ availableModels: models })
    await w.find('.model-pill').trigger('click')
    const groupLabels = w.findAll('.model-group-label').map((n) => n.text())
    expect(groupLabels).toEqual(['💻 本地 Ollama', '☁️ 云端'])
    const optionNames = w.findAll('.model-option-name').map((n) => n.text())
    expect(optionNames).toEqual(['A模型', 'B模型'])
  })

  it('with <=6 cloud models the search box does not appear; with 7 or more it appears', async () => {
    const sixCloud = Array.from({ length: 6 }, (_, i) => cloud(`c${i}`, `M${i}`, 'p', 'P'))
    const w6 = mountPicker({ availableModels: sixCloud })
    await w6.find('.model-pill').trigger('click')
    expect(w6.find('.model-search').exists()).toBe(false)

    const sevenCloud = Array.from({ length: 7 }, (_, i) => cloud(`c${i}`, `M${i}`, 'p', 'P'))
    const w7 = mountPicker({ availableModels: sevenCloud })
    await w7.find('.model-pill').trigger('click')
    expect(w7.find('.model-search').exists()).toBe(true)
  })

  it('clicking an option emits select(key) and collapses the dropdown', async () => {
    const models = [local('local:a', 'A'), local('local:b', 'B')]
    const w = mountPicker({ availableModels: models, selectedKey: 'local:a' })
    await w.find('.model-pill').trigger('click')
    expect(w.find('.model-dropdown').exists()).toBe(true)
    const options = w.findAll('.model-option')
    await options[1].trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['local:b'])
    expect(w.find('.model-dropdown').exists()).toBe(false)
  })

  it('an outside click closes the dropdown (and clears the search query)', async () => {
    const sevenCloud = Array.from({ length: 7 }, (_, i) => cloud(`c${i}`, `M${i}`, 'p', 'P'))
    const w = mountPicker({ availableModels: sevenCloud })
    await w.find('.model-pill').trigger('click')
    expect(w.find('.model-dropdown').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.model-dropdown').exists()).toBe(false)
  })

  it('🧠 appears only on cloud model options where supports_thinking is true', async () => {
    const models = [
      cloud('cloud:1:a', 'A', 'p1', 'P1', true),
      cloud('cloud:1:b', 'B', 'p1', 'P1', false),
    ]
    const w = mountPicker({ availableModels: models })
    await w.find('.model-pill').trigger('click')
    const metas = w.findAll('.model-option').map((opt) => opt.find('.model-option-meta').exists())
    expect(metas).toEqual([true, false])
  })

  it('empty state: shows "还没有可用模型" copy, clicking "前往设置" emits open-settings and collapses the dropdown', async () => {
    const w = mountPicker({ availableModels: [] })
    await w.find('.model-pill').trigger('click')
    expect(w.find('.model-empty-text').text()).toBe('还没有可用模型')
    await w.find('.model-empty-btn').trigger('click')
    expect(w.emitted('open-settings')).toHaveLength(1)
    expect(w.find('.model-dropdown').exists()).toBe(false)
  })
})
