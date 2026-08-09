### Task 7: 挂 `App.vue` + 解禁设置页那一行

**Files:**
- Modify: `src/App.vue`
- Modify: `src/settings/panels/general/WallpaperRow.vue`(整体重写)
- Modify: `src/settings/panels/general/rows.test.ts`(替换 `WallpaperRow` 那个 describe 块)
- Modify: `src/i18n/zh_cn.sp9.ts` · `src/i18n/en_us.sp9.ts`(删 `settingsWallpaperNa`)

**Interfaces:**
- Consumes: Task 5/6 的 `WallpaperDialog.vue`;Task 4 的 `wp.openDialog` / `wp.load`
- Produces: 全应用任何路由下都能 `useWallpaperStore().openDialog()`

- [ ] **Step 1: 写失败测试** —— 用下面这段**替换** `src/settings/panels/general/rows.test.ts` 里现有的 `describe('WallpaperRow(债务 D5…)')` 整块:

```ts
describe('WallpaperRow (SP11: debt D5 paid off)', () => {
  it('renders the label with an enabled change button', () => {
    const w = mountRow(WallpaperRow)
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.set-btn').attributes('disabled')).toBeUndefined()
  })
  it('no longer explains why it is unavailable', () => {
    expect(mountRow(WallpaperRow).find('.set-row-hint').exists()).toBe(false)
  })
  it('opens the app-level picker', async () => {
    const w = mountRow(WallpaperRow)
    await w.find('.set-btn').trigger('click')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})
```
文件顶部补 `import { useWallpaperStore } from '../../../stores/wallpaper'`,并把该文件的 `vi.mock('@nimotech/nimoos-service', …)` 工厂里的 `users` 补上 `uploadImage` / `setImageFromPath` / `getCustomStorage` 三个桩(store 会 import 到它们)。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/settings/panels/general/rows.test.ts`
Expected: FAIL —— 按钮仍 `disabled`、hint 仍存在。

- [ ] **Step 3: 重写 `WallpaperRow.vue`**

```vue
<script setup lang="ts">
// Settings > General > Wallpaper. Mirrors Vue2 SettingsPanel.vue L102-116.
// SP11 pays off debt D5: the button used to be disabled with a hint saying the
// new UI had no wallpaper system. It now opens the app-level picker, which is
// mounted in App.vue because settings is its own route and the desktop entries
// live under a different one.
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import { useWallpaperStore } from '../../../stores/wallpaper'
const { t } = useI18n()
const wp = useWallpaperStore()
</script>

<template>
  <SettingsRow :label="t('settingsWallpaper')">
    <template #control>
      <button class="set-btn" type="button" @click="wp.openDialog()">{{ t('settingsWallpaperChange') }}</button>
    </template>
  </SettingsRow>
</template>
```

- [ ] **Step 4: 删掉那条死文案** —— 从 `src/i18n/zh_cn.sp9.ts:23` 与 `src/i18n/en_us.sp9.ts:21` 各删一行 `settingsWallpaperNa`。`settingsWallpaper` 与 `settingsWallpaperChange` **保留原位不动**(仍在用)。

- [ ] **Step 5: 挂弹窗到 `App.vue`**

```vue
<template>
  <router-view />
  <WallpaperDialog />
  <AppToast />
</template>
```
```ts
import { defineAsyncComponent, onMounted } from 'vue'
import AppToast from './components/AppToast.vue'
import { useSessionStore } from './stores/session'
import { useLocaleStore } from './stores/locale'
import { useWallpaperStore } from './stores/wallpaper'

// Async on purpose: the two built-in JPEGs total ~3 MB, and this keeps them out
// of the first-paint bundle -- they download only when the picker is opened.
const WallpaperDialog = defineAsyncComponent(() => import('./components/WallpaperDialog.vue'))

onMounted(() => {
  const session = useSessionStore()
  if (session.isAuthed) {
    void useLocaleStore().loadFromServer()
    // main.ts already painted the cached wallpaper before mount; this reconciles
    // it with the server so a change made on another device shows up.
    void useWallpaperStore().load()
  }
})
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run src/settings/panels/general/rows.test.ts src/i18n && pnpm vue-tsc --noEmit`
Expected: 全绿(`src/i18n` 确认删键后 parity 仍一致)+ exit 0。

- [ ] **Step 7: 确认 3MB 真的没进首屏 chunk**

Run: `pnpm build && ls -la dist/assets/ | grep -i wallpaper`
Expected: 两个 wallpaper 资源存在,且 `dist/assets/index-*.js` 里**不含**它们的引用 —— 用
`grep -c "wallpaper0" dist/assets/index-*.js` 应得 `0`,而某个懒加载 chunk 里能 grep 到。

- [ ] **Step 8: Commit**

```bash
git add src/App.vue src/settings/panels/general/WallpaperRow.vue src/settings/panels/general/rows.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git commit -o src/App.vue src/settings/panels/general/WallpaperRow.vue src/settings/panels/general/rows.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts -m "feat(wallpaper): mount the picker app-wide and enable the settings row

The picker has to be an App.vue singleton because settings is its own route
while the desktop entries live under another, so no route-scoped store can
reach both. Loading it asynchronously keeps the ~3 MB of built-in imagery out
of the first-paint bundle. Debt D5 and its explanatory hint string are gone.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

