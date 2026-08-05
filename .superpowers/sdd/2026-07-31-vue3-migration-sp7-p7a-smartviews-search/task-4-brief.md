### Task 4: `views/PhotosSmartViews.vue` —— 列表页 + 路由 + 侧栏条目

**Files:**
- Create: `src/views/PhotosSmartViews.vue`
- Create: `src/views/__tests__/PhotosSmartViews.test.ts`
- Modify: `src/router/index.ts`(**只追加** `/photos/smart-views`,插在 `/photos/places/:key`(现 `:48`)之后)
- Modify: `src/photos/components/PhotosSidebar.vue`(nav 数组插入,在 `places` 之后)
- Modify: `src/photos/components/__tests__/PhotosSidebar.test.ts`(补条目数与顺序断言)
- Read-only 参考: `PhotosSmartViewsView.vue:14-38`、`:303-304`、`:330-349`、`photos-smartview.scss:4-25`+`:118-145`、`PhotosSidebar.vue:114-119`(Vue2 顺序)、体例参照 `src/views/PhotosPeople.vue`(横幅 + `getConfig` 直读的先例在 `:98` 与 `:379`)

**Interfaces:**
- Consumes: T2 的 store、T3 的 `SmartViewCard`、T1 的键
- Produces: 路由 name `photos-smart-views`;侧栏 nav 项 `{ id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosSvSmartViews' }`

**结构规格:**

1. **外壳照本区既定形态**:`<AreaShell :title="t('photosTitle')">` → `.photos-layout` → `<PhotosSidebar />` + `<main class="photos-main">`(照 `views/Photos.vue:164-193` 与 `PhotosPeople.vue` 的既有布局,**含那条 `@media (max-width: 768px)` 的 `gap: 0`**)。
2. **AI 横幅**(Vue2 `:15-20`,整条是内联 style,改成 class):`v-if="aiSmartViewOff"` → 琥珀底 + 琥珀边 + 26×26 圆角图标块(info 图标 13px)+ 标题 `photosSvSmartViewsAutoUpdate` + 说明 `photosSvTheseSavedSearchesStay` + **不可点的**「设置 · AI 行为」标注。
   - **数据来源照 `PhotosPeople.vue:379` 的 P5 先例**:`onMounted` 直读一次 `service.photos.getConfig()`,取 `cfg?.aiFeatures?.smartview`;**缺字段或请求失败一律按开启处理**(不吓用户)⇒ `aiSmartViewOff = cfg?.aiFeatures?.smartview === false`。
   - **链接不可点**(§7e-9 / 政策三):渲染成 `<span>` 而非 `<a>`,`aria-disabled="true"`,`title` 说明「设置页迁移中」(新增一个自拟键 `photosSvSettingsPending`,zh「设置页待迁移(P8)」/ en `Settings page coming in P8`)。**代码注释登记 P8 接线点。**
   - 琥珀色走 `--dem-fg` 家族(照 P6「preop 琥珀 → `--dem-fg`」先例);**先 grep `theme.css` 确认 `--dem-fg` 与配套的软底/边框 token 都在**,缺则新增并两套主题给值。
