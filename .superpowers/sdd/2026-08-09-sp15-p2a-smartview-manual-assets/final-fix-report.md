# SP15-P2a 整支终审 · 修复波报告

日期:2026-08-09 · 分支 `sp15-photos-moments` · 工作树 `.claude/worktrees/sp15-photos-moments`
提交:`3cdfcb0 fix(photos): close the smart-view manual-asset gaps the branch review found`
(报告本身另起一条提交)

本期没有逐任务评审,这是整支唯一一轮评审,也没有第二波修复 —— 七条 finding + 四个覆盖漏洞
+ 一条结构性修复,全部一次做完。**七条全部成立,一条都没有驳回。**

---

## 逐条

### Finding 1(Important)· 路由切换的选择重置其实没被守住

**结论:成立,且比描述更糟一点** —— 选择栏的 `v-if` 是 `selecting && selectedIds.length`,
只要 `selecting` 被清掉栏就消失,所以原用例(只断言栏消失)对 `selectedIds.value = []` 这行
完全不敏感。真实故障链与评审描述一致:sv1 选中 `a1` → 切到 sv2(栏隐藏、`selecting=false`、
`selectedIds` 仍是 `['a1']`)→ 在 sv2 按「选择」,而 `toggleSelecting` 只在**退出**时清空、
进入时不清 → 栏带着 sv1 的 id 回来 → 点移除 → `POST /smart-views/sv2/assets/remove
{assetIds:['a1']}`。

**改动**:`src/views/PhotosSmartViewDetail.assets.test.ts` 的
`drops the selection and closes the picker when the route id changes` 在导航之后**重新进入
选择模式**并断言栏不再出现。原有两条断言保留(它们守的是另外两件事:`selecting` 与
`pickerOpen`)。

代码侧未改 —— 路由 watcher 里的重置本来就是对的,缺的只是能证伪它的用例。

### Finding 2(Minor · 1:1 破坏)· 自行翻译的文案

**结论:成立,已回源实证。** 不是照评审的话改的,是自己去 Vue2 查的:

```
NimoOS-UI 899af59b:src/assets/lang/zh_CN.json:2020   "Add photos": "添加照片"
NimoOS-UI 899af59b:src/assets/lang/zh_CN.json:2045   "Add selected": "添加所选"
```

(注意路径是 `src/assets/lang/zh_CN.json`,不是 `src/lang/zh_CN.json` —— 后者在该提交上
不存在。)`photosSvAddPhotos` 原值 `加照片` 是本地缩写,而同屏复用的
`photosAlbumPickerTitle` 已经渲染成「添加照片到「…」」,自相矛盾。

**改动**:`src/i18n/zh_cn.photos.ts` → `添加照片`,并把该键上方那段注释改写成登记(说明
原值错在哪、Vue2 的原文在哪一行、以及「这里的中文一律从 Vue2 抄,不在本仓翻译」这条规则)。
`en_us.photos.ts` 的 `'Add photos'` 本来就对,未动 ⇒ parity 不受影响。

### Finding 3(Minor)· picker 提交按钮标签的 1:1 破坏

**结论:成立,已回源实证。** Vue2 `PhotosSmartViewDetail.vue:288` 给这个 picker 传的是
静态 `:submit-label="$t('Add selected')"`;相册两页传的才是带计数的 `Add ({count})`。
原实现传了相册那个计数函数,并援引 `PhotosLibraryPicker.vue` 偏离 (b) —— 但那条偏离的原话
是关于「保持相册既有消费方不变」,对一个**新**消费方该用哪种一个字都没说。

**改动**:
- `:submit-label="t('photosMoAddSelected')"`(P1 已有的键,值就是 `添加所选`,**不新增键**);
- 删掉视图里的 `pickerSubmitLabel(count)` 函数;
- 模板处补一段中文注释登记为什么换回静态标签。

**已确认的两件事**:
1. `PhotosLibraryPicker` 的 prop 类型是 `string | ((count: number) => string)`
   (`PhotosLibraryPicker.vue:60`),内部 `submitText` 用 `typeof === 'function'` 分流
   (`:102`),传纯字符串是合法路径,不是硬塞;
2. 相册两页零改动 —— `PhotosAlbums.test.ts` + `PhotosAlbumDetail.test.ts` 53 例全绿(见下)。

对应用例也改了:原来那条 `passes the submit label as a function of the selected count`
现在断言 `label === zh.photosMoAddSelected` 且 `typeof label === 'string'`。

### Finding 4(Minor)· 已排除瓦片在选择模式下仍会写服务端

**结论:成立。** Vue2 `:167` 的 `@click="restoreOne(p)"` 无条件挂着,本仓照抄。页面上其他每
一张瓦片在选择模式下都是切换选中,唯独已排除那张会**静默发一次恢复请求**:没有二次确认、
没有 toast、没有撤销,而用户按下去时期待的是打勾。

