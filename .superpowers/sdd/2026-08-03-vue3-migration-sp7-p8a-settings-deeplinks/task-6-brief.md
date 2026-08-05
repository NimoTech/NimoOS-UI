## Task 6: 三项 config 挂账收编(§7e-9 / §7e-15 / P7a 的 aiFeatures 重复读)

**Files:**
- Modify: `src/views/PhotosPeople.vue`(删本地 `loadFacesEnabled`,改读 store)
- Modify: `src/views/PhotosSmartViews.vue`(同上;并把不可点 `<span>` 接成真链接)
- Modify: `src/photos/components/PhotosSidebar.vue`(`smart-views` 条目条件隐藏)
- Test: 三个文件各自的既有测试 + 新增用例

**Interfaces:**
- Consumes: T1 store 的 `aiFeatures` / `aiFeaturesLoaded` / `fetchAiFeatures`;T5 的 `/photos/settings?section=ai`。

**回源坐标**:Vue2 `PhotosSidebar.vue:120-122`(`ai.smartview === false` 时 `items.filter(i => i.id !== 'smart')`);New-UI 现状 `PhotosPeople.vue:376-387`、`PhotosSmartViews.vue:78-86`(两处各自 `onMounted` 直读 `getConfig`)、`PhotosSmartViews.vue` 头注释「偏离登记 1」记着的那个不可点 `<span aria-disabled="true">`。

**三件事**

1. **收编重复读**:两个视图删掉各自的 `getConfig` 直读,改成 `onMounted(() => void settings.fetchAiFeatures())` + 读 `settings.aiFeatures.faces` / `.smartview`。**语义保持不变**:缺字段/失败按开启(T1 已在 store 里落实)。
2. **§7e-15 侧栏条件隐藏**:`aiFeatures.smartview === false` 时整条隐藏 `smart-views` 条目。⚠️ **侧栏是全相册区共用组件**,它自己要拉一次 config —— 但 store 是单例,`fetchAiFeatures` 在多个消费方同时挂载时会并发发多次请求。**加一个在途去重**(store 内部一个在途 Promise 复用,照 Vue2 `_restoreUploadsPromise` 的幂等手法),并为它写用例:「两个消费方同时挂载只发一次 `getConfig`」。
3. **§7e-9 链接接线**:把 `PhotosSmartViews.vue` 里那个不可点 `<span aria-disabled="true" :title="t('photosSvSettingsPending')">` 换成 `<RouterLink to="/photos/settings?section=ai">`。**`photosSvSettingsPending` 键随之成为死键 —— 从两个 locale 文件删掉**(照 P7a 终审 Minor 8 删 `photosPersonSubtitle` 的先例),并在提交信息里写明。

- [ ] **Step 1: 写失败测试**

```ts
// 在 settings.test.ts 里加
it('fetchAiFeatures 并发去重:两个消费方同时挂载只发一次 getConfig', async () => {
  vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
  const s = usePhotosSettingsStore()
  await Promise.all([s.fetchAiFeatures(), s.fetchAiFeatures()])
  expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
})

it('去重不是永久缓存:上一次结算后再调会重新发请求', async () => {
  vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
  const s = usePhotosSettingsStore()
  await s.fetchAiFeatures()
  await s.fetchAiFeatures()
  expect(service.photos.getConfig).toHaveBeenCalledTimes(2)
})

// PhotosSidebar.test.ts
it('aiFeatures.smartview 为 false 时整条隐藏智能视图入口(§7e-15)', async () => { /* … */ })
it('smartview 未确定(取数失败)时按开启显示,不吓用户', async () => { /* … */ })

// PhotosSmartViews.test.ts
it('AI behavior 链接是真路由链接,指向 /photos/settings?section=ai(§7e-9)', async () => {
  const link = wrapper.get('[data-test="sv-ai-settings-link"]')
  expect(link.attributes('aria-disabled')).toBeUndefined()
  expect(link.attributes('href')).toContain('/photos/settings')
})

// PhotosPeople.test.ts
it('facesEnabled 读 store 而非自己调 getConfig', async () => {
  expect(service.photos.getConfig).not.toHaveBeenCalled() // 视图层不再直读
})
```

- [ ] **Step 2–4: 运行确认失败 → 实现 → 确认通过**

- [ ] **Step 5: 死键清理验证**

```bash
grep -rn 'photosSvSettingsPending' src/ && echo "⚠️ 仍有引用,不能删" || echo "✓ 零引用,可删"
```
删除后跑 `pnpm exec vitest run src/i18n --reporter=verbose` 确认 parity 仍绿。

- [ ] **Step 6: 变异验证 + Commit**

变异验证:①删掉在途去重 → 「只发一次」应变红 ②把去重做成永久缓存 → 「不是永久缓存」应变红 ③把侧栏隐藏判据从 `=== false` 改成 `!x` → 「未确定时按开启」应变红。

```bash
git add src/views/PhotosPeople.vue src/views/PhotosSmartViews.vue \
        src/photos/components/PhotosSidebar.vue src/photos/stores/settings.ts \
        src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): 三项 config 挂账收编进 photosSettings store(P8a-T6)

§7e-9 Settings·AI behavior 链接接线(photosSvSettingsPending 随之成死键,已删)
§7e-15 smartview 关闭时隐藏侧栏智能视图入口
P7a 两处 onMounted 直读 getConfig 收编,加在途去重"
```

---

