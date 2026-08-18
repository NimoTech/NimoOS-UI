### Task 2: ShareRow checkbox

**Files:**
- Modify: `src/files/shares/ShareRow.vue`
- Test: `src/files/shares/ShareRow.test.ts` (create)

**Interfaces:**
- Consumes: `ShareRow` type from `../stores/shares` (existing).
- Produces: `ShareRow.vue` accepts optional prop `selected?: boolean`, emits `(e: 'toggle-select', row: ShareRow)` when the checkbox changes. Root `.share-row-main` carries class `selected` when the prop is true. (Task 3 binds both.)

- [ ] **Step 1: Write the failing component test**

Create `src/files/shares/ShareRow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import ShareRow from './ShareRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const row = { id: 5, path: '/DATA/Documents', name: 'Documents' }

function mountRow(selected: boolean) {
  return mount(ShareRow, { props: { row, selected }, global: { plugins: [i18n] } })
}

describe('ShareRow selection checkbox', () => {
  it('renders a checkbox whose checked state follows the selected prop', () => {
    const off = mountRow(false)
    const on = mountRow(true)
    expect((off.find('input.share-check-box').element as HTMLInputElement).checked).toBe(false)
    expect((on.find('input.share-check-box').element as HTMLInputElement).checked).toBe(true)
    off.unmount(); on.unmount()
  })

  it('adds the selected class to the row body when selected', () => {
    const on = mountRow(true)
    const off = mountRow(false)
    expect(on.find('.share-row-main').classes()).toContain('selected')
    expect(off.find('.share-row-main').classes()).not.toContain('selected')
    on.unmount(); off.unmount()
  })

  it('emits toggle-select with the row when the checkbox changes', async () => {
    const w = mountRow(false)
    await w.find('input.share-check-box').setValue(true)
    expect(w.emitted('toggle-select')).toHaveLength(1)
    expect(w.emitted('toggle-select')![0]).toEqual([row])
    w.unmount()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/files/shares/ShareRow.test.ts`
Expected: FAIL — `input.share-check-box` not found.

- [ ] **Step 3: Implement the checkbox**

In `src/files/shares/ShareRow.vue`:

Replace the props/emits lines with:

```ts
const props = defineProps<{ row: ShareRow; selected?: boolean }>()
const emit = defineEmits<{ (e: 'get-link', row: ShareRow): void; (e: 'goto', row: ShareRow): void; (e: 'unshare', row: ShareRow): void; (e: 'toggle-select', row: ShareRow): void }>()
```

In the template, add the `selected` class binding and the checkbox before the icon:

```html
      <div class="share-row-main" :class="{ selected: props.selected }">
        <span class="share-check" @click.stop>
          <input
            type="checkbox"
            class="share-check-box"
            :checked="props.selected"
            :aria-label="props.row.name"
            @change="emit('toggle-select', props.row)"
          />
        </span>
        <img class="share-icon" :src="iconUrl('folder-default')" alt="" />
```

Append to the scoped styles (mirrors `FileTile.vue`'s hover-reveal checkbox; `var(--token, fallback)` form matches existing lines in this file):

```css
.share-check { flex: 0 0 auto; display: flex; align-items: center; }
.share-check-box { opacity: 0; cursor: pointer; }
.share-row-main:hover .share-check-box, .share-row-main.selected .share-check-box { opacity: 1; }
.share-row-main.selected { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
```

- [ ] **Step 4: Run tests to verify they pass (and no regression in the page suite)**

Run: `pnpm exec vitest run src/files/shares/`
Expected: PASS (new ShareRow tests + existing SharesPage/ShareLinkDialog tests untouched).

- [ ] **Step 5: Commit**

```bash
git add src/files/shares/ShareRow.vue src/files/shares/ShareRow.test.ts
git commit -m "feat(shares): hover-revealed selection checkbox on share rows" -- src/files/shares/ShareRow.vue src/files/shares/ShareRow.test.ts
```

---

