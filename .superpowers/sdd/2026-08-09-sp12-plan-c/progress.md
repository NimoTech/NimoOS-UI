# SP12 Plan C 执行台账 —— T9 加载健壮性 + T11 网格虚拟滚动

- 分支:`sp12-plan-c`,工作树 `.claude/worktrees/sp12-plan-c`
- 起点:本地 `master` **4d8485b**(**不是** `origin/master` 0a7e6fb —— 后者落后 100+ 提交、不含 Plan A)
- 计划:`docs/superpowers/plans/2026-08-09-sp12-plan-c-load-robustness-grid-virtualization.md`
- 状态:**编码全完成,五道收尾门全绿;2026-08-09 已快进合入 master(`fde639e`);未部署、未推 origin**
- **验收:机主 2026-08-09 明示先不验收,dev server(5290)已关,9 步清单挂账,等 SP12 各线做完统一验。**

---

## 1. 范围是怎么定的

挂账文档 `2026-08-09-sp12-plan-a-outstanding.md` 列了 6 个剩余任务(T1/T7/T8/T9/T10/T11)。
并行的两条线:`.claude/worktrees/ai-catchup`(SP14 AI)、`.claude/worktrees/sp12-plan-b`
(T1/T7/T8 冲突弹窗链)。本线取**独立三条**里的 T9 + T11。

**机主 2026-08-09 两处拍板:**
1. T9 的「RAID 用量兜底」在 New-UI 没有宿主界面 → **连侧栏磁盘用量显示一起补**。
2. T10 → **不做,但要记清楚为什么不做、没做什么** → 交接票
   `docs/superpowers/2026-08-09-sp12-t10-progress-merge-handoff.md`。

---

## 2. 开工前的代码级取证(spec 与实际代码对不上的四处)

spec §5 把 T9 写成四个子项。逐条到 New-UI 里核,只有一条是照抄就能落地的:

| spec 子项 | 实际 | 本期怎么处理 |
|---|---|---|
| `retryRequest` 侧栏列表重试 | ✅ 确实缺(`src/home/stores/folders.ts:46` 一 catch 就清空) | 照搬 |
| 骨架屏卡死 | ⚠️ **New-UI 根本没有骨架屏**,`files.loading` 有值但没有模板在用 | 改做同源病灶:默认目录解析不出来就永久空白(Task 3) |
| RAID 用量兜底 | ⚠️ **侧栏零用量显示**,兜底无处可挂 | 按机主拍板连宿主界面一起补(Task 4/5/6) |
| 错误文案归一化 | ⚠️ **压根没有错误面**,`files.ts` catch 里只 `console.warn` | 先建错误面,再归一(Task 2) |

**顺带查实的连锁**:`loadDisks` 失败 → `disks=[]` → `defaultRootReal()` 返 `''` →
`Files.vue:351` `if (!rootReal) return` → **整个文件页永远空白、无报错、无重试**。
这是 New-UI 版的「Location 永久全空 + 卡死」,前两条其实是一条。

**真机 fixture(2026-08-09 curl 本机,逐字记在 `diskUsage.test.ts` 顶部)**:
`/v1/storage?system=show` 的 `size/avail/used` 是**字符串**、系统盘 `mount_point` 是 `/`;
`/v2/raid` 返回 **`[]`**。

---

## 3. 逐任务结果

| # | 任务 | 提交 | 变异验证 |
|---|---|---|---|
| 1 | retryRequest + 接进 loadDisks | (见下) | ✅ 拆掉重试 → 2 条红 |
| 2 | 错误文案归一 + 错误面 | | ✅ 去掉 `error.value=` → 2 条红 |
| 3 | 默认目录兜底 | | ✅ 换回旧的 `if (!rootReal) return` → 1 条红 |
| 4 | RAID 兜底纯函数 | | 纯函数,4 例 |
| 5 | 磁盘用量 store | | 9 例(含真机 fixture 那条) |
| 6 | 用量悬浮窗 + 侧栏接线 | | ✅ 删 `@click.stop` → 1 条红 |
| 7 | 虚拟化纯函数 | | 10 例 |
| 8 | 框选几何矩形 | | 6 例(含喂 `marqueeSelect` 的端到端例) |
| 9 | FileGridView 虚拟滚动 | | ✅ 可视窗口换回全量 → 2 条红,且用时 54ms→6194ms |
| 10 | Files.vue 接网格几何 | | ✅ 强制走量 DOM → 1 条红 |