3. **hero**(`:22-30`):`<h1>{{ t('photosSvSmartViews') }}</h1>` + `<p>{{ t('photosSvSavedSearchesStayLive') }}</p>` + 右侧 `.sv-create-btn`(sparkles 13px + `photosSvCreateSmartView`,`@click` 打开创建弹窗)。
4. **网格**(`:31-38`):`.sv-grid` → `v-for` 出 `SmartViewCard`(`:key="String(sv.id)"`,`@open` → `router.push('/photos/smart-views/' + id)`)+ 末尾 `.sv-create-card`(`.plus` 圆块含 20px plus 图标 + `<h3>{{ t('photosSvNewSmartView') }}</h3>` + `<p>{{ t('photosSvDescribeWantSetQuality') }}</p>`,`@click` 同样打开创建弹窗)。
5. **加载态与空态**:Vue2 **两者都没有**(`smartViews` 为空时只剩那张新建卡)。New-UI:`store.listLoading && !store.listLoaded` → 骨架;`listLoaded && smartViews.length === 0` → **不加空态**(那张新建卡本身就是空态,信息层级照 Vue2)。**登记这个判断。**
6. **创建弹窗挂载点**:`<SmartViewCreateDialog v-model:open="createOpen" @created="onCreated" />`(T5 建;**本任务先用一个最小占位实现让测试跑通是不允许的** —— T5 尚未存在,故本任务的模板里**先不挂**,只留 `createOpen` state 与两个入口的 `@click` 置真 + 一条 TODO 注释指向 T5,并在测试里断言 `createOpen` 被置真而非断言弹窗渲染)。**T5 负责挂载并把这条断言升级。**
7. **路由追加**(`src/router/index.ts`,**只追加不重排**):`{ path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews }`,插在 `/photos/places/:key` 之后。**import 也追加在对应位置。**
8. **侧栏条目**:在 `places`(现 `PhotosSidebar.vue:34`)之后插入 `{ id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosSvSmartViews' }`。**顺序照 Vue2 `PhotosSidebar.vue:114-118`(library / albums / people / places / smart)** ⇒ 插在 places 之后、favorites 之前。**注意本仓现有顺序是 library/albums/people/places/favorites/trash,插入后是 6→7 项。** `PhotosSidebar.test.ts` 里若有「恰好 6 项」的断言,改成 7 并**同时**断言 `smart-views` 的下标是 4。
9. **`activeNavId` 工具**(`util/activeNavId.ts`)可能需要认识新路由 —— **先读那个文件**,若它按路由前缀匹配则无需改;若是白名单则追加。

- [ ] **Step 1: 写失败测试**

必含用例:
- `onMounted` 调 `store.fetchSmartViews()` 一次。
- 三条 store 状态 → 三种渲染:`listLoading && !listLoaded` 出骨架;`listLoaded` + 2 条 → 2 个 `SmartViewCard` + 1 张 `.sv-create-card`;`listLoaded` + 0 条 → 0 个卡片 + 1 张新建卡且**无独立空态元素**。
- 横幅三态:`getConfig` 返 `{ aiFeatures: { smartview: false } }` → 横幅在;返 `{ aiFeatures: {} }` → 横幅**不在**;`getConfig` reject → 横幅**不在**(不吓用户)。**这三条照 `PhotosPeople.test.ts:290-301` 的既有先例写。**
- 横幅里的设置链接是 `<span>` 且带 `aria-disabled="true"`,**不是** `<a href>`;点它不触发任何导航(`router.push` 的 spy 未被调)。
- 点 hero 的创建按钮 → `createOpen` 为真;点 `.sv-create-card` → 同样为真。
- 卡片 `@open` → `router.push` 被调用且参数是 `/photos/smart-views/7`(后端 id 数字 7 → 断言字符串拼接正确)。
- **路由表**:`?raw` 读 `src/router/index.ts` 源文本,断言 `/photos/smart-views` 出现在 `/photos/places/:key` **之后**(行序比较,**不要用 `getRoutes()` 下标** —— vue-router 4 会把动态段路由排到静态之前,P6b-T9 实测过);并用 `createMemoryHistory` 的 router `resolve('/photos/smart-views')` 断言 `name === 'photos-smart-views'`(**真解析,不只 spy push**,T8 转来的硬要求同型)。
- **侧栏**:7 个条目;`smart-views` 在下标 4;文案取 `photosSvSmartViews`;点击 push 到 `/photos/smart-views`。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/views/__tests__/PhotosSmartViews.test.ts src/photos/components/__tests__/PhotosSidebar.test.ts src/router/index.test.ts`

- [ ] **Step 3: 实现**

- [ ] **Step 4: 跑全量 + tsc + color-guard + parity,逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单:①`getConfig` 的 `=== false` 改成 `!cfg?.aiFeatures?.smartview` → 「缺字段不吓用户」用例红;②`getConfig` 的 catch → reject 用例红;③`String(sv.id)` → 数字 id 的 push 参数用例红;④侧栏插入位置挪到末尾 → 下标 4 用例红;⑤路由行插到 `/photos` 之前 → 行序用例红。

- [ ] **Step 5: Commit**

```bash
git add src/views/PhotosSmartViews.vue src/views/__tests__/PhotosSmartViews.test.ts src/router/index.ts src/photos/components/PhotosSidebar.vue src/photos/components/__tests__/PhotosSidebar.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7a-T4 智能视图列表页 + /photos/smart-views 路由 + 侧栏第 5 条目"
```

---

