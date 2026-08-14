# Files 区 6 个缺陷修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修掉机主报的 6 个 New-UI 文件区缺陷:收藏超量丢失、名称长度限制不一致、空文件夹上传、新建文件无长度校验、删除后收藏残留、面包屑多行。

**Architecture:** 四个互不重叠的改动面,按**文件归属**切分成 4 个可并行任务。收藏域(store + 删除同步 + 侧栏)归 Task 1;面包屑归 Task 2;名称长度与截断展示归 Task 3;上传选择器归 Task 4。任何任务都不得编辑不属于自己的文件 —— 四个任务在**同一个 worktree** 里并行执行,越界即产生写冲突。

**Tech Stack:** Vue 3 + `<script setup>` + Pinia + vue-i18n + vitest/jsdom + pnpm@9。后端为 NimoOS Go 服务(真机就在本机)。

## Global Constraints

- **工作目录:** `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/files-bugfix`,分支 `fix/files-bugs-batch`。不要 `cd` 回主仓。
- **包管理器:** `pnpm@9.0.6`。禁止 npm / yarn。
- **注释与 commit message 一律英文**(顶层 CLAUDE.md 硬要求)。对话与本计划保持中文。
- **中文文案以 Vue2 的 `NimoOS-UI/src/lang/zh_CN.json` 为准**,不要自己翻译;组件内联的 `zh:` 字段也要查。新增 i18n key 必须同时补 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`。
- **测试必须在前台跑**,不要丢后台。证据一律 `pnpm test --reporter=verbose <文件>`(默认 reporter 会吞掉通过用例的 stderr 告警)。
- **已知基线红:** `oss/cli-args.test.mjs`、`oss/export-rsync.test.mjs`、`oss/media-wave.test.mjs`、`oss/tree.test.mjs` 共 3 个用例在干净 HEAD 上就是失败的(开源导出工具的 manifest 锚点漂移),**与本批无关,不要去修,也不要把它算成自己引入的回归**。
- **异步写共享 state 必须带 epoch/uuid 守卫**(本仓评审已抓过四次)。
- **不要碰机主真实数据**:`/var/lib/nimoos/1/favorites.json` 是机主真实收藏(已备份到 `/tmp/claude-1000/-home-nimo-NimoTech/c2b28ef2-631d-49ee-835e-89f3977e84b1/scratchpad/favorites.json.bak`,内容 `[{"name":"test_folder","path":"/DATA/Documents/test_folder"}]`)。需要造数据一律用别的 key 或 CDP 拦截注入。
- **禁止 `git stash`**(与主仓共享 stash 栈)。要暂存改动就打 WIP commit。
- 每个任务结束时 commit,message 用英文祈使句,说明 *why* 而不是复述 diff。

---

## 已完成的取证(不要重复做)

Bug 1(收藏超量)已经排除的层:

| 层 | 结论 | 证据 |
|---|---|---|
| UserService 直连 | **无上限** | POST+GET `/v1/users/current/custom/favorites_probe`,N=100/500/900/1000/1100/1500/2000/5000 全部 `success=200`、`data` 是 list 且长度正确(最大 310 KB) |
| Gateway `:80` 转发 | **无上限** | 同上 N=1000/1100/1500/5000 全部 200,长度正确 |
| 后端读写实现 | 无截断 | `NimoOS-Common/utils/file/file.go` 的 `ReadFullFile` 是 `io.ReadAll`;`WriteToFullPath` 是 `O_TRUNC` 全量写。UserService/Gateway/Common 全仓 **零** `BodyLimit` |
| 前端 `unwrap` / axios 拦截器 | 无长度逻辑 | `packages/service/src/unwrap.ts`、`http.ts` 通读 |

**剩余嫌疑面在浏览器侧**。一个可用的 CDP 探针已经写好在
`/tmp/claude-1000/-home-nimo-NimoTech/c2b28ef2-631d-49ee-835e-89f3977e84b1/scratchpad/fav-browser-probe.mjs`,
用 `node --experimental-websocket <脚本> <N>` 跑(Node 20 必须带这个 flag)。它做了三件事:
拦截 `*custom/favorites*` 的**响应**并注入 N 条合成收藏;在**请求**阶段剥掉 `Authorization` 头
(带假 token 会 401,不带头才走 localhost 跳过 JWT 的路径);预置 localStorage 的
`access_token`/`refresh_token`/`version`/`user`。

**已知未解决的探针缺陷**:页面加载约 1 秒后应用会自己登出跳 `#/login`
(`onAuthFail` → `session.clear()` + `window.location.href = '/app/#/login'`,而这是 **hash 变化、不是新文档**,
所以 `Page.addScriptToEvaluateOnNewDocument` 不会重新注入),导致侧栏观察不到。
Task 1 需要先把这个探针弄稳(建议:在注入脚本里包住 `Storage.prototype.removeItem`,
对 `access_token`/`refresh_token`/`version`/`user` 四个 key 拒绝删除并打印调用栈)。

