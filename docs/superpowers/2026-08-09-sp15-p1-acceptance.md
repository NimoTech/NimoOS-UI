# SP15-P1 验收清单 —— Moments 整块已收官,真机验收未跑

**状态**:11 个任务全部编码完成,每任务一轮独立评审 + 7 轮修复轮全部关账。收尾五门 + color-guard 全绿。
**未部署、未推 origin、未合 master。真机验收一步没跑。**

分支 `sp15-photos-moments`,`8b09693..6eff313`,29 提交(其中 21 个代码提交)。
计划:`docs/superpowers/plans/2026-08-09-sp15-p1-photos-moments.md`
设计:`docs/superpowers/specs/2026-08-09-sp15-p1-photos-moments-design.md`
台账:`.superpowers/sdd/2026-08-09-sp15-p1-photos-moments/`(已入库,含 11 份简报 + 11 份实现报告 + progress.md)

收尾门(控制器亲自复跑,工作树干净时):

| 门 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | clean(exit 0) |
| `pnpm test` | **678 文件 / 10806 例全绿** |
| `pnpm exec vitest run src/i18n/parity.test.ts` | 9/9 |
| `node oss/export.mjs --out <tmp> --no-commit --allow-dirty-oss` | 零真实泄漏(DELETE 76 · REPLACE 4 · PATCH 258) |
| `pnpm build` | ✓ 17.09s(仅既有的 chunk-size 提示) |
| `pnpm exec vitest run src/styles`(color-guard) | 1075/1075 |

> **`oss` 门有个前置条件容易踩**:它断言工作树干净。台账 `progress.md` 只要有未提交改动,
> 这门就报 3 失败 + 70 跳过。先提交台账再跑,**不要 stash 绕过**。

产品文件:26 个,+4093/−95。

---

## 🔴 验收第 0 步(必做,否则下面每一步都只能看到空态)

**真机 `moments` 表是 0 行。** 785 张照片里只有 7 张带 GPS(`trip` 聚不出行程),
5 条 `theme:*` recipe 被 BE-1 卡死(CLIP 文本向量缺 `text.token_embedding.weight`),
只有 `profile:family` 有一个候选实体。所以先手动触发一次重算:

浏览器打开 `/app/`,登录后 F12 控制台执行:

```js
// 先看一眼 token 的确切键名
Object.keys(localStorage)

// 再发重算(键名以上一行实测为准)
await fetch('/v1/photos/moments/recompute', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('token')).access_token },
}).then(r => r.status)   // 期望 202
```

**必须走浏览器控制台,不能 curl** —— Photos 的 localhost 白名单是 fail-closed + 精确匹配,
只放行 `POST /search/smart` 与 `GET /albums`(`route/router.go` 的 `mcpReadSkip`),
curl 直打 `/moments/recompute` 必 401。

然后刷新页面。

## 🔴 第 1 行提示:分区整块不出现是**预期行为**,不是本期缺陷

Vue2 的 `showMoments()` 在 `moments.length === 0` 时隐藏整个 For You 分区,本期 1:1 照搬。
重算后如果 `/photos/smart-views` 顶部什么都没有,**先确认 `moments` 表是不是仍为 0 行**,
再判断是不是缺陷。**最好情况 1 条(家人),最坏 0 条。**

若重算后仍为 0 条,本期验收降级为「空态 + 数据层链路」可验,
**卡片形态与详情页两块整体挂账**,参照 SP14 `#136`/`#141` 的先例,不假装验过。

查表(设备上):

```bash
sqlite3 -readonly /DATA/.system_data/photos/photos.db \
  "select count(*) from moments; select count(*) from moment_assets;"
```

---

## 验收步骤

### A. 分区(`/app/#/photos/smart-views`)

1. **分区显隐**:有时刻时页面顶部出现「时刻 · 为你推荐」标题 + 副标题,下方是马赛克网格;
   0 条时整块不出现(见上方第 1 行提示)。
2. **门控**:去设置里关掉 AI 智能视图开关,回来确认分区消失(即使有时刻)。再打开恢复。
3. **分隔线**:分区出现时,下方「智能视图」hero 顶部应有一条分隔线;分区不出现时没有。
4. **五种拼贴形态**:标准卡(封面大图 + 右侧两张精选)、高卡(上大下双)、宽卡(横占两列)、
   两格(只有 1 张精选时封面与精选左右对半)、单图(无精选)。
   **需要多条时刻才看得全 —— 数据不足时这条挂账。**
5. **绿色徽标**:本周新增张数 > 0 的卡片右下角有绿色「本周 +N」。
6. **拖拽排序**:拖动卡片换位 → 松手 → **刷新页面确认顺序留存**。
   断网再拖,应弹红色「排序保存失败」toast 且顺序回滚。

> ⚠️ **窄窗口要专门看一眼**(评审挂的账,jsdom 照不出):`.mo-grid` 的
> `@media (max-width: 1055px)` 断点是从 Vue2 逐字抄来的,而 Vue2 算这个断点时页面**没有侧栏**,
> 本页有 `PhotosSidebar`。把窗口拉到 **1000–1150px 之间**,分别在侧栏展开/收起两种状态下看
> **宽卡有没有溢出或压塌网格**。这是本期唯一一条已知的、真机才能证伪的布局疑点。

### B. 详情页(点卡片进入 `/app/#/photos/moments/<id>`)

7. **深链冷启动**:复制详情页地址,**新开标签页直接粘贴访问**(不经过列表页)。
   页面应正常加载 —— 后端没有 `GET /moments/:id`,这条路径靠拉全量列表再按 id 查,是 New-UI 独有代码。
