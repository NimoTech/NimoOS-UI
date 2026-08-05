# SP4-P1d 多选 — 进度台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-02-vue3-migration-sp4-p1d-multiselect.md
Spec: NimoOS-UI/docs/superpowers/specs/2026-07-02-vue3-migration-sp4-p1d-multiselect-design.md
Repo: NimoOS-New-UI, branch master, BASE 06d285c (= P1c 完成点)
执行: subagent-driven (implementer=haiku 新文件 / sonnet 改存量; reviewer=sonnet; 终审=opus)

前置事实(勿忘):
- 100% 前端,不改共享包 → 无需 pnpm install。
- 普通单击仍导航;选择叠加复选框+修饰键。导航即清空选中(load 首行 clearSelection)。
- 选中集合用真实路径(entry.path);框选 data-path=真实路径。
- 列对齐铁律:FileRow 前导 .file-check(0 0 28px) 必须 + FileListView 表头 .col-check(0 0 28px);col-name 保留 ml:40。
- 框选纯函数 marqueeSelect/rectFromPoints 单测;DOM 几何真机验。
- 测试演进:FileRow.test 整体替换(T3);Files.test 追加选中用例(T5)。
- 测试基线: P1c 后 177 passing。

- [x] Task 1: filesStore 选中状态 + actions(+ load 清空) — complete (commit b282414, review clean 0 issues;return 完整/load 首行清空/Set 替换响应式/selectRange 退化路径/allSelected 守卫 全过)
- [x] Task 2: util/marquee.ts(marqueeSelect + rectFromPoints) — complete (commit 4a166f6, review clean 0 issues;归一化/严格相交/边缘排除全对)
- [x] Task 3: FileRow/FileTile 复选框+修饰键 emit select + data-path + .selected;FileListView col-check + selectedPaths;FileGridView selectedPaths;FileRow.test 更新 — complete (commit b721ab8, review clean;修饰键分支/checkbox @click.stop/列对齐 80px 两侧一致/P1c 保留/selectedPaths 转发/data-path 全过)
- [x] Task 4: SelectionToolbar + i18n — complete (commit 34df9bf, review clean 0 issues;i18n 3 key/命名插值/props+emits/按钮类 全对)
- [x] Task 5: Files.vue 接线(select 派发 + 工具栏 + 框选)+ 全量 + build — complete (commit ada2b98,全量 193/193 + build 干净;P1c 管线保留、onSelect 映射、框选守卫/清理、工具栏条件、Set 响应式 全过)
- [~] Task 6: 部署 /app/ + 真机验收 — 已 build + deploy;http://localhost/app/=200,served bundle=index-Cj1ioLbd.js(与本次构建一致)。**待用户浏览器眼验**(复选框/Ctrl/Shift/框选/工具栏计数全选清空/进目录清空/回归)。

## 终审(opus, 全支 06d285c..ada2b98, 5 commits): **Ready to merge**
- 0 Critical / 0 Important。跨任务 select payload/selectedPaths/store API/marquee 类型一致;交互不变量全 hold(普通点导航、修饰键/复选框选而不路由、@click.stop 挡导航+框选、导航清空选中、真实路径不进 router);列对齐未回归;框选守卫+纯函数已测。
- 全量 193/193 + build 干净。
- 2 条 Minor 全 defer 到 P2/later:见下。

## Minor findings (for final review) — 终审裁定全 defer
- 终审 Minor:Files.vue 框选 window 监听仅在 down 加/up 删,无 onBeforeUnmount 兜底——组件在拖拽中途卸载(极罕见:按住空白拖拽时导航离开)会泄漏 2 个监听。正常路径无泄漏。P2/later 顺加 `onBeforeUnmount(onMarqueeUp)`。
- T3 FileRow.test 掉了 open payload 断言(只断 truthy;沿 brief 测试规格)、checkbox 用 trigger('change') 未走 @click.stop 路径(代码已确认正确;brief 测试设计缺口)。
