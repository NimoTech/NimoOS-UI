# 开源版 NimoOS Web UI（NimoOS-Web）导出机制 —— 设计

**日期**：2026-08-03
**产出物**：`/home/nimo/NimoTech/NimoOS-Web/`（新建独立 git 仓，零历史）
**机制载体**：`NimoOS-New-UI/oss/`（私有仓内，自身不进开源产物）

---

## §0 这份 spec 是在什么状态下写的（读之前必看）

> **⚠️ 本节是这份文档最重要的一节。它记录了写作时的前提快照，而这些前提正在变化。**

### 0.1 写作时机

本 spec 写于 **2026-08-03**，当时：

- **SP7（相册）与 SP8（AI）两条分支都还没有合进 master。** 它们活在独立 worktree
  `/home/nimo/NimoTech/.sp7/` 和 `.sp8/`，分支 `sp7-photos` / `sp8-ai`，与 master 均**非快进**、
  各有 6–7 个冲突文件。
- **用户 2026-08-04 拍板：快照发布之后仍要把这两支合进 master。**
  → 因此本 spec 的剥离清单只覆盖 **master 上的 AI/相册残留面**；两支合流后，
  清单必须为 `src/photos/**`、`src/ai/**` 两个完整功能区扩张（路由、i18n 分片、
  数十个测试文件），那是一次独立的工作。单源 + 导出脚本的架构正是为此选的。
- **SP9 正在进行中，具体在做 P6（KVM 第二半：创建向导 / OSSelector / 快照 tab / 全局设置）。**
  摸底期间 New-UI HEAD 从 `1935b3e` 连动两次到 `41e5abc`，Service 从 `39f5eb1` 到 `7e84566`
  （最新一条是「`FolderEntry` 补 size，SP9-P6 OSSelector 要显示文件大小」），
  工作树里还有一份正在被编辑的 P6 计划书。**P6 是与本项目并发的活跃工作。**
- SP9 的 **P0–P5 已关账**（设置壳 / general+developer / network / apps+status+terminal+storage /
  account+folder-permissions / KVM 列表+控制台+电源）。
- **SP9-P7（Search 区）已从范围内删除**（用户 2026-08-03 拍板）—— 它的四源聚合入口只有
  `POST /v1/ai/search/agent/tool`，必须经 NimoOS-AI 代理。
- 剩余迁移工作：**SP9-P6**（进行中）、SP9-P8（cutover）、SP6-P7（文件区快照套件，7 子任务
  含 621 行 SnapshotTimeWheel）、SP10（退役 Vue2）。

### 0.2 摸底基线（会过期）

| 项 | 值 | 取值时 HEAD |
|---|---|---|
| New-UI `src/` 文件数 | 804 | `cd382d5` |
| 测试规模 | 352 文件 / 3078 例（全绿，退出码 1 见 §7.4） | `cd382d5` |
| 命中禁词的 `.test.ts` | 42 个 | `cd382d5` |
| `zh_cn.ts` 待删键 | **44 个**（33 + 11 个 audio 转录键） | `cd382d5` |
| `zh_cn.sp9.ts` 待删键 | 10 个 | `cd382d5` |
| MediaViewer.vue | 852 行 | `cd382d5` |
| 运行时依赖 | 45 个，无一与 AI/相册相关 | `cd382d5` |

### 0.3 开工前必须重新核实的清单

> **✅ 2026-08-04 已按本节逐条重跑完毕，结论与 14 条偏差见
> `docs/superpowers/plans/2026-08-04-oss-web-ui-export.md` 的「现场核实结论」一节。
> 那份计划是执行依据；本 spec 之后各节凡与它冲突，以计划为准。**

> **本 spec 的一切文件路径、行数、锚点、键名都是 2026-08-03 的快照。
> 开工第一件事不是写代码，是把下面每一条重新跑一遍并更新本文档。**

开工前逐条确认（预计 20–30 分钟）：

1. **两个仓的 HEAD 与工作树状态** —— `git -C NimoOS-New-UI log --oneline -1`、
   `git -C NimoOS-Service log --oneline -1`。确认 P6 已关账、无未提交的他人工作。
   已知长期例外：主工作树里 3 个 `design-export/*` 的删除态（见 §10.3）。
2. **§4 类 1 的删除清单** —— 每个路径 `test -e` 确认还在，且没有新增的同类文件
   （重跑 §0.4 的探测命令，比对是否出现新的命中文件）。
3. **§4 类 3 的 23 处锚点** —— 逐处 grep 确认锚点文本仍存在且**唯一**。
   P6 会不会动到？摸底时判断是「不会」（P6 动 `src/kvm/**` 与 KVM 全局设置），
   **但这个判断必须重新验证**，不要沿用。
4. **i18n 待删键** —— 重跑 §0.4 的键提取命令，不要用 §0.2 里那两个数字。
   键名有增减是正常的（`zh_cn.ts` 近 3 月被改 123 次）。
5. **测试规模基线** —— 跑一次全量 `pnpm test` 记下文件数/例数，作为剥离后对比的基准。
   注意 §7.4 那条已知的退出码 1。
6. **`useOpenAction.ts` 的 `SYS_ROUTE` 现状** —— §8.2 的核心依据是「设置和虚机磁贴仍指 Vue2」。
   如果 P6 或 P8 已经翻过来了，§8.2 的结论要相应简化。
7. **`src/router/index.ts` 已注册的路由清单** —— 决定开源版哪些入口有内部落点。

### 0.4 重新探测用的命令（照抄即可）

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI

