### Task 4: 保留策略高级表单 + 手动创建快照(`SnapshotPanel.vue` 续)

在 T3 的面板里补齐 Vue2 `enabled` 态剩下的两块:**高级设置**(点按钮展开 → 4 个数字输入 + 逐字段校验 + 保存/取消;展开时摘要行隐藏)与**手动创建快照行**(备注输入框 + 「立即创建快照」按钮)。

**Files:**
- Modify: `src/storage/components/SnapshotPanel.vue`、`src/storage/components/SnapshotPanel.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(附录 A 标「T4」的 9 个键)

**Interfaces:**
- Consumes: `validatePolicyForm`/`PolicyForm`(T1);`store.savePolicy`/`store.createSnapshot`/`store.policySaving`/`store.creatingSnapshot`(T2)。
- Produces: 新增稳定 class:`.sp-advanced-btn`、`.sp-advanced`(表单容器)、`.sp-in-hourly` / `.sp-in-daily` / `.sp-in-weekly` / `.sp-in-pct`(四个 `<input type="number">`)、`.sp-err-hourly` / `.sp-err-daily` / `.sp-err-weekly` / `.sp-err-pct`(错误文案)、`.sp-save`、`.sp-cancel-adv`、`.sp-label-input`、`.sp-create`。

**Vue2 逐字对照点**(`SnapshotPanel.vue:46-85` + `:209-254`):
- `openAdvanced`:表单初值取当前 policy,**缺失时用默认 24/7/4/90**(`?? `),清空 `fieldErrors`,再展开。
- `cancelAdvanced`:收起 + 清空错误(**不回写表单**)。
- `savePolicy`:先本地校验 → 有错就**只更新错误提示、不发请求**;通过则发请求,成功后收起表单。
- 保存中:保存按钮 loading + 禁用,取消按钮也禁用。
- 手动创建:输入框 `:disabled="creatingSnapshot"`,按钮 loading + 禁用;成功后**清空备注输入框**。
- 数字输入下限:hourly/daily/weekly `min=1`,阈值 `min=1 max=100`(Vue2 `b-numberinput` 的 min/max 原样落到原生 input)。

- [ ] **Step 1: 写失败测试**(追加到 `SnapshotPanel.test.ts`)

```ts
describe('SnapshotPanel 高级策略表单', () => {
  const enabledVol = [{ volume_uuid: 'u1', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }]

  it('点"高级设置"→ 表单以当前策略为初值展开,摘要行让位', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    expect(w.find('.sp-advanced').exists()).toBe(true)
    expect(w.find('.sp-policy-summary').exists()).toBe(false)
    expect((w.find('.sp-in-hourly').element as HTMLInputElement).value).toBe('24')
    expect((w.find('.sp-in-pct').element as HTMLInputElement).value).toBe('90')
  })

  it('策略缺失(getPolicy 抛错)时表单落默认值 24/7/4/90', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    getPolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    expect((w.find('.sp-in-daily').element as HTMLInputElement).value).toBe('7')
    expect((w.find('.sp-in-weekly').element as HTMLInputElement).value).toBe('4')
  })

  it('非法输入 → 显示逐字段错误且不发请求', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('0')
    await w.find('.sp-in-pct').setValue('101')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(w.find('.sp-err-hourly').text()).toBe(zh.snapErrPositiveInt)
    expect(w.find('.sp-err-pct').text()).toBe(zh.snapErrPercent)
    expect(patchPolicy).not.toHaveBeenCalled()
    expect(w.find('.sp-advanced').exists()).toBe(true)   // 表单不收起
  })

  it('合法输入 → patchPolicy 收到四字段数字(非字符串),成功后收起表单', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    patchPolicy.mockResolvedValue(null)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('12')
    await w.find('.sp-in-daily').setValue('5')
    await w.find('.sp-in-weekly').setValue('3')
    await w.find('.sp-in-pct').setValue('80')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(patchPolicy).toHaveBeenCalledWith('u1', { hourly_keep: 12, daily_keep: 5, weekly_keep: 3, pause_threshold_pct: 80 })
    expect(w.find('.sp-advanced').exists()).toBe(false)
    expect(w.find('.sp-policy-summary').text()).toContain('12')
  })

  it('取消 → 收起表单、错误清空、不发请求', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('0')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(w.find('.sp-err-hourly').exists()).toBe(true)
    await w.find('.sp-cancel-adv').trigger('click')
    expect(w.find('.sp-advanced').exists()).toBe(false)
    expect(patchPolicy).not.toHaveBeenCalled()
    await w.find('.sp-advanced-btn').trigger('click')
    expect(w.find('.sp-err-hourly').exists()).toBe(false)   // 重开无残留错误
  })
})