8. **乱填 id**:把地址里的 id 改成 `nonexistent`,应显示明确的「找不到这个时刻」,**不是空白页**。
9. **拉取失败态**:断网后访问详情页深链,应显示「加载失败」并带**重试按钮**,
   **不是**「找不到这个时刻」。恢复网络点重试,页面应正常加载。
   *(这是本期修掉的一个真缺陷:原来网络抖一下会被告知数据已删除。)*
10. **顶栏**:返回按钮回智能视图页;「最后更新」显示 `—`。
    **`—` 是正确的** —— 后端 `momentResponse` 根本不发 `updated_at`,Vue2 那边也一直是 `—`。
11. **右栏 About**:类型胶囊(行程/宠物/家人/主题)、时间窗、地点(多地点时取前三 `A · B · C +N`)。
    缺数据的行显示 `—`,**整行不隐藏**。
12. **右栏 Stats**:照片数、精选数、跨度(含头含尾的天数)、最后更新(同样是 `—`)。
13. **按月份直方图**:柱子按 `YYYY-MM` 升序;没有任何照片带拍摄时间时整个分节不渲染。
14. **两段网格**:Featured 段(有精选时才出现,标题带张数)+ All photos 段。
    manual 加入的照片在 Featured 里有 pin 角标。
15. **灯箱**:非选择态点瓦片打开灯箱。**点精选格应在精选列表里翻页,点全部格在全部列表里翻页**
    (这条是评审补的测试才守住的)。

### C. 写操作

16. **加入照片**:点「加入照片」→ 从库里选几张 → 确认。
    张数应在详情页**和列表卡片上同时**变化;弹成功 toast。已在时刻里的照片应是禁用/置灰状态。
17. **加入失败**:断网重试,应弹失败 toast,张数不动。
18. **移出照片**:点 Select 进选择态 → 选几张 → 点移出。
    成功后退出选择态并清空已选;**失败时保持选择态与已选不变**(让你能直接重试)。
19. **导出相册**:点「存为相册」→ 成功后 toast 带「打开」动作 → 点它应跳到新相册。
    导出进行中按钮应禁用(防重复点)。
    **重名时应给专门文案(「已有同名相册」),不是笼统失败。**
20. **删除时刻**:更多菜单 → 删除 → **先弹确认框,不直接删**。取消关闭;确认后删除并跳回智能视图页。
    **删除失败时留在原页,错误提示内联在确认框里、不自动消失** ——
    *(这是本期对 Vue2 的有意偏离:Vue2 是关框 + toast,那一两秒读起来像「删成功了」。)*
21. **点菜单外**应关闭更多菜单。

### D. 主题

22. **浅色与深色两套主题都要看一遍**(切 `data-theme`)。
    token 映射 jsdom 完全照不出,历史上 SP11 就是靠真机才发现浅色主题下整个界面被雾白的。
    重点看:橙色类型胶囊、绿色本周徽标、拼贴底部渐变遮罩上的白色徽标文字、拖拽态的虚线外框。

---

## 本期对 Vue2 的有意偏离(界面 1:1,逻辑改正确)

按机主 2026-07-27 立的规矩,Vue2 的 bug 不照抄、改正确并注释登记。逐条登记在
`src/views/PhotosMomentDetail.vue` 与 `src/photos/stores/moments.ts` 的文件头,摘要:

| 偏离 | 理由 |
|---|---|
| 删除失败改内联提示 | Vue2 关框 + toast,读起来像删成功了 |
| 拉取失败与「不存在」分开 | Vue2 无此路径(它是内联子组件,moment 靠 prop 传入) |
| `setOrder` 拒绝重复 id | Vue2 只比长度,`['m1','m1']` 会静默丢掉另一条 |
| 两个资产请求独立失败 | 原实现用 `Promise.all`,一个失败会丢掉另一个已到的数据 |
| 精选格越界不渲染空 `<img>` | Vue2 会发一次 src 为 undefined 的多余请求 |
| store 带过期守卫 | Vue2 只在 mounted 拉一次撞不上;路由化后回列表会再拉 |
| 移出操作加重入守卫 | Vue2 无,连点两下会并发发两次 |
| `AlbumLibraryPicker` 泛化但**不改名** | 改名属 `#79` 的一部分,随 `#79` 其余内容归 P2 |

---

## 已知挂账(不在本期修)

- **`PhotosMomentDetail.vue` 已 979 行**,Tasks 8/9/10 各往里加了一块。抽 grid 子组件是该做的,
  但不在最后一个功能任务里做 —— 那等于把四轮评审刚逐行核过的文件重写一遍。**独立票。**
- 成功删除的 toast 没有测试覆盖(实现者按 Vue2 补的,评审确认正确)。
- `doDelete` 成功路径不显式关确认框,靠页面 unmount。与 `PhotosSmartViewDetail` 的写法不对称。
- 切 `:id` 时 `moreOpen`/`confirmDeleteOpen`/`exporting` 不重置(页内没有触发路径)。
- `listError` 只被成功的 `fetchMoments` 清除,一次失败后同会话内真被删的时刻会显示「加载失败」而非「不存在」。保守但不算错。
- 徽标星形丢了 Vue2 的描边(`stroke-width: 1.6` + 圆角端点),9px 下是亚像素差异。
- `useAlbumDragSort` 的「默认值未变」测试只断言了 `ghostClass`,`itemSelector`/`chosenClass` 的回归它逮不住。
- `photosSelectedCount` 等 6 个键复用了既有键而非新增(Vue2 本身就是一个字符串喂两个 picker)。
