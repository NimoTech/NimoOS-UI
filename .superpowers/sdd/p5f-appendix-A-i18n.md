# P5f 附录 A —— i18n 键表(T0 产出,2026-08-06)

> 🔴 **T1 起任何一刀不许在本附录缺位时开工。**
> 权威源:**zh = `git -C ../../NimoOS-UI show 7a6ee6b7:src/assets/lang/zh_CN.json`** ·
> **en = 同 sha 的 `en_US.json` 的覆盖值**(承 E-31 / 裁定 R10,**不许假设「en = key」**)。

## A.0 终值

| 项 | 值 | 取数 |
|---|---|---|
| 本期 **distinct 键** | 🔴 **90** | 静态 `$t('…')` **83** + `OP_LABEL_KEYS` 4 + `GROUPS_TEMPLATE.labelKey` 3 |
| 其中可复用既有 `aiKb*` | **14** | 见 §A.2 |
| 其中**需新增** | 🔴 **76** | = 90 − 14 |
| zh 权威命中 | 🟢 **90 / 90** | **零条需要自造中文** |
| en 权威命中 | 🟢 **90 / 90** | 同上 |
| `wikiViewHelpers.js` 的 i18n | 🟢 **0**(E-65 结案) | 全文 95 行零 `$t(` / 零 `i18n.t(` |
| 起点全表 | **1648 / 1648**(zh\en 与 en\zh 差集**均空**) | 真实模块导入(esbuild bundle → `import`) |
| 起点 `aiKb*` | **441 / 441** | 同上 |

**逐页静态 distinct**:`AllowlistView` **36** · `RootsView` **31** · `WikiView` **20**
(三页去重后 83;`Cancel` / `Add` / `Operation failed` / `Rescan started` 跨页共用)。

### 🔴 A.0.1 「en = key」这次**恰好**成立,但**规则仍必须遵守**

实测:**本期 90 个键的 `en_US.json` 覆盖值全部等于 key 本身(90/90)。**
⚠️ **这是巧合,不是保证** —— 同一份 `en_US.json` 全表 **2676 键里有 308 条(11.5%)值 ≠ 键**,例如:

```
key="lang_name"                          -> en="English"
key="This field is required"             -> en="This field is required."
key="Let's create your initial account"  -> en="Let's create your account"
```

⇒ 🔴 **`p5f-task-1-i18n-verify.mjs` 的 en 侧仍必须从 `en_US.json` 读**,不许写成 `en === key`
(那正是 E-44 那个 bug 的形态)。本期即使写错也测不出来 —— **所以更要按规则写**。

## A.1 占位符清单(终值)

| 占位符 | 出现在 | 两档一致 |
|---|---|---|
| `{ext}` | `Now indexing {ext}` · `Stopped indexing {ext}` · `Added {ext}` | ✅ |
| `{group}` | `All {group} selected` · `All {group} deselected` | ✅ |
| `{h}` | `Scan every {h} h` | ✅ |
| `{t}` | `Summary updated {t}` | ✅ |
| `{n}` | `{n} items` | ✅ |
| `{path}` | `This page renders {path} — …` | ✅ |

🔴 **集合 = `{ext, group, h, n, path, t}`,共 6 个,9 条带占位符的键,两档占位符名集合逐条一致。**
🔴 **E-45**:vue-i18n 对未匹配占位符是**静默置空**,**反向断言不许写「渲染结果含 `{x}` 字面量」**(零判别力),
要断**真实插值出来的值**(例:`{ n: 3 }` → 断言含 `3 项` / `3 items`)。

## A.2 🟢 可复用的既有 `aiKb*` 键(14 条,**两档逐码点相等**才算)

> 判据:某既有键的 **zh 值与 en 值同时**与本期该文案逐字相等,**且键名前缀是 `aiKb*`**。
> 🔴 **只撞一侧的一律不复用**;🔴 **同值但属于别的区的一律按 A-1 拒绝**(见 §A.3)。

