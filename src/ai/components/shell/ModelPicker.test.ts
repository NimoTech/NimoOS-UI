import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ModelPicker from './ModelPicker.vue'
import type { AgentModel } from '../../stores/agentStore'

// 1:1 逐字港 Vue2 src/views/AI/Agent/shell/ModelPicker.vue(127 行)。
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
  it('已选中模型时 pill 显示其 displayName', () => {
    const models = [local('local:llama3', 'Llama 3')]
    const w = mountPicker({ availableModels: models, selectedKey: 'local:llama3' })
    expect(w.find('.model-pill-name').text()).toBe('Llama 3')
  })

  it('有模型可选但未选中 → pill 显示"未选择";完全无模型 → pill 显示"选择模型"', () => {
    const withModels = mountPicker({ availableModels: [local('a', 'A')], selectedKey: null })
    expect(withModels.find('.model-pill-name').text()).toBe('未选择')

    const noModels = mountPicker({ availableModels: [], selectedKey: null })
    expect(noModels.find('.model-pill-name').text()).toBe('选择模型')
  })

  it('本地组(💻)与云组(☁️)分别渲染,各自的选项列全部出现', async () => {
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

  it('云模型 <=6 个不出现搜索框,7 个及以上出现搜索框', async () => {
    const sixCloud = Array.from({ length: 6 }, (_, i) => cloud(`c${i}`, `M${i}`, 'p', 'P'))
    const w6 = mountPicker({ availableModels: sixCloud })
    await w6.find('.model-pill').trigger('click')
    expect(w6.find('.model-search').exists()).toBe(false)

    const sevenCloud = Array.from({ length: 7 }, (_, i) => cloud(`c${i}`, `M${i}`, 'p', 'P'))
    const w7 = mountPicker({ availableModels: sevenCloud })
    await w7.find('.model-pill').trigger('click')
    expect(w7.find('.model-search').exists()).toBe(true)
  })

  it('点击选项 emit select(key) 并收起下拉', async () => {
    const models = [local('local:a', 'A'), local('local:b', 'B')]
    const w = mountPicker({ availableModels: models, selectedKey: 'local:a' })
    await w.find('.model-pill').trigger('click')
    expect(w.find('.model-dropdown').exists()).toBe(true)
    const options = w.findAll('.model-option')
    await options[1].trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['local:b'])
    expect(w.find('.model-dropdown').exists()).toBe(false)
  })

  it('外部点击关闭下拉(并清空搜索 query)', async () => {
    const sevenCloud = Array.from({ length: 7 }, (_, i) => cloud(`c${i}`, `M${i}`, 'p', 'P'))
    const w = mountPicker({ availableModels: sevenCloud })
    await w.find('.model-pill').trigger('click')
    expect(w.find('.model-dropdown').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.model-dropdown').exists()).toBe(false)
  })

  it('🧠 仅在 supports_thinking 为真的云模型选项上出现', async () => {
    const models = [
      cloud('cloud:1:a', 'A', 'p1', 'P1', true),
      cloud('cloud:1:b', 'B', 'p1', 'P1', false),
    ]
    const w = mountPicker({ availableModels: models })
    await w.find('.model-pill').trigger('click')
    const metas = w.findAll('.model-option').map((opt) => opt.find('.model-option-meta').exists())
    expect(metas).toEqual([true, false])
  })

  it('空态:显示"还没有可用模型"文案,点"前往设置" emit open-settings 并收起下拉', async () => {
    const w = mountPicker({ availableModels: [] })
    await w.find('.model-pill').trigger('click')
    expect(w.find('.model-empty-text').text()).toBe('还没有可用模型')
    await w.find('.model-empty-btn').trigger('click')
    expect(w.emitted('open-settings')).toHaveLength(1)
    expect(w.find('.model-dropdown').exists()).toBe(false)
  })
})
