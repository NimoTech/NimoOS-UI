### Task 2: 缩略图 `isImage` + `useInView` + `FileThumb`,接入 FileTile/FileRow

**Files:**
- Create: `src/files/util/isImage.ts`
- Create: `src/files/util/isImage.test.ts`
- Create: `src/files/composables/useInView.ts`
- Create: `src/files/components/FileThumb.vue`
- Create: `src/files/components/FileThumb.test.ts`
- Modify: `src/files/components/FileTile.vue`(图标换 FileThumb)
- Modify: `src/files/components/FileRow.vue`(图标换 FileThumb)
- Modify: `src/files/components/FileRow.test.ts`(stub FileThumb,改图标断言)

**Interfaces:**
- Consumes:`IMAGE_EXTS`/`iconNameFor`/`iconUrl`(icons.ts,Task1)、`fileExt`(ext.ts)、`service.image.thumbUrl`(共享包)、`FileEntry`。
- Produces:
  ```ts
  export function isImageEntry(e: { name: string; is_dir: boolean }): boolean   // isImage.ts
  export function useInView(el: Ref<HTMLElement | null>): Ref<boolean>           // useInView.ts:一次性进入视口
  // FileThumb.vue: props { entry: FileEntry };根 <span class="file-thumb">,由父级类名定尺寸
  ```

- [ ] **Step 1: 写 isImage 失败测试**

`src/files/util/isImage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isImageEntry } from './isImage'

describe('isImageEntry', () => {
  it('true for image files (case-insensitive)', () => {
    expect(isImageEntry({ name: 'p.png', is_dir: false })).toBe(true)
    expect(isImageEntry({ name: 'P.JPG', is_dir: false })).toBe(true)
    expect(isImageEntry({ name: 'a.webp', is_dir: false })).toBe(true)
  })
  it('false for non-images and directories', () => {
    expect(isImageEntry({ name: 'a.txt', is_dir: false })).toBe(false)
    expect(isImageEntry({ name: 'v.mp4', is_dir: false })).toBe(false)
    expect(isImageEntry({ name: 'Pics', is_dir: true })).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/util/isImage.test.ts`
Expected: FAIL(`Cannot find module './isImage'`)

- [ ] **Step 3: 写 isImage 实现**

`src/files/util/isImage.ts`:
```ts
import { IMAGE_EXTS } from './icons'
import { fileExt } from './ext'

export function isImageEntry(entry: { name: string; is_dir: boolean }): boolean {
  return !entry.is_dir && IMAGE_EXTS.has(fileExt(entry.name))
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/util/isImage.test.ts`
Expected: PASS

- [ ] **Step 5: 写 `useInView` composable**

`src/files/composables/useInView.ts`:
```ts
import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

// 一次性进入视口检测:元素进入视口即置 true 并停止观察。
// 环境无 IntersectionObserver(如 jsdom)时降级为立即可见。
export function useInView(el: Ref<HTMLElement | null>): Ref<boolean> {
  const inView = ref(false)
  let observer: IntersectionObserver | null = null
  onMounted(() => {
    if (inView.value) return
    if (typeof IntersectionObserver === 'undefined') { inView.value = true; return }
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        inView.value = true
        observer?.disconnect()
        observer = null
      }
    })
    if (el.value) observer.observe(el.value)
  })
  onBeforeUnmount(() => { observer?.disconnect(); observer = null })
  return inView
}
```
(无独立测试:IntersectionObserver 在 jsdom 不可靠;其行为由 FileThumb.test 用 fake IO 覆盖。)

- [ ] **Step 6: 写 `FileThumb` 失败测试**

`src/files/components/FileThumb.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FileThumb from './FileThumb.vue'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` } },
}))

// fake IntersectionObserver:observe 时立即回报 intersecting
beforeEach(() => {
  ;(globalThis as any).IntersectionObserver = class {
    cb: (entries: { isIntersecting: boolean }[]) => void
    constructor(cb: any) { this.cb = cb }
    observe() { this.cb([{ isIntersecting: true }]) }
    disconnect() {}
  }
})

describe('FileThumb', () => {
  it('renders a lazy thumbnail img for image entries once in view', async () => {
    const w = mount(FileThumb, { props: { entry: { name: 'p.png', path: '/DATA/p.png', is_dir: false } } })
    await nextTick()
    const img = w.get('img.thumb-img')
    expect(img.attributes('src')).toContain('type=thumbnail')
    expect(decodeURIComponent(img.attributes('src')!)).toContain('/DATA/p.png')
  })
  it('renders the type icon for non-image entries', () => {
    const w = mount(FileThumb, { props: { entry: { name: 'a.txt', path: '/DATA/a.txt', is_dir: false } } })
    expect(w.find('img.thumb-img').exists()).toBe(false)
    expect(w.get('img.thumb-icon').attributes('src')).toBeTruthy()
  })
  it('falls back to the type icon when the thumbnail errors', async () => {
    const w = mount(FileThumb, { props: { entry: { name: 'p.png', path: '/DATA/p.png', is_dir: false } } })
    await nextTick()
    await w.get('img.thumb-img').trigger('error')
    expect(w.find('img.thumb-img').exists()).toBe(false)
    expect(w.get('img.thumb-icon').attributes('src')).toBeTruthy()
  })
})
```

- [ ] **Step 7: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FileThumb.test.ts`
Expected: FAIL(`Cannot find module './FileThumb.vue'`)

