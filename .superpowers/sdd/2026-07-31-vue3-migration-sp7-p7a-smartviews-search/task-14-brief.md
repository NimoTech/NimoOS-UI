### Task 14: `SearchPeoplePopover.vue` + `SearchSaveSmartView.vue`(D12 真建)

**Files:**
- Create: `src/photos/components/SearchPeoplePopover.vue` + `__tests__/SearchPeoplePopover.test.ts`
- Create: `src/photos/components/SearchSaveSmartView.vue` + `__tests__/SearchSaveSmartView.test.ts`
- Read-only 参考: `PhotosSearchView.vue:93-122`(people 弹层)、`:435-447`+`:545-549`(realPeopleList / filteredPeopleList)、`:152-210`(保存弹层)、`:550-559`(defaultSaveName)、`:798-812`(openSave / confirmSave)、`photos.scss:2689-2694`+`:2645-2657`+`:2795-2831`

**Interfaces:**
- Consumes: T10 的 `type PersonOption`、T2 的 store(`createSmartView` / `createBusy`)、T9+T1 的键、`service.photos.personFaceThumbnailUrl`
- Produces:
  ```ts
  // SearchPeoplePopover.vue
  { people: PersonOption[]; selected: string[] }         // selected 存人名(照搬 Vue2:按 name 过滤)
  (e: 'update:selected', v: string[]): void
  (e: 'apply'): void
  (e: 'cancel'): void

  // SearchSaveSmartView.vue
  { open: boolean; query: string; conditions: string[]; defaultName: string }
  (e: 'update:open', v: boolean): void
  (e: 'saved', id: string): void
  ```

**结构规格:**

**A. `SearchPeoplePopover.vue`**

1. `.fpop`(width **300**,照搬 `:94`)含:`<input class="fpop-search">`(占位 `photosSearchSearchPeople`)+ `v-if="filtered.length"` 的 `.face-pop-grid`(`repeat(4, 1fr)`)+ `v-else` 空态(`photosSearchNoPeopleDetected`)+ 脚两钮。
2. 每格 `.face-cell`(`:data-on="selected.includes(p.name)"`,`@click="toggle(p.name)"`)含:`.face-avatar`(48×48 圆形;`p.coverFaceId` 非空 → `<img :src="personFaceThumbnailUrl(p.id)">`,否则渲染名字首字母)+ `.face-cell-name` + `.face-cell-count`(`p.count.toLocaleString(locale)`)。
   - **`.face-avatar` 的渐变底 + 白字是 Vue2 内联 style(`:102`)** ⇒ 改 class + token。**`p.named ? p.n[0] : '?'` 这个分支**:Vue2 的 `realPeopleList` 已经 `.filter(p => p.name && p.name.trim())`(`:437`)⇒ `named` 恒真 ⇒ **`'?'` 分支不可达 = 死代码**。New-UI 的 `PersonOption` 只含已命名的人 ⇒ **直接取首字母,不迁 `'?'` 分支**(grep 实证后登记)。同理 `photosSearchUnnamed` 那个键在此处**不可达**(它是 `.face-cell-name` 的 `p.named ? p.n : $t('Unnamed')`)⇒ **也不迁**。**⚠ 这两条要在 T9 的 i18n 表里核对:若 `Unnamed` 在表内,本任务负责把它移除并同步改 T9 的键数(54 → 53)。**
   - **`PersonAvatar.vue` 本仓已有**(P5 建的公共头像)⇒ **先读它**,能复用就复用(它大概已经处理了「无封面 → 首字母」);不能复用再自绘,并在报告里说明为何。
3. `filtered`:`search` 空 → `people`;否则按 `name.toLowerCase().includes(...)`(照搬 `:545-549`)。
4. Apply 按钮文案带计数:`selected.length` 非 0 时追加 ` ({n})`(照搬 `:118`)。

**B. `SearchSaveSmartView.vue`**

5. `.save-pop`(`v-if="open"`)含 4 段:
   - `.save-pop-head`:28×28 accent 实底图标块(sparkles 13px,**`--on-accent` 合法**)+ 标题 `photosSearchSaveAsSmartView` + 副标题(**复用 T1 的 `photosSvSavedSearchKeepsItself`**)+ 关闭按钮。
   - `.save-pop-body`:
     - 名称:label(复用 `photosSvName`)+ `<input>`(`v-model="name"`,占位 复用 `photosSvEGSaraTokyo`,`@keydown.enter.prevent="confirm"`、`@keydown.esc.prevent="close"`)。
     - 条件:label(复用 `photosSvConditions`)+ `.save-pop-conds`(`v-for` 出 `conditions` 的 `.save-pop-cond`;为空 → 一行提示 `photosSearchNoActiveFiltersSaves`)。
     - 阈值:label(复用 `photosSvQualityThreshold`)+ 右对齐的 `≥ {thresh}%` + **`<PhotosThreshSlider>`(T5 已抽的共享组件,含 range + 三档标尺)**。契约见 T8 第 1 条;**不要自己再写一份**。
     - Keep it live:开关(复用 `photosSvKeepLive` + `photosSvAutoAddMatchesPhotos`),`role="switch"` + `aria-checked` + `aria-label`。
   - `.save-pop-foot`:ghost(复用 `photosSvCancel`)+ primary(sparkles 12px + 复用 `photosSvCreateSmartView`,`:disabled="!name.trim() || store.createBusy"`)。