**一个值得优先验证的线索:** 1000 条合成收藏的 JSON 恰好是 62,001 字节,1100 条是 68,201 字节 ——
**64 KiB(65,536)边界落在 N=1057 与 N=1058 之间**,与机主说的"约一千多"高度吻合。
但注意:网络层已在 N=1100 证伪(POST/GET 都正常),所以如果 64 KiB 真是阈值,
它只可能出现在**浏览器侧**(而非 curl 侧)的某个环节。请把这条当**待证假设**而不是结论。

---

## Task 1: 收藏域 —— 超量丢失(Bug 1)+ 删除后残留(Bug 5)

**独占文件(其它任务不得触碰):**
- Modify: `src/files/stores/favorites.ts`
- Modify: `src/files/composables/useFileOps.ts`
- Modify: `src/files/components/FilesSidebar.vue`
- Test: `src/files/stores/favorites.test.ts`、`src/files/composables/useFileOps.test.ts`

**Interfaces:**
- Consumes: `service.users.getCustomStorage(key)` / `setCustomStorage(key, data)`(`packages/service/src/users.ts`),标准信封,失败抛 `Error & {code}`。
- Produces: `useFavoritesStore()` 现有导出 `{ list, load, isFavorite, add, remove, renamePath, reorder }`。**如果新增方法(例如 `removeUnder(prefix)`),必须保持已有方法签名不变** —— `FavoriteStar.vue`、`FileContextMenu.vue`、`Breadcrumb.vue`、`views/Files.vue` 都在用,而这些文件归别的任务或不归任何人。

### 1A. Bug 5 —— 删除后收藏残留(先做,确定性高)

现状:`useFileOps.ts:88` 已经有
`for (const p of paths) if (favorites.isFavorite(p)) await favorites.remove(p)` ——
**只做精确路径匹配**。已确认的两个缺口:

1. **删父目录不销子收藏。** 收藏 `/DATA/Documents/a/b`,然后删 `/DATA/Documents/a` ——
   `isFavorite('/DATA/Documents/a')` 为 false,`b` 永远留在侧栏。
   参照 `renamePath()`(favorites.ts:58-69)已经处理了 `f.path.startsWith(oldPath + '/')` 的前缀情形,
   删除侧缺的正是同一件事。
2. **每条各发一次 POST。** 批量删 N 条收藏会串行发 N 次全量 `persist()`。

- [ ] **Step 1: 先复现机主的原始场景。** 机主说的是"新建文件夹并加入收藏,删除后收藏里还在"——
      那是**精确匹配**的情形,按现有代码本该被清掉。**先写一个复现该精确场景的测试**;
      如果它通过,说明机主碰到的是另一条删除路径(候选:剪切/移动、回收站、
      侧栏收藏项自己的右键菜单、`fileOps` store 的批量操作),
      用 `grep -rn "batch.delete\|service.file.remove\|service.folder.remove" src --include=*.ts --include=*.vue`
      把**所有**删除入口找出来,逐个核对是否同步了收藏。不要在没找到真根因前动手改。
- [ ] **Step 2: 写失败测试**(`src/files/stores/favorites.test.ts`),覆盖:
      精确路径、后代路径(删 `/a` 应清掉 `/a/b`)、非后代的同前缀路径
      (删 `/a` **不得**清掉 `/ab`,这是 `startsWith` 的经典误伤)。
