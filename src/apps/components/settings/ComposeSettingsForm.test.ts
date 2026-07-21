import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import zh from '../../../i18n/zh_cn'
import ComposeSettingsForm from './ComposeSettingsForm.vue'
import { parseSettings } from '../../util/composeSettings'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const YAML2 = `services:
  a:
    image: img/a:1
    ports: ["80:80"]
  b:
    image: img/b:1
x-nimoos:
  scheme: http
  title: { custom: T }
`
function mk() {
  const model = reactive(parseSettings(YAML2, 'zh_cn'))
  const w = mount(ComposeSettingsForm, { props: { model }, global: { plugins: [i18n] } })
  return { w, model }
}

describe('ComposeSettingsForm', () => {
  it('renders one tab per service; switching shows that service fields', async () => {
    const { w } = mk()
    const tabs = w.findAll('[data-test="svc-tab"]')
    expect(tabs).toHaveLength(2)
    await tabs[1].trigger('click')
    expect((w.find('[data-test="svc-image"]').element as HTMLInputElement).value).toBe('img/b:1')
  })
  it('webui section only on first service tab; edits land in model', async () => {
    const { w, model } = mk()
    expect(w.find('[data-test="webui-section"]').exists()).toBe(true)
    await w.find('[data-test="webui-port"]').setValue('8080')
    expect(model.webui.portMap).toBe('8080')
    await w.findAll('[data-test="svc-tab"]')[1].trigger('click')
    expect(w.find('[data-test="webui-section"]').exists()).toBe(false)
  })
  it('tips textarea binds model.tipsCustom and preview renders markdown', async () => {
    const { w, model } = mk()
    await w.find('[data-test="tips-input"]').setValue('# hi')
    expect(model.tipsCustom).toBe('# hi')
    await w.find('[data-test="tips-preview-btn"]').trigger('click')
    expect(w.find('[data-test="tips-preview"]').html()).toContain('<h1>')
  })
  it('memory input empty -> null, number -> MB', async () => {
    const { w, model } = mk()
    await w.find('[data-test="svc-memory"]').setValue('512')
    expect(model.services[0].memoryMB).toBe(512)
    await w.find('[data-test="svc-memory"]').setValue('')
    expect(model.services[0].memoryMB).toBeNull()
  })
  it('command 编辑器:加/删 token 置 commandDirty', async () => {
    const { w, model } = mk()
    expect(model.services[0].commandDirty).toBe(false)
    await w.find('[data-test="cmd-add"]').trigger('click')
    expect(model.services[0].commandTokens).toEqual([''])
    expect(model.services[0].commandDirty).toBe(true)
    await w.find('[data-test="cmd-input"]').setValue('redis-server')
    expect(model.services[0].commandTokens).toEqual(['redis-server'])
    model.services[0].commandDirty = false // 复位再验证删除也置 dirty
    await w.find('[data-test="cmd-del"]').trigger('click')
    expect(model.services[0].commandTokens).toEqual([])
    expect(model.services[0].commandDirty).toBe(true)
  })
  it('networks prop 渲染下拉且按 driver 分组,选择置 networkDirty', async () => {
    const model = reactive(parseSettings(YAML2, 'zh_cn'))
    const w = mount(ComposeSettingsForm, {
      props: {
        model,
        networks: [
          { name: 'bridge', driver: 'bridge', id: '1' },
          { name: 'host', driver: 'host', id: '2' },
          { name: 'mynet', driver: 'bridge', id: '3' },
          { name: 'vlan1', driver: 'macvlan', id: '4' },
        ],
      },
      global: { plugins: [i18n] },
    })
    const select = w.find('[data-test="svc-network"]')
    expect(select.exists()).toBe(true)
    const groups = select.findAll('optgroup')
    expect(groups.length).toBeGreaterThan(0)
    expect(select.html()).toContain('mynet')
    expect(select.html()).toContain('vlan1')
    await select.setValue('host')
    expect(model.services[0].network).toBe('host')
    expect(model.services[0].networkDirty).toBe(true)
  })
  it('stableTags 有值时 tag 下拉出现,选 stable 改写 image tag;非商店应用(null)不渲染', async () => {
    const model = reactive(parseSettings(YAML2, 'zh_cn'))
    const w = mount(ComposeSettingsForm, {
      props: { model, stableTags: { a: '1.2.3', b: null } },
      global: { plugins: [i18n] },
    })
    const tagSelect = w.find('[data-test="tag-select"]')
    expect(tagSelect.exists()).toBe(true)
    expect(tagSelect.html()).toContain('1.2.3')
    await tagSelect.setValue('stable')
    expect(model.services[0].image).toBe('img/a:1.2.3')
    await w.findAll('[data-test="svc-tab"]')[1].trigger('click')
    expect(w.find('[data-test="tag-select"]').exists()).toBe(false)
  })
})