| 蓝本文案 | 复用键 | zh | en |
|---|---|---|---|
| `Path` | `aiKbColPath` | 路径 | Path |
| `Action` | `aiKbColAction` | 类型 | Action |
| `Cancel` | `aiKbCancel` | 取消 | Cancel |
| `Index Roots` | `aiKbNavRoots` | 索引目录 | Index Roots |
| `Real-time watch` | `aiKbRealtimeWatch` | 实时监视 | Real-time watch |
| `Scheduled scan only` | `aiKbScheduledScanOnly` | 仅定时扫描 | Scheduled scan only |
| `Last scan:` | `aiKbLastScan` | 上次扫描: | Last scan: |
| `never` | `aiKbNever` | 从未 | never |
| `Operation failed` | `aiKbOpFailed` | 操作失败 | Operation failed |
| `Retry` | `aiKbRetry` | 重试 | Retry |
| `Manage roots` | `aiKbManageRoots` | 管理知识根 | Manage roots |
| `Delete` | `aiKbNtDelete` | 删除 | Delete |
| `Auto` | `aiKbOriginAuto` / `aiKbDeviceAuto` | 自动 | Auto |
| `Removed` | `aiKbStatusRemoved` | 已删除 | Removed |

🔴 **最后三条(`Delete` / `Auto` / `Removed`)T1 必须自己再判一次语义**:
- `aiKbNtDelete` 是 **Notes 页**词干(`aiKbNt*`)· `aiKbOriginAuto`/`aiKbDeviceAuto` 是**来源/设备**语义、
  而 `RootsView` 的 `Auto` 是**监视模式** · `aiKbStatusRemoved` 是**索引文件状态**、
  而 `Removed` 是 **wiki 变更 op**。
- **三者都属于「文案同值但语义域不同」** ⇒ 按 A-1 的理由(「将来那个区改文案会静默改掉知识库」)
  **建议新建 `aiKbRtDelete` / `aiKbRtWatchAuto` / `aiKbWkOpRemoved`**。
  🔴 **T1 拍板并在报告里显式申报选了哪一侧**;拿不准写 `NEEDS_CONTEXT`。
  ⚠️ 若按建议新建,则「可复用 14 / 新增 76」变成「可复用 11 / 新增 79」。

## A.3 🔴 双向撞车扫描(治理 §7.1)—— **实测 28 条撞车,协调者点名的 23 条已全部覆盖**

**方法**:本期 90 条的 zh 值 / en 值分别去 **1648 全表**里找同值键(**真实模块导入**,不做文本解析),
**两个方向都扫**。

### A.3.1 🔴 **只撞一侧**的(**绝不能复用** —— 复用会让另一档文案错)

| 本期文案 | zh 撞 | en 撞 | 结论 |
|---|---|---|---|
| `File types` | `aiKbSrFileType` | — | 🔴 新建 |
| `enabled` | `aiCfgChannelsEnabled` `aiSkActive` `aiKbStatusActive` | — | 🔴 新建 |
| `Add failed` | `aiCfgAddFailed` | — | 🔴 新建 |
| `Root enabled` | `aiCfgChannelsEnabled` `aiSkActive` `aiKbStatusActive` | — | 🔴 新建 |
| `Root deleted` | `aiCfgDeleted` `aiKbStatusRemoved` | — | 🔴 新建 |
| `Renamed` | `filesRename` `filesUploadRename` | — | 🔴 新建 |
| `Documents` | `aiKbDocumentsSuffix`(zh)/ `searchTabDocuments`(两档) | `searchTabDocuments` | 🔴 新建(见下) |

⚠️ **`enabled` 与 `Root enabled` 的 zh 都是「已启用」** —— 🔴 **本期内部也撞车**:
`AllowlistView` 的 `enabled`(计数后缀)与 `RootsView` 的 `Root enabled`(toast)zh 同值、en 不同值,
**必须是两个独立键**(`aiKbAlEnabledSuffix` / `aiKbRtRootEnabled`),**不许合并**。

