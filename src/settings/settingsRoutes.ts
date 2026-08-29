import type { RouteRecordRaw } from 'vue-router'
import SettingsPage from './views/SettingsPage.vue'
import { DEFAULT_TAB, isSettingsTab } from './util/tabs'
import { readLastTab } from './util/lastTab'

// The route table lives in its own file; src/router/index.ts only adds one import + one spread.
// This keeps SP9's change to the main route table fixed at two lines, minimizing the merge-conflict surface with sp7/sp8 when they later merge into master (spec §9.3 item 3).
export const settingsRoutes: RouteRecordRaw[] = [
  // Memory is carried by the route (Vue2 keeps it in component data + watch); readLastTab already falls back to general on an invalid stored value.
  { path: '/settings', redirect: () => `/settings/${readLastTab()}` },
  {
    path: '/settings/:tab',
    name: 'settings',
    component: SettingsPage,
    // Unknown tab falls back to general, not a 404 (spec §4.1).
    beforeEnter: (to) => (isSettingsTab(to.params.tab) ? true : `/settings/${DEFAULT_TAB}`),
  },
]