- [ ] **Step 8: 写 `FileThumb` 实现**

`src/files/components/FileThumb.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { FileEntry } from '../stores/files'
import { iconNameFor, iconUrl } from '../util/icons'
import { isImageEntry } from '../util/isImage'
import { useInView } from '../composables/useInView'

const props = defineProps<{ entry: FileEntry }>()
const el = ref<HTMLElement | null>(null)
const inView = useInView(el)
const errored = ref(false)
const showThumb = computed(() => isImageEntry(props.entry) && inView.value && !errored.value)
</script>

<template>
  <span ref="el" class="file-thumb">
    <img v-if="showThumb" class="thumb-img" :src="service.image.thumbUrl(props.entry.path)" alt="" @error="errored = true" />
    <img v-else class="thumb-icon" :src="iconUrl(iconNameFor(props.entry))" alt="" />
  </span>
</template>

<style scoped>
/* 尺寸由父级类名(.tile-icon / .file-icon)给到本组件根元素;这里只管填充与裁切 */
.file-thumb { display: inline-flex; align-items: center; justify-content: center; overflow: hidden; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }
.thumb-icon { width: 100%; height: 100%; object-fit: contain; }
</style>
```

- [ ] **Step 9: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FileThumb.test.ts`
Expected: PASS(3 用例)

- [ ] **Step 10: 接入 `FileTile.vue`(图标换 FileThumb)**

把 `src/files/components/FileTile.vue` 改为(注意:删掉 `iconNameFor`/`iconUrl` import,改 import FileThumb;`.tile-icon` 尺寸类保留,加到 FileThumb 上给它定尺寸):
```vue
<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import { dateFmt } from '../util/format'
import FileThumb from './FileThumb.vue'

const props = defineProps<{ entry: FileEntry }>()
const emit = defineEmits<{ (e: 'open', entry: FileEntry): void }>()
</script>

<template>
  <div class="file-tile" @click="emit('open', props.entry)">
    <FileThumb class="tile-icon" :entry="props.entry" />
    <span class="tile-name">{{ props.entry.name }}</span>
    <span class="tile-date">{{ dateFmt(props.entry.date || '') }}</span>
  </div>
</template>

<style scoped>
.file-tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: 16px; cursor: pointer; color: var(--fg); background: transparent; border: 1px solid transparent; }
.file-tile:hover { background: var(--chip-bg, rgba(255,255,255,0.08)); }
.tile-icon { width: var(--app-size, 64px); height: var(--app-size, 64px); }
.tile-name { font-size: 13px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.tile-date { font-size: 11px; color: var(--fg-muted, #9aa4bf); }
</style>
```

- [ ] **Step 11: 接入 `FileRow.vue`(图标换 FileThumb)**

在 `src/files/components/FileRow.vue`:删 `import { iconNameFor, iconUrl } from '../util/icons'`(保留 `renderSize, dateFmt` 与 Task1 加的 `fileExt`);import FileThumb:
```ts
import FileThumb from './FileThumb.vue'
```
把图标那行:
```html
    <img class="file-icon" :src="iconUrl(iconNameFor(props.entry))" alt="" />
```
改为:
```html
    <FileThumb class="file-icon" :entry="props.entry" />
```
(`.file-icon { width:28px; height:28px; flex:0 0 auto }` 样式保留,现作用在 FileThumb 根 span 上。)

- [ ] **Step 12: 更新 `FileRow.test.ts`(stub FileThumb + 改图标断言)**

把 `src/files/components/FileRow.test.ts` 改为:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileRow from './FileRow.vue'

const mountOpts = { global: { stubs: { FileThumb: true } } }

describe('FileRow', () => {
  it('renders name, a FileThumb, size for files; emits open on click', async () => {
    const entry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false, size: 1536, date: '2026-01-02T10:00:00Z' }
    const w = mount(FileRow, { props: { entry }, ...mountOpts })
    expect(w.text()).toContain('a.txt')
    expect(w.find('.file-icon').exists()).toBe(true)   // FileThumb stub 根带 file-icon 类
    expect(w.text()).toContain('1.5 KB')
    await w.trigger('click')
    expect(w.emitted('open')).toBeTruthy()
    expect(w.emitted('open')![0][0]).toEqual(entry)
  })

  it('keeps the size column but shows no size text for directories (column alignment)', () => {
    const entry = { name: 'Docs', path: '/DATA/Docs', is_dir: true }
    const w = mount(FileRow, { props: { entry }, ...mountOpts })
    expect(w.text()).toContain('Docs')
    expect(w.find('.file-size').exists()).toBe(true)
    expect(w.find('.file-size').text()).toBe('')
  })
})
```

- [ ] **Step 13: 跑受影响测试 + 全量确认无回归**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FileRow.test.ts src/files/components/FileThumb.test.ts src/files/util/isImage.test.ts src/views/Files.test.ts`
Expected: 全绿。(Files.test 里目录/txt 均非图片 → FileThumb 渲染图标分支,不触发 service.image;jsdom 无 IO 时降级立即可见亦仅影响图片项,故无回归。)

- [ ] **Step 14: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/util/isImage.ts src/files/util/isImage.test.ts src/files/composables/useInView.ts src/files/components/FileThumb.vue src/files/components/FileThumb.test.ts src/files/components/FileTile.vue src/files/components/FileRow.vue src/files/components/FileRow.test.ts
git commit -m "feat(files): lazy image thumbnails (FileThumb + useInView), wired into tile/row"
```

---

