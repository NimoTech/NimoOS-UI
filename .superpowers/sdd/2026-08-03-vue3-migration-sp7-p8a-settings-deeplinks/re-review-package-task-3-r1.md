# Re-review package — Task 3 fix round 1 (050b12f..04e6684)

## Commits
04e6684 fix(photos): PhotosStorageCard 补 Rescan Now 覆盖 + data-test 钩子(P8a-T3 评审修复)

## Stat
 src/photos/components/PhotosStorageCard.vue        |  2 +-
 .../components/__tests__/PhotosStorageCard.test.ts | 57 ++++++++++++++++++++--
 2 files changed, 55 insertions(+), 4 deletions(-)

## Diff (-U10)
```diff
diff --git a/src/photos/components/PhotosStorageCard.vue b/src/photos/components/PhotosStorageCard.vue
index ebe41b0..9247070 100644
--- a/src/photos/components/PhotosStorageCard.vue
+++ b/src/photos/components/PhotosStorageCard.vue
@@ -185,21 +185,21 @@ onMounted(() => {
           :data-active="store.retentionDays === d" @click="selectRetention(d)"
         >{{ t('photosSettingsRetentionDay', { n: d }) }}</button>
       </div>
     </div>
 
     <div class="psc-row">
       <div class="psc-row-text">
         <div class="psc-row-label">{{ t('photosSettingsRescanLabel') }}</div>
         <div class="psc-row-desc">{{ t('photosSettingsRescanDesc') }}</div>
       </div>
-      <button type="button" class="psc-btn" :disabled="scanBusy" @click="rescanNow">
+      <button type="button" class="psc-btn" data-test="rescan-now" :disabled="scanBusy" @click="rescanNow">
         <span v-if="scanBusy" class="psc-spinner"></span>
         {{ scanBusy ? t('photosSettingsRescanning') : t('photosSettingsRescanNow') }}
       </button>
     </div>
 
     <div class="psc-row">
       <div class="psc-row-text">
         <div class="psc-row-label">{{ t('photosSettingsScanIntervalLabel') }}</div>
         <div class="psc-row-desc">{{ t('photosSettingsScanIntervalDesc') }}</div>
       </div>
diff --git a/src/photos/components/__tests__/PhotosStorageCard.test.ts b/src/photos/components/__tests__/PhotosStorageCard.test.ts
index 18b126c..740017c 100644
--- a/src/photos/components/__tests__/PhotosStorageCard.test.ts
+++ b/src/photos/components/__tests__/PhotosStorageCard.test.ts
@@ -205,36 +205,87 @@ describe('PhotosStorageCard', () => {
     }
     await nextTick()
     vi.spyOn(store, 'pruneCache').mockRejectedValue(new Error('boom'))
     const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
     await wrapper.get('[data-test="clear-cache"]').trigger('click')
     await flushPromises()
     expect(fetchSpy).not.toHaveBeenCalled()
     expect(wrapper.emitted('toast')).toBeTruthy()
   })
 
-  it('容量条段数 = breakdown 段数 + 1 个 free 段', async () => {
+  it('容量条段数 = breakdown 段数 + 1 个 free 段(评审 Important-take-along:精确断言,不是 >=5)', async () => {
     const { wrapper, store } = mountCard()
-    store.storage = {
+    const fixture = {
       diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
       photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
     }
+    store.storage = fixture
     await nextTick()
-    expect(wrapper.findAll('[data-test="bar-seg"]').length).toBeGreaterThanOrEqual(5)
+    // 期望段数从 buildBreakdown 本身派生(usedGB = capGB - freeGB = 60,已知段合计 58GB,
+    // other = 2GB > 0.05 会追加)——不写死数字,这样若换了 fixture 数值,期望值跟着走,
+    // 断言仍然是"组件真的把 buildBreakdown 的每一段都渲染出来了",而不是一个凑巧成立的下限。
+    const usedGB = fixture.diskTotalBytes / 1024 ** 3 - fixture.diskFreeBytes / 1024 ** 3
+    const expectedSegs = buildBreakdown(fixture, usedGB)
+    expect(expectedSegs.map((s) => s.key)).toEqual(['photos', 'videos', 'raw', 'thumbs', 'ai', 'other'])
+    expect(wrapper.findAll('[data-test="bar-seg"]')).toHaveLength(expectedSegs.length)
     expect(wrapper.findAll('[data-test="bar-free"]')).toHaveLength(1)
   })
 
   it('mount 时自取一次 storage(fetchStorage 被调,矫正 T3 Consumes 接口列表里点名的动作)', () => {
     const fetchSpy = vi.spyOn(usePhotosSettingsStore(), 'fetchStorage')
     mount(PhotosStorageCard)
     expect(fetchSpy).toHaveBeenCalled()
   })
+
+  // 评审 Important-1:Rescan Now(rescanNow/triggerScan/scanBusy 守卫/成功 check toast/
+  // 失败兜底 toast)此前零覆盖——task-3-report.md 曾误报"已纳入组件与测试",实际未写。
+  // 补三条:成功、失败、忙时守卫(第一版报告的完整性声明有误,已在报告里如实登记,不是
+  // 悄悄改成"现在测了"就完事)。
+  it('Rescan Now 成功:调 triggerScan,emit check toast,scanBusy 复位', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'triggerScan').mockResolvedValue(true)
+    const btn = wrapper.get('[data-test="rescan-now"]')
+    await btn.trigger('click')
+    await flushPromises()
+    expect(store.triggerScan).toHaveBeenCalledTimes(1)
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'check' })
+    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('Rescan Now 失败:emit 兜底 toast(trash 图标,复用 photosSettingsRebuildStartFailed),scanBusy 复位', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'triggerScan').mockRejectedValue(new Error('boom'))
+    const btn = wrapper.get('[data-test="rescan-now"]')
+    await btn.trigger('click')
+    await flushPromises()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'trash' })
+    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('Rescan Now 忙时守卫:在途请求未完成前再点一次不会触发第二次 triggerScan', async () => {
+    const { wrapper, store } = mountCard()
+    let release: (() => void) | undefined
+    vi.spyOn(store, 'triggerScan').mockImplementation(
+      () => new Promise<boolean>((res) => { release = () => res(true) }),
+    )
+    const btn = wrapper.get('[data-test="rescan-now"]')
+    await btn.trigger('click') // 不 await 完成,趁在途再点一次
+    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeDefined()
+    await wrapper.get('[data-test="rescan-now"]').trigger('click')
+    expect(store.triggerScan).toHaveBeenCalledTimes(1)
+    release?.()
+    await flushPromises()
+  })
 })
 
 describe('样式:分段器 [data-active] 变体自带 hover 背景(本区已栽四次)', () => {
   it('seg-btn 的 hover 胜出规则同时含 :hover 与 data-active', () => {
     const style = extractStyleBlock(photosStorageCardRaw)
     expect(style.length).toBeGreaterThan(0)
     const winner = winningHoverBackground(style, ['seg-btn'])
     expect(winner.selector).toContain(':hover')
     expect(winner.selector).toContain('data-active')
   })
```
