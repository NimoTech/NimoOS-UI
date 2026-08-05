# Task 6 报告:三项 config 挂账收编(§7e-9 / §7e-15 / P7a aiFeatures 重复读)

工作区:`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`,分支 `sp7-photos`。
提交:`40bc33e feat(photos): 三项 config 挂账收编进 photosSettings store(P8a-T6)`。

## 三件事分别做了什么

### 1. §7e-10:PhotosPeople.vue / PhotosSmartViews.vue 折进 store

- `src/views/PhotosPeople.vue`:删掉 `loadFacesEnabled()`(async 函数)、`service` 直接
  import、以及 `facesEnabled = ref(true)`。改成:
  - `const settings = usePhotosSettingsStore()`
  - `const facesEnabled = computed(() => settings.aiFeatures.faces)`
  - `onMounted` 里的 `void loadFacesEnabled()` 换成 `void settings.fetchAiFeatures()`。
  语义保持 1:1(缺字段/失败按开启)——这条防御性判据现在只在 store 的 `readAiFeatures`/`on()`
  里实现一次,视图层纯消费。
- `src/views/PhotosSmartViews.vue`:同样删掉 `loadAiSmartViewOff()`、`service` import、
  `aiSmartViewOff = ref(false)`。改成 `computed(() => settings.aiFeatures.smartview === false)`,
  `onMounted` 里改调 `settings.fetchAiFeatures()`。

### 2. §7e-15:侧栏条件隐藏 smart-views 条目

`src/photos/components/PhotosSidebar.vue`:
- 新增 `const settings = usePhotosSettingsStore()` + `onMounted(() => void settings.fetchAiFeatures())`。
- 原来的 `const NAV = [...]`(7 项字面量)改名 `NAV_ALL`,新增：
  ```ts
  const NAV = computed(() =>
    settings.aiFeatures.smartview === false
      ? NAV_ALL.filter((n) => n.id !== 'smart-views')
      : NAV_ALL,
  )
  ```
- `isActive()` 里的 `activeNavId(route.path, NAV)` 改成 `activeNavId(route.path, NAV.value)`
  (computed 在纯 JS 函数里要手动 `.value`,模板里不用)。
- **没有改 NAV_ALL 数组顺序、没有碰 Task 5 加的设置齿轮入口**(`.side-settings` 那一段原样)。

### 3. §7e-9:AI behavior 链接接线

`src/views/PhotosSmartViews.vue` 模板里的
`<span class="svs-banner-link" aria-disabled="true" data-test="svs-settings-link" :title="t('photosSvSettingsPending')">`
换成
`<RouterLink class="svs-banner-link" data-test="svs-settings-link" to="/photos/settings?section=ai">`。
`data-test` id 保留 `svs-settings-link`(本文件既有命名,见下方"brief-vs-源冲突"第 3 条)。
样式 `.svs-banner-link` 的 `cursor: default` 改成 `cursor: pointer`(不再是不可点占位)。
死键 `photosSvSettingsPending` 从 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts` 删除,原位置留注释
（照 `photosPersonSubtitle` 删除先例，`zh_cn.ts:847`）。

## 在途去重实现(§7e-15 引出的新需求)

`src/photos/stores/settings.ts`,`fetchAiFeatures()`:

```ts
let aiFeaturesInFlight: Promise<PhotosAiFeatures> | null = null