**改动**(视图):
- `restoreOne` 更名 `onExcludedTileClick`,首行 `if (selecting.value) return`;
- 瓦片加 `:data-inert="selecting"`,并配两条 CSS:选择模式下 `cursor: default`,且 hover
  不再浮出「恢复」提示 —— 否则提示还在邀请一次现在被故意忽略的点击,读起来像页面坏了;
- 文件头**偏离登记新增第 6 条**,写清 Vue2 出处、为什么不照抄、为什么已排除资产也不该变成
  可选(选择模式在这一页只通向「从此视图移除」,而它们本来就已经不在视图里)。

样式约束自查:两条新规则不含任何颜色;CSS 注释里没有 `*` 紧贴 `/`。

### Finding 5(Minor)·「忙」与「什么都没变」返回同一个值

**结论:成立。** 三个 store 写动作的守卫是 `if (!assetIds.length || assetBusy.value)`,
空列表与被 busy 丢弃返回同一个值,视图分不出来 —— 一次根本没发出去的 `pinAssets` 仍然会弹
`已钉住 0 张到此视图` 并**关闭 picker**,把用户刚挑的一批照片一起丢掉。

**改动**(store `src/photos/stores/smartViews.ts`):把两个守卫拆开,busy 在**前**并返回
`null` 哨兵,空列表仍返回真实的零:

| action | busy(丢弃) | 空列表(真零) |
|---|---|---|
| `pinAssets` | `null` | `0` |
| `removeAssets` | `null` | `{ unpinned: 0, excluded: 0 }` |
| `restoreAssets` | `null` | `0` |

返回类型相应放宽成 `Promise<number \| null>` / `Promise<{…} \| null>`。全仓消费方只有
`PhotosSmartViewDetail.vue` 一处(已 grep 确认,相册的 `removeAssetsFromAlbum` 是另一个 store
的同名近似方法,不受影响),三处调用点各加一行 `if (… === null) return`:
- `onPickPhotos`:不弹 toast、**不关 picker**(选择留着);
- `removeSelected`:不弹 toast、**不清选择**;
- `onExcludedTileClick`:不重拉(什么都没发生,没有可刷新的东西)。

### Finding 6(Minor)· 拉取失败会删掉整个「已排除」分区

**结论:成立,且两个约束不冲突 —— 守卫完整保留。**

原实现在 await 之前无条件 `excluded.value = []`,只在成功路径回填,所以一次瞬时 500 会让整条
「已排除(N)」band 消失,而服务端上排除项还在,界面上没有任何信号。

**改动**:把清空改成**仅在 id 真的变了**时才做(这本来就是它唯一需要成立的场景 —— 免得 A 视图
的排除项挂在 B 视图的标题下面,同 `loadDetail` 的既有理由)。新增模块级 `let excludedFor = ''`
记录当前屏上这份列表属于哪个视图;同一视图的重拉不再清空,失败因此原样保留上一份。

**staleness 守卫未受任何影响**:拦截迟到旧响应的是 `excludedSeq`,一行没动。两者回答的是不同
问题(「这个响应还要不要」vs「上一个视图的数据能不能留在屏上」),不构成取舍。已用两条用例
分别钉住:同视图重拉失败保留旧列表 / 换视图时**在新列表回来之前**就已经清空。
`__resetForTest` 一并复位 `excludedFor`。

### Finding 7(Minor)· 选中高亮守卫没检查可达性

**结论:成立。** `PhotosMomentDetail.selectionHighlight.test.ts` 只 regex 选择器里有没有
`.tile` 和 `[data-selected]`,而实际规则是 `.sv-grid-photos .tile[data-selected="true"]` ——
把模板里的容器类改名,高亮静默失效而用例照绿。

**改动**:容器类不再靠猜或写死,**从渲染出来的 DOM 取**(`tile.parentElement.classList`),
再要求命中的规则选择器里至少包含其中一个类;顺带断言瓦片自己确实带 `.tile`、以及它确实坐在
一个有类名的容器里。这样模板改名 ⇒ DOM 类变 ⇒ 选择器不再包含它 ⇒ 变红。

---

## 四个覆盖漏洞

1. **钉住的 toast** 原来只有 `expect(show).toHaveBeenCalled()`。现在照 moment 详情页同类用例
   的做法:`toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(zh.photosSvPinnedNToView
   .replace('{n}','2'))`(计数取自 store 返回值 2,而不是挑中的 id 个数),并顺带断言 picker
   确实关闭。为此在该测试文件里 `import zh from '../i18n/zh_cn'`。
