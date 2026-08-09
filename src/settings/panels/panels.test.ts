/// <reference types="node" />
// 显式引 node 类型而不是往 tsconfig 的 types 数组里加 "node"(同 color-guard.test.ts:8-10)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
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
    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(10)
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
  // Task 9 起 apps 也填了真实内容(数据位置三行 + Docker 缓存清理 + 待上传缓存做样子,见
  // AppsPanel.test.ts)——同理会打 service.sys.getSystemPaths()/service.storage.list() 且用到
  // useToast()(pinia),排除理由与上面一致。
  // P4 起 folder-permissions 与 account 也填了真实内容
  // (见 FolderPermissionsPanel.test.ts / AccountPanel.test.ts)——**至此 9 个 tab 全部实现完毕,
  // 骨架抽查已经没有对象了**(原来那条 it.each 与「骨架的文案 key 都有译文」两条随之收口)。
  // 换成下面这条收口断言:任何 tab 都不该再渲染 .set-skeleton。
  //
  // 为什么不逐个 mount 去证:9 个面板里有 7 个会打真实接口 / 用 useRouter / 用 pinia,
  // 而本文件是**零 mock** 的同步测试(见上面各期的排除理由)。改成扫源码。
  //
  // ⚠️ 查的是 **`settingsSkeletonHint`** 这个文案键,**不是 `.set-skeleton` 类名** ——
  // 后者被 AppsPanel / StoragePanel 复用成了「取数在途」的加载态占位(它们的测试正是
  // 先断 `.set-skeleton` 存在、flush 后不存在),拿类名当判据会永远红。
  // 那个文案键只由 P0 的空骨架模板使用,现在**零引用**就等于 9 个 tab 全填完了。
  it('9 个 tab 全部实现完毕:没有任何面板还在渲染 P0 的骨架提示文案', () => {
    // ⚠️ 目录要用 fileURLToPath(import.meta.url) 解,**不能用 `new URL('.', import.meta.url).pathname`**
    // ——后者在 vitest 下给出的是相对 root 的路径,readdir 会 ENOENT(同 color-guard.test.ts 的口径)。
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const leftovers: string[] = []
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.name.endsWith('.vue') && fs.readFileSync(p, 'utf8').includes('settingsSkeletonHint')) {
          leftovers.push(path.relative(dir, p))
        }
      }
    }
    walk(dir)
    expect(leftovers).toEqual([])
  })

  it('terminal 无标题(对位 Vue2 L51),现为真实的日志卡 + 终端空态', () => {
    const w = mount(PANEL_BY_TAB.terminal, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-head').exists()).toBe(false)
    expect(w.find('.set-term-empty').exists()).toBe(true)
  })

  // storage 的真实交互(容量口径、8% 启发式、跳转 /storage、失败空态、过期守卫)已迁到
  // StoragePanel.test.ts(带 service/router mock)。这里只钉一个零 mock 也能验的静态标记:
  // 入口卡按钮不受异步取数是否落定影响,挂载后立刻就在(不在 v-if 门槛后面)。
  it('storage 已填真实内容(概览 + 入口卡),不再是纯骨架', async () => {
    const w = mount(PANEL_BY_TAB.storage, { global: { plugins: [i18n] } })
    // 评审 Important #3 新增了真实加载态:取数落定前先渲染 .set-skeleton(不是遗漏,
    // 是避免落定前露一段 0 值假读数),这里先钉住"确实经过了加载态",再 flush 到落定后
    // 断言不再是骨架。
    expect(w.find('.set-skeleton').exists()).toBe(true)
    expect(w.find('.set-store-entry').exists()).toBe(true) // 入口卡不受加载态门控
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.find('.set-store-entry').exists()).toBe(true)
  })

  // apps 的真实交互(displayNames 换算虚拟路径、迁移弹窗联动、Docker 清理二次确认、prune
  // 成功/失败提示)已迁到 AppsPanel.test.ts(带 service mock)。这里只钉一个零 mock 也能验
  // 的静态标记:三行数据位置骨架恒定渲染(取数是否落定不影响行数,同 storage 的既有先例)。
  // AppsPanel 用了 useToast()(pinia store),零 mock 下也需要一个 active Pinia,否则
  // setup() 阶段就会因 "no active Pinia" 抛出 —— 只在这一个 it() 里装,不影响其它用例。
  it('apps has real content (four data-location rows + Docker cleanup + upload-cache placeholder), no longer a bare skeleton', async () => {
    setActivePinia(createPinia())
    const w = mount(PANEL_BY_TAB.apps, { global: { plugins: [i18n] } })
    // 评审 Important #3 新增了真实加载态:两个接口都落定前先渲染 .set-skeleton(不是
    // 遗漏,是避免落定前露四行 0 值假读数),这里先钉住"确实经过了加载态"。
    expect(w.find('.set-skeleton').exists()).toBe(true)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(4)
    expect(w.find('.set-app-prune').exists()).toBe(true)
    expect(w.find('.set-app-pending-btn').attributes('disabled')).toBeDefined()
  })

  // developer 的「返回按钮代替标题 / 点击冒泡 open-tab general」用例已迁到
  // DeveloperPanel.test.ts —— 该组件从 Task 11 起会打真实接口(getSSLConfig 等),
  // panels.test.ts 保持零 mock 的纯骨架测试(同 general 的既有先例,见上)。

  // general 的「developer 入口行仍在最后并能 emit open-tab」用例已迁到
  // GeneralPanel.integration.test.ts —— 该组件从 P1 起会打真实接口,
  // panels.test.ts 保持零 mock 的纯骨架测试(见任务简报 Step 4)。

  // 原来用 network 做这条抽查,P2 起它不再是骨架 → 换成仍是骨架的 storage;
  // Task 7 起 storage 也不再是骨架了 → 换成仍是骨架的 apps;
  // 「骨架的文案 key 都有译文」那条(历次在 network → storage → apps → folder-permissions →
  // account 之间挪窝)P4 起没有骨架可查了,已随上面那条一起收口。tab 标题的译文完整性
  // 由 util/tabs.test.ts(TAB_LABEL_KEY 全表)+ i18n/parity.test.ts 一起守。
})

describe('禁用的设置行悬停不变强调色', () => {
  it('.set-list-item.clickable:hover 带 :not(:disabled) 限定', () => {
    const css = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles/settings.css'),
      'utf8',
    )
    // 断在源文本上:jsdom 不做级联,也进不了 hover 态,getComputedStyle 读不出结果。
    const hoverRules = css.match(/\.set-list-item\.clickable[^{]*:hover[^{]*\{/g) ?? []
    expect(hoverRules.length).toBeGreaterThan(0) // 防空转:规则改名了就该红,而不是静默通过
    for (const r of hoverRules) expect(r).toContain(':not(:disabled)')
  })
})
