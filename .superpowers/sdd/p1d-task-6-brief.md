### Task 6: 部署 `/app/` + 交付真机验收

- [ ] **Step 1: 构建 + 部署**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && bash scripts/deploy.sh`
(内含 `pnpm build`;若沙箱拦截活设备写入,交用户以 `! bash scripts/deploy.sh` 自行部署。)

- [ ] **Step 2: 冒烟自检**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost/app/`
Expected: `200`

- [ ] **Step 3: 交付用户真机验收(眼验清单)**

浏览器强刷 `http://localhost/app/#/files`,确认:
- **复选框**:文件/文件夹悬停出复选框,勾选=选中(行/卡高亮);已选项复选框常显。
- **Ctrl/Cmd + 单击**:切换该项选中(不导航)。
- **Shift + 单击**:从上次点击项到当前项范围选(按当前排序序)。
- **普通单击**:文件夹仍进子目录(不被多选干扰)。
- **框选**:在空白区按住拖拽出选框,框到的项被选中;松手结束。
- **工具栏**:选中 ≥1 时顶部出「已选 N 项 + 全选 + 清空」;全选=选中当前目录全部;清空=取消。
- **进入子目录 / 换目录**:选中自动清空。
- **回归**:缩略图/面包屑/侧栏/收藏★/排序/视图切换/列对齐(复选框列未破坏对齐)均正常。

> ⚠️ jsdom 测不了的项(框选拖拽几何、复选框悬停时机、Shift 跨滚动范围)以真机为准。批量操作(删除/下载/等)不在 P1d,选中目前无「可执行动作」——那是 P2。

## Self-Review

- **Spec 覆盖**:§3.1 store 选中=T1;§3.2 marquee 纯函数=T2;§3.3 复选框+修饰键=T3;§3.4 视图转发=T3;§3.5 SelectionToolbar=T4;§3.6 Files.vue 接线+框选=T5;i18n=T4;交互模型表全覆盖;§5 不做项不实现。
- **Placeholder 扫描**:无 TBD;每 code step 给完整代码/命令/期望。
- **类型/命名一致**:`select` 事件 payload `{entry, mode:'toggle'|'range'}` 在 FileRow/FileTile(T3)→ FileListView/FileGridView 转发(T3)→ Files.vue `onSelect`(T5)一致;`selectedPaths:Set<string>` prop 在视图(T3)← Files.vue 传 `files.selected`(T5);store `toggleSelect/selectRange/selectAll/clearSelection/setSelection/selectedCount/allSelected/selected`(T1)被 Files.vue/工具栏消费;`marqueeSelect/rectFromPoints/ItemRect/Rect`(T2)被 Files.vue 用;class `.file-check`/`.row-check`/`.tile-check-box`/`.col-check`/`.selected`/`.selection-toolbar`/`.sel-all`/`.sel-clear`/`.files-listwrap`/`.marquee-box`/`data-path` 与测试选择器/框选查询对应。
- **列对齐**:FileRow 前导 `.file-check`(0 0 28px)+ FileListView 表头 `.col-check`(0 0 28px);`.col-name` 保留 `margin-left:40px`(对齐图标后名字)——与 P1b/P1c 对齐铁律一致。
- **测试演进**:FileRow.test 整体替换(加 select/checkbox/selected 断言,保留 open + 目录空 size 格);Files.test 追加选中用例,现有 5 用例不动(子件 selectedPaths 可选默认 undefined,`?.has` 安全,普通点击仍 open→导航)。
- **路径安全**:选中集合全用真实路径(`entry.path`);框选 `data-path`=真实路径;不涉及 router,虚拟路径不变。
- **导航即清空**:`load` 首行 `clearSelection()`;Files.test「进目录清空」由既有导航用例隐式覆盖 + T1 显式 `load` 清空用例。
- **不改共享包**:仅动 New-UI;无 `pnpm install`。