2. **分层移除的求和**原来全仓无断言 —— 把 `r.unpinned + r.excluded` 改成只 `r.unpinned`
   整套用例照绿。新增 `confirms with both removal tiers added together`:`{unpinned: 2,
   excluded: 3}` 两层都非零且互不相等,断言 toast 是 `已从此视图移除 5 张`。
3. **`Array.isArray` 守卫**原来只喂过 `undefined`(那用 `?? []` 也能过)。新增
   `getSmartViewExcluded rejects a truthy non-array body`,遍历 `{items:[…]}` /
   `{message:'not found'}` / `'oops'` / `42` / `true` 五种真值非数组 —— 即注释里写的那种
   「信封或错误体直达调用方,下游 `.map()` 当场 TypeError」的形状。
   (已核对 `photos.ts` 的 `body()`:这五种都不带 `success: number`,会原样透传到守卫处。)
4. **`assetBusy` 互斥原来一个用例都没有**。新增 `describe('assetBusy mutual exclusion')` 三条:
   一次挂起的 `pinAssets` 在途时,三个动作**全部**返回 `null` 且都没发请求、释放后在途那次仍
   返回正确值且标志复位、之后还能正常写;空列表仍是真零(与 `null` 区分开);失败路径也会复位
   标志。

---

## 结构性修复 · 开源剥离清单的漏登记(已复发四次)

清单 `oss/manifest.mjs` 是逐文件枚举,四次有新测试文件没被登记,每次都由最慢的那道门
(`oss/tree.test.mjs` 的泄漏守卫,先导出再扫描)在整轮末尾报 `Cannot find module` 才发现 ——
那句报错读起来完全不像「你漏了一行清单」。所有关键词守卫对这类漏登记**结构性失明**:它们扫的
是**产物树**里有没有泄漏词,而一个压根没被剥离的文件要么表现为别处一堆词命中、要么(文件里
恰好没有清单词时)什么都不表现。

**保留枚举**(它给的是反方向的陈旧检测:清单里列了但磁盘上没有的路径会让导出退出 1),
**补上缺的那个方向**:新增 `oss/photosStripCoverage.test.mjs`,读 `src/views`、
`src/views/__tests__`、`packages/service/src` 三个目录,凡 basename 命中 `/photo/i` 而不在
对应 `DELETE` / `SERVICE_DELETE` 里的,失败并**同时报出文件名和该加进哪张表**,失败信息直接
给出可粘贴的 `'path',` 行。覆盖判定同时接受精确条目与目录条目前缀(清单两种形式都在用)。
每个 case 还断言「至少找到一个 photo 文件」——一道找不到东西可查的守卫不算通过。

`src/photos/**` 不在扫描范围:清单用一条 `'src/photos'` 整目录删除,那里新建文件天然被覆盖。
`oss/` 自己整体不进产物树,所以这个新文件本身无需登记。

---

## 四次删码验证(全部实测,逐条恢复原状)

| # | 删/改什么 | 期望 | 实测 |
|---|---|---|---|
| 1 | 路由 watcher 里删 `selectedIds.value = []` | 红 | ✅ `× drops the selection and closes the picker when the route id changes` — 1 failed \| 19 passed |
| 4 | `onExcludedTileClick` 删首行 `if (selecting.value) return` | 红 | ✅ `× an excluded tile does nothing while in selection mode` — 1 failed \| 19 passed |
| 5 | store 把两个守卫合回 `if (!assetIds.length \|\| assetBusy.value) return 0` | 红 | ✅ `× drops a second write while one is in flight, and says so with null rather than a zero` — 1 failed \| 35 passed |
| 新守卫 | `manifest.mjs` 删掉 `PhotosMomentDetail.selectionHighlight.test.ts` 与 `photos.smartviewAssets.test.ts` 两行 | 红 | ✅ 2 failed \| 1 passed,失败信息逐条点名文件与目标表 |

**另外三条顺带做的删码验证**(不在要求清单里,但值得记):

| 删/改什么 | 实测 |
|---|---|
| 视图删掉两处 `if (n === null) return` / `if (r === null) return` | ✅ 2 failed(picker 那条 + 移除那条) |
| store 把 `loadExcluded` 的条件清空改回无条件 `excluded.value = []`(finding 6) | ✅ `× keeps the loaded list when a refetch of the same view fails` — 1 failed \| 15 passed |
| `PhotosMomentDetail.vue` **只在模板里**把 `sv-grid-photos` 改名 `mo-photo-grid`(样式块不动,finding 7) | ✅ `× carries its own [data-selected="true"] rule reachable from the grid class the template renders`,报错原文 `…under any of mo-photo-grid` |

---

## 门(全部实测输出)

