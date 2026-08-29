import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn.sp9'
import FolderPermissionsPanel from './FolderPermissionsPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// The panel itself doesn't teleport, but it contains a FolderPickerDialog (reka Portal).
// Without explicit cleanup, dialog content leaks into the next test case (same lesson as
// P3 AppPathDialog.test.ts:49-87).
let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* already unmounted */ }
  }
  mountedWrappers = []
  document.body.innerHTML = ''
})

function mountPanel() {
  const w = mount(FolderPermissionsPanel, { global: { plugins: [i18n] } })
  mountedWrappers.push(w)
  return w
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('FolderPermissionsPanel —— policy 3 "read-only mockup"', () => {
  it('shows the Vue2 intro copy plus this sprint\'s new "data source not yet wired up" notice bar', async () => {
    const w = mountPanel()
    await flush()
    expect(w.text()).toContain(zh.settingsFpIntro)
    expect(w.find('[data-test="fp-pending"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.settingsFpDataPending)
  })

  it('all four sections are present, titles match Vue2 (C3: four sections, not a matrix)', async () => {
    const w = mountPanel()
    await flush()
    const titles = w.findAll('.set-fp-title').map((n) => n.text())
    expect(titles).toEqual([
      zh.settingsFpFilenameIndex,
      zh.settingsFpKnowledge,
      zh.settingsFpAiHidden,
      zh.settingsFpPhotos,
    ])
  })

  it('every section has Vue2\'s description text', async () => {
    const w = mountPanel()
    await flush()
    for (const k of ['settingsFpFilenameDesc', 'settingsFpKnowledgeDesc', 'settingsFpAiDesc', 'settingsFpPhotosDesc'] as const) {
      expect(w.text()).toContain(zh[k])
    }
  })

  it('the AI section carries the "current user only" badge (Vue2 L87-89 renders it unconditionally)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.text()).toContain(zh.settingsFpCurrentUserOnly)
  })

  it('empty snapshot, all four sources offline → all four sections show the "service offline" badge', async () => {
    const w = mountPanel()
    await flush()
    expect(w.findAll('[data-test="fp-offline"]')).toHaveLength(4)
    expect(w.text()).toContain(zh.settingsFpServiceOffline)
  })

  it('while offline, no "add folder" button is rendered at all (Vue2 v-if="offline" takes the badge branch)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.findAll('[data-test^="fp-add-"]')).toHaveLength(0)
  })

  it('while offline, none of the four sections\' lists or empty-state hints render (Vue2 wraps them in a !offline template)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.findAll('.set-fp-item')).toHaveLength(0)
    expect(w.findAll('.set-fp-empty')).toHaveLength(0)
    expect(w.text()).not.toContain(zh.settingsFpNoFolders)
  })

  it('the refresh button exists and is clickable, and triggers no write operation', async () => {
    const w = mountPanel()
    await flush()
    const btn = w.find('[data-test="fp-refresh"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    await flush()
    // Still the empty snapshot with all four sources offline, no exception bubbled up
    expect(w.findAll('[data-test="fp-offline"]')).toHaveLength(4)
  })

  it('this sprint renders zero toggles — writes are disabled (policy 3)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('the photos section shows no "update needed" / "auto mode" copy when neither stale nor auto', async () => {
    const w = mountPanel()
    await flush()
    expect(w.text()).not.toContain(zh.settingsFpUpdateRequired)
    expect(w.text()).not.toContain(zh.settingsFpPhotosAuto)
  })
})