- [ ] **Step 3: 前台跑,确认失败。** `pnpm test --reporter=verbose src/files/stores/favorites.test.ts`
- [ ] **Step 4: 在 `favorites.ts` 里实现 `removeMany(paths: string[])`** ——
      一次算出要删的全集(精确 + 后代),`list.value` 一次性赋值,**只 `persist()` 一次**。
      后代判定必须是 `f.path === p || f.path.startsWith(p + '/')`。
- [ ] **Step 5: 在 `useFileOps.ts:88` 用 `await favorites.removeMany(paths)` 替换那行循环。**
- [ ] **Step 6: 前台跑两个测试文件,确认通过。**
- [ ] **Step 7: commit。**

### 1B. Bug 1 —— 超量丢失(需要先做完根因调查)

- [ ] **Step 8: 把 CDP 探针弄稳**(见上文"已知未解决的探针缺陷")。
      成功标准:`#/files` 停留 10 秒不跳 `#/login`,且能从 DOM 里读出侧栏"收藏"分区渲染了多少行。
- [ ] **Step 9: 二分找阈值。** 用探针跑 N = 500 / 1000 / 1057 / 1058 / 1100 / 1500,
      记录每次侧栏是"渲染了 N 行"还是"暂无收藏",以及 console 里有没有
      `[favorites] load failed`。**把每个 N 的原始输出贴进报告** —— 这是本任务最重要的交付物。
- [ ] **Step 10: 定位到具体那一行代码为止。** 如果阈值确实存在,继续往下切:
      是 `getCustomStorage` 抛了(→ 看 `unwrap` 收到的信封长什么样),
      还是返回了非数组(→ 后端把无效 JSON 当字符串回,`Array.isArray` 为 false → `[]`,
      **这条路径与"显示暂无收藏"的症状完全吻合,优先验证**),
      还是渲染层的问题。**不要在没有这一步结论之前改代码。**
- [ ] **Step 11: 写失败测试。** 按第 10 步的结论,在 `favorites.test.ts` 里写一个能复现的用例
      (例如:`getCustomStorage` 返回字符串 / 抛错时,`list` 应保留上一次的值而不是清空,
      或者按真实根因决定)。
- [ ] **Step 12: 前台跑,确认失败。**
- [ ] **Step 13: 实现修复。**
      无论根因是什么,**顺手补一道防御**:`load()` 目前在 catch 里把 `list.value = []`,
      等于"一次网络抖动就让用户以为收藏全没了"。改成**失败时保留原值并 toast/warn**,
      只有确实拿到空数组才清空。这一条本身就是缺陷,即使 Bug 1 的主根因在别处也要改。
- [ ] **Step 14: 前台跑,确认通过;再用探针在真机上复验阈值 N 已经不再触发。**
- [ ] **Step 15: commit。**

**收尾:** 我(主会话)在 UserService 上留下了一个探测用的 key `favorites_probe`
(磁盘文件 `/var/lib/nimoos/1/favorites_probe.json`,约 310 KB)。任务结束时删掉它:
`curl -s -X DELETE "$(sudo cat /var/run/nimoos/user-service.url)/v1/users/current/custom/favorites_probe" -H 'user_id: 1'`。
如果权限被拦,**不要绕过**,在报告里写明让机主自己删。

---

## Task 2: 面包屑两行封顶 + 中间层级折叠(Bug 6)

**独占文件:**
- Modify: `src/files/components/Breadcrumb.vue`
- Create: `src/files/util/breadcrumbCollapse.ts`(纯函数,便于单测)
- Test: `src/files/components/Breadcrumb.test.ts`、`src/files/util/breadcrumbCollapse.test.ts`

**机主已拍板的方案(不要改设计,直接实现):**
> 面包屑**最多两行**。在两行之内正常换行显示,**超过两行**才把中间层级折叠成一个
> **可点击的 `…`**,点开是下拉菜单列出被折叠的层级、可直接跳转。首级与末尾层级常驻。

现状根因:`Breadcrumb.vue:37` 的 `.breadcrumb` 是 `flex-wrap: wrap` 且无高度约束,
深路径直接堆成任意多行。