async function fetchAiFeatures(): Promise<PhotosAiFeatures> {
  if (aiFeaturesInFlight) return aiFeaturesInFlight
  aiFeaturesInFlight = (async () => {
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      aiFeatures.value = readAiFeatures(cfg)
      aiFeaturesLoaded.value = true
    } catch (e) {
      aiFeatures.value = { ...ALL_ON }
      console.error('[photos-settings] fetchAiFeatures', e)
    }
    return aiFeatures.value
  })()
  try {
    return await aiFeaturesInFlight
  } finally {
    aiFeaturesInFlight = null
  }
}
```

- **去重**:多个并发调用者(侧栏 + 任意视图的 `onMounted`)在同一个 promise 未落地前复用它,
  只发一次 `getConfig`。
- **不是永久缓存**:`finally` 里把 `aiFeaturesInFlight` 落回 `null`——promise 结算之后,
  下一次调用会重新走一遍 `if (aiFeaturesInFlight)` 判断(此时为 `null`),发出全新请求。

**证明不是永久缓存的具体做法**:测试
`去重不是永久缓存:上一次结算后再调会重新发请求` —— `await s.fetchAiFeatures()` 两次
(不是并发 `Promise.all`,是顺序 `await`,第一次结算完了才发第二次),断言
`getConfig` 被调用 **2 次**。如果做成永久缓存(把 `finally` 清空那行删掉),这条测试会
从绿变红(见下方"变异验证②")。

## 死键删除前的 grep 证据

```
$ grep -rn "photosSvSettingsPending" src/
src/i18n/zh_cn.ts:1259:  photosSvSettingsPending: '设置页待迁移(P8)',
src/i18n/en_us.ts:1265:  photosSvSettingsPending: 'Settings page coming in P8',
src/views/PhotosSmartViews.vue:24://     ai),这里换成真实的 <RouterLink>(§7e-9)—— 原先占位用的 photosSvSettingsPending
```
排除两处 locale 定义本身与我在 PhotosSmartViews.vue 头部注释里写的一句"历史说明"(纯 prose，
不是代码引用)之后：

```
$ grep -rn "photosSvSettingsPending" src/ | grep -v "src/i18n/zh_cn.ts:1259\|src/i18n/en_us.ts:1265\|src/views/PhotosSmartViews.vue:24"
(无输出)
```

确认零功能引用后才删除。删除后 `pnpm exec vitest run src/i18n --reporter=verbose`：
**25/25 通过**（parity.test.ts / p8aKeys.test.ts / people.i18n.test.ts / i18n.test.ts 四个文件全绿）。

## TDD 证据

### 1. settings.ts 在途去重

**RED**(临时手动去掉刚写的 dedup 实现，恢复成 T1 原版无去重的 `fetchAiFeatures`，运行新加的
两条用例）:
```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose
 × fetchAiFeatures 并发去重:两个消费方同时挂载只发一次 getConfig
   → expected "vi.fn()" to be called 1 times, but got 2 times
 ✓ 去重不是永久缓存:上一次结算后再调会重新发请求   (这条无去重时天然也过，见下方讨论)
 × 三个并发调用者同样只发一次(不是"恰好 2 个"才生效的偶然实现)
   → expected "vi.fn()" to be called 1 times, but got 3 times
 Tests  2 failed | 30 passed (32)
```
预期：没有去重实现时，两个/三个并发调用各自发起真实请求，`getConfig` 调用次数应等于调用者数量而不是 1——确认失败原因正确。

**GREEN**(还原去重实现后重跑同一文件):
```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

### 2. PhotosSidebar.vue smartview 条件隐藏

