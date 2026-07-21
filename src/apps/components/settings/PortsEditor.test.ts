import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PortsEditor from './PortsEditor.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('PortsEditor', () => {
  it('marks conflicting rows (published+protocol match)', () => {
    const rows = [
      { published: '8384', target: '8384', protocol: 'tcp' as const },
      { published: '22000', target: '22000', protocol: 'udp' as const },
    ]
    const w = mount(PortsEditor, { props: { rows, conflicts: ['8384/tcp'] }, global: { plugins: [i18n] } })
    const items = w.findAll('[data-test="port-row"]')
    expect(items[0].classes()).toContain('conflict')
    expect(items[1].classes()).not.toContain('conflict')
  })
  it('add/remove rows mutates array', async () => {
    const rows: Array<{ published: string; target: string; protocol: 'tcp' | 'udp' }> = []
    const w = mount(PortsEditor, { props: { rows }, global: { plugins: [i18n] } })
    await w.find('[data-test="port-add"]').trigger('click')
    expect(rows).toHaveLength(1)
    expect(rows[0].protocol).toBe('tcp')
  })
})