**实现要点:**
- 折叠是**测量驱动**的(取决于容器宽度和字体),不能靠"层级数 > N"这种拍脑袋的静态阈值。
  用 `ResizeObserver` 观察容器,渲染后测 `scrollHeight`,超过两行高度就多折叠一级,循环到放得下为止。
- 把"给定层级数组 + 需要折叠掉几级 → 输出显示序列"抽成纯函数放进
  `breadcrumbCollapse.ts` 单测;**几何测量部分留真机验**(jsdom 里 `scrollHeight` 恒为 0,
  测不出来,不要写一个假装能测的用例)。
- 两行高度 = `2 * 单行行高`,行高从计算样式读,不要硬编码像素。
- 下拉菜单:本仓已有下拉的既有写法,先看 `src/files/components/AddMountMenu.vue` 和
  `FileContextMenu.vue` 是怎么做的,**照抄本仓既有模式**,不要引第三方。
- ⚠️ 剪贴板/菜单坑:本仓用 reka 菜单时踩过 `inert` 导致交互假成功,
  如果你用到 reka 的 menu 组件,交互必须在真浏览器里验一次,不能只看 jsdom。
- 保留现有行为:最后一级是**非按钮**的 `.crumb.current`;`FavoriteStar` 仍挂在末尾。

- [ ] **Step 1: 写 `breadcrumbCollapse.test.ts` 失败测试** —— 覆盖:不需要折叠时原样返回;
      折叠 1 级/多级时首级与末 2 级保留、中间被替换为一个 `{ kind: 'ellipsis', hidden: Seg[] }`;
      层级总数少于 4 时**永不折叠**(否则 `…` 比它省下的还长)。
- [ ] **Step 2: 前台跑,确认失败。** `pnpm test --reporter=verbose src/files/util/breadcrumbCollapse.test.ts`
- [ ] **Step 3: 实现纯函数。**
- [ ] **Step 4: 前台跑,确认通过。**
- [ ] **Step 5: 改 `Breadcrumb.vue`** —— 接上测量循环 + `…` 下拉;
      `.breadcrumb` 保留 `flex-wrap: wrap` 但加 `max-height: 2 行` 与 `overflow: hidden` 兜底
      (测量循环收敛前的一帧不能露出第三行)。
- [ ] **Step 6: 前台跑 `Breadcrumb.test.ts`,补齐既有用例(现有用例不得改红)。**
- [ ] **Step 7: 真浏览器自查截图**(暗色 + 亮色各一张),路径要深到能触发折叠。
      chromium 在 `/home/nimo/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`;
      进真页面的 CDP 配方见本计划 Task 1 的探针脚本(剥 `Authorization` 头那段可以直接抄)。
      截图存 `.superpowers/sdd/2026-08-13-files-bugfix-batch/`。
- [ ] **Step 8: commit。**

---

## Task 3: 名称长度限制统一(Bug 2)+ 新建文件实时校验(Bug 4)+ 过长名称截断展示(Bug 2 后半)