```
$ pnpm exec vitest run src/views/PhotosSmartViewDetail.assets.test.ts \
    src/views/__tests__/PhotosSmartViewDetail.test.ts \
    src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts \
    src/photos/stores/__tests__ \
    packages/service/src/photos.smartviewAssets.test.ts \
    src/i18n/parity.test.ts --reporter=verbose
 Test Files  16 passed (16)
      Tests  452 passed (452)

$ pnpm exec vue-tsc --noEmit
(无输出,退出 0)

$ pnpm exec vitest run src/styles
 Test Files  4 passed (4)
      Tests  1075 passed (1075)
# 与评审给的「1084 with parity」一致:1075 + parity 9 = 1084。
# 已用 git stash 做过改动前/后对照,两侧同为 1075 ⇒ 本波对样式门零影响。

$ pnpm exec vitest run src/i18n/parity.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)

$ pnpm exec vitest run oss                      # 提交之后跑(见下方注意事项)
 Test Files  21 passed (21)
      Tests  472 passed (472)

$ pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts \
                        src/views/__tests__/PhotosAlbumDetail.test.ts
 Test Files  2 passed (2)
      Tests  53 passed (53)                     # finding 3 未波及相册两页

$ pnpm exec vitest run                          # 额外做的全量,要求清单里没有
 Test Files  683 passed (683)
      Tests  10862 passed (10862)
```

**注意事项(踩到并记下)**:`pnpm exec vitest run oss` 在工作树脏的时候会失败 ——
`oss/export-rsync.test.mjs` / `tree.test.mjs` 会真的调 `export.mjs`,而它见到未提交改动就
`[oss] 失败:… 工作树不干净,导出中止`。脏树下的结果是 `3 failed | 399 passed | 70 skipped`,
**这不是代码问题**。这道门必须在提交之后跑。另外该轮 stderr 里的
`Not implemented: navigation (except hash changes)` 是既有噪声,不是失败。

---

## 改动的文件

| 文件 | 内容 |
|---|---|
| `src/photos/stores/smartViews.ts` | finding 5(三个动作的 `null` 哨兵 + 类型放宽)、finding 6(`excludedFor` + 条件清空 + `__resetForTest`) |
| `src/views/PhotosSmartViewDetail.vue` | finding 3(静态 submit label,删 `pickerSubmitLabel`)、finding 4(`onExcludedTileClick` + `data-inert` + 两条 CSS + 文件头偏离登记 6)、finding 5(三处 `null` 早退) |
| `src/i18n/zh_cn.photos.ts` | finding 2(`加照片` → `添加照片`,注释改写为登记) |
| `src/views/PhotosSmartViewDetail.assets.test.ts` | finding 1(重入选择模式)、finding 3(断言静态标签)、finding 4(新用例)、finding 5(两条视图侧新用例)、钉住 toast 与分层求和两个覆盖洞 |
| `src/photos/stores/__tests__/smartViews.assets.test.ts` | `assetBusy` 互斥三条新用例、finding 6 两条新用例、原「失败留空」用例改名以区分首拉与重拉 |
| `packages/service/src/photos.smartviewAssets.test.ts` | `Array.isArray` 真值非数组用例 |
| `src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts` | finding 7(容器类取自渲染 DOM) |
| `oss/photosStripCoverage.test.mjs` | **新增**,剥离清单的反向覆盖守卫 |

另:按约束 7 删掉了工作树里出现的 `.superpowers/sdd/.gitignore`(内容是单独一行 `*`)。它是
未跟踪文件,而 P2a 台账目录里的文件早已入库,所以这次没有造成实际丢失 —— 但它正是「20 份台账
静默不入库」那条记忆里的同一个陷阱,已按约定删除且不重建。

---

## 遗留与担心

1. **`photosAlbumPickerAdd` 在本页不再被引用**,但相册两页仍在用,键保留不动。
2. **finding 4 的「不可选」是设计判断,不是 Vue2 的行为**:已排除资产在选择模式下既不恢复也
   不可选。理由写在偏离登记里(选择模式在这一页唯一的去向是「从此视图移除」,而它们已经不在
   视图里)。若日后要给已排除项加批量恢复,这条登记就是该改的地方。
3. **finding 6 的 `excludedFor` 是模块级 `let`,不进 state**,与 `excludedSeq` 同体例。它只
   影响「要不要在 await 前清空」,不参与渲染,所以刻意不做成 ref。
4. **`assetBusy` 的 `null` 哨兵靠调用方自觉**。目前消费方只有一处、三个调用点都已处理,类型
   上 `number | null` 也会让新调用点在 `vue-tsc` 下暴露;但它终究是约定而非强制。
5. **本波的真机验收挂账未动** —— 全部改动都是逻辑与守卫层面,没有部署、没有推送。设备上
   smart view 的 `excluded` 需要移除一张**自动匹配**的资产才产生,而测试设备上所有智能视图都是
   semantic/paused/从未评估过(见测试文件头的既有说明),finding 4 / 6 的真机路径在当前设备上
   仍然复现不了。
