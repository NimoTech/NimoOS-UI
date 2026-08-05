# SP4-P1b 列表/网格+图标+排序 — 进度台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-01-vue3-migration-sp4-p1b-list-grid-icons-sort.md
Repo: NimoOS-New-UI, branch master, BASE 5fa7dc3 (= P1a 完成点)
执行方式: subagent-driven (implementer=haiku 转写/sonnet 集成; reviewer=sonnet; 终审=opus)

前置事实(勿忘):
- New-UI 用 pnpm file:../NimoOS-Service;本阶段不改共享包,故无需 pnpm install。
- 复用 P1a: filesStore.entries/FileEntry、pathUtils、FilesShell、Files.vue 的 openEntry(目录 push 虚拟路由,文件不处理)。
- 只复制 typeMap 用到的 ~31 个 SVG(清单在 plan Task 1),不搬全部 185。
- 测试全绿基线: P1a 后 141+ passing。

- [x] Task 1: 复制图标 SVG + icons.ts (iconNameFor/iconUrl, import.meta.glob) — complete (commits 5749464..67f7362, review clean; user拍板改成完全对齐 Vue2:ext()去 i>0 守卫 + 补 text-dockerfile + conf.d)
- [x] Task 2: format.ts (renderSize + dateFmt) — complete (commit 4665d29, review clean; 亲验对齐 Vue2 file_utils/mixin,port 的空/负/NaN 守卫是有益增强)
- [x] Task 3: filesStore 扩 viewMode/sort/order + sortedEntries(文件夹优先) — complete (commit 2ddf279, review clean;return 完整性/非破坏排序/文件夹优先方向无关/computed import 全过)
- [x] Task 4: FileRow.vue + FileTile.vue — complete (commit 5ddddd6, review clean;props/emit/类名/v-if 隐 size/token 样式全过)
- [x] Task 5: FileListView + FileGridView + Files.vue 接视图切换/排序头 + i18n — complete (commit 6b38102,全量 154/154 + build 绿;P1a openEntry/管线保留;改的 P1a 测试选择器 .files-row.is-dir→.file-tile 经审核合法=旧 DOM 已不存在,导航断言不变仍虚拟路径)
- [x] Task 6: 部署 /app/ + 真机验收 — 已 build + deploy;http://localhost/app/=200。**用户已眼验通过**,并提两处反馈,已修+重部署:
  - 验收 fix 1 (390184e):列表视图文件夹行日期/列不对齐 → 根因 flex 里文件夹把 .file-size 格整个 v-if 删掉,少了右侧 80px 格致日期右偏。改为文件夹保留 .file-size 格但留空(列结构与文件行一致→对齐表头);测试从「.file-size 不存在」改为「存在且空」。
  - 验收 fix 2 (tile 样式):网格 FileTile 默认去掉常驻玻璃卡片(background/border transparent),仅 :hover 显 --chip-bg;图标 56px→var(--app-size,64px) 对齐主页/Dock 图标。纯 scoped CSS。
  - 说明:文件夹不显示大小/类型是设计如此(P1b spec「目录不显 size」+ 文件夹无扩展名),与 Vue2 一致。

## 状态:P1b 完成(2026-07-02),全 6 任务 done + 终审 Ready to merge + 用户验收通过。HEAD=index bundle index-CYnXWo4e.js 对应最新 commit。

## 终审(opus, 全支 5fa7dc3..6b38102, 6 commits): **Ready to merge**
- 0 Critical / 0 Important。跨任务接线一致、图标集完备(31=21+9+unknown)、port 对齐 Vue2(含 last-match-wins dockerfile + 无守卫 ext)。
- 唯一 Minor: ext 逻辑三处重复(icons.ts ext() / store extOf / FileRow inline split),各自正确,→ P1c 合并整理。
- 5 条既有 Minor 全部 defer 到 P1c(见下,均无害/覆盖缺口/纯展示)。

## Minor findings (for final review) — 终审裁定全 defer 到 P1c
- T3 files.test.ts:51 用 `files.order`(非 .value)——靠 Pinia 自动解包,与 P1a 测试风格一致,可留。
- T3 date keyFn `new Date(e.date||0).getTime()||0` 末尾 `||0` 冗余(无害,风格)。
- T3 覆盖缺口:没测「换列排序 reset 到 asc」(toggle 路径已测)。
- T4 FileRow 格式列内联 `split('.')` 逻辑与图标 ext() 略不一致:Dockerfile/无扩展名类型格显示空、dotfile(.gitignore)显示 "gitignore"。纯展示、plan 指定的表达式;真机眼验类型列时留意。
- T4 FileTile 无独立测试(brief 只要求 FileRow.test);目录行未断言图标存在。