**独占文件:**
- Modify: `src/files/util/pathLimits.ts`
- Modify: `src/files/components/NewItemDialog.vue`
- Modify: `src/files/components/RenameDialog.vue`
- Modify: `src/files/components/FileRow.vue`、`src/files/components/FileTile.vue`(仅 CSS 截断)
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`
- Test: 对应 `.test.ts`

> ⚠️ **不要编辑 `src/views/Files.vue`** —— 那个文件归 Task 4 独占。
> Files.vue:319 已经 `import { nameTooLong, pathTooLong } from '../files/util/pathLimits'`,
> 所以你只要改 `pathLimits.ts` 里的口径,上传路径会自动跟着变,**不需要动 Files.vue**。

### 3A. 先把"后端到底限多少"测出来

机主原话:**"直接按照后端接口的长度做"**。现在前端写死 `NAME_MAX = 255` 字节、
`PATH_MAX = 4095` 字节(`pathLimits.ts:7-8`)。而机主报的是"新建文件夹命名"和"上传文件夹"
两处**不一致** —— 但通读代码,两处调的是同一组函数
(`useFileOps.ts:48/56` 的 `createBlocked` vs `Files.vue:319` 的 `nameTooLong`+`pathTooLong`),
口径看起来是一样的。**所以真正的不一致点还没找到,你的第一件事是把它找出来,不是直接改常量。**

- [ ] **Step 1: 实测后端真实上限。** 对 `POST /v1/folder`(建文件夹)和上传落地路径分别探测:
      名字长度取 254 / 255 / 256 字节,以及中文(3 字节/字)边界 84 / 85 字。
      直连 UserService 之外的服务用 `sudo cat /var/run/nimoos/nimoos.url` 取地址。
      **在 `/DATA/Documents/` 下建一个临时目录做靶场,测完清干净;
      如果权限被拦就停下来问机主,不要绕过。**
- [ ] **Step 2: 把两条前端路径的实际差异定位到行。** 至少核对这几点:
      (a) 两处是否都算**字节**而不是字符;(b) 上传路径是逐段 `rel.split('/').some(nameTooLong)`,
      新建路径是整名一次 `nameTooLong`,对含 `/` 的输入行为是否不同
      (`NewItemDialog.vue:20` 会把 `/` 全部剥掉,上传则保留为层级);
      (c) 超限后的**反馈方式**不同 —— 新建是明确 toast(`filesNameTooLong`/`filesPathTooLong`),
      上传是静默过滤 + 数量 toast(`Files.vue:321-324`)。**(c) 很可能就是机主感知到的"不一致"。**
      把结论写进报告。
- [ ] **Step 3: 按第 1、2 步的实测结论,写失败测试**(`src/files/util/pathLimits.test.ts`),
      统一两条路径的口径。
- [ ] **Step 4: 前台跑,确认失败 → 实现 → 前台跑,确认通过。**

### 3B. Bug 4 —— 新建文件/文件夹实时长度校验

现状:`NewItemDialog.vue` 只在 `onInput` 里剥 `/`(第 20 行),**完全不校验长度**;
`confirm()` 直接 emit,长度问题要等 `useFileOps` 的 `createBlocked` 才发现 —— 机主的抱怨正是
"输完后才提示最大只支持 255 字节"。

- [ ] **Step 5: 写失败测试**(`NewItemDialog.test.ts`):输入超长名字时,
      对话框**内联**显示错误、确认按钮禁用;回到合法长度后错误消失、按钮恢复。
      ⚠️ **错误必须内联显示在对话框里,不要用 toast**(本仓既有约定)。
- [ ] **Step 6: 前台跑,确认失败。**
- [ ] **Step 7: 实现。** 复用 `pathLimits.ts` 的函数,不要在组件里重写字节计算。
      `RenameDialog.vue` 是同一个问题的同源组件,一并改(重命名也会撞 255 字节)。
- [ ] **Step 8: 前台跑,确认通过。**
- [ ] **Step 9: commit。**

### 3C. Bug 2 后半 —— 过长名称用 `…` 截断展示

机主原话:**"展示时如果太长使用桌面上同款的 ... 省略去作截断"**。

- [ ] **Step 10: 先去桌面区把"同款"找出来。** 在 `src/home/` 下找图标标题的截断实现
      (`grep -rn "text-overflow\|line-clamp\|ellipsis" src/home`),
      **照抄它的 CSS 口径**(单行还是两行、是否 `word-break`),不要自己发明一套。
      把抄来的来源文件:行号写进报告。
- [ ] **Step 11: 应用到 `FileRow.vue` / `FileTile.vue` 的名称元素。**
      必须给容器 `min-width: 0`(flex 子项不加这个 `text-overflow` 不生效,是本仓踩过的坑)。
- [ ] **Step 12: 真浏览器截图自查**(暗色 + 亮色),列表视图与网格视图各一张,
      名称要长到确实触发省略号。⚠️ **CSS 截断类问题 jsdom 照不出来,
      必须真浏览器取证**,不要只跑单测就说做完了。截图存
      `.superpowers/sdd/2026-08-13-files-bugfix-batch/`。
- [ ] **Step 13: commit。**

---

## Task 4: 选择器上传空文件夹(Bug 3)

**独占文件:**
- Modify: `src/views/Files.vue`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts` ——
  ⚠️ **这两个文件 Task 3 也要改。等 Task 3 报完工再动它们,或者只在文件末尾追加自己的 key
  以降低冲突面。冲突了就手动合,别 revert 对方的 key。**