提交序列(`4d8485b..`):

```
1022d7e docs(sp12): implementation plan for Plan C (load robustness + grid virtualization)
0bea576 fix(files): retry the storage list instead of blanking the sidebar
f4faad7 test(home): wait for the context menu portal instead of one microtask flush
6785501 feat(files): surface directory load failures instead of faking an empty folder
3c8d50e fix(files): land on /DATA rather than a blank page when disks are unknown
11a2960 feat(files): map RAID status onto the sidebar space shape
23abf9f feat(files): add the sidebar disk usage data source
999b0da feat(files): show disk usage in the sidebar behind a hover affordance
3e0a5e2 test(home): close the context menu before tearing it down
44bf095 test(home): stop wiping document.body in the context menu teardown
090ea9c feat(files): add the pure geometry for grid virtualization
d23032f feat(files): derive marquee rects from grid geometry
65ba1f3 perf(files): virtualize the grid view by row
45b3c91 fix(files): source marquee rects and highlight scrolling from grid geometry
```

---

## 4. 收尾门(控制器亲自跑,数字是实测)

| 门 | 结果 |
|---|---|
| `pnpm test` | **654 文件 / 10481 例全过**(基线 4d8485b 实测 644/10408) |
| `pnpm exec vue-tsc --noEmit` | clean |
| `pnpm exec vitest run src/i18n/parity.test.ts` | 9/9 |
| `pnpm build` | ✓ built in 31.58s |
| `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss` | 零真实泄漏(3 个二进制预期内跳过) |

**⚠️ 一次未能归因的间歇失败**:收尾阶段第一次全量跑出过 `1 failed`(654 文件中 1 个),
当时管道只留了 tail,**没抓到是哪条**;随后连跑 4 次全绿。**不当作已解决**,下次跑全量
若再现,立刻 `pnpm test > 文件 2>&1` 落盘取证。

---

## 5. 本期最值钱的四条教训

1. **全量测试必须在工作树干净时跑。** `oss/export.mjs` 拒绝在脏树导出(`--allow-dirty-oss`
   只放行 `oss/` 自己),于是 `oss/*.test.mjs` 三个文件会整体失败。我第一次是「先跑全量后提交」,
   白白追了一轮假故障。**顺序应为:先提交,再跑全量。**
2. **「时序问题」是个太顺手的解释,要用证据推翻它。** `DesktopContextMenu.test.ts` 在全量里红、
   单独跑绿。我第一版按超时处理(轮询等 portal),**碰巧绿了一次**,下一轮又红。加诊断打印
   `document.body` 才看到真相:触发器是 `data-state="closed"`、teleport 是空的 ——
   **菜单根本没打开**。根因是 `afterEach` 里的 `document.body.innerHTML = ''` 把开着的 portal
   从 reka-ui 的全局层状态底下抽走,下一次挂载因此拒绝打开。改成「先按 Esc 让它自己收、再
   unmount、不抹 body」才真修好(顺带消掉了一个 `insertBefore` on null 的未处理拒绝 ——
   那也是这行抹除造成的)。**挂账文档里「只在单独跑那一个文件时失败」的记载是错的,正好相反。**
3. **断言要落在结果上,不在内部调用上。** 框选那条测试第一版 spy `itemRects` 被调用,红了 ——
   而且第一次红的原因还不是功能问题,是 `wrap.trigger('mousemove')` 根本到不了装在 `window` 上的
   监听器。改成断言「网格模式选中 >0、列表模式选中 0」(jsdom 无布局 ⇒ 量 DOM 全是 0×0 矩形,
   天然是判别式),既测到真行为,又不依赖内部方法名。
4. **token 名相同 ≠ 视觉效果相同。** 进度槽本想复用 `--chip-bg`,但它在纸感主题是纯白
   `#ffffff`,刷在同为白底的浮层上等于不可见。新增 `--usage-track` 并在两个主题块都给值。
   (同一隐患在 `UploadPanel.vue:284` 的 `.up-progress` 上仍在,已写进 T10 交接票 §5。)