### A.3.2 🔴 **两档都撞、但同值键属于别的区** —— 按 **A-1 一律拒绝复用**

| 本期文案 | 同值键(全在别区) |
|---|---|
| `Select all` | `filesSelectAll` |
| `Add` | `addPanelTitle` `topbarAdd` `appsSettingsAdd` `appsSourcesAdd` `aiCfgAdd` |
| `Allow` | `aiAllow` |
| `Deny` | `aiDeny` |
| `Save failed` | `filesViewerSaveFailed` `appsSettingsSaveFailed` `aiCfgSaveFailed` |
| `Delete failed` | `aiCfgDeleteFailed` `aiSkDeleteFailed` |
| `Documents` | `searchTabDocuments` |
| `Rescan now` | `aiCfgRescanNow` |

🔴 **理由(A-1 原文口径)**:键名语义属于别的区,**将来那个区改文案会静默改掉知识库**。
⚠️ **`Delete` / `Cancel` / `Add` / `Path` 四个协调者特别点名的高危项已逐个落表**:
`Cancel`→可复用 `aiKbCancel` ✅ · `Path`→可复用 `aiKbColPath` ✅ · `Add`→**新建** · `Delete`→见 §A.2 末三条。

## A.4 🔴 **不进 i18n** 的硬编码字面量(逐个实扫,**不是只有协调者点的那两个**)

| 处 | 字面量 | 为什么不进 |
|---|---|---|
| `WikiView.vue:101` | `<span class="kw-sec-en">Contents</span>` | 🔴 **蓝本未过 `$t()`** —— 装饰性英文副标题(同 P5e `FILE_TYPES` 先例) |
| `WikiView.vue:123` | `<span class="kw-sec-en">Recent changes</span>` | 同上 |
| **`WikiView.vue:59`** | `<span class="k2-tag" …>**TREE**</span>` | 🔴 **T0 新扫到的同类,协调者没点** —— 蓝本未过 `$t()` 的装饰标签 |
| `AllowlistView.vue:45` | `placeholder=".log, .ini, .conf …"` | 蓝本未过 `$t()`(placeholder 全期照抄) |
| `AllowlistView.vue:111` | `placeholder="DATA / Backup / Media / any"` | 同上 |
| `AllowlistView.vue:116` | `placeholder="/Downloads/*"` | 同上 |
| `RootsView.vue:56` | `placeholder="/DATA"` | 同上 |
| `AllowlistView.vue:78` | `{{ r.root_id \|\| 'any' }}` 的 `'any'` | **数据兜底值**,不是文案 |
| `WikiView.vue:138` | 按钮文案尾部的 ` →` | 蓝本拼在 `$t()` **外面**,照抄 |
| `AllowlistView.vue:82` | `r.action === 'allow' ? 'check' : 'x'` | **glyph 名**,不是文案 |

🔴 **`TREE`(`:59`)是本节相对协调者清单的净增项 —— T7 不许顺手把它 i18n 化。**

## A.5 全角标点例外清单(`messageSyntax.test.ts` 的 `toBe` 钉死项)

守卫正则 `/[，；：？！（）]/` 命中的 **9 条**(⚠️ `。`/`「」`/`·`/`—`/`…`/`×` **不在**该正则里):