# 命中禁词的源文件（排除测试）
grep -rlnE "photo|[Gg]allery|[^a-zA-Z]ai[^a-zA-Z]|search|transcript|speaker|folderPerm" \
  src --include=*.ts --include=*.vue | grep -v "\.test\.ts" | sort

# 命中禁词的测试文件
grep -rlE "[Pp]hoto|[Gg]allery|'ai'|\"ai\"|[Ss]earch|[Tt]ranscript|[Ss]peaker|[Ff]olderPerm" \
  src --include=*.test.ts | sort

# i18n 待删键（zh_cn 与 sp9 分片分别跑）
grep -oE "^\s+(topbarSearch|search[A-Z][a-zA-Z]*|widgetAi[a-zA-Z]*|appPhotos|appAi|addPanelTabPhoto|addPanelNoPhotos)[a-zA-Z]*" src/i18n/zh_cn.ts
grep -oE "^\s+[a-zA-Z]*([Ss]earch|[Pp]hoto|Ai[A-Z]|[Kk]nowledge|[Ww]iki|[Pp]arser|[Ff]olderPerm)[a-zA-Z]*" src/i18n/zh_cn.sp9.ts
```

---

## §1 目标与非目标

### 目标

产出一个可开源发布的 NimoOS Web UI：**纯 Vue 3、无 AI、无相册、无搜索栏**，
且代码里不留这三块的痕迹 —— 组件、store、路由、共享包域、i18n 键、桌面磁贴入口、
**注释**、静态资源全部清掉。外部读者从这份代码里看不出「作者还有一个带 AI 的版本」。

### 非目标（明确不做）

- 后端微服务剔除（NimoOS-AI / Photos / Parser / Search / Wiki）—— 别人负责
- ISO 构建、安装脚本
- LICENSE / NOTICE / 开源合规 —— 别人负责
- 私有基础设施地址（`store.nimoos.io` 等）—— 别人负责
- 把 sp7/sp8 两条分支改造成插件（那是另一条路线，已否决，见 §2 决策 1）
- 新做任何功能。本项目只做减法 + 两处必要的重排/拆分

---

## §2 已定决策

全部由用户在 2026-08-03 的 brainstorming 中拍板。

| # | 决策 | 理由 / 代价 |
|---|---|---|
| 1 | **单源 + 导出脚本**：私有 New-UI 继续当唯一主干（含 AI/相册），写脚本产出开源仓 | 剩余迁移工作（P6/P8/SP6-P7/SP10）只做一遍。否决「一次性快照后两边各自演进」（会漂到无法同步）与「开源仓变新主干 + AI 做插件」（sp7/sp8 是深度内嵌写法，改造成本最大） |
| 2 | **共享包内嵌成子目录**：开源仓 `packages/service/`，包名不变，只改 `package.json` 里 `file:` 那一行 | 源码里所有 `import` 字节不改；开源用户 clone 一个仓就能跑。否决「开两个开源仓」（上手门槛高）与「发 npm 公开包」（多一个要剥离的发布物） |
| 3 | **音频转录面板整块剥掉** | `audioTranscripts.ts`(323 行) + `speakerWave.ts`(111 行) + MediaViewer 里的三 tab。转录+高光+Ask 一看就知道背后要接 AI，是唯一真正不泄底的做法。保留播放器 + 真实波形（`waveform.ts` 解码 PCM，不涉 AI） |
| 4 | **设置「文件夹权限」整个 tab 删掉** | 四个分区（文件名索引/知识库/禁止 AI 访问/照片）全是 AI 链路消费方，且数据源本就是空实现（SP9 政策三）。rail 从 7 项变 6 项。**账号 tab 的成员文件夹授权是另一回事，保留** |
| 5 | **桌面默认布局重排一版** | 不新做组件，把现有 6 个小组件按各自 `max` 放大 + 5 个系统应用磁贴 + 4 个文件夹磁贴填满上面 6 行，最后两行留空。否决「坐标不动直接留空」（首屏是漏的） |
| 6 | **`docs/superpowers/` 整个目录不导出**，只留本地 | 43 份 spec/plan 里 15 份提到相册或 AI，还有 SP7/SP8 分支、后端债务编号（D1–D42）、真机 fixture、内网 IP。逐份洗的成本高于对外价值。**⚠️ 未明确确认的假设**：`docs/THEMING.md`（主题 token 手册）与 `docs/nimoos-app-label-spec.md`（Docker 应用 label 规范）**照旧导出**（洗白后），因为前者是本仓硬约束、不给手册外部人一提 PR 就会写死色值，后者对第三方应用开发者有用。若用户其实想「一份文档都不带」，把这两条移进类 1 即可 |
| 7 | **只建本地仓，不加 remote、不 push** | 推到 GitHub 即公开，缓存/镜像可能留存，删不干净。守卫测试再强也抵不上机主自己看一眼。推的时机由用户定 |
| 8 | **仓名 = `NimoOS-Web`** | 不带 UI/New/OSS 字样，不暴露内部还有「旧 UI / 新 UI / 商用版」的分层 |
| 9 | **不合并私有主干里重复的系统应用 key 清单** | 用户「禁无关重构」的长期规矩优先。四处各 1–6 行锚点，客观风险低；代价是以后动系统应用清单时可能同时碰上几个锚点 |
| 10 | **测试文件一律「删」不「改写」** | 见 §7。改写等于造 25 个会静默过期的冻结分身 |

---

## §3 架构

### 3.1 三方位置

```
/home/nimo/NimoTech/
├── NimoOS-New-UI/          私有主干（不变，含全部功能）
│   └── oss/                ★ 新增：导出机制。自身不进开源产物
│       ├── export.mjs        入口，一条命令
│       ├── manifest.mjs      DELETE / REPLACE / PATCH 三张表
│       ├── files/            REPLACE 用的整文件
│       ├── forbidden.mjs     禁词表 + 白名单
│       └── verify.mjs        泄漏守卫
├── NimoOS-Service/         私有共享包（不变）
└── NimoOS-Web/             ★ 产出物：独立 git 仓，零历史，永远只有 1 个提交
    ├── src/                  剥离后的 New-UI
    ├── packages/service/     内嵌的共享包（源码 + 它自己的测试）
    ├── package.json          file:./packages/service
    ├── docs/THEMING.md
    ├── docs/nimoos-app-label-spec.md
    └── README.md
