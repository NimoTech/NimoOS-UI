### Task 4: 「文件操作」分组 + 头部三态接线

**Files:**
- Modify: `src/files/components/UploadPanel.vue`, `src/files/components/UploadPanel.test.ts`

**Interfaces:**
- Consumes: Task 1/2 的四个纯函数;Task 3 的 `ops` / `opsCount` / `panelVisible`
- Modify: 新增一个 i18n 键 `filesUploadZoneOps`

- [ ] **Step 1: 写失败测试(追加)**

```ts
describe('UploadPanel file-operation group', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders one row per active operation, showing only the basename', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask({ id: 'a' }), opsTask({ id: 'b', processing_path: '/DATA/Media/movie.mkv' })]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    const rows = w.findAll('.up-ops-item')
    expect(rows.length).toBe(2)
    expect(rows[1].text()).toContain('movie.mkv')
    expect(rows[1].text()).not.toContain('/DATA')
  })

  it('shows the percentage when the size is known', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask({ processed_size: 30, total_size: 100 })]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.up-ops-item').text()).toContain('30%')
  })

  it('omits the percentage entirely when the total size is unknown', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask({ total_size: 0 })]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.up-ops-item').text()).not.toContain('%')
  })

  it('switches the header to the processing wording when only operations run', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask()]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.up-title').text()).toBe(i18n.global.t('filesUploadHeaderProcessing'))
  })

  it('cancels every operation through the store when cancel-all is pressed', async () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask()]
    let called = 0
    ops.cancelAll = async () => { called += 1 }
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    await w.find('.up-ops-cancel-all').trigger('click')
    expect(called).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/components/UploadPanel.test.ts`
Expected: 5 条新用例 FAIL

- [ ] **Step 3: 加第三个 i18n 键**

`src/i18n/zh_cn.base.ts`:`filesUploadZoneOps: '文件操作',`
`src/i18n/en_us.base.ts`:`filesUploadZoneOps: 'File operations',`

- [ ] **Step 4: 写实现**

`<script setup>` 里加:

```ts
import { opsTaskPercent, opsTaskLabelKey, opsTaskBasename, resolveUploaderHeader } from '../util/opsRow'

const headerText = computed(() =>
  t(resolveUploaderHeader({ uploadCount: totalCount.value, opsCount: opsCount.value })),
)
```

模板:头部那句改成 `<span class="up-title">{{ headerText }}</span>`。
在**警示区(`problemBatches`)之后、上传中区(`activeBatches`)之前**插入分组:

```vue
      <div v-if="opsCount" class="up-zone">
        <div class="up-zone-head">
          <span class="up-zone-title">{{ t('filesUploadZoneOps') }}</span>
          <button class="up-link-btn up-ops-cancel-all" @click="ops.cancelAll()">{{ t('filesCancelAll') }}</button>
        </div>
        <div v-for="task in ops.active" :key="task.id" class="up-item up-ops-item">
          <div class="up-item-line">
            <span class="up-item-name">{{ t(opsTaskLabelKey(task)) }} · {{ opsTaskBasename(task.processing_path) }}</span>
            <span v-if="opsTaskPercent(task) !== null" class="up-item-pct">{{ opsTaskPercent(task) }}%</span>
          </div>
          <div class="up-progress">
            <div class="up-progress-fill" :style="{ width: (opsTaskPercent(task) ?? 0) + '%' }"></div>
          </div>
        </div>
      </div>
```

`<style scoped>` 里加(**只用 token,禁字面色值**):

```css
.up-zone-head { display: flex; align-items: center; justify-content: space-between; }
```

⚠️ `.up-zone-title` / `.up-item` / `.up-progress` / `.up-progress-fill` / `.up-item-pct` **复用既有规则,不要重复定义**。
⚠️ 改 CSS 时确认没有 `*` 紧贴 `/` —— 那会提前关闭注释块并吃掉后面整条规则,而五道门全瞎(本仓已有专门守卫,务必跑 `src/styles/`)。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/components/UploadPanel.test.ts src/i18n/parity.test.ts src/styles/`
Expected: 全绿

- [ ] **Step 6: 变异验证**

把 `v-if="opsTaskPercent(task) !== null"` 改成 `v-if="true"` 并把插值换成 `opsTaskPercent(task) ?? 0`,重跑 → 「omits the percentage entirely」必须真红。恢复后全绿。

- [ ] **Step 7: 提交**

```bash
git add src/files/components/UploadPanel.vue src/files/components/UploadPanel.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): show file-operation progress inside the upload panel

Rows sit between the problem and active upload zones, matching Vue2's
layout. An unknown total size renders no percentage rather than a bar
claiming 0%.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

