import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import { SETTINGS_TABS } from '../util/tabs'
import { PANEL_BY_TAB } from './index'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: { zh_cn: { ...zh, ...zhSp9 } },
})

describe('9 个 tab 骨架', () => {
  it('每个 tab 都能取到一个组件', () => {
    for (const t of SETTINGS_TABS) {
      expect(PANEL_BY_TAB[t], t).toBeTruthy()
    }
    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(9)
  })

  // P1 起 general 已填真实内容(见 GeneralPanel.integration.test.ts),不再有 .set-skeleton;
  // developer 从 Task 11 起也填了真实内容(见 DeveloperPanel.test.ts),同样不再是纯骨架。
  // P2 起 network 也填了真实内容(见 network/NetworkPanel.integration.test.ts)——它会打
  // service.network.getInterfaces() 与 useUtilization(MessageBus + /sys/utilization),
  // 而本文件是**零 mock** 的纯骨架测试,挂载它会因 getHttp() 未初始化而抛。
  // P3 起 system-status 也填了真实内容(见 SystemStatusPanel.test.ts)——同理会打
  // service.sys.getGatewayComponents(),排除理由与 network 一致。
  // P3 起 terminal 也填了真实内容(见 TerminalPanel.test.ts)——同理会打
  // service.sys.getLogs(),排除理由与 network/system-status 一致。
  // Task 7 起 storage 也填了真实内容(容量概览 + 跳转入口卡,见 StoragePanel.test.ts)——
  // 同理会打 service.storage.list() 且用到 useRouter(),排除理由与上面一致。
  it.each(SETTINGS_TABS.filter((t) => t !== 'terminal' && t !== 'general' && t !== 'developer' && t !== 'network' && t !== 'system-status' && t !== 'storage'))('%s 骨架渲染标题与空态位', (tab) => {
    const w = mount(PANEL_BY_TAB[tab], { global: { plugins: [i18n] } })
    expect(w.find('.set-section-title,.set-back').exists()).toBe(true)
    expect(w.find('.set-skeleton').exists()).toBe(true)
  })

  it('terminal 无标题(对位 Vue2 L51),现为真实的日志卡 + 终端空态', () => {
    const w = mount(PANEL_BY_TAB.terminal, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-head').exists()).toBe(false)
    expect(w.find('.set-term-empty').exists()).toBe(true)
  })

  // storage 的真实交互(容量口径、8% 启发式、跳转 /storage、失败空态、过期守卫)已迁到
  // StoragePanel.test.ts(带 service/router mock)。这里只钉一个零 mock 也能验的静态标记:
  // 入口卡按钮不受异步取数是否落定影响,挂载后立刻就在(不在 v-if 门槛后面)。
  it('storage 已填真实内容(概览 + 入口卡),不再是纯骨架', () => {
    const w = mount(PANEL_BY_TAB.storage, { global: { plugins: [i18n] } })
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.find('.set-store-entry').exists()).toBe(true)
  })

  // developer 的「返回按钮代替标题 / 点击冒泡 open-tab general」用例已迁到
  // DeveloperPanel.test.ts —— 该组件从 Task 11 起会打真实接口(getSSLConfig 等),
  // panels.test.ts 保持零 mock 的纯骨架测试(同 general 的既有先例,见上)。

  // general 的「developer 入口行仍在最后并能 emit open-tab」用例已迁到
  // GeneralPanel.integration.test.ts —— 该组件从 P1 起会打真实接口,
  // panels.test.ts 保持零 mock 的纯骨架测试(见任务简报 Step 4)。

  // 原来用 network 做这条抽查,P2 起它不再是骨架 → 换成仍是骨架的 storage;
  // Task 7 起 storage 也不再是骨架了(见上一条新用例)→ 再换成仍是骨架的 apps(理由同上)。
  it('骨架的文案 key 都有译文(没有渲染出裸 key)', () => {
    const w = mount(PANEL_BY_TAB.apps, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-title').text()).toBe('应用')
    expect(w.find('.set-skeleton').text()).not.toMatch(/^settings/)
  })
})
