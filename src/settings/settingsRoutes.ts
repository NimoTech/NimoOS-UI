import type { RouteRecordRaw } from 'vue-router'
import SettingsPage from './views/SettingsPage.vue'
import { DEFAULT_TAB, isSettingsTab } from './util/tabs'
import { readLastTab } from './util/lastTab'

// 路由表单独成文件,src/router/index.ts 只加一个 import + 一次展开。
// 这样 SP9 对主路由表的改动固定为两行,与 sp7/sp8 将来合并 master 的冲突面最小(spec §9.3 第 3 条)。
export const settingsRoutes: RouteRecordRaw[] = [
  // 记忆由路由承载(Vue2 是组件内 data + watch);readLastTab 已对非法存值回落 general。
  { path: '/settings', redirect: () => `/settings/${readLastTab()}` },
  {
    path: '/settings/:tab',
    name: 'settings',
    component: SettingsPage,
    // 未知 tab 回落 general,不是 404(spec §4.1)。
    beforeEnter: (to) => (isSettingsTab(to.params.tab) ? true : `/settings/${DEFAULT_TAB}`),
  },
]
