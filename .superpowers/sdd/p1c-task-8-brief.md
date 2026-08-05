### Task 8: 部署 `/app/` + 交付真机验收

- [ ] **Step 1: 构建 + 部署**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && bash scripts/deploy.sh`
(`deploy.sh` 内含 `pnpm build`;若沙箱拦截活设备写入,交用户以 `! bash scripts/deploy.sh` 自行部署。)

- [ ] **Step 2: 冒烟自检**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost/app/`
Expected: `200`

- [ ] **Step 3: 交付用户真机验收(眼验清单)**

浏览器强刷 `http://localhost/app/#/files`,确认:
- **缩略图**:图片文件(网格卡 + 列表行)显示真实缩略图、懒加载(滚动进入才加载),非图片仍类型图标,损坏图回退图标。
- **面包屑**:顶部显示虚拟路径分段(如 `NimoOS-HD › Documents`),点任意段跳转;地址栏永远虚拟路径、无 `/DATA`。
- **面包屑 ☆**:点尾部 ☆ 收藏当前目录,再点取消;侧栏收藏区即时出现/移除。
- **悬停 ★**:文件/文件夹悬停出 ★,点击收藏/取消;已收藏项常显 ★。
- **侧栏**:收藏区(点击导航、× 删除、拖拽重排)、磁盘区(点盘根导航);当前所在高亮。
- **持久化**:刷新后收藏仍在(localStorage 无关,走后端 custom storage;与 Vue2 `/files` 收藏互通)。
- **回归**:视图切换/排序/进子目录/回主页仍正常;列表列对齐(P1b 修复未被星标列破坏)。

> ⚠️ jsdom 测不了的项(缩略图懒加载时机/容器布局、侧栏拖拽几何、★ 悬停),以真机为准(P2/P4c 塌陷血泪)。窄屏观感偏挤属已知(响应式=P8),此期不阻断。

## Self-Review

- **Spec 覆盖**:§3.1 ext合并=T1;§3.2 缩略图=T2;§3.3 收藏 store=T3、FavoriteStar=T4;§3.4 面包屑=T5;§3.5 侧栏=T6;§3.6 布局=T7;§3.7 i18n=T7;§4 收藏后端(零迁包)=T3 直接用 `service.users`;§6 各单元测试=各任务;部署验收=T8。§5 明确不做项不实现(正确)。
- **Placeholder 扫描**:无 TBD;每 code step 给完整代码 + 命令 + 期望。
- **类型/命名一致**:`fileExt`(T1)→ isImage(T2)/store format(T1)/FileRow(T1);`IMAGE_EXTS`(T1)→ isImage(T2);`Favorite{name,path}`/`moveItem`/`useFavoritesStore`(T3)→ FavoriteStar(T4)/FilesSidebar(T6);`FileThumb`(T2)→ FileTile/FileRow(T2);`FavoriteStar`(T4)→ Breadcrumb(T5);`FilesSidebar`/`Breadcrumb`(T5/6)→ Files.vue(T7);class `.file-thumb`/`.file-star`/`.col-star`/`.favorite-star`/`.crumb`/`.crumb-star`/`.files-sidebar`/`.side-item`/`.side-remove`/`.files-layout` 与各测试选择器对应。
- **测试演进护栏**:`FileRow.test.ts` 在 T2(stub FileThumb + 改图标断言)与 T4(stubs 加 FavoriteStar)各更新一次;`Files.test.ts` 在 T7 扩 service mock(users+image)+ IO fake + 新布局断言——每任务后全量保持绿。
- **路径安全**:收藏 blob 存真实路径(Vue2 兼容),所有导航经 `toVirtualPath`;Breadcrumb/Sidebar 测试显式断言 emit 不含 `/DATA`。
- **不改共享包**:T1–T7 仅动 New-UI;`service.users`/`service.image` 已存在,无需 `pnpm install`。
