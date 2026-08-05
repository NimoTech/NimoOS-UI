### Task 2: Vue2 `Home.vue` 存储入口改跳

`showStorageManagerPanelModal` 只由 `mounted()` 里的 EventBus `casaUI:openStorageManager` 触发 —— 即新盘检测通知卡的「Storage Manager」按钮(`src/components/CoreService.vue:306`)。**EventBus 接线本任务不动**,改方法体即覆盖该路径。

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/views/Home.vue`(`showStorageManagerPanelModal`,当前在 262-273 行附近)
- Create: `/home/nimo/NimoTech/NimoOS-UI/src/views/__tests__/Home.storageCutover.spec.js`

**Interfaces:**
- Consumes: `resolveEntryTarget(from, storage)`(Task 1),`import { resolveEntryTarget } from '@/router/strangler'`。
- Produces: 无(叶子改动)。

**测试策略(照此做,不要改成 `shallowMount`)**:`Home.vue` 的 `created()` 会打三个 `$api` 请求,`components` 里挂着 `SideBar`/`SearchBar`/`CoreService`/`AppSection`/`KVMFullPage` + `vue-custom-scrollbar`,挂载它需要一大堆与本改动无关的 mock。本任务测的是方法内的一个分支,故**在桩 `this` 上直调 `Home.methods.showStorageManagerPanelModal`**,并在测试文件里注释写明这个取舍。模板与 EventBus 接线本任务未改动,由真机验收覆盖。

- [ ] **Step 1: 写失败测试**

新建 `src/views/__tests__/Home.storageCutover.spec.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Home from '@/views/Home.vue'

// 说明:Home.vue 的 created() 会打三个 $api 请求、components 里挂着 SideBar/CoreService/
// AppSection/KVMFullPage 等,shallowMount 需要一大堆与本改动无关的 mock。本用例测的是
// showStorageManagerPanelModal 里的 cutover 分支,故在桩 this 上直调该方法。
// 模板绑定与 mounted() 里的 EventBus 接线(casaUI:openStorageManager)本期未改动,由真机验收覆盖。
function stubThis() {
  return {
    $messageBus: vi.fn(),
    $buefy: { modal: { open: vi.fn() } },
  }
}

let savedLocation
let hrefs
beforeEach(() => {
  hrefs = []
  savedLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { set href(v) { hrefs.push(v) }, get href() { return '' } },
  })
  localStorage.removeItem('strangler:disabled:/storage')
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: savedLocation })
  localStorage.removeItem('strangler:disabled:/storage')
})

describe('Home.vue 存储入口 cutover(SP6-P6)', () => {
  it('未回退时整页跳 /app/#/storage,不开老弹窗', async () => {
    const vm = stubThis()
    await Home.methods.showStorageManagerPanelModal.call(vm)
    expect(hrefs).toEqual(['/app/#/storage'])
    expect(vm.$buefy.modal.open).not.toHaveBeenCalled()
  })

  it('埋点 widget_storagemanager 仍然上报', async () => {
    const vm = stubThis()
    await Home.methods.showStorageManagerPanelModal.call(vm)
    expect(vm.$messageBus).toHaveBeenCalledWith('widget_storagemanager')
  })

  it('回退 flag == "1" 时开老弹窗,不跳转', async () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const vm = stubThis()
    await Home.methods.showStorageManagerPanelModal.call(vm)
    expect(hrefs).toEqual([])
    expect(vm.$buefy.modal.open).toHaveBeenCalledTimes(1)
    expect(vm.$messageBus).toHaveBeenCalledWith('widget_storagemanager')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm vitest run src/views/__tests__/Home.storageCutover.spec.js
```

预期:第 1、3 条 FAIL(现在无论如何都开弹窗、`hrefs` 为空);第 2 条已通过。

- [ ] **Step 3: 实现**

`src/views/Home.vue` 顶部 import 区(与其他 `@/` import 同段)加:

```js
import { resolveEntryTarget } from '@/router/strangler'
```

把 `showStorageManagerPanelModal` 改为(**2 空格缩进**,`$buefy.modal.open` 整块原样保留):

```js
    // show storage settings modal
    async showStorageManagerPanelModal() {
      this.$messageBus('widget_storagemanager')
      // SP6-P6 cutover:存储区已迁到 New-UI(/app/#/storage)。
      // localStorage['strangler:disabled:/storage'] === '1' 时返回 null,落到下面的老弹窗(可逆回退)。
      const target = resolveEntryTarget('/storage')
      if (target) {
        window.location.href = target
        return
      }
      this.$buefy.modal.open({
        parent: this,
        component: () => import('@/components/Storage/StorageManagerPanel.vue'),
        hasModalCard: true,
        customClass: 'storage-modal',
        trapFocus: true,
        canCancel: [],
        scroll: 'keep',
        animation: 'zoom-in',
      })
    },
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/views/__tests__/Home.storageCutover.spec.js
```

预期:3 条全 PASS。

- [ ] **Step 5: 变异验证**

把 `if (target) {` 临时改成 `if (false) {`,重跑 → 第 1 条变红;改回。
把 `this.$messageBus('widget_storagemanager')` 临时挪到 `return` 之后,重跑 → 第 2 条变红;改回。

- [ ] **Step 6: 提交**

```bash
git add src/views/Home.vue src/views/__tests__/Home.storageCutover.spec.js
git commit -m "feat(storage): Vue2 桌面存储入口改跳 /app/#/storage(SP6-P6)

新盘通知卡「Storage Manager」按钮经 EventBus casaUI:openStorageManager 打到这里。
埋点保留在跳转前;老弹窗代码原样留作安全网,flag strangler:disabled:/storage 可逆回退。"
```

---