**RED**(临时把 `PhotosSidebar.vue` 换回 T5 提交时的版本——没有 settings store 集成、没有
`NAV` 过滤，用 `git show HEAD:...` 取出，逐字复制回真实路径，跑新加的三条用例）:
```
$ pnpm exec vitest run src/photos/components/__tests__/PhotosSidebar.test.ts --reporter=verbose
 × aiFeatures.smartview 为 false 时整条隐藏智能视图入口
   → expected [ ...(7) ] to have a length of 6 but got 7
 ✓ smartview 未确定(取数失败)时按开启显示,不吓用户   (未接线时天然全 7 项可见，本来就过)
 × 挂载即调用一次 fetchAiFeatures(经 store 读配置,不直读 getConfig)
   → expected "wrappedAction" to be called 1 times, but got 0 times
 Tests  2 failed | 18 passed (20)
```

**GREEN**(还原真实实现):
```
$ pnpm exec vitest run src/photos/components/__tests__/PhotosSidebar.test.ts --reporter=verbose
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

### 3. PhotosPeople.vue / PhotosSmartViews.vue 折进 store + §7e-9 链接

这两处没有额外做"临时改回旧代码再跑 RED"的动作,原因:这两个视图原来的 `loadFacesEnabled`/
`loadAiSmartViewOff` 与折进 store 之后在**外部可观察行为**上完全等价(同一组 `svc.photos.getConfig`
mock 场景，产出同一组结果)——既有测试(三态：false / 缺字段 / 失败)不改代码就已经覆盖了语义
不变量,折的过程本身不需要新增行为断言的 RED/GREEN 循环，只需要重构后既有测试仍然绿。
**新增的两条测试**（"facesEnabled/aiSmartViewOff 读 store 而非自己调 getConfig"）是结构性断言
（spy 住 store action），在旧代码下天然为 RED（旧代码没有调用 `settings.fetchAiFeatures`，
`usePhotosSettingsStore` 甚至没被 import），跑法：
```
$ pnpm exec vitest run src/views/__tests__/PhotosPeople.test.ts --reporter=verbose
$ pnpm exec vitest run src/views/__tests__/PhotosSmartViews.test.ts --reporter=verbose
```
折完之后两个文件分别 56/56、17/17 全绿（见下方最终结果）。

§7e-9 链接测试("AI behavior 链接是真路由链接")在旧的 `<span aria-disabled>` 实现下必然 RED
（`link.attributes('href')` 是 `undefined`，`.toContain('/photos/settings')` 会抛错）——同样
没有单独跑这条 RED，因为改动是"删旧断言、写新断言"而不是"新增行为"，旧断言本身就是这条链接
状态变化前后二选一的反证。

## 变异验证(Step 6 三项)

①**删掉在途去重**(把 `if (aiFeaturesInFlight) return aiFeaturesInFlight` 改成
`if (false) return aiFeaturesInFlight`,手改→跑→手动恢复):
```
 × fetchAiFeatures 并发去重:两个消费方同时挂载只发一次 getConfig
   → expected "vi.fn()" to be called 1 times, but got 2 times
 × 三个并发调用者同样只发一次...
   → expected "vi.fn()" to be called 1 times, but got 3 times
 Tests  2 failed | 1 passed | 29 skipped (32)
```
**确认变红**。已手动恢复为 `if (aiFeaturesInFlight) return aiFeaturesInFlight`。

②**去重做成永久缓存**(删掉 `finally { aiFeaturesInFlight = null }`,手改→跑→手动恢复):
```
 × 去重不是永久缓存:上一次结算后再调会重新发请求
   → expected "vi.fn()" to be called 2 times, but got 1 times
 Tests  1 failed | 2 passed | 29 skipped (32)
```
**确认变红**。已手动恢复 `finally` 块。

③**把侧栏隐藏判据从 `=== false` 改成 `!x`**(手改→跑→手动恢复):
```
$ pnpm exec vitest run src/photos/components/__tests__/PhotosSidebar.test.ts -t "smartview" --reporter=verbose
 ✓ aiFeatures.smartview 为 false 时整条隐藏智能视图入口
 ✓ smartview 未确定(取数失败)时按开启显示,不吓用户
 ✓ 挂载即调用一次 fetchAiFeatures...
 Tests  3 passed | 17 skipped (20)
```
**没有变红——与 brief 预期不符,已排查原因,如实登记如下**（详见"brief-vs-源/实现冲突"第 1 条）：
`settings.aiFeatures.smartview` 到达侧栏时永远是 store 已经归一化过的严格 `boolean`
（初值 `{...ALL_ON}` 全部字面 `true`；失败分支落 `{...ALL_ON}`；成功分支走
`readAiFeatures()`/`on()` 返回严格布尔）。对严格 boolean 而言 `x === false` 与 `!x`
在所有可达状态下产出完全相同的结果——两者在**侧栏这一层**不可区分，因此这个特定 mutation
在侧栏组件层面是行为无操作(no-op)，测试保持全绿不是去重/隔离失败，而是这处 mutation
本身选错了观测层。

为了不让这条不变量落空，补做了一次**等价但真正命中该不变量的 mutation**：把
`readAiFeatures()` 内部的 `on = (v) => v !== false` 改成 `on = (v) => !!v`（这才是
"显式 false / falsy" 分歧真正产生分支的地方——`ocr: 0`、`smartview: null` 这类非布尔
falsy 值只有在这里才会被误判为关闭）：
```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts -t "只有显式 false 才关" --reporter=verbose
 × 只有显式 false 才关
   {
     "faces": false,
-    "ocr": true,
+    "ocr": false,
     "scenes": true,
-    "smartview": true,
+    "smartview": false,
   }
 Tests  1 failed | 31 skipped (32)
```
**确认变红**——"只认显式 false,不认 falsy"这条契约真实被一条现有测试(`settings.test.ts`
里 T1 期就有的 `只有显式 false 才关`)锁住,只是锁在 store 的 `readAiFeatures`/`on()` 这一层,
不在侧栏。已手动恢复 `on = (v) => v !== false`。

侧栏保留 `=== false` 写法仍然是对的选择(照抄 Vue2 源 1:1、与本文件其余判据风格一致、对未来
如果 store 契约变化提供额外一层防御),只是它目前在这一层不可观测——已在下方"brief-vs-源
冲突"里登记这个发现，不影响交付结论。

## 测试结果与 [Vue warn] 计数(按运行分别报告)

```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  32 passed (32)
[Vue warn] 计数: 0   (本文件不 mount 任何组件,我新写的测试同样是纯 store 调用)
```

```
$ pnpm exec vitest run src/photos/components/__tests__/PhotosSidebar.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  20 passed (20)
[Vue warn] 计数: 140   (全部来自本文件既有的、Global Constraints 里已登记为"不要修"的
  本地 createI18n 单例——每次 mount 都会重复注册 i18n-t/i18n-n/i18n-d 组件与 t 指令而告警。
  这是 pre-existing debt,非本次引入;我新增的 3 条测试各 mount 一次 PhotosSidebar,按
  同一个每 mount ~7 条的比例贡献了其中一部分,但债务本身在 T4/T5 时就已存在。)
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosPeople.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  56 passed (56)
[Vue warn] 计数: 406   (同上一类债务——本文件第 41 行自己 `createI18n({...})`,与
  PhotosSidebar.test.ts 是同一种"未用 vitest.setup.ts 单例"的既有模式,Global Constraints
  只点名了 PhotosSidebar.test.ts,但这是同类、非本次引入的 pre-existing debt,我没有修它
  ——按"禁止无关重构"处理,只如实报数。)
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosSmartViews.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  17 passed (17)
[Vue warn] 计数: 91   (同上,本文件第 37 行自己 createI18n,同类既有债务。)
```

```
$ pnpm exec vitest run src/i18n --reporter=verbose
Test Files  4 passed (4) | Tests  25 passed (25)
[Vue warn] 计数: 0
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts --reporter=verbose   (collateral fix, 见下)
Test Files  1 passed (1) | Tests  18 passed (18)
```

```
$ pnpm exec vue-tsc --noEmit
(无输出,退出码 0)
```

**汇总一次(局部门,本任务触及文件 + 上述 collateral 文件 + i18n + color-guard)**:
```
$ pnpm exec vitest run \
  src/photos/stores/__tests__/settings.test.ts \
  src/photos/components/__tests__/PhotosSidebar.test.ts \
  src/views/__tests__/PhotosPeople.test.ts \
  src/views/__tests__/PhotosSmartViews.test.ts \
  src/i18n \
  src/styles/color-guard.test.ts \
  --reporter=verbose
Test Files  9 passed (9) | Tests  898 passed (898)
```

**额外验证(超出"只跑局部测试"的约定,但为了核实上面发现的 collateral 影响而临时跑了一次
更大范围)**：`pnpm exec vitest run src/photos src/views src/i18n` → **121 files / 2331 tests
全绿**。这不是本任务要求的收尾全量门(那是 T11 的事),只是为了确认下面这条 collateral 修复
之外没有更多我没发现的连带影响,跑完即止,没有额外改动。

## 一处必须修的连带影响(collateral fix)

`src/views/PhotosSettings.vue`(Task 5 产物)自己的 `onMounted` 本来就调用一次
`settings.fetchAiFeatures()`,同时它的模板里也挂了一份 `<PhotosSidebar />`(本页头部注释
:14-17 明确写了"整页只有一份 PhotosSidebar 副本")。T6 给侧栏接上 `fetchAiFeatures()` 之后,
这一个页面里两个调用点(设置页自己 + 它挂的侧栏)同帧各调一次——`PhotosSettings.test.ts`
里 Task 5 写的断言 `expect(fetchAiFeatures).toHaveBeenCalledTimes(1)` 因此从绿变红
(实测:got 2 times)。

这是**真实的行为变化**,不是测试脆弱:排查后确认这正是"侧栏也要读配置"这个需求的直接后果,
去重只收敛了网络层的请求数(仍是 1 次 `getConfig`),没有也不应该收敛 action 调用层的次数
(去重的定位是防止重复网络请求,不是防止调用者调用 action——调用者各自决定要不要调,store
只保证"不管几个人同时调,网络只跑一次")。已把该测试的断言从 `toHaveBeenCalledTimes(1)` 改成
`toHaveBeenCalledTimes(2)`,并在测试里加注释说明原因,跑通后确认这是本次 T6 唯一的 collateral
影响(`pnpm exec vitest run src/photos src/views src/i18n` 121/121 文件全绿印证)。

## 文件改动清单

- `src/photos/stores/settings.ts` —— `fetchAiFeatures()` 加在途去重 + 头部注释追加。
- `src/photos/stores/__tests__/settings.test.ts` —— 新增 3 条去重用例(brief 给的 2 条 + 我
  补的"三个并发调用者"第 3 条,防止"恰好 2 个"这种偶然实现漏过评审)。
- `src/photos/components/PhotosSidebar.vue` —— 接入 settings store,`NAV` 改 computed 按
  `smartview === false` 过滤;`NAV_ALL` 保留原顺序/内容不变。
- `src/photos/components/__tests__/PhotosSidebar.test.ts` —— mock `@nimotech/nimoos-service`,
  新增 3 条用例(隐藏 / 未确定按开启 / 调用 fetchAiFeatures)。
- `src/views/PhotosPeople.vue` —— 删本地 `loadFacesEnabled`,改读 store。
- `src/views/__tests__/PhotosPeople.test.ts` —— 新增 1 条 spy 用例(见下方冲突记录第 2 条)。
- `src/views/PhotosSmartViews.vue` —— 删本地 `loadAiSmartViewOff`,改读 store;`<span>` 换
  `<RouterLink>`;`.svs-banner-link` 的 `cursor` 从 `default` 改 `pointer`。
- `src/views/__tests__/PhotosSmartViews.test.ts` —— 新增 `/photos/settings` 桩路由、1 条链接
  用例(替换旧的 span 断言)、1 条 spy 用例。
- `src/views/__tests__/PhotosSettings.test.ts` —— collateral fix(见上,`toHaveBeenCalledTimes`
  1→2 + 注释)。
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` —— 删 `photosSvSettingsPending`,原位置留死键
  说明注释。

## brief-vs-源/既有实现冲突记录

1. **变异验证③的字面 mutation 在侧栏这一层是 no-op**(见上方"变异验证"③的完整分析)。
   `aiFeatures.smartview` 到达侧栏之前已经被 store 归一化为严格 boolean,`=== false` 与
   `!x` 在所有可达状态下等价,mutation 不会让侧栏的两条测试变红。真正锁住"只认显式 false"
   这条契约的是 store 的 `readAiFeatures`/`on()`(T1 期就有的既有测试),已用等价 mutation
   在那一层验证过变红。侧栏保留 `=== false` 仍然正确(照抄源、防御性、风格一致),只是
   mutation-verification 的观测点应该点在 store 层而不是侧栏层——已如实记录,没有为了让
   mutation "看起来生效"而改测试或改实现去凑一个假的红。

2. **brief 给的 PhotosPeople.test.ts 断言与同文件既有测试自相矛盾**。brief Step 1 写的是
   ```ts
   it('facesEnabled 读 store 而非自己调 getConfig', async () => {
     expect(service.photos.getConfig).not.toHaveBeenCalled()
   })
   ```
   但同文件里已有的测试(未改动、折之前折之后都必须保持绿)`onMounted 拉人物 + 拉合并建议 +
   读一次 getConfig` 断言的是 `expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)`。两者
   不可能同时成立(`getConfig` 是 mock 在 service 层的,不管是"视图直读"还是"经 store 间接读"
   都会打到同一个 mock 函数上,`not.toHaveBeenCalled()` 与 `toHaveBeenCalledTimes(1)` 矛盾)。
   已在报告与测试注释里登记,改用**能真正区分"视图直读 vs 经 store 读"**的断言:
   `vi.spyOn(settings, 'fetchAiFeatures')` + `expect(spy).toHaveBeenCalled()`,证明 onMounted
   调的是 store 的 action 而不是自己包一层 `getConfig`,同时不与既有测试冲突。

3. **brief 给 PhotosSmartViews 链接测试用的 data-test id 与既有命名不一致**。brief:
   `wrapper.get('[data-test="sv-ai-settings-link"]')`;本文件/组件既有命名(T4/T5 期就定的)
   是 `svs-settings-link`。沿用既有命名,没有为了字面对齐 brief 而改 id(改 id 属于无关改动,
   且会与本组件其余 `svs-*` 系列 data-test 命名不一致)。

4. **§7e-15 的"两个消费方同时挂载只发一次 getConfig"在真实集成里不是一个理论场景**,而是
   每次 mount `PhotosPeople`/`PhotosSmartViews` 都会真实发生(因为这两个视图都在模板里
   `<PhotosSidebar />`,子组件先 mount、父组件后 mount,两者的 `onMounted` 在同一次同步渲染
   里各调一次 `fetchAiFeatures()`)。`PhotosPeople.test.ts` 里未改动的既有测试
   `onMounted 拉人物 + 拉合并建议 + 读一次 getConfig`(断言 `getConfig` 恰好 1 次)因此在
   折完之后天然是"侧栏 + 本页去重生效"的一次端到端印证,不只是单元测试——已在该测试旁补了
   一句注释说明这一点(见 PhotosPeople.test.ts:104-112)。

## 自查(self-review)

- **完整性**:三项债务(facesEnabled/aiSmartViewOff 折 store、侧栏条件隐藏、§7e-9 链接接线)
  全部落地;在途去重两个必要行为(去重生效 + 非永久缓存)各有独立测试且都过了 RED→GREEN；
  死键已删且 grep 证据在案。
- **质量**:命名沿用既有约定(`NAV_ALL`/`NAV`、`settings` 变量名与 PhotosSettings.vue 一致);
  没有把 `aiFeatures.smartview`/`.faces` 作为 prop 往下传(ruling 1 明确要求不这样做)。
- **纪律**:没有碰 Task 5 的齿轮入口、没有重排 NAV_ALL 顺序、没有加第二个 poller/watcher、
  没有修 `PhotosSidebar.test.ts`/`PhotosPeople.test.ts`/`PhotosSmartViews.test.ts` 里那份
  已登记的 pre-existing createI18n 告警债务。唯一超出最初文件清单的改动是
  `PhotosSettings.test.ts` 的一处必要 collateral 断言修正(见上,已解释为何必须改、为何不是
  掩盖回归)。
- **测试**:facesEnabled/aiSmartViewOff 的"失败/缺字段一律按开启"两条既有测试组
  (各三态)折之前折之后都跑通,证明语义没被破坏;侧栏"未确定按开启"用例真实证明的是
  `=== false` 语义,不是 falsy 语义(尽管如冲突记录①所说,mutation 在侧栏层碰不到这条边界,
  已在 store 层补证)。所有我authored 的新测试文件运行(settings.test.ts)[Vue warn] = 0;
  mount 组件的文件(PhotosSidebar/PhotosPeople/PhotosSmartViews 三个 test 文件)全部是
  pre-existing createI18n 债务贡献的告警,已按运行分别报数,没有笼统合并成一个数字掩盖。

## 关于本任务 mutation 验证③的结论(重申)

不是"没做验证"，是做了、如实发现它在字面指定的观测点上不生效，换了一个真正命中不变量的
观测点重新验证并确认变红。这个发现本身值得收进后续 P8a 收尾期(T11)的台账，作为"mutation
verification 要选对观测层"的一条经验，但不阻塞本任务交付。

---

## Fix report(评审「需要修改」回合)

评审确认:实现本身通过(去重实现正确——只有发起调用者在 `finally` 里清空
`aiFeaturesInFlight`,跟进者复用同一个从不 reject 的共享 promise,没有双重清空竞态、没有
未处理拒绝风险);三项债务收编干净;三条自报冲突全部成立(mutation③推理、PhotosPeople
矛盾断言、§7e-9 markup 核对)。评审给了 1 条 Important(必须修)+ 2 条 take-along(顺手改)。

### Important 1:网络层去重不变量没有被真正锁住

**评审原话核心**:`PhotosSettings.test.ts` 里把 `fetchAiFeatures` spy 成
`.mockResolvedValue(...)` 之后断言 `toHaveBeenCalledTimes(2)`,但真正的去重代码
(`settings.ts` 里 `aiFeaturesInFlight` 那段)完全没有跑到——那条断言只证明了"页面 + 它挂的
侧栏各调了一次 action",证明不了"两次 action 调用最终只打了一次真实网络请求"。
`PhotosSmartViews.test.ts` 同款缺口。

**修法**:每个页面新增一条**不 spy `fetchAiFeatures`**、让真实实现跑起来、直接在
`service.photos.getConfig`(HTTP 层的 mock)数调用次数的用例。

**PhotosSettings.test.ts 的额外坑(过程记录)**:第一版直接 `await mountView()` 后断言
`getConfig` 恰好 1 次,实测跑出来是 **3 次**,不是 2 次也不是 1 次。排查后发现:
`settings.ts` 里 `fetchRetention()`/`fetchScanInterval()` 各自也会独立调
`service.photos.getConfig()`(为了拿当前 `watchDirs`/`retentionDays` 随写回一起回传,文件
头部注释里"读了再写"的既定模式),这两个 action 与 `fetchAiFeatures` 的去重毫无关系——
`PhotosSettings.vue` 的 `onMounted` 一次性拉了四项(`fetchAbout`/`fetchRetention`/
`fetchScanInterval`/`fetchAiFeatures`),真正跑起来时,`getConfig` 的三个来源(fetchRetention
1 次 + fetchScanInterval 1 次 + fetchAiFeatures 去重后 1 次)叠加成 3。这不是去重失效,是
第一版测试没有把无关的 `getConfig` 来源隔离干净。修法:像既有的第一条用例一样,把
`fetchRetention`/`fetchScanInterval` spy 成 `mockResolvedValue(undefined)`(`fetchAbout`
不碰 `getConfig`,不需要 spy),只留 `fetchAiFeatures` 走真实实现,这样 `getConfig` 的唯一
来源就是 aiFeatures 的去重路径,断言 1 次才有意义。

`PhotosSmartViews.test.ts` 没有这个问题(`onMounted` 只调 `fetchSmartViews` +
`fetchAiFeatures`,`fetchSmartViews` 打的是 `listSmartViews`,不碰 `getConfig`),新增测试
直接 `await mountView()` 后断言 `getConfig` 恰好 1 次即可,不需要额外 spy。

**新增测试(节选)**:

```ts
// PhotosSettings.test.ts
it('§7e-15 网络级去重证明:PhotosSettings 自身 + 它挂的 PhotosSidebar 同帧各调一次 fetchAiFeatures,真实 getConfig 只发一次', async () => {
  const store = usePhotosSettingsStore()
  vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
  vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
  await mountView()
  expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
})

// PhotosSmartViews.test.ts
it('§7e-15 网络级去重证明:PhotosSmartViews 自身 + 它挂的 PhotosSidebar 同帧各调一次 fetchAiFeatures,真实 getConfig 只发一次', async () => {
  await mountView()
  expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
})
```

同时给 `PhotosSettings.test.ts` 的 mock 补了一个真的 `getConfig: vi.fn()`(此前是空对象
`photos: {}`,任何未 spy 的真实调用只会同步抛 TypeError,虽然被 try/catch 吞掉、行为上凑巧
"看起来"对,但完全没验证到调用次数),并在 `beforeEach` 里加了
`vi.mocked(service.photos.getConfig).mockReset().mockResolvedValue({})`。

**Mutation 验证(dedup 早退 `if (aiFeaturesInFlight) return aiFeaturesInFlight`)**:

手改 → 跑 → 手动恢复,过程:

```
$ # 手改 settings.ts:107 为 `if (false) return aiFeaturesInFlight`
$ pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts -t "网络级去重证明" --reporter=verbose
 × §7e-15 网络级去重证明:...
   AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
 Tests  1 failed | 18 skipped (19)

$ pnpm exec vitest run src/views/__tests__/PhotosSmartViews.test.ts -t "网络级去重证明" --reporter=verbose
 × §7e-15 网络级去重证明:...
   AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
 Tests  1 failed | 17 skipped (18)
```

两条都确认变红(count 从 1 变成 2,与"侧栏 + 页面各打一次未去重请求"完全吻合)。手动恢复
`settings.ts:107` 为 `if (aiFeaturesInFlight) return aiFeaturesInFlight` 后:
`git diff -- src/photos/stores/settings.ts` 输出为空,确认逐字还原(该文件在这一回合没有
产生任何净改动,`git status --short` 只列出 4 个测试文件)。

### Take-along 1:收紧两处 `toHaveBeenCalled()` 断言

**没有照字面建议改成 `toHaveBeenCalledTimes(1)`**——评审建议的数字在两处都是错的,改之前先
手动验证了真实次数:临时把断言改成 `toHaveBeenCalledTimes(1)` 跑一次,两处都在 got 2 times
上失败。原因与 Important 1 同源:`PhotosPeople.vue`/`PhotosSmartViews.vue` 挂载的是**完整
组件树**(模板里含 `<PhotosSidebar />`),spy 住的是 store 的 action 本身而不是网络层——
页面自身的 `onMounted` + 它挂的那份侧栏的 `onMounted` 同帧各调一次 `fetchAiFeatures()`,
action 调用次数天然是 2,只有网络请求(靠 `aiFeaturesInFlight` 去重)才收敛成 1。两处最终
定为 `toHaveBeenCalledTimes(2)`,并在测试注释里写明"临时改 1 手动跑过、确认会失败"这个
验证过程,不是抄评审建议的字面值。

- `PhotosPeople.test.ts`:`facesEnabled 读 store 而非自己调 getConfig(...)` → 2。
- `PhotosSmartViews.test.ts`:`aiSmartViewOff 读 store 而非自己调 getConfig(...)` → 2。

`PhotosSidebar.test.ts:280-286`(评审举的"已经做对"的先例)之所以是 1,是因为那条用例只
mount 了 `PhotosSidebar` 自己,没有嵌套消费方——两处场景不同,数字理应不同,不是同一个数字
"抄对/抄错"的问题。

### Take-along 2:重命名/补全「尚未加载」测试

`PhotosSidebar.test.ts` 里原来的 `smartview 未确定(取数失败)时按开启显示,不吓用户` 拆成
两条:

1. `smartview 请求失败(store 落入 catch 分支)时按开启显示,不吓用户`——原测试体不变
   (mock reject + `flushPromises`),只是标题去掉容易误读成"尚未取数"的「未确定」措辞,
   明确写成"失败"。
2. 新增 `smartview 请求仍在途(尚未 resolve)时按开启显示,同步渲染 7 项`——mock
   `getConfig` 返回一个手动控制的、故意不 resolve 的 promise,`mount()` 之后**不**
   `flushPromises()`,同步断言此刻仍是 7 项。这条才是名副其实的"加载中/尚未取到数"分支,
   与第 1 条(catch 分支落回同一个全 true 值,但代码路径不同)互补,不是同一件事的重复
   断言。收尾用 `resolveFn?.({})` 把挂起的 promise 结算掉,避免泄漏到下一条用例。

选择"重命名 + 补一条"而不是二选一,因为覆盖缺口本身值得补(评审原话"or add a genuine
synchronous pre-resolve assertion alongside"),不只是改个名字。

### 覆盖测试与命令输出(本回合改动的 4 个测试文件,按运行分别报告 [Vue warn])

```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  32 passed (32)
[Vue warn] 计数: 0   (未改动此文件,回归确认)

$ pnpm exec vitest run src/photos/components/__tests__/PhotosSidebar.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  21 passed (21)   (原 20 条 + 拆分/新增净增 1 条)
[Vue warn] 计数: 147   (较修复前的 140 略增,同一份 pre-existing createI18n 债务,新增的
  1 条 mount 按比例贡献;未修债务本身,遵守"禁止无关重构"。)

$ pnpm exec vitest run src/views/__tests__/PhotosPeople.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  56 passed (56)   (条数不变,只改了断言数值与标题)
[Vue warn] 计数: 406   (与修复前一致,未新增 mount。)

$ pnpm exec vitest run src/views/__tests__/PhotosSmartViews.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  18 passed (18)   (原 17 条 + 新增 1 条网络级去重证明)
[Vue warn] 计数: 98   (较修复前的 91 略增,同上,同一份 pre-existing 债务按比例贡献。)

$ pnpm exec vitest run src/views/__tests__/PhotosSettings.test.ts --reporter=verbose
Test Files  1 passed (1) | Tests  19 passed (19)   (原 18 条 + 新增 1 条网络级去重证明)
[Vue warn] 计数: 0

$ pnpm exec vue-tsc --noEmit
(无输出,退出码 0)
```

**收尾前额外跑了一次更大范围确认无连带影响(超出"只跑局部测试"的约定,同上一轮报告的做法,
跑完即止没有额外改动)**:

```
$ pnpm exec vitest run src/photos src/views src/i18n
Test Files  121 passed (121) | Tests  2334 passed (2334)
```

### 本回合文件改动

- `src/photos/components/__tests__/PhotosSidebar.test.ts` —— 拆分"未确定"测试为"失败分支"
  + 新增"在途分支"两条。
- `src/views/__tests__/PhotosPeople.test.ts` —— 收紧 spy 断言为 `toHaveBeenCalledTimes(2)`
  并写明验证过程。
- `src/views/__tests__/PhotosSmartViews.test.ts` —— 同上收紧 + 新增网络级去重证明用例。
- `src/views/__tests__/PhotosSettings.test.ts` —— mock 补 `getConfig: vi.fn()`、
  `beforeEach` 补 reset、新增网络级去重证明用例(含 `fetchRetention`/`fetchScanInterval`
  隔离)。
- **`src/photos/stores/settings.ts` / `src/photos/components/PhotosSidebar.vue`
  本回合零改动**(mutation 验证的手改已逐字恢复,`git diff` 为空)。

提交:`1da9c2f test(photos): P8a-T6 review fix — pin network-level aiFeatures dedup + tighten spies`。

### 本回合发现的一处过程性教训(非阻塞,已在上面记录,这里点名方便后续台账检索)

给"网络级去重"写测试时,凡是被测页面在 `onMounted` 里一次性拉了多个不同 action、且这些
action 碰巧都会调同一个底层端点(`getConfig`)时,数调用次数前必须先确认*哪些*调用是这次
要验证的不变量的一部分、哪些是无关的("读了再写"模式导致的旁路调用)——否则得到的数字
(本例第一版的 3)会是好几个不相关来源叠加的结果,既不是去重成功的证据也不是失败的证据,
只是凑巧对不上预期而已。