| 蓝本 key | zh 值 | 命中的全角符 |
|---|---|---|
| `Advanced: custom extensions` | 高级：自定义扩展名 | `：` |
| `Priority: Deny > Allow > Default-allow` | 优先级：禁止 > 允许 > 默认允许 | `：` |
| `Example: deny /Downloads/* to stop indexing that folder` | 举例：禁止 /Downloads/* 后，该文件夹下所有文件停止索引 | `：` `，` |
| `Wildcard * supported, e.g. /Photos/**/*.raw` | 支持 * 通配符，如 /Photos/**/*.raw | `，` |
| `Priority: Deny > Allow > Default-allow. Example: deny /Downloads/* to stop indexing that folder.` | 优先级：禁止 > 允许 > 默认允许。例：禁止 /Downloads/* 下所有文件不被索引。 | `：` |
| `Deleted. Cleaning up affected files…` | 已删除，正在清理受影响的文件… | `，` |
| `No index roots configured — the knowledge base will not index any files.` | 尚未配置索引目录，知识库不会索引任何文件。 | `，` |
| `Index data in the knowledge base is kept; re-adding the same directory reuses it.` | 知识库中的索引数据会保留；重新添加同一目录可直接复用。 | `；` |
| `Backend version too old — deploy the Wiki service update first.` | 后端版本过旧，请先部署 Wiki 服务更新。 | `，` |

🔴 **这 9 条一律 `toBe` 钉死**,不许放宽正则。

## A.6 逐条键表(90 条,zh/en 终值)

> 🔴 **值一律逐字照抄,不许自己翻译、不许改标点**(P5d 的 C-1 就栽在这)。
> 页码:**Al** = AllowlistView · **Rt** = RootsView · **Wk** = WikiView · 🔸动态 = 经 `$t(变量)` 渲染,**必须进 i18n**。

| # | 蓝本 key | 页 | zh(权威 zh_CN.json) | en(权威 en_US.json 覆盖值) | 复用判定 |
|---|---|---|---|---|---|
| 1 | `File types` | Al | 文件类型 | File types | 🆕 新建 |
| 2 | `Unchecked types are no longer indexed` | Al | 取消勾选的将不再被收录 | Unchecked types are no longer indexed | 🆕 新建 |
| 3 | `enabled` | Al | 已启用 | enabled | 🆕 新建 |
| 4 | `Select all` | Al | 全选 | Select all | 🔴 **新建**(同值键 `filesSelectAll` 全在别的区,A-1 拒绝复用) |
| 5 | `Select none` | Al | 全不选 | Select none | 🆕 新建 |
| 6 | `Advanced: custom extensions` | Al | 高级：自定义扩展名 | Advanced: custom extensions | 🆕 新建 |
| 7 | `Add` | Al/Rt | 添加 | Add | 🔴 **新建**(同值键 `addPanelTitle`,`topbarAdd`,`appsSettingsAdd`,`appsSourcesAdd`,`aiCfgAdd` 全在别的区,A-1 拒绝复用) |
| 8 | `Folder rules` | Al | 文件夹规则 | Folder rules | 🆕 新建 |
| 9 | `Priority: Deny > Allow > Default-allow` | Al | 优先级：禁止 > 允许 > 默认允许 | Priority: Deny > Allow > Default-allow | 🆕 新建 |
| 10 | `Add rule` | Al | 添加规则 | Add rule | 🆕 新建 |
| 11 | `No rules yet — click [+ Add rule] above to get started.` | Al | 还没有规则。点右上角 [+ 添加规则] 开始。 | No rules yet — click [+ Add rule] above to get started. | 🆕 新建 |
| 12 | `Library` | Al | 存储库 | Library | 🆕 新建 |
| 13 | `Path` | Al | 路径 | Path | 🟢 **可复用** `aiKbColPath` |
| 14 | `Action` | Al | 类型 | Action | 🟢 **可复用** `aiKbColAction` |
| 15 | `Allow` | Al | 同意 | Allow | 🔴 **新建**(同值键 `aiAllow` 全在别的区,A-1 拒绝复用) |
| 16 | `Deny` | Al | 拒绝 | Deny | 🔴 **新建**(同值键 `aiDeny` 全在别的区,A-1 拒绝复用) |
| 17 | `Delete rule` | Al | 删除规则 | Delete rule | 🆕 新建 |
| 18 | `Example: deny /Downloads/* to stop indexing that folder` | Al | 举例：禁止 /Downloads/* 后，该文件夹下所有文件停止索引 | Example: deny /Downloads/* to stop indexing that folder | 🆕 新建 |
| 19 | `Add folder rule` | Al | 添加文件夹规则 | Add folder rule | 🆕 新建 |
| 20 | `Use "any" to apply to all libraries` | Al | 填 "any" 表示所有存储库都生效 | Use "any" to apply to all libraries | 🆕 新建 |
| 21 | `Wildcard * supported, e.g. /Photos/**/*.raw` | Al | 支持 * 通配符，如 /Photos/**/*.raw | Wildcard * supported, e.g. /Photos/**/*.raw | 🆕 新建 |
| 22 | `Index files under this path` | Al | 收录该路径下的文件 | Index files under this path | 🆕 新建 |
| 23 | `Stop indexing this path` | Al | 不再收录该路径 | Stop indexing this path | 🆕 新建 |
| 24 | `Priority: Deny > Allow > Default-allow. Example: deny /Downloads/* to stop indexing that folder.` | Al | 优先级：禁止 > 允许 > 默认允许。例：禁止 /Downloads/* 下所有文件不被索引。 | Priority: Deny > Allow > Default-allow. Example: deny /Downloads/* to stop indexing that folder. | 🆕 新建 |
| 25 | `Cancel` | Al/Rt | 取消 | Cancel | 🟢 **可复用** `aiKbCancel` |
| 26 | `Save rule` | Al | 保存规则 | Save rule | 🆕 新建 |
| 27 | `Now indexing {ext}` | Al | 已收录 {ext} | Now indexing {ext} | 🆕 新建 |
| 28 | `Stopped indexing {ext}` | Al | 已停止收录 {ext} | Stopped indexing {ext} | 🆕 新建 |
| 29 | `Save failed` | Al | 保存失败 | Save failed | 🔴 **新建**(同值键 `filesViewerSaveFailed`,`appsSettingsSaveFailed`,`aiCfgSaveFailed` 全在别的区,A-1 拒绝复用) |
| 30 | `All {group} selected` | Al | 已全选 {group} | All {group} selected | 🆕 新建 |
| 31 | `All {group} deselected` | Al | 已全不选 {group} | All {group} deselected | 🆕 新建 |
| 32 | `Added {ext}` | Al | 已添加 {ext} | Added {ext} | 🆕 新建 |
| 33 | `Add failed` | Al | 添加失败 | Add failed | 🆕 新建 |
| 34 | `Saved. Cleaning up in background…` | Al | 已保存。正在后台清理不再符合规则的文件… | Saved. Cleaning up in background… | 🆕 新建 |
| 35 | `Deleted. Cleaning up affected files…` | Al | 已删除，正在清理受影响的文件… | Deleted. Cleaning up affected files… | 🆕 新建 |
| 36 | `Delete failed` | Al | 删除失败 | Delete failed | 🔴 **新建**(同值键 `aiCfgDeleteFailed`,`aiSkDeleteFailed` 全在别的区,A-1 拒绝复用) |
| 37 | `Documents` 🔸动态 | Al | 文档 | Documents | 🔴 **新建**(同值键 `searchTabDocuments` 全在别的区,A-1 拒绝复用) |
| 38 | `Text` 🔸动态 | Al | 文本 | Text | 🆕 新建 |
| 39 | `Code` 🔸动态 | Al | 代码 | Code | 🆕 新建 |
| 40 | `Index Roots` | Rt | 索引目录 | Index Roots | 🟢 **可复用** `aiKbNavRoots` |
| 41 | `Directories scanned for the knowledge base` | Rt | 知识库扫描的根目录 | Directories scanned for the knowledge base | 🆕 新建 |
| 42 | `Add root directory` | Rt | 添加索引目录 | Add root directory | 🆕 新建 |
| 43 | `No index roots configured — the knowledge base will not index any files.` | Rt | 尚未配置索引目录，知识库不会索引任何文件。 | No index roots configured — the knowledge base will not index any files. | 🆕 新建 |
| 44 | `Real-time watch` | Rt | 实时监视 | Real-time watch | 🟢 **可复用** `aiKbRealtimeWatch` |
| 45 | `Scheduled scan only` | Rt | 仅定时扫描 | Scheduled scan only | 🟢 **可复用** `aiKbScheduledScanOnly` |
| 46 | `Scan every {h} h` | Rt | 每 {h} 小时扫描 | Scan every {h} h | 🆕 新建 |
| 47 | `Last scan:` | Rt | 上次扫描: | Last scan: | 🟢 **可复用** `aiKbLastScan` |
| 48 | `never` | Rt | 从未 | never | 🟢 **可复用** `aiKbNever` |
| 49 | `Rescan now` | Rt | 立即重扫 | Rescan now | 🔴 **新建**(同值键 `aiCfgRescanNow` 全在别的区,A-1 拒绝复用) |
| 50 | `Delete` | Rt | 删除 | Delete | 🟢 **可复用** `aiKbNtDelete` |
| 51 | `Selected path` | Rt | 已选路径 | Selected path | 🆕 新建 |
| 52 | `Advanced options` | Rt | 高级选项 | Advanced options | 🆕 新建 |
| 53 | `Watch mode` | Rt | 监视模式 | Watch mode | 🆕 新建 |
| 54 | `Auto` | Rt | 自动 | Auto | 🟢 **可复用** `aiKbOriginAuto` / `aiKbDeviceAuto` |
| 55 | `Scan only` | Rt | 仅扫描 | Scan only | 🆕 新建 |
| 56 | `Scan interval (hours)` | Rt | 扫描间隔(小时) | Scan interval (hours) | 🆕 新建 |
| 57 | `Add in mirror mode` | Rt | 以镜像模式添加 | Add in mirror mode | 🆕 新建 |
| 58 | `Delete index root?` | Rt | 删除索引目录? | Delete index root? | 🆕 新建 |
| 59 | `Also delete the generated .wiki.md files under this directory` | Rt | 同时删除该目录下已生成的 .wiki.md 导航文件 | Also delete the generated .wiki.md files under this directory | 🆕 新建 |
| 60 | `Index data in the knowledge base is kept; re-adding the same directory reuses it.` | Rt | 知识库中的索引数据会保留；重新添加同一目录可直接复用。 | Index data in the knowledge base is kept; re-adding the same directory reuses it. | 🆕 新建 |
| 61 | `Root enabled` | Rt | 已启用 | Root enabled | 🆕 新建 |
| 62 | `Root disabled` | Rt | 已禁用 | Root disabled | 🆕 新建 |
| 63 | `Backend version too old — deploy the Wiki service update first.` | Rt | 后端版本过旧，请先部署 Wiki 服务更新。 | Backend version too old — deploy the Wiki service update first. | 🆕 新建 |
| 64 | `Operation failed` | Rt/Wk | 操作失败 | Operation failed | 🟢 **可复用** `aiKbOpFailed` |
| 65 | `Rescan started` | Rt/Wk | 已开始重新扫描 | Rescan started | 🆕 新建 |
| 66 | `Root added` | Rt | 已添加索引目录 | Root added | 🆕 新建 |
| 67 | `This directory is read-only — retry in mirror mode to store wiki data centrally.` | Rt | 该目录只读——可改用镜像模式添加(wiki 数据存放在中央目录)。 | This directory is read-only — retry in mirror mode to store wiki data centrally. | 🆕 新建 |
| 68 | `Root deleted` | Rt | 已删除 | Root deleted | 🆕 新建 |
| 69 | `Failed to load the wiki tree` | Wk | 加载 Wiki 树失败 | Failed to load the wiki tree | 🆕 新建 |
| 70 | `Retry` | Wk | 重试 | Retry | 🟢 **可复用** `aiKbRetry` |
| 71 | `No wiki has been generated yet` | Wk | 还没有生成任何 wiki | No wiki has been generated yet | 🆕 新建 |
| 72 | `Add a knowledge root and the wiki map will build itself from your folders.` | Wk | 添加知识根后,Wiki 导航会自动从你的目录生成。 | Add a knowledge root and the wiki map will build itself from your folders. | 🆕 新建 |
| 73 | `Manage roots` | Wk | 管理知识根 | Manage roots | 🟢 **可复用** `aiKbManageRoots` |
| 74 | `Open folder` | Wk | 打开文件夹 | Open folder | 🆕 新建 |
| 75 | `Summary updated {t}` | Wk | 摘要更新于 {t} | Summary updated {t} | 🆕 新建 |
| 76 | `Maintained automatically by Nimo` | Wk | 由 Nimo 自动维护 | Maintained automatically by Nimo | 🆕 新建 |
| 77 | `This folder has no wiki summary yet` | Wk | 此目录还没有 wiki 摘要 | This folder has no wiki summary yet | 🆕 新建 |
| 78 | `It will be generated automatically on the next scan.` | Wk | 下次定期扫描时会自动生成。 | It will be generated automatically on the next scan. | 🆕 新建 |
| 79 | `Rescan this root` | Wk | 重新扫描该根 | Rescan this root | 🆕 新建 |
| 80 | `Contents` | Wk | 子项清单 | Contents | 🆕 新建 |
| 81 | `{n} items` | Wk | {n} 项 | {n} items | 🆕 新建 |
| 82 | `Collapsed — contents are not indexed individually` | Wk | 已折叠 — 内容不逐项索引 | Collapsed — contents are not indexed individually | 🆕 新建 |
| 83 | `Recent changes` | Wk | 最近变化 | Recent changes | 🆕 新建 |
| 84 | `This page renders {path} — the index service rewrites it after folder changes` | Wk | 本页由 {path} 渲染,索引服务在目录变化后自动重写 | This page renders {path} — the index service rewrites it after folder changes | 🆕 新建 |
| 85 | `Rendered view` | Wk | 渲染视图 | Rendered view | 🆕 新建 |
| 86 | `View source` | Wk | 查看原文 | View source | 🆕 新建 |
| 87 | `Added` 🔸动态 | Wk | 新增 | Added | 🆕 新建 |
| 88 | `Updated` 🔸动态 | Wk | 更新 | Updated | 🆕 新建 |
| 89 | `Removed` 🔸动态 | Wk | 已删除 | Removed | 🟢 **可复用** `aiKbStatusRemoved` |
| 90 | `Renamed` 🔸动态 | Wk | 重命名 | Renamed | 🆕 新建 |

## A.7 🔴 动态键的 7 条(不进模板但必须进 i18n)

| 常量 | 蓝本坐标 | 值 | 渲染处 |
|---|---|---|---|
| `OP_LABEL_KEYS.create` | `WikiView.vue:156` | `Added` | `$t(OP_LABEL_KEYS[c.op] \|\| 'Updated')`(`:205`) |
| `OP_LABEL_KEYS.modify` | 同上 | `Updated` | 同上(**也是未知 op 的兜底值**) |
| `OP_LABEL_KEYS.delete` | 同上 | `Removed` | 同上 |
| `OP_LABEL_KEYS.rename` | 同上 | `Renamed` | 同上 |
| `GROUPS_TEMPLATE[0].labelKey` | `AllowlistView.vue:160` | `Documents` | `$t(g.labelKey)`(`:17`)+ `$t('All {group} …', {group: $t(g.labelKey)})`(`:207`) |
| `GROUPS_TEMPLATE[1].labelKey` | `:162` | `Text` | 同上 |
| `GROUPS_TEMPLATE[2].labelKey` | `:164` | `Code` | 同上 |

🔴 **T8 死键核查时注意**:这 7 个键在模板里**搜不到**(它们写在常量的 `labelKey` 字段上),
按治理 §T8-6「间接消费要逐条落地核实,不算死键」**不许判成死键**。

## A.8 D-4 口径(继续挂账)

本期新键**照 P5a–P5e 既定全仓模式**:多数键只有**存在性断言**,值的正确性由一次性
`p5f-task-1-i18n-verify.mjs` 逐码点校验。🔴 **T1 报告要写清「只有存在性断言」的条数。**
**不许在 P5f 内单方面反转 D-4。**
