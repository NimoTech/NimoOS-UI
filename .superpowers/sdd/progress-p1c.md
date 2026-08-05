# SP4-P1c 缩略图/面包屑/侧栏/ext合并 — 进度台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-02-vue3-migration-sp4-p1c-thumbs-breadcrumb-sidebar.md
Spec: NimoOS-UI/docs/superpowers/specs/2026-07-02-vue3-migration-sp4-p1c-thumbs-breadcrumb-sidebar-design.md
Repo: NimoOS-New-UI, branch master, BASE 141f378 (= P1b 完成点)
执行: subagent-driven (implementer=haiku 新文件转写 / sonnet 改存量文件; reviewer=sonnet; 终审=opus)

前置事实(勿忘):
- 100% 前端,不改共享包(收藏走 service.users.getCustomStorage/setCustomStorage,缩略图走 service.image.thumbUrl)→ 无需 pnpm install。
- 收藏 blob 与 Vue2 同键,存 {name, 真实路径},导航时才 toVirtualPath 转虚拟;绝不写虚拟路径进 blob。
- 测试演进护栏:FileRow.test 在 T2(stub FileThumb)+T4(stub FavoriteStar)各更新;Files.test 在 T7 扩 service mock(users+image)+IO fake。
- 测试基线: P1b 后 154 passing。

- [x] Task 1: util/ext.ts + IMAGE_EXTS,合并 icons/store/FileRow 三处 ext — complete (commit d746f61, review clean;三处重复全除、fileExt 精确、IMAGE_EXTS 正确、行为不变)
- [x] Task 2: isImage + useInView + FileThumb,接入 FileTile/FileRow(+FileRow.test 更新) — complete (commit 14f4869, review clean;showThumb 门控严密、错误回退、IO 降级+清理、尺寸类保留全过)
- [x] Task 3: stores/favorites.ts(Vue2 兼容 + moveItem) — complete (commit dea748b, review clean;纯函数/去重/null容错/错误隔离/真实路径存储/每变更持久化 全对)
- [x] Task 4: FavoriteStar + 悬停接入 FileRow/FileTile + FileListView 表头对齐列 — complete (commit 81f456b, review clean;.stop/列对齐 0 0 32px 两侧一致/真实路径切换/:deep 揭示/FileRow.test stub 全过)
- [x] Task 5: Breadcrumb.vue — complete (commit aafeff6, review clean;纯展示、虚拟路径累积正确、emit 不含 /DATA、FavoriteStar 接真实路径)
- [x] Task 6: FilesSidebar.vue — complete (commit 70b25d3, review clean;虚拟路径 emit/.stop 删除/拖拽接线/只读磁盘/空态/高亮 全过)
- [x] Task 7: Files.vue 布局集成 + i18n + 全量 + build — complete (commit 06d285c,全量 177/177 + build 干净;P1a 管线保留、虚拟路径完整、favorites.load 非阻断、布局结构齐)
- [x] Task 8: 部署 /app/ + 真机验收 — 已 build + deploy(bundle index-BeGF_z53.js);**用户已眼验通过(2026-07-02,无问题)**。

## 状态:P1c 完成(2026-07-02),全 7 任务 done + 终审 Ready to merge + 用户验收通过。HEAD=06d285c。下一步 P1d 多选。

## 终审(opus, 全支 141f378..06d285c, 7 commits): **Ready to merge**
- 0 Critical / 0 Important。跨任务接口一致、路径安全双向零泄漏(收藏 blob 只进真实路径=Vue2 互通、router 只收虚拟路径)、ext 三处合并彻底(grep 确认无第 4 份)、缩略图门控正确。
- 全量 177/177 + build 干净。
- 7 条 Minor 全部 defer 到 P1d(纯 cosmetic/test-only,不影响运行时/互通/路径安全)。

## Minor findings (for final review) — 终审裁定全 defer 到 P1d
- T1 ext.test 无 `fileExt('')` 空串边界用例(安全返回'',非阻断)。
- T1 副作用(正面):FileRow 类型列对无扩展名文件(Dockerfile)现显 "dockerfile"(spec 指定,顺带修 P1b 类型列不一致)。
- T2 useInView `if(inView.value) return` 挂载时不可达(无害死码)。
- T3 测试覆盖缺口(实现均已验证正确):reorder 未断言 persist、moveItem 只测 from 越界一种、add 未断言 dedup 调用次数。
- T4 空 `.col-star` 表头格继承 `.head-cell` 的 `cursor:pointer`(非交互却显手型,cosmetic)。可 T7 顺加 `.col-star{cursor:default}`。
- T5 覆盖/UX 小项:无空路径用例、当前(末)段仍可点触发导航到自身、测试未断言 FavoriteStar 的 path/name props。
- T6 小项:disk-click 测试靠「收藏空→index 0 是磁盘」的脆弱假设;收藏项图标恒用 folder-default(不区分 USB,cosmetic);reorder drop 无测试(jsdom 限制,设计接受)。
