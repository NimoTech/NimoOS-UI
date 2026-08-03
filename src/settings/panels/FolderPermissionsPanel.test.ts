import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn.sp9'
import FolderPermissionsPanel from './FolderPermissionsPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// 面板本身不 teleport,但它内含 FolderPickerDialog(reka Portal)。不显式清理的话
// 弹窗内容会残留到下一个用例(同 P3 AppPathDialog.test.ts:49-87 的教训)。
let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* 已 unmount 过 */ }
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

describe('FolderPermissionsPanel —— 政策三「做样子」', () => {
  it('顶部有 Vue2 原文说明 + 本期新增的「数据源待接入」说明条', async () => {
    const w = mountPanel()
    await flush()
    expect(w.text()).toContain(zh.settingsFpIntro)
    expect(w.find('[data-test="fp-pending"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.settingsFpDataPending)
  })

  it('四个分区都在,标题与 Vue2 一致(C3:四分区,不是矩阵)', async () => {
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

  it('每个分区都有 Vue2 的说明文字', async () => {
    const w = mountPanel()
    await flush()
    for (const k of ['settingsFpFilenameDesc', 'settingsFpKnowledgeDesc', 'settingsFpAiDesc', 'settingsFpPhotosDesc'] as const) {
      expect(w.text()).toContain(zh[k])
    }
  })

  it('AI 分区带「仅当前用户」徽标(Vue2 L87-89 无条件渲染)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.text()).toContain(zh.settingsFpCurrentUserOnly)
  })

  it('空快照四路离线 → 四个分区都显示「服务离线」徽标', async () => {
    const w = mountPanel()
    await flush()
    expect(w.findAll('[data-test="fp-offline"]')).toHaveLength(4)
    expect(w.text()).toContain(zh.settingsFpServiceOffline)
  })

  it('离线时不渲染任何「添加文件夹」按钮(Vue2 v-if="offline" 走徽标分支)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.findAll('[data-test^="fp-add-"]')).toHaveLength(0)
  })

  it('离线时四个分区的列表与空态提示都不渲染(Vue2 把它们包在 !offline 的 template 里)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.findAll('.set-fp-item')).toHaveLength(0)
    expect(w.findAll('.set-fp-empty')).toHaveLength(0)
    expect(w.text()).not.toContain(zh.settingsFpNoFolders)
  })

  it('刷新按钮存在且可点,不会触发任何写操作', async () => {
    const w = mountPanel()
    await flush()
    const btn = w.find('[data-test="fp-refresh"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    await flush()
    // 仍然是四路离线的空快照,没有异常冒泡
    expect(w.findAll('[data-test="fp-offline"]')).toHaveLength(4)
  })

  it('本期一个开关都不渲染 —— 写操作禁用(政策三)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('照片分区在非 stale 非 auto 时不显示「需要更新」/「自动模式」文案', async () => {
    const w = mountPanel()
    await flush()
    expect(w.text()).not.toContain(zh.settingsFpUpdateRequired)
    expect(w.text()).not.toContain(zh.settingsFpPhotosAuto)
  })
})
