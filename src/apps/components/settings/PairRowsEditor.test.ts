import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PairRowsEditor from './PairRowsEditor.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mk = (rows: Array<{ a: string; b: string }>) =>
  mount(PairRowsEditor, { props: { rows, labelA: 'K', labelB: 'V' }, global: { plugins: [i18n] } })

describe('PairRowsEditor', () => {
  it('renders a row per item and mutates on input', async () => {
    const rows = [{ a: 'TZ', b: 'UTC' }]
    const w = mk(rows)
    const inputs = w.findAll('input')
    expect(inputs).toHaveLength(2)
    await inputs[1].setValue('Asia/Shanghai')
    expect(rows[0].b).toBe('Asia/Shanghai')
  })
  it('add appends empty row; remove deletes the row', async () => {
    const rows = [{ a: 'X', b: '1' }]
    const w = mk(rows)
    await w.find('[data-test="pair-add"]').trigger('click')
    expect(rows).toHaveLength(2)
    await w.findAll('[data-test="pair-del"]')[0].trigger('click')
    expect(rows).toHaveLength(1)
    expect(rows[0].a).toBe('')
  })
})
