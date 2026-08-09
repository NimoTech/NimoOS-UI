### Task 9: 桌面空白处右键菜单

**Files:**
- Create: `src/home/components/DesktopContextMenu.vue`
- Create: `src/home/components/DesktopContextMenu.test.ts`
- Modify: `src/views/Home.vue`(用它包住 `GridCanvas`)
- Modify: `src/i18n/zh_cn.base.ts` · `src/i18n/en_us.base.ts`(加 `wpChangeWallpaper`)

**Interfaces:**
- Consumes: `src/components/ui/ContextMenu.vue`;Task 4 的 `wp.openDialog`
- Produces: `DesktopContextMenu.vue` 默认导出(默认插槽包住被右击区域)

**新增 i18n 键:** `wpChangeWallpaper` → zh `更换壁纸` / en `Change wallpaper`

- [ ] **Step 1: 写失败测试 `src/home/components/DesktopContextMenu.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => '', setCustomStorage: async () => undefined,
      uploadImage: async () => ({ path: 'p', file_name: 'f', online_path: 'x' }),
      setImageFromPath: async () => ({ path: 'p', file_name: 'f', online_path: 'x' }),
    },
  },
}))

import DesktopContextMenu from './DesktopContextMenu.vue'
import { useWallpaperStore } from '../../stores/wallpaper'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

describe('DesktopContextMenu', () => {
  it('renders its slot content unchanged', () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'canvas-stub' }, 'grid') },
    })
    expect(w.find('.canvas-stub').text()).toBe('grid')
  })

  it('lets a right-click on a tile through to the browser instead of opening the menu', async () => {
    // Vue2 gated this the same way (wallpaper/ContextMenu.vue:50 checked for the
    // contextmenu-canvas class): a right-click on a tile is not a desktop click.
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }, [h('div', { class: 'grid-item' }, 'tile')]) },
    })
    const tile = w.find('.grid-item')
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    tile.element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('handles a right-click on blank canvas', async () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }, 'blank') },
    })
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    w.find('.grid').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('exposes a wallpaper action that opens the picker', async () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }) },
    })
    // The menu content is portalled; call the handler the item is bound to.
    ;(w.vm as unknown as { onChangeWallpaper: () => void }).onChangeWallpaper()
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/home/components/DesktopContextMenu.test.ts`
Expected: FAIL —— 组件不存在。

- [ ] **Step 3: 写实现 `src/home/components/DesktopContextMenu.vue`**

```vue
<script setup lang="ts">
// Right-click on empty desktop -> Change wallpaper. Ports Vue2
// components/wallpaper/ContextMenu.vue, including its gate: a right-click that
// landed on a tile is not a desktop click and must fall through to the browser
// (Vue2 checked for the `contextmenu-canvas` class at :50; New-UI's equivalent
// signal is "the target is inside a .grid-item").
import { ContextMenuItem } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import ContextMenu from '../../components/ui/ContextMenu.vue'
import { useWallpaperStore } from '../../stores/wallpaper'

const { t } = useI18n()
const wp = useWallpaperStore()

function onContextMenu(e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('.grid-item')) {
    // Stop reka-ui's trigger from seeing it; the browser menu stays available.
    e.stopPropagation()
  }
}

function onChangeWallpaper() {
  wp.openDialog()
}

defineExpose({ onChangeWallpaper })
</script>

<template>
  <ContextMenu>
    <div class="desktop-ctx-host" @contextmenu.capture="onContextMenu">
      <slot />
    </div>
    <template #menu>
      <ContextMenuItem class="ui-ctx-item ctx-change-wallpaper" @select="onChangeWallpaper">
        {{ t('wpChangeWallpaper') }}
      </ContextMenuItem>
    </template>
  </ContextMenu>
</template>

<style scoped>
/* Must not introduce a new box: GridCanvas measures itself and the dock offset. */
.desktop-ctx-host { display: contents; }
</style>
```

> `display: contents` 是刻意的:`useGridMeasure` 量的是 `GridCanvas` 根元素与 dock 的位置,插一个有盒模型的包裹层会改布局。若 `@vue/test-utils` 下 `closest` 因 `display:contents` 行为异常,改成把 `@contextmenu.capture` 直接绑在 `ContextMenu` 的 trigger 上并去掉包裹 div。

- [ ] **Step 4: 接进 `src/views/Home.vue`** —— 把
```vue
    <GridCanvas v-else ref="canvas" :cell="cell" :gap="gap" :cols="cols" :rows="rows" />
```
换成
```vue
    <DesktopContextMenu v-else>
      <GridCanvas ref="canvas" :cell="cell" :gap="gap" :cols="cols" :rows="rows" />
    </DesktopContextMenu>
```
并 `import DesktopContextMenu from '../home/components/DesktopContextMenu.vue'`。
**不给手机端(`MobileHome`)加** —— 它是只读启动器(spec §9)。

- [ ] **Step 5: 跑测试确认通过 + 主页回归**

Run: `pnpm vitest run src/home src/views/Home.integration.test.ts && pnpm vue-tsc --noEmit`
Expected: 全绿。**若 `Home.integration.test.ts` 因多一层包裹而红,修测试的选择器,不要退回去删包裹层** —— 但必须确认 `useGridMeasure` 相关断言(cols/rows/cell)数值未变,变了说明 `display: contents` 没生效,那才是真回归。

- [ ] **Step 6: Commit**

```bash
git add src/home/components/DesktopContextMenu.vue src/home/components/DesktopContextMenu.test.ts src/views/Home.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -o src/home/components/DesktopContextMenu.vue src/home/components/DesktopContextMenu.test.ts src/views/Home.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts -m "feat(wallpaper): add the desktop right-click entry

Ports Vue2's desktop context menu including its gate: a right-click that landed
on a tile is not a desktop click and falls through to the browser. The host
element uses display:contents so the grid measurement, which reads the canvas
and dock geometry, is unaffected.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