```

`oss/` 是普通目录、进私有仓的 git。它不会出现在开源产物里，
因为 §3.2 第 3 步的 DELETE 表第一条就是它自己。

### 3.2 `export.mjs` 六步（每步失败即停，非零退出）

1. **前置检查** —— 两个私有仓工作树干净（例外白名单：3 个 `design-export/*` 的删除态）；
   记下两个 HEAD 写进导出报告 `NimoOS-Web/.export-report.txt`（该文件**不进** git，
   仅供本地追溯，因为它含私有仓 commit hash）。
2. **取源** —— `git archive HEAD | tar -x` 到临时目录，Service 同样。
   用 `git archive` 而不是 `cp -r`：`.git` / `node_modules` / `dist` / `.superpowers` /
   `scripts/tmlab/` / `vite.config.tmlab.ts` 全部自动排除（它们或在 `.gitignore` 里、或不被跟踪）。
3. **应用清单** —— 顺序固定 DELETE → REPLACE → PATCH。
   - DELETE：路径不存在即 exit 1（清单过期了要知道）
   - REPLACE：先校验私有侧源文件的**哈希钉**（§3.3），不符即 exit 1
   - PATCH：锚点命中次数必须**恰好为 1**，0 次或 ≥2 次都 exit 1
4. **内嵌 Service** —— Service 的 archive 落到 `packages/service/`，
   改 `package.json` 的 `"@nimotech/nimoos-service": "file:../NimoOS-Service"`
   → `"file:./packages/service"`。
5. **跑泄漏守卫**（§6）—— 在**临时目录**上跑。不过就 exit 1，
   **一个字节都不落到 `NimoOS-Web/`**。
6. **落盘** —— `rsync -a --delete`（排除 `.git`）进 `NimoOS-Web/`，
   `git add -A`，`git commit --amend --no-edit`（首次是 `git commit`），保持零历史。

### 3.3 REPLACE 的哈希钉（堵住唯一的静默失败路径）

整文件替换的本质是「在 `oss/files/` 放一份冻结分身」。私有主干以后改了那个文件，
脚本照样把老的盖上去 —— **不报错、不提示，开源仓悄悄停在今天**。

所以每条 REPLACE 在 `manifest.mjs` 里同时钉住**私有侧源文件的 SHA-256**：

```js
{ path: 'src/files/viewers/MediaViewer.vue',
  from: 'oss/files/MediaViewer.vue',
  privateSha256: '…' }   // 私有侧那份的哈希
```

私有主干改了 `MediaViewer.vue` → 哈希不符 → exit 1，报
「私有仓的 MediaViewer.vue 变了，请复核 oss/files/MediaViewer.vue 后更新 privateSha256」。

**这条纪律是本设计的核心不变式：两条路都必须「响一声」，绝不允许「哑火」。**
锚点补丁天然响（命中不到就报错），替换靠哈希钉补上这个能力。

### 3.4 为什么默认用补丁而不是替换

判据是 **churn × 共享比例**，不是改动大小：

| 文件 | 总行 | 要删 | 近 3 月改动 | 结论 |
|---|---|---|---|---|
| `i18n/zh_cn.ts` | 788 | 33 键 | **123 次** | 补丁 |
| `styles/theme.css` | 561 | 33 | **28 次** | 补丁 |
| `views/Home.vue` | 134 | 5 | 20 次 | 补丁 |
| `widgets/WidgetCard.vue` | 158 | **1** | 18 次 | 补丁 |
| `components/GridItem.vue` | 117 | 4 | 13 次 | 补丁 |
| `stores/layout.ts` | 231 | 3 | 12 次 | 补丁 |

`WidgetCard.vue` 要删的是一行（`ai: AiWidget,`），而它三个月被改 18 次。
冻结它等于：以后每次改 WidgetCard，开源版都拿不到。

**只有「开源版本天生就该不一样、没有可继承的东西」才用替换** —— 见 §4 类 2，共 5 个文件。

---

## §4 剥离清单（四类动作）

> 全部路径以 2026-08-03 `1935b3e` 为准，**开工前按 §0.3 第 2、3 条重新核实**。

### 类 1 · 整体删除

| 位置 | 文件 |
|---|---|
| `oss/` | **它自己**（第一条） |
| `src/home/` | `components/SearchDialog.vue`（599 行，写死 demo，从未接后端）· `components/PhotoTile.vue` · `components/widgets/AiWidget.vue` · `stores/photos.ts` · `apps/icons/photos.svg` · `apps/icons/ai.svg` |
| `src/files/viewers/` | `audioTranscripts.ts`(323) · `speakerWave.ts`(111) —— **`waveform.ts` 保留**（解码 PCM 画真实波形，不涉 AI） |
| `src/settings/` | `panels/FolderPermissionsPanel.vue` · `panels/folderPerm/`（整目录，`FolderPickerDialog.vue` 只有它自己在用）· `util/folderPermissions.ts` · `util/folderPermissionsSnapshot.ts` · `util/folderPermissionsView.ts` |
| Service | `src/photos.ts` |
| 文档/资源 | `docs/superpowers/`（整目录，43 份）· `design-export/`（3 份 HTML）· **`public/demo/fish_video_poster.jpg`**（搜索 demo 的鱼） |
| 测试 | §7.2 那 10 个整体删除的测试文件 |

### 类 2 · 整文件替换（放 `oss/files/`，各带哈希钉）

| 文件 | 为什么天生不一样 |
|---|---|
| `src/home/grid/defaultLayout.ts` | 开源版是重排后的新桌面，`PHOTO_PLACEHOLDERS` 整个不存在（§5.1） |
| `src/files/viewers/MediaViewer.vue` | 拆掉转录面板后结构真的变了（852 行动掉约一半，§5.2） |
| `src/home/components/AddPanel.vue` | 照片 tab 织进了 519 行里，抠起来比重写脆 |
| `README.md` | 面向外部开发者，与私有版受众不同 |
| `docs/THEMING.md` | 要洗掉提到 SearchDialog / MediaViewer 转录 / 相册的字样 |

> **`useOpenAction.ts` 定为补丁、不走替换**（brainstorming 过程中我先说走替换，后改了主意）。
> 它只有 60 行，但里面 `openApp` 的 LinkApp / 未运行应用弹「是否启动」那套逻辑是**真在演进的业务逻辑**，
> 冻结它会让开源版拿不到后续修复。改动量（约 12 行 + §8.2 的两处值替换）用锚点完全够，
> 而且它是**最可能报错的锚点点位**（P8 与 SP10 都会动它）—— 那正是我们要的信号。

### 类 3 · 锚点补丁（23 处）

| 文件 | 抠掉什么 |
|---|---|
| `home/apps/systemApps.ts` | `photos`/`ai` 两条系统应用 + 两个 `import` + `G.photos`/`G.ai` |
| `home/composables/useDock.ts` | `DEFAULT_FAV` 去 `photos`/`ai` → `['files','storage','vm','appstore']` |
| `home/composables/useOpenAction.ts` | `SYS_ROUTE` 的 `photos`/`ai` 两键 · `kind==='photo'` 分支 · `widget==='ai'` 分支 · `sendToAI` 整个函数 · **另见 §8.2：`settings`/`vm` 要改指内部路由、`cutoverDisabled` 拍成恒 false** |
| `home/composables/useAddPanel.ts` | `curTab` 联合类型去 `'photo'` · 尺寸表的 `'photo'` 分支 |
| `home/grid/types.ts` | `Kind` 去 `'photo'` |
| `home/components/GridItem.vue` | PhotoTile 分支 + `import` + `kind==='photo'` 判定 |
| `home/components/MobileHome.vue` | PhotoTile 分支 + `import` + `m-photo` 类与样式 |
| `home/components/widgets/WidgetCard.vue` | `ai: AiWidget,` 一行 + `import` |
| `home/widgets/registry.ts` | `WIDGETS.ai` + `ICON.ai` |
| `home/stores/layout.ts` | `bindPhotos` 函数 + return 里的导出 |
| `home/stores/homeUi.ts` | `searchOpen` / `setSearch` / `openSearch` / `closeSearch` 四项 + return |
| `home/components/HomeTopbar.vue` | 搜索胶囊按钮 + ⌘K 键盘监听 + `.search-btn` 样式 |
| `views/Home.vue` | `<SearchDialog />` 挂载 + `import` + `usePhotosStore` + `onMounted` 里那行 `photos.loadAssets()` |
| `settings/util/tabs.ts` | `RAIL_TABS` / 标签映射去 `folder-permissions` + admin 过滤简化 |
| `settings/panels/index.ts` | `'folder-permissions': FolderPermissionsPanel` 注册 + `import` |
| `settings/util/folderBrowser.ts` | 切断 Wiki 候选参数，只留固定三根（`/DATA`、`/media`、`/mnt`）—— 真机上本来就恒走这条回退 |
| `styles/theme.css` | `--spk-1..5` · `--wave-dim` · `--orb-core` · `--orb-glow` · `@keyframes pulse` · `.ic-photos` · `.ic-ai` · `.ic-search` · `.photo-thumb*`（3 条）· `.kind-photo*`（3 条）。**两套主题块都要删**。`--wave-none` 见 §5.2 的注意事项 |
| Service `src/index.ts` | `createPhotos` 的 import / `photos` getter / `PhotoAsset` 类型导出 |
| `i18n/zh_cn.ts` + `en_us.ts` | 33 个键（`appPhotos` `appAi` `widgetAi*`×7 `addPanelTabPhoto` `addPanelNoPhotos` `topbarSearch*`×2 `search*`×20），两边同步 |
| `i18n/zh_cn.sp9.ts` + `en_us.sp9.ts` | 10 个键（`settingsTabFolderPermissions` `settingsFp*`×9），两边同步 |
| `apps/util/systemApp.ts` | **注释洗白**：「幕后组件(AI agent 运行时 / Photos ML 后端等)」→ 泛化措辞。**代码一个字节不动**（判 `nimoos.system` label，本来就是通用的） |
| `settings/util/appPaths.ts` | **注释洗白**：「后端返回 4 个 key —— app_data / images / database / photos_data」那句 |
| `.gitignore` | `git archive` 会把它带进产出树。里面 `.claude/` 与 `.superpowers/` 两行会暴露「AI 辅助开发」（**不是 AI 功能**，但性质相邻，社区观感各异）；`scripts/tmlab/` 与 `vite.config.tmlab.ts` 是时间机器验收台、与 AI 无关但对外无意义。另需加 `.export-report.txt`。**这条是否要洗、洗到什么程度，待用户拍板**（§0.3 之外的开放项） |

**i18n 的守卫是自动的**：`src/i18n/parity.test.ts` 断言 zh_cn 与 en_us 键集完全一致，
漏删一边当场红。

### 类 4 · 测试同步

见 §7。

### 4.1 明确不动的假阳性

| 文件 | 为什么留 |
|---|---|
| `files/util/protect.ts` | `'Gallery'` 是 LocalStorage 开机自建的系统目录，与相册 app 无关 |
| `files/util/icons.ts` | `Gallery` → `folder-pictures` 图标、`APPLICATION_PHOTOSHOP` |
| `files/util/fileCategories.ts` | `APPLICATION_PHOTOSHOP = ['psd','psb']` |
| `apps/views/StorePage.vue` · `apps/stores/installedApps.ts` | 是**应用商店的筛选框**（`?search=` 深链、`searchInput`、`filterStoreApps`），与 NimoOS-Search 无关 |
| `apps/util/systemApp.ts` 的**代码** | 隐藏 `nimoos.system` 幕后容器的规则，后端仍在跑时有用。只洗注释 |
| `settings/util/migrateBrowse.ts` | `'Gallery'` 在系统目录黑名单里，是真实系统目录 |
| `files/viewers/waveform.ts` | 真实波形 = 解码 PCM，不涉 AI |
| `settings/panels/account/MemberFoldersView.vue` | 成员文件夹授权（`grantMemberFolder` → `user_folder_permissions`），与 AI 无关 |

---

## §5 两块需要重做的东西

### 5.1 桌面默认布局重排

12×8 = 96 格。现有默认布局占 **86 格**；删掉 AI 组件（4×4=16）、3 张照片磁贴（各 2×2=12）、
photos/ai 两个应用磁贴（2）之后剩 **56 格**，空出 30 格 = **31%**。

不硬塞填充物 —— 6 个小组件按各自 `max` 放大（clock 4×2 · storage 4×2 · cpu 4×3 ·
network 4×4 · events 2×4 · gpu 4×2 = 60 格）+ 5 个系统应用磁贴（补上现有布局里没有的
`storage` 应用磁贴）+ 4 个文件夹磁贴 = 约 **69 格**，填满上面 6 行，
**最后两行故意留空**给用户自己加。稀疏但整齐。

草图（**不是最终坐标**，最终值在 plan 阶段定死）：

```
     c1   c2   c3   c4   c5   c6   c7   c8   c9   c10  c11   c12
r1  [ 时钟   ][ 存储 4×2          ][ CPU 4×2           ][文件][设置]
r2  [        ][                   ][                   ][商店][虚机]
r3  [ 网络 4×4                    ][事件][ GPU 4×2      ][磁盘][文档]
r4  [                             ][2×4 ][              ][相册][下载]
r5  [                             ][    ][              ][媒体][    ]
r6  [                             ][    ][              ][    ][    ]
r7   （留空）
r8
```

约束：每个小组件的落位尺寸必须落在 `registry.ts` 里它自己的 `min`/`max` 之内
（`clock` 4×2 · `storage` 4×2 · `network` 4×4 · `events` 2×4 · `gpu` 4×2 · `cpu` 4×3）。
「相册」那格是 `/DATA/Gallery` **文件夹**磁贴，不是相册应用。
可顺带补上 `storage` 系统应用磁贴（`/storage` 路由 SP6 已上线，现有默认布局里没它）。

**验证方式**：无头 chromium 截图自查（暗色 + 亮色两套），再交用户眼验。

### 5.2 MediaViewer 拆转录面板

852 行里约 158 行命中转录相关词。

**保留**：自绘播放器、真实波形（`waveform.ts`）、常规音视频控制、图片/视频通路。
**删掉**：`summary` / `transcript` / `ask` 三 tab 的整套 UI 与状态、说话人分色
（`speakerWave.ts` 的 `speakerToken`/`segMatches`/`barSpeakers`/`segChapterIndex`/`barChapterIndex`）、
章节过滤、说话人 chips。

> **⚠️ 拆的时候必须确认的一点**：波形的「静场竖条」用 `--wave-none`，
> 而 `--wave-none` 与说话人着色共用一套 token 家族（`--spk-*` / `--wave-dim`）。
> **不能因为删 token 把保留下来的波形也弄没颜色。**
> 具体做法：`--wave-none` **保留**（波形自己在用），`--spk-1..5` 和 `--wave-dim` 删。
> 这一条必须有测试或截图证据，不能只靠读代码。

---

## §6 泄漏守卫

在**临时目录**上跑，不过就一个字节都不落盘。词表分两级。

### 6.1 硬禁词（出现即失败，无白名单）

```
相册 · Nimo AI · ask nimo · transcript · qdrant · ollama · embedding
CLIP · immich · photos_data · folderPermission · wikiRoot · 192.168.1.115
```

### 6.2 软禁词 + 精确白名单

| 词 | 白名单 |
|---|---|
| `photo` | `APPLICATION_PHOTOSHOP`（fileCategories.ts）· `folder-pictures`（icons.ts） |
| `gallery` / `Gallery` | `/DATA/Gallery` 系统目录（protect.ts · icons.ts · defaultLayout.ts · migrateBrowse.ts） |
| `search` | 应用商店筛选（StorePage.vue 的 `?search=`、`searchInput`、`filterStoreApps`） |
| `speaker` | 无 —— 拆完应零命中，留着当哨兵 |
| `\bai\b` | 无（用词边界，别误伤中文与 `chain`/`main` 之类） |
| `parser` | 无（用词边界，别误伤 `JSON.parse`） |
| `wiki` | 无 |

### 6.3 三条纪律

1. **白名单按「文件 + 允许的正则」豁免，不按行号。** 行号会漂，漂了豁免就失效，
   然后人就会去放宽词表 —— 那是这类守卫烂掉的标准路径。
2. **扫描范围是产出树全部文件**，含 `package.json` · `pnpm-lock.yaml` · `*.svg` ·
   `public/` · i18n · **以及注释**。注释是本次最大的泄漏面
   （`systemApp.ts` 就是代码干净、注释泄底）。
3. **孤儿 i18n 键不需要另写检查** —— 删了源码却留在 i18n 里的键（如 `widgetAiTitle`）
   本身就是禁词，守卫会当场抓到。

### 6.4 两条结构校验

- `git -C NimoOS-Web rev-list --count HEAD` 必须 **== 1**（零历史）
- `pnpm build` 的产物也过一遍禁词扫描（防 i18n 或注释被打进 bundle）

---

## §7 测试策略

### 7.1 为什么「删」而不是「改写」

约 25 个测试文件混着测被删功能与保留功能。把它们改写成 `oss/files/` 里的分身
= 造 25 个冻结分身，正好犯 §3.3 讲的静默过期问题，还是 ×25。

**换法**：开源仓比私有仓少约 25 个测试文件、覆盖率低一截；
**私有主干一条测试都不少，覆盖率不受影响。**
用「开源仓覆盖率低一点」换掉「25 个会静默过期的分身」，划得来。

### 7.2 整体删除（10 个，零维护）

`home/components/PhotoTile.test.ts` · `home/components/SearchDialog.test.ts` ·
`home/components/widgets/AiWidget.test.ts` · `home/stores/photos.test.ts` ·
`files/viewers/speakerWave.test.ts` · `settings/panels/FolderPermissionsPanel.test.ts` ·
`settings/util/folderPermissions.test.ts` · `settings/util/folderPermissionsSnapshot.test.ts` ·
`settings/util/folderPermissionsView.test.ts` · Service `src/photos.test.ts`

### 7.3 锚点抠个别用例（约 15 个）

以 `it(...)` 整块当锚点。候选（**开工前重新探测，别照抄**）：
`HomeTopbar.test` · `MobileHome.test` · `GridItem.click.test` · `useDock.test` ·
`useDock.reorder.test` · `useOpenAction.test` · `defaultLayout.test` · `homeUi.test` ·
`layout.test` · `panels.test` · `Home.integration.test` · `appPaths.test` ·
`systemApp.test` · `migrateBrowse.test` · `icons.test`

私有侧以后改到那条用例 → 锚点报错把人叫回来。

### 7.4 已知：全量测试退出码是 1（但用例全绿）

```
Unhandled Rejection: TypeError: service.users.avatarPath is not a function
```

SP9-P4 头像那块的异步泄漏，一条测试跑完后才炸。**不是测试红了。**
本项目的验收门若靠退出码判定，必须先修掉它 —— 记忆 `newui-test-gate-speedup-plan`
里的提速方案原本挂着「等 sp7/sp8 合回 master 再做」，
**本项目不合并它们，这个前提消失了，可以顺手做掉。**

### 7.5 产出树上的四道门

```bash
cd /home/nimo/NimoTech/NimoOS-Web
pnpm install
pnpm test                     # 剥离后应比私有侧少约 25 文件、少若干例
pnpm exec vue-tsc --noEmit    # 必须 0 错
pnpm build                    # 必须过，产物再过一遍禁词扫描
```

---

## §8 排期

### 8.1 什么时候开工、什么时候能出包

**答案：等 SP9-P6 收官，即可开工，也可出包。**

P6 是最后一个补**基础能力**的期（KVM 创建向导 / OSSelector / 快照 tab / 全局设置）。
缺了它，开源用户装上之后**没法新建虚拟机** —— 那不是「功能少一点」，是「模块只能看不能用」。
设置区 P0–P5 已齐（终端 tab 是空态，但那是后端 NimoOS-Terminal 整个不存在，
Vue2 侧本来也是坏的）。

P6 期间动的是 `src/kvm/**` 与 KVM 全局设置，**不碰任何一处锚点文件**
—— 但这个判断必须按 §0.3 第 3 条重新验证，不要沿用。

### 8.2 为什么**不用**等 SP9-P8 和 SP10（反直觉，但重要）

摸底发现 `useOpenAction.ts` 的路由表现状：

```js
const SYS_ROUTE = { photos:'/#/photos', ai:'/#/ai/agent', vm:'/#/kvm', settings:'/#/legacy' }
window.location.href = SYS_ROUTE[key] || '/#/legacy'
```

New-UI 自己**已经有** `/settings` 和 `/kvm` 路由（P0–P5 做完了），
只是桌面磁贴还指向 Vue2 —— 翻磁贴正是 P8 cutover 的活。
私有版无所谓（真机上 Vue2 还在跑），但**开源包里没有 Vue2，弹过去就是白屏**。

结论：

- **P8 不用等。** P8 干的是「翻 Vue2 那侧的入口 + 留回退 flag」，属真机升级路径。
  开源包没有 Vue2 可回退 → 导出脚本直接把 `SYS_ROUTE` 拍成内部路由
  （`vm → /kvm`、`settings → /settings`、兜底 → `/`），
  把 `cutoverDisabled()` 拍成恒 `false`。
  **这是一处必然的、有意的行为偏离，要在类 3 锚点里显式登记。**
- **SP10 更不用等。** 开源包里根本没有 Vue2、没有 strangler 机制
  —— 它天然就是「退役之后」的形态。

### 8.3 工作量分账（脚本是最简单的部分）

| 活 | 占比 |
|---|---|
| MediaViewer 拆转录 | ~25% |
| 默认布局重排 + 双主题截图自查 | ~20% |
| 25 个测试文件同步（删 + 抠用例） | ~20% |
| 守卫白名单调试 + i18n 43 键 + README 重写 | ~20% |
| 导出脚本三个文件（约 400–500 行 Node，零依赖） | ~15% |

---

## §9 开源包的已知缺口（要写进 README）

1. **文件区快照套件不全** —— SP6-P7 那 7 个子任务（含 621 行 SnapshotTimeWheel）没迁。
   时间机器那部分是做了的，缺的是完整快照管理。增值功能，不是基础能力。
2. **只有中文 + 英文两种语言** —— Vue2 那 31 个 locale 一直没全量收口。
3. **终端设置 tab 是空态** —— 后端 NimoOS-Terminal 服务不存在（`/v1/sys/wsssh` 与
   `/v1/terminal/settings` 实测均 404）。Vue2 侧同样是坏的。
4. **存储 tab 是跳转入口卡**，不是完整面板（SP9 授权偏离 ③）。

---

## §10 风险与失败模式

### 10.1 主要风险：锚点随私有主干漂移

**表现**：`export.mjs` exit 1 报锚点未命中。
**这是设计意图，不是故障。** 修法 = 看一眼私有侧那几行改成什么了、更新 `manifest.mjs`。
预计频率：P8 与 SP10 各会撞一次（都会动 `useOpenAction.ts`）。

### 10.2 次要风险：REPLACE 分身过期

**已被哈希钉堵住**（§3.3）。若哪天有人为了让脚本跑过而删掉哈希钉，
这条路就重新变成哑火 —— **禁止**。

### 10.3 工作树纪律（血泪教训，必须遵守）

主工作树 index/工作区里长期躺着 3 个 `design-export/*` 的删除态，不属任何一方。

- **永远不要 `git checkout` / `git stash` / `git reset`** —— 会把它们卷走或改变状态
- **`git commit` 必须带显式 pathspec**，绝不裸 `git commit` 或 `git add -A`
  （否则会把 index 里别人的东西一起提交）
- 本项目并发于 SP9-P6，**每个任务的 BASE 现取 HEAD**，评审包按「本任务的提交」范围出

### 10.4 守卫误报/漏报

误报（白名单漏一条）→ 脚本报错，加白名单，成本低。
漏报（词表缺一个词）→ **真泄漏**，成本高。
所以词表宁可宽、白名单宁可细。**禁止用「放宽词表」来消除误报**，只能加精确白名单。

---

## §11 验收

1. `node oss/export.mjs` 一条命令跑通，无警告
2. 产出树四道门全绿（§7.5）
3. `NimoOS-Web` 的 `git rev-list --count HEAD == 1`
4. 手工抽查：`grep -ri "相册\|nimo ai\|transcript\|qdrant\|192.168.1.115" NimoOS-Web/` 零命中
5. **起 dev server 眼验**：`cd NimoOS-Web && pnpm dev --host`
   （注意：**不是** `deploy.sh` —— 设备上只有一个 `/app/` 部署目录，
   而 `deploy.sh` 是 `rsync --delete`，会覆盖别人的部署）
   - 桌面首屏（暗色 + 亮色）：无搜索胶囊、无 AI 组件、无照片磁贴，布局不漏
   - 点设置磁贴 → 落在 `/settings`（不是白屏）
   - 点虚机磁贴 → 落在 `/kvm`（不是白屏）
   - 设置 rail 6 项，无「文件夹权限」
   - 音频预览：播放器 + 波形正常**有颜色**，无三 tab
6. 重跑 `node oss/export.mjs`，结果与第一次逐字节一致（幂等）

---

## §12 交付边界

**做**：`NimoOS-New-UI/oss/` 全套机制 · `NimoOS-Web/` 产出仓（本地，不加 remote）·
`oss/files/` 里 5 个替换文件 · README 重写 · THEMING.md 洗白。

**不做**：推 GitHub（用户自己定时机）· LICENSE/NOTICE · 后端剔除 · ISO/安装脚本 ·
私有基础设施地址 · sp7/sp8 的合并或插件化 · 任何新功能。

---

## §13 勘误（2026-08-04 现场核实）

本节推翻前文若干结论，阅读顺序：§0 → §13 → 其余各节。

**门槛已达成：SP9-P6 已关账，可以开工也可以出包。** P6 的 `1935b3e..cd382d5` 里，非 `src/kvm/**`、非 `docs/`、非测试的改动只有 3 个文件（`i18n/zh_cn.sp9.ts`、`i18n/en_us.sp9.ts`、`styles/theme.sp9.css`），其中前两个本来就在锚点清单里 —— **spec §8.1「P6 不碰锚点」的判断成立**。

以下 14 条是核实中查出的 spec 偏差，T1 负责写回 spec，后续任务按本计划执行：

| # | spec 怎么写的 | 现场事实 |
|---|---|---|
| E1 | `zh_cn.ts` 待删 33 键 | **44 键**。33 是对的（`widgetAiPrompt1/2/3` 因末位数字被 spec 的正则漏掉），但**另有 11 个 `audio*` 转录键完全没登记**：`audioSummary` `audioTranscript` `audioAsk` `audioAskPlaceholder` `audioAskEmpty` `audioAskDemo` `audioHighlightsOnly` `audioShowAll` `audioSpeakerAll` `audioChapters` `audioAllChapters`（第 47-49 行的 `audioSkipBack`/`audioSkipForward`/`audioSpeed` 是播放器控件，**保留**） |
| E2 | 未登记 | **`settings/util/systemConfig.ts` 的 `search_switch` 是真泄漏面**（接口字段 + `SYSTEM_DEFAULTS` 各一处）。决定删两行（索引签名 `[k: string]: unknown` 已保证读改写不丢未知字段），并同步改 `stores/locale.test.ts` 的 mock |
| E3 | `folderBrowser.ts` 走锚点补丁（切断 Wiki 候选） | 删掉 `FolderPermissionsPanel` 后 **`folderBrowser.ts` 零消费方**（`pickerRoots`/`dirEntries`/`crumbsFor` 只有 `folderPerm/FolderPickerDialog.vue` 和它自己的测试在用）→ 改为**整体删除** `folderBrowser.ts` + `folderBrowser.test.ts`。类 3 少一条 |
| E4 | 硬禁词表含 `folderPermission`（无白名单） | **会让守卫永久红**：`UserFolderPermission` 是成员文件夹授权的类型名，`types.ts`/`users.ts`/`MemberFoldersView.vue` 都要保留（spec §4.1 自己说的）。`folderPermission` 必须降为软禁词 + 白名单 `UserFolderPermission` |
| E5 | 未登记 | **`\bai\b` 硬词会误伤 `files/stores/files.ts:139-142`** 的局部变量 `const ai = list.findIndex(...)`（anchorIndex 缩写）。必须进白名单 |
| E6 | §4.1 列了 8 个假阳性 | 另有 3 个未登记的假阳性要进白名单：`apps/util/importNormalize.ts`（`'photo'` 关键词 → `/DATA/Gallery` 路径归一，Vue2 逐字移植）· `settings/panels/AppsPanel.vue`（`Gallery` 出现在系统目录显示串里）· `files/stores/files.ts`（见 E5） |
| E7 | 类 1 未列 | **`CLAUDE.md` 必须删**。它是全仓最直白的「AI 辅助开发」标记，且正文引用了 `docs/THEMING.md` 与 `docs/superpowers/specs/...`（导出后这些路径不存在）。spec 完全没覆盖根目录这一层 |
| E8 | 决策 6 假设导出 `docs/THEMING.md` + `docs/nimoos-app-label-spec.md` | **用户 2026-08-04 拍板：一份文档都不带** → `docs/` 整目录删。类 2 替换从 5 个降为 **4 个**（`THEMING.md` 那条作废） |
| E9 | `.gitignore` 洗到什么程度待拍板 | **用户 2026-08-04 拍板**：删 `.claude/`、`.superpowers/`、`scripts/tmlab/`、`vite.config.tmlab.ts` 四行 + 加 `.export-report.txt` |
| E10 | §0.1 写「sp7/sp8 永久忽略，绝不合并」 | **用户 2026-08-04 拍板：快照发布后仍要合进 master。** 本期剥离清单只覆盖 master 现有残留面；两支合流后，清单需为 `src/photos/**`、`src/ai/**` 两个完整功能区大幅扩张（几十个测试文件、路由、i18n 分片）。§0.1 的措辞要订正，并在 `oss/manifest.mjs` 顶部写明这一预期 |
| E11 | §5.2 担心删 token 会把保留的波形弄没颜色 | **已查清**：`--wave-none` 保留（波形静场竖条在用）、`--spk-1..5` 与 `--wave-dim` 删。另外 `@keyframes pulse` / `--orb-core` / `--orb-glow` 的**唯一**消费方是 `AiWidget.vue`，可以放心删 —— `DropPage.vue` 用的是自己的 `@keyframes dropPulse`，不受影响 |
| E12 | §7.4 说退出码 1 的原因是 `service.users.avatarPath is not a function` | 现象仍在但落点更精确：`src/settings/views/SettingsPage.test.ts` 的 `service.users` mock **缺 `avatarPath`**，测试跳到 `/settings/account` 时 `AccountPanel.vue:43` 的 `avatarSrc` computed 抛错，在用例结束后才浮出 → vitest 报 `Errors 1` 并退出 1，**但 3078 例全绿**。修法是给那个 mock 补一行（T2） |
| E13 | Service 侧只列 `src/photos.ts` + `src/index.ts` | 还要删 `src/types.ts` 的 `export interface PhotoAsset`（第 63 行）。`UserFolderPermission`（第 116 行）**保留** |
| E14 | §0.2 基线 | `src/` 778 → **804** 文件；测试 → **352 文件 / 3078 例**；命中禁词的测试文件仍是 42 个 |

**明确划在范围外（观察到但不动）**：全仓注释里大量引用 `Vue2` / `NimoOS-UI` / `SP4-P8` / `策略 C` / 债务编号 —— 它们泄露的是「有一个旧 UI 和一套内部迁移计划」，**不是 AI/相册/搜索**，不在用户这次的目标里。若以后想洗，是一次独立的工作。