describe('SnapshotPanel 手动创建快照', () => {
  const enabledVol = [{ volume_uuid: 'u1', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }]

  it('填备注后点创建 → create 收到 {volume_uuid,label},成功后输入框清空', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    createSnap.mockResolvedValue(undefined)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-label-input').setValue('升级前')
    await w.find('.sp-create').trigger('click'); await flush(w)
    expect(createSnap).toHaveBeenCalledWith({ volume_uuid: 'u1', label: '升级前' })
    expect((w.find('.sp-label-input').element as HTMLInputElement).value).toBe('')
  })

  it('创建失败 → 备注保留(便于重试)', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    createSnap.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    await w.find('.sp-label-input').setValue('升级前')
    await w.find('.sp-create').trigger('click'); await flush(w)
    expect((w.find('.sp-label-input').element as HTMLInputElement).value).toBe('升级前')
  })

  it('创建在途:按钮与输入框都禁用', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    let release: (v?: unknown) => void = () => {}
    createSnap.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountPanel(); await flush(w)
    await w.find('.sp-create').trigger('click'); await w.vm.$nextTick()
    expect((w.find('.sp-create').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('.sp-label-input').element as HTMLInputElement).disabled).toBe(true)
    release(); await flush(w)
    expect((w.find('.sp-create').element as HTMLButtonElement).disabled).toBe(false)
  })
})
```

> 注:本 Task 需要把测试文件顶部 mock 里的 `patchPolicy: vi.fn()` / `create: vi.fn()` 换成具名 mock(`const patchPolicy = vi.fn()`、`const createSnap = vi.fn()`,再在 `vi.mock` 工厂里转发),并在 `beforeEach` 里给 `patchPolicy.mockResolvedValue(null)`、`createSnap.mockResolvedValue(undefined)` 默认值——照 T3 已有 `listVolumes`/`getPolicy` 的写法。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts`
Expected: FAIL(`.sp-advanced-btn` 等找不到)。

- [ ] **Step 3: 实现**

`<script setup>` 追加:
```ts
import { ref } from 'vue'
import { validatePolicyForm, type PolicyForm } from '../util/snapshotView'

const advancedOpen = ref(false)
const policyForm = ref<PolicyForm>({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
const fieldErrors = ref<Partial<Record<keyof PolicyForm, string>>>({})
const manualLabel = ref('')

function openAdvanced() {
  const p = store.policy
  policyForm.value = {
    hourly_keep: Number(p?.hourly_keep ?? 24),
    daily_keep: Number(p?.daily_keep ?? 7),
    weekly_keep: Number(p?.weekly_keep ?? 4),
    pause_threshold_pct: Number(p?.pause_threshold_pct ?? 90),
  }
  fieldErrors.value = {}
  advancedOpen.value = true
}

function cancelAdvanced() {
  advancedOpen.value = false
  fieldErrors.value = {}
}

async function onSavePolicy() {
  const { valid, errors } = validatePolicyForm(policyForm.value)
  fieldErrors.value = errors
  if (!valid) return
  const ok = await store.savePolicy(props.volumeUuid, { ...policyForm.value })
  if (ok) advancedOpen.value = false
}

async function onCreateSnapshot() {
  const ok = await store.createSnapshot(props.volumeUuid, manualLabel.value)
  if (ok) manualLabel.value = ''   // Vue2 同款:只有成功才清备注
}
```