- Test: `src/views/Files.upload.test.ts`

**已定位的根因:**
`Files.vue:227-231` 的 `onInputChange`:
```ts
function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length) handleSelectedFiles(input.files)
  input.value = ''
}
```
选中一个**空文件夹**时,`<input webkitdirectory>` 触发 `change` 但 `input.files.length === 0`,
于是 `handleSelectedFiles` 根本不被调用 —— **静默什么都不做**。
而拖拽路径走的是 `onDrop` → `dropEntries.ts`(`webkitGetAsEntry`),
能拿到空目录并交给 `createEmptyDirs()`(`Files.vue:257-261`)补建,所以拖拽能成。

**⚠️ 这里有一个你必须先验证的平台限制:**
`<input webkitdirectory>` 在选中空文件夹时,`input.files` 是空的,
**浏览器不提供该文件夹的名字** —— 也就是说这条路径上前端可能**根本无从得知要建哪个目录**。
同理,选中一个"有文件、但含空子目录"的文件夹时,空子目录也不会出现在 `files` 里
(因为 `webkitRelativePath` 只由文件产生)。

- [ ] **Step 1: 先用真浏览器把这个限制验掉。** 写一个最小 HTML 页面,
      放一个 `<input type="file" webkitdirectory>`,用 CDP 的 `DOM.setFileInputFiles`
      或直接在 chromium 里手动选,观察空文件夹时 `input.files.length` 与
      能否从任何属性拿到目录名。**把观察到的原始输出贴进报告。**
      chromium 在 `/home/nimo/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`。
- [ ] **Step 2: 按第 1 步结论选方案。**
      - **若确实拿不到目录名:** 唯一能拿到的是 File System Access API 的
        `showDirectoryPicker()`,但它要求**安全上下文**(HTTPS 或 localhost)——
        本产品常见部署是 **HTTP + 局域网 IP**,那里 `window.showDirectoryPicker` 是 `undefined`
        (本仓已经因为同一个安全上下文限制踩过剪贴板的坑)。
        所以做**能力检测 + 双轨**:可用时走 `showDirectoryPicker()`
        (能拿到目录名和完整目录树,空目录一并处理);
        不可用时**至少不要静默失败** —— 明确 toast 告诉用户
        "空文件夹请用拖拽上传"(文案去 Vue2 `zh_CN.json` 找对应的,找不到再新建 key)。
      - **若能拿到目录名:** 直接补建,不需要 File System Access API。
- [ ] **Step 3: 写失败测试**(`Files.upload.test.ts`):
      模拟 `change` 事件且 `files.length === 0` 时,**不再是什么都不发生**
      (按第 2 步选定的方案断言:要么调用了 `createEmptyDirs`,要么弹了那条 toast)。
- [ ] **Step 4: 前台跑,确认失败。** `pnpm test --reporter=verbose src/views/Files.upload.test.ts`
- [ ] **Step 5: 实现。** 注意 `input.value = ''` 这行**必须保留**
      (否则重复选同一文件夹不再触发 change)。
- [ ] **Step 6: 前台跑,确认通过。**
- [ ] **Step 7: 真机验一次**:在 `/DATA/Documents/` 下建一个空文件夹,
      用 "upload folder" 选它,确认行为符合第 2 步选定的方案。
- [ ] **Step 8: commit。**

---

## 全部任务完成后(由主会话执行)

- [ ] 前台跑全量 `pnpm test`,与基线对比:**除已知的 3 个 `oss/` 失败外不得有新增红灯**。
- [ ] `pnpm build`(含 `vue-tsc --noEmit`)必须通过。
- [ ] `pnpm lint` 必须通过。
- [ ] 删掉真机上的探测残留 `favorites_probe`。
- [ ] 恢复/核对机主真实收藏 `favorites.json` 未被改动。
- [ ] 部署走 `./scripts/deploy.sh`(禁止手写 rsync),然后交机主真机验收。
