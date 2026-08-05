### Task 3: Vue2 磁盘小组件 + 文件区挂载按钮改跳

两处方法同名 `showDiskManagement`、改法同型,合成一个任务。**两个文件都用 Tab 缩进。**

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/widgets/Disks.vue`(`showDiskManagement`,当前 107-120 行附近;**有** `$messageBus` 一行)
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/components/filebrowser/components/MountActionButton.vue`(`showDiskManagement`,当前 106-118 行附近;**没有** `$messageBus`,不要加)
- Create: `/home/nimo/NimoTech/NimoOS-UI/src/widgets/__tests__/Disks.spec.js`
- Create: `/home/nimo/NimoTech/NimoOS-UI/src/components/filebrowser/components/__tests__/MountActionButton.spec.js`

**Interfaces:**
- Consumes: `resolveEntryTarget(from, storage)`(Task 1)。
- Produces: 无(叶子改动)。

测试策略同 Task 2:桩 `this` 直调方法(`Disks.vue` 的 `mounted()` 读 `$store.state.hardwareInfo`,`MountActionButton.vue` 的 `created()` 打 `$api.driver.getDriverList`,挂载都要无关 mock)。

- [ ] **Step 1: 写失败测试(两个文件)**

新建 `src/widgets/__tests__/Disks.spec.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Disks from '@/widgets/Disks.vue'

// 说明:Disks.vue 的 mounted() 读 $store.state.hardwareInfo,挂载需与本改动无关的 mock。
// 本用例测 showDiskManagement 里的 cutover 分支,故在桩 this 上直调该方法。
// 模板 @click 绑定本期未改动,由真机验收覆盖。
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

describe('Disks 小组件存储入口 cutover(SP6-P6)', () => {
  it('未回退时整页跳 /app/#/storage,不开老弹窗', () => {
    const vm = stubThis()
    Disks.methods.showDiskManagement.call(vm)
    expect(hrefs).toEqual(['/app/#/storage'])
    expect(vm.$buefy.modal.open).not.toHaveBeenCalled()
  })

  it('埋点 widget_storagemanager 仍然上报', () => {
    const vm = stubThis()
    Disks.methods.showDiskManagement.call(vm)
    expect(vm.$messageBus).toHaveBeenCalledWith('widget_storagemanager')
  })

  it('回退 flag == "1" 时开老弹窗,不跳转', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const vm = stubThis()
    Disks.methods.showDiskManagement.call(vm)
    expect(hrefs).toEqual([])
    expect(vm.$buefy.modal.open).toHaveBeenCalledTimes(1)
  })
})
```

新建 `src/components/filebrowser/components/__tests__/MountActionButton.spec.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MountActionButton from '@/components/filebrowser/components/MountActionButton.vue'

// 说明:MountActionButton.vue 的 created() 打 $api.driver.getDriverList,挂载需无关 mock。
// 本用例测 showDiskManagement 里的 cutover 分支,故在桩 this 上直调该方法。
// 该组件原本没有 widget_storagemanager 埋点,本期也不加。
function stubThis() {
  return { $buefy: { modal: { open: vi.fn() } } }
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

describe('文件区挂载按钮存储入口 cutover(SP6-P6)', () => {
  it('未回退时整页跳 /app/#/storage,不开老弹窗', () => {
    const vm = stubThis()
    MountActionButton.methods.showDiskManagement.call(vm)
    expect(hrefs).toEqual(['/app/#/storage'])
    expect(vm.$buefy.modal.open).not.toHaveBeenCalled()
  })

  it('回退 flag == "1" 时开老弹窗,不跳转', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const vm = stubThis()
    MountActionButton.methods.showDiskManagement.call(vm)
    expect(hrefs).toEqual([])
    expect(vm.$buefy.modal.open).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm vitest run src/widgets/__tests__/Disks.spec.js src/components/filebrowser/components/__tests__/MountActionButton.spec.js
```

预期:两文件各有「未回退时跳转」「回退时开弹窗」FAIL(现在恒开弹窗)。

- [ ] **Step 3: 实现 —— `src/widgets/Disks.vue`**

顶部 import 区加(与既有两行 import 同段):

```js
import { resolveEntryTarget } from '@/router/strangler'
```

方法改为(**Tab 缩进**,`$buefy.modal.open` 整块原样保留,注意原文分号风格):

```js
		showDiskManagement() {
			this.$messageBus('widget_storagemanager');
			// SP6-P6 cutover:存储区已迁到 New-UI(/app/#/storage)。
			// localStorage['strangler:disabled:/storage'] === '1' 时返回 null,落到下面的老弹窗(可逆回退)。
			const target = resolveEntryTarget('/storage')
			if (target) {
				window.location.href = target
				return
			}
			this.$buefy.modal.open({
				parent: this,
				component: StorageManagerPanel,
				hasModalCard: true,
				customClass: 'storage-modal',
				trapFocus: true,
				canCancel: [],
				scroll: "keep",
				animation: "zoom-in",
			})
		},
```

- [ ] **Step 4: 实现 —— `src/components/filebrowser/components/MountActionButton.vue`**

顶部 import 区加:

```js
import { resolveEntryTarget } from '@/router/strangler'
```

方法改为(**Tab 缩进**,不加埋点):

```js
		// Show Disk Management Panel
		showDiskManagement() {
			// SP6-P6 cutover:存储区已迁到 New-UI(/app/#/storage)。
			// localStorage['strangler:disabled:/storage'] === '1' 时返回 null,落到下面的老弹窗(可逆回退)。
			const target = resolveEntryTarget('/storage')
			if (target) {
				window.location.href = target
				return
			}
			this.$buefy.modal.open({
				parent: this,
				component: StorageManagerPanel,
				hasModalCard: true,
				customClass: 'storage-modal',
				trapFocus: true,
				canCancel: [],
				scroll: "keep",
				animation: "zoom-in",
			})
		},
```

- [ ] **Step 5: 跑测试确认通过 + 全量**

```bash
pnpm vitest run src/widgets/__tests__/Disks.spec.js src/components/filebrowser/components/__tests__/MountActionButton.spec.js
pnpm test 2>&1 | tail -20
```

预期:新用例全 PASS;全量绿(用例数 = Task 0 记下的数 + 本期新增)。

- [ ] **Step 6: 变异验证**

`Disks.vue` 里 `if (target) {` 临时改 `if (false) {` → Disks 第 1 条变红;改回。
`MountActionButton.vue` 同样操作 → 该文件第 1 条变红;改回。
把 `MountActionButton.vue` 的目标临时改成 `'/app/#/storages'` → 第 1 条变红(证明断言锁的是逐字 URL);改回。

- [ ] **Step 7: 提交**

```bash
git add src/widgets/Disks.vue src/widgets/__tests__/Disks.spec.js \
        src/components/filebrowser/components/MountActionButton.vue \
        src/components/filebrowser/components/__tests__/MountActionButton.spec.js
git commit -m "feat(storage): 桌面磁盘小组件与文件区挂载按钮改跳 /app/#/storage(SP6-P6)

两处 showDiskManagement 各加两行 cutover 判定,老弹窗原样留作安全网。
Disks 的 widget_storagemanager 埋点保留在跳转前;MountActionButton 原本无埋点,不加。"
```

---