模板把 T3 的策略行与两处占位注释换成:
```vue
        <div class="sp-row sp-policy-row">
          <div class="sp-policy-wrap">
            <div v-if="!advancedOpen" class="sp-policy-summary sp-muted">{{ policySummaryText }}</div>
            <div v-else class="sp-advanced">
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapHourlyKeep') }}</span>
                <input class="sp-num sp-in-hourly" type="number" min="1" v-model.number="policyForm.hourly_keep" />
                <span v-if="fieldErrors.hourly_keep" class="sp-err sp-err-hourly">{{ t(fieldErrors.hourly_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapDailyKeep') }}</span>
                <input class="sp-num sp-in-daily" type="number" min="1" v-model.number="policyForm.daily_keep" />
                <span v-if="fieldErrors.daily_keep" class="sp-err sp-err-daily">{{ t(fieldErrors.daily_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapWeeklyKeep') }}</span>
                <input class="sp-num sp-in-weekly" type="number" min="1" v-model.number="policyForm.weekly_keep" />
                <span v-if="fieldErrors.weekly_keep" class="sp-err sp-err-weekly">{{ t(fieldErrors.weekly_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapPauseThreshold') }}</span>
                <input class="sp-num sp-in-pct" type="number" min="1" max="100" v-model.number="policyForm.pause_threshold_pct" />
                <span v-if="fieldErrors.pause_threshold_pct" class="sp-err sp-err-pct">{{ t(fieldErrors.pause_threshold_pct) }}</span>
              </label>
              <div class="sp-adv-actions">
                <button class="sp-save" type="button" :disabled="store.policySaving" @click="onSavePolicy">{{ t('snapSave') }}</button>
                <button class="sp-cancel-adv" type="button" :disabled="store.policySaving" @click="cancelAdvanced">{{ t('storageCancel') }}</button>
              </div>
            </div>
          </div>
          <button v-if="!advancedOpen" class="sp-advanced-btn" type="button" @click="openAdvanced">{{ t('snapAdvanced') }}</button>
        </div>

        <div class="sp-row sp-manual-row">
          <input
            class="sp-label-input"
            type="text"
            v-model="manualLabel"
            :placeholder="t('snapLabelPlaceholder')"
            :disabled="store.creatingSnapshot"
          />
          <button class="sp-create" type="button" :disabled="store.creatingSnapshot" @click="onCreateSnapshot">
            {{ t('snapCreateNow') }}
          </button>
        </div>
```

样式追加(全 token):
```css
.sp-policy-wrap { flex: 1 1 auto; min-width: 0; }
.sp-advanced { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.sp-field { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--fg-muted); }
.sp-field-label { flex: 1 1 auto; }
.sp-num, .sp-label-input {
  box-sizing: border-box; padding: 5px 9px; font-size: 12.5px; border-radius: 8px;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); outline: none;
}
.sp-num { width: 88px; font-family: var(--num-font); }
.sp-num:focus, .sp-label-input:focus { border-color: var(--accent); }
.sp-num:disabled, .sp-label-input:disabled { opacity: 0.55; }
.sp-err { flex: 1 0 100%; color: var(--remove-fg); font-size: 11px; }
.sp-adv-actions { display: flex; gap: 8px; margin-top: 2px; }
.sp-manual-row { gap: 8px; }
.sp-label-input { flex: 1 1 auto; min-width: 0; }
.sp-advanced-btn, .sp-save, .sp-cancel-adv, .sp-create {
  padding: 5px 12px; border-radius: 999px; font-size: 12px; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
}
.sp-save, .sp-create { border-color: var(--accent); color: var(--accent); }
.sp-advanced-btn:hover, .sp-save:hover, .sp-cancel-adv:hover, .sp-create:hover { background: var(--chip-bg-hi); }
.sp-save:disabled, .sp-cancel-adv:disabled, .sp-create:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts` → PASS
Run: `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/SnapshotPanel.vue src/storage/components/SnapshotPanel.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照保留策略高级表单+手动创建快照(P5 T4)"
```

---