6. **`open` 变真时重置**(`watch`,不是 `onMounted` —— 持久挂载坑):`name = defaultName`、`thresh = 75`、`live = true`,并 `$nextTick` focus + select 名称输入框(照搬 `:798-804`)。**默认阈值 75,与创建弹窗的 80 不同 —— 逐字核 `:801`。**
7. **`confirm()` —— D12 真建**:
   ```ts
   // Vue2 confirmSave(PhotosSearchView.vue:806-812)只置 saved=true + 写一个全仓
   // 再没人读的 savedSv + 弹"已保存"toast,零 store/service 调用 —— 这颗按钮在
   // Vue2 里是假的(spec D12)。这里真调 createSmartView。
   const created = await store.createSmartView({
     name: name.value.trim(),
     description: props.query,          // 原始查询词作为语义兜底条件(后端会用它)
     conds: [...props.conditions],
     threshold: thresh.value,
     live: live.value,
     includeVideos: false,              // Vue2 保存弹层没有这个开关,取 create 的默认值
   })
   if (created) { emit('saved', created.id); emit('update:open', false) }
   ```
   失败 → `useToast` 报错 + **弹层不关**(与 T5 同口径)。
   - **`description: props.query`**:Vue2 的 `savedSv` 里存的是 `{ query, filters }`,而后端 `createSmartView` 的语义是「conds 为空时用 description 作语义兜底」(Vue2 `PhotosSmartViewsView.vue:426` 的注释明说)。**把查询词放 description 是唯一合理的映射,注释登记这个推断。**
   - **`conditions` 由宿主(T16)算好传进来**(= `activeConditions`)。
8. **`defaultName` 由宿主算**(T16 的 `defaultSaveName`,照搬 `:550-559`)—— 本组件只收 prop。

- [ ] **Step 1: 写失败测试**

`SearchPeoplePopover.test.ts`:
- 4 人 → 4 个 `.face-cell`;`people` 为空 → 空态文案、0 格。
- `coverFaceId` 非空 → 有 `img` 且 `personFaceThumbnailUrl(p.id)` 被调;为空 → 无 img、显示名字首字母。
- `selected` 含某人名 → 该格 `data-on="true"`。
- 点格 → `update:selected` 增删(**新数组,不原地改**)。
- 搜索过滤:大小写不敏感;过滤到 0 → 空态。
- Apply 文案:`selected` 为空 → 不含括号;2 人 → 含 `(2)`。
- 计数千分位跟 locale(源文本断言 `toLocaleString(` 带参数)。
- **`'?'` 分支与 `Unnamed` 键不存在**:源文本不含 `'?'` 的那个三元、不含 `photosSearchUnnamed`(死代码未迁的反向断言)。

`SearchSaveSmartView.test.ts`:
- `open: false` → 不渲染;置真 → 渲染 4 段。
- **`open` 变真时重置走 watch**:改过 name 后关闭再打开 → name 回到 `defaultName`(**持久挂载坑守卫**);`thresh` 回到 **75**。
- 打开后名称输入框自动聚焦(`document.activeElement`)。
- `conditions` 为空 → 提示文案;非空 → N 个 `.save-pop-cond`。
- primary:`name` 为空 → disabled;`store.createBusy` → disabled。
- **`confirm` 真调 store**:断言 `createSmartView` 收到的对象逐字段(`description === props.query`、`conds` 是 `conditions` 的拷贝而非同一引用、`threshold` 是当前 thresh、`live`、`includeVideos: false`);`saved` 事件带 id;`update:open` 发 false。
- **失败**:reject → toast 被调、`update:open` **未**发出、**`saved` 未发出**。
- 开关 `role="switch"` + `aria-checked` 随状态;有 `aria-label`。
- Esc → `update:open` 发 false(**不提交**)。
- `--on-accent` 正向断言:`.save-pop-icon` 是 accent 实底 + `--on-accent`。
- cssCascade:primary / ghost 各自 hover 归属变体。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现(含按 A-2 结论决定复用 `PersonAvatar` 或自绘;按 A-2 结论回改 T9 的 i18n 表)**

- [ ] **Step 4: 跑全量 + tsc + color-guard + parity,逐个删码验证**

删码清单:①`watch(() => props.open)` 换 `onMounted` → 重置用例红;②`thresh = 75` 改成 80 → 阈值用例红;③`conds: [...props.conditions]` 的展开 → 「拷贝非同引用」用例红;④`confirm` 的 catch → 失败不关用例红;⑤`description: props.query` 换成 `''` → 字段用例红;⑥Apply 计数的 `v-if` → 括号用例红;⑦`coverFaceId` 的 `v-if` → 首字母用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/components/SearchPeoplePopover.vue src/photos/components/SearchSaveSmartView.vue src/photos/components/__tests__/SearchPeoplePopover.test.ts src/photos/components/__tests__/SearchSaveSmartView.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7a-T14 人物弹层 + 保存为智能视图弹层(D12 接线做真)"
```

---

