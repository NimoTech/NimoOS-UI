import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  listToolboxComponents: vi.fn(),
  installToolboxComponent: vi.fn(),
  upgradeToolboxComponent: vi.fn(),
  uninstallToolboxComponent: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      listToolboxComponents: h.listToolboxComponents,
      installToolboxComponent: h.installToolboxComponent,
      upgradeToolboxComponent: h.upgradeToolboxComponent,
      uninstallToolboxComponent: h.uninstallToolboxComponent,
    },
  },
}))

import ToolboxSection from './ToolboxSection.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () =>
  mount(ToolboxSection, { props: { pollIntervalMs: 1 }, global: { plugins: [i18n] } })
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

function comp(over: Record<string, unknown> = {}) {
  return {
    id: 'gh',
    name: 'GitHub CLI',
    description: 'GitHub official CLI',
    latest_version: '2.62.0',
    installed_version: null,
    status: 'not_installed',
    error: '',
    ...over,
  }
}

describe('ToolboxSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    h.listToolboxComponents.mockReset()
    h.installToolboxComponent.mockReset()
    h.upgradeToolboxComponent.mockReset()
    h.uninstallToolboxComponent.mockReset()
  })

  it('renders catalog rows with version + status pill', async () => {
    h.listToolboxComponents.mockResolvedValue({ components: [comp()] })
    const w = mountSection()
    await flush()
    expect(w.text()).toContain('GitHub CLI')
    expect(w.text()).toContain('可安装 v2.62.0')
    expect(w.text()).toContain('未安装')
    expect(w.find('[data-test="toolbox-install"]').exists()).toBe(true)
  })

  it('unmanaged binaries render dimmed with a disabled no-op button', async () => {
    h.listToolboxComponents.mockResolvedValue({
      components: [comp({ id: 'unmanaged:mytool', name: 'mytool', status: 'unmanaged' })],
    })
    const w = mountSection()
    await flush()
    expect(w.find('.tok-row.unmanaged').exists()).toBe(true)
    expect(w.text()).toContain('未托管的二进制')
    expect(w.find('[data-test="toolbox-install"]').exists()).toBe(false)
  })

  it('install click calls the endpoint then polls until the row settles', async () => {
    h.listToolboxComponents
      .mockResolvedValueOnce({ components: [comp()] })
      .mockResolvedValueOnce({ components: [comp({ status: 'installing' })] })
      .mockResolvedValue({
        components: [comp({ status: 'installed', installed_version: '2.62.0' })],
      })
    h.installToolboxComponent.mockResolvedValue({ status: 'installing' })
    const w = mountSection()
    await flush()
    await w.find('[data-test="toolbox-install"]').trigger('click')
    await new Promise((r) => setTimeout(r, 20))
    await flush()
    expect(h.installToolboxComponent).toHaveBeenCalledWith('gh')
    expect(w.text()).toContain('已安装 v2.62.0')
    expect(w.find('[data-test="toolbox-uninstall"]').exists()).toBe(true)
  })

  it('upgrade button shows only when the installed version lags the catalog', async () => {
    h.listToolboxComponents.mockResolvedValue({
      components: [
        comp({ id: 'gh', status: 'installed', installed_version: '2.60.0' }),
        comp({ id: 'lark-cli', name: 'lark', status: 'installed', installed_version: '1.0.85', latest_version: '1.0.85' }),
      ],
    })
    const w = mountSection()
    await flush()
    const upgrades = w.findAll('[data-test="toolbox-upgrade"]')
    expect(upgrades).toHaveLength(1)
    expect(upgrades[0].text()).toContain('升级到 v2.62.0')
  })

  it('upgrade click calls the upgrade endpoint', async () => {
    h.listToolboxComponents.mockResolvedValue({
      components: [comp({ status: 'installed', installed_version: '2.60.0' })],
    })
    h.upgradeToolboxComponent.mockResolvedValue({ status: 'upgrading' })
    const w = mountSection()
    await flush()
    await w.find('[data-test="toolbox-upgrade"]').trigger('click')
    await flush()
    expect(h.upgradeToolboxComponent).toHaveBeenCalledWith('gh')
  })

  it('uninstall click calls the endpoint and reloads', async () => {
    h.listToolboxComponents
      .mockResolvedValueOnce({
        components: [comp({ status: 'installed', installed_version: '2.62.0' })],
      })
      .mockResolvedValue({ components: [comp()] })
    h.uninstallToolboxComponent.mockResolvedValue({ status: 'ok' })
    const w = mountSection()
    await flush()
    await w.find('[data-test="toolbox-uninstall"]').trigger('click')
    await flush()
    expect(h.uninstallToolboxComponent).toHaveBeenCalledWith('gh')
    expect(w.find('[data-test="toolbox-install"]').exists()).toBe(true)
  })

  it('failed rows surface the stored error text', async () => {
    h.listToolboxComponents.mockResolvedValue({
      components: [comp({ status: 'failed', error: 'sha256 mismatch' })],
    })
    const w = mountSection()
    await flush()
    expect(w.find('.tox-err').text()).toBe('sha256 mismatch')
  })
})