---

## 5.5 合并(2026-08-09)

**已快进合入 master:`4d8485b` → `fde639e`**(master 当时未被其它会话推进,故是纯快进,零冲突)。
主工作树那 3 个 `design-export` staged 删除与 `oss/*` 改动(别人的活)**未受影响** —— 本分支
与它们零交集(合并前 `git diff --name-only 4d8485b..HEAD | grep -E '^(oss/|design-export/)'` 为空)。

**与 sp12-plan-b 的先后顺序:实测无影响。** 合并前用 `git merge-tree --write-tree sp12-plan-c
sp12-plan-b` 做过只读三方预演,**git 退出码 0、无冲突段 ⇒ 两条线可无冲突合并**。
共享文件恰好 4 个,改的是不同区域:

| 文件 | Plan C 改了什么 | plan-b 改了什么 |
|---|---|---|
| `src/i18n/zh_cn.base.ts` / `en_us.base.ts` | 追加 6 个键(加载失败/重试/容量四条) | 追加冲突弹窗的键 |
| `src/styles/theme.css` | 新增 `--usage-track`(两个主题块) | 冲突弹窗相关 token |
| `src/views/Files.vue` | 错误条、默认目录兜底、`gridRef` + 框选分流、高亮按行滚 | 冲突弹窗接线、`unloadGuard` 移走 |

> ⚠️ **无文本冲突 ≠ 合并结果已验证。** 两条分支各自的全绿只覆盖自己那半;
> **后合的一方必须在合并结果上重跑全套门(全量 + vue-tsc + parity + build + oss)**,
> 不能拿分支上的绿数交差。plan-b 合的时候记得。

> 顺带:plan-b 已经把 Plan A 挂的两张后续票做掉了(`ba24ee3` unloadGuard 移到 App 级、
> `59e4f7c`/`9a16076` 死 tus URL 循环),交接时别重复开票。

---

## 6. 欠的:真机验收 9 步(一步没跑 —— 机主 2026-08-09 明示先不验,等统一验)

验收 = `pnpm dev --host --port 5273`(**不是** `deploy.sh` —— 本期不是 cutover 期)。
⚠️ 5273 是 master 那条线的端口;本期曾起在 5290,**已按机主要求关闭**。

1. 侧栏磁盘行悬停 → 出现 `⋮`;鼠标移上 `⋮` → 弹出用量窗:「已用 x / y」+ 进度条 + 百分比 + 可用。
2. 点 `⋮` **不会**跳转目录。
3. **浅色和深色都要看**用量窗(颜色走 token,jsdom 照不出)。
4. 地址栏改 `#/files/xxx` 进不存在目录 → 出现红色错误条 + 后端真实错误文本,点「重试」重新加载。
5. DevTools 置 Offline 后刷新 → 侧栏磁盘列表不再一次判死(约 4 秒内重试);仍失败则文件页落到
   /DATA 而**不是空白**。
6. 造大目录(`for i in $(seq 1 5000); do touch /DATA/bigdir/f$i; done`)→ 网格滚动流畅;
   DevTools Elements 里 `.file-tile` 数量**远小于** 5000。
7. 在该目录里从顶部**拖框选到底部**(拖到边缘触发滚动)→ 屏幕外的文件也被选中(看选中计数)。
8. 深链 `#/files/<dir>?highlight=f4999` → 页面滚到该文件并闪烁。
9. **切到列表视图**重复第 7 条 → 框选照常(列表未虚拟化,走 DOM 路径)。

## 7. 挂账

- **RAID 用量兜底未经真机验证** —— 本机单盘,`/v2/raid` 返回 `[]`。仅单测覆盖。
  与 SP6「快照卷==RAID 阵列致单盘设备无法实盘验」同类约束,随多盘设备补。
- **T10 未做**,见交接票。
- **收尾门那次未归因的间歇失败**,见 §4。
- `UploadPanel.vue:284` 浅色主题进度槽疑似不可见,并入 T10 交接票 §5,未单独开票。
