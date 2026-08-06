# SP8-P2a Task 9 — ModelsSection(本地模型)实现报告

工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`。
任务起点 HEAD `5a9dc04`;提交时因 P2b 会话并行推进,HEAD 已前移到 `8a55456`
(P2b Task 4)。本任务提交 `a21a0b2`,建立在 `8a55456` 之上。

## 1. 与 Vue2 的逐块对照

Vue2 源:`src/views/AI/Settings/sections/ModelsSection.vue`(222 行)。

| 区块 | Vue2 行号 | New-UI 实现 | 说明 |
|---|---|---|---|
| 页头(h1 + desc) | 4-5 | `.set-page-head` | `aiCfgLocalModels`(复用) / `aiCfgModelsDesc` |
| 已装模型卡头 | 11-18 | `.set-cardhead` | 计数 = `store.installedModels.length`;刷新按钮调 `store.loadModels()` |
| 下载进度横幅 | 21-60 | `v-for="(job, filename) in store.hfImportJobs"` | 四态标题/取消按钮文案/进度条/统计行/勿关机警告,见下方 §2 |
| 加载中/空态/表格 | 62-81 | `.set-note` / `.set-table` | `modelsLoading` → `else if` 空态 → `else` 表格,三路径互斥,逐字保留分支顺序 |
| 从 Ollama 拉取 | 86-106 | 第二张 `.sk-section` | 输入框 v-model + 回车 + 按钮 disabled(`!store.pullModelInput`)+ 在途提示 |
| HuggingFace 导入 | 110-153 | 第三张 `.sk-section` | 搜索框 → 结果列表 → 选中态 → 文件区 → 逐个导入 |
| `formatSize`(methods) | 170-175 | `src/ai/util/formatModelSize.ts::formatModelSize` | 抽成纯函数,逻辑逐字未变(见 §5 结构调整说明) |
| `etaLabel`(methods) | 176-180 | `formatEtaSeconds` + 组件内 `etaLabel()` 包装 | 纯函数只返回 `{unit,n}`,i18n 挑键留在组件 |
| `confirmDelete` | 181-194 | `deleteDlg` ref + `AlertDialog` + `requestDelete`/`onDeleteConfirm` | Buefy confirm → 共享 AlertDialog |
| `onPull`/`onSearch`/`onImport` | 195-219 | 同名函数 | 逻辑逐字保留(含 `onPull` 提前捕获 trim 后的 name,再调 store 清空输入框) |

## 2. 下载进度横幅四态(本任务重点)

| 态 | 标题键 | 取消/关闭按钮 | 勿关机警告 | 统计行 |
|---|---|---|---|---|
| `downloading` | `aiCfgImporting`(正在导入) | 「取消」→ `cancelImportJob` | 有 | 有(百分比/大小/speed>0 才有速度/etaSecs 非空才有 ETA) |
| `creating model` | `aiCfgRegisteringModel`(正在注册模型…) | 「取消」→ `cancelImportJob` | 有 | 有 |
| `success` | `aiCfgImportComplete`(导入完成) | **无按钮**(`v-if="status!=='success'"`) | 无 | 有 |
| `error` | `aiCfgImportFailed`(导入失败) | 「关闭」→ `dismissImportJob` | 无 | **无**,改渲染 `job.error` 文本 |

进度条宽度与统计行百分比是两套独立的除零兜底(逐字保留 Vue2 :47 与 :51 的不同 fallback):
- 进度条宽度:`total>0 ? ...toFixed(1)+'%' : '0%'`
- 统计行百分比:`total>0 ? ...toFixed(0)+'%' : '—'`

## 3. 测试真实输出(红→绿)

### 3.1 `formatModelSize.test.ts`

RED(实现文件不存在):
```
FAIL  src/ai/util/formatModelSize.test.ts [ src/ai/util/formatModelSize.test.ts ]
Error: Failed to resolve import "./formatModelSize" from "src/ai/util/formatModelSize.test.ts".
```

写完 `formatModelSize.ts` 后 GREEN:
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

### 3.2 `ModelsSection.test.ts`

测试文件与组件文件是在同一批工具调用里一起写的(未经过「组件文件不存在」这层
古典 RED)——**这是对 brief Step 3/4 严格顺序的一处流程偏离,如实申报**:
根因是三张卡的模板/交互面较大,先把测试用例列全(依据 brief 21 条清单逐条对
Vue2 源码反推预期行为)、同时把组件写完更利于保持两者结构对应,不是刻意跳过
TDD。但确实拿到了一条**真实的红**(不是「文件缺失」型,是「断言与真实渲染行为
不符」型),来自对 jsdom CSSOM 序列化规则的错误假设:

首次跑 28 例时,用例 19a(`total>0` 进度条宽度)用了 Vue2 brief 字面给的
30/120(=25.0%)断言 `style.width === '25.0%'`,实际输出:

```
FAIL  ... > 19a. total > 0 → 进度条宽度按百分比(一位小数)
AssertionError: expected '25%' to be '25.0%'
Received: "25%"
```

用 node 直接验证是 jsdom(与真实浏览器 CSSOM 序列化规则一致)在归一化整数值
的百分比字符串,与 Vue 或本组件实现无关:
```js
d.style.width = '25.0%'; d.style.width // => "25%"
d.style.width = '33.3%'; d.style.width // => "33.3%"（非整数不被裁剪）
```
把测试数据换成 1/3(=33.3%,非整数)后重跑,27/28 → **28/28 全绿**。

## 4. brief Step 7 RED 验证(除零守卫)两段真实输出

**RED**(把 `job.total > 0 ? ((job.completed/job.total)*100).toFixed(1)+'%' : '0%'`
改成直接 `((job.completed/job.total)*100).toFixed(1)+'%'`,去掉三元守卫):

```
 FAIL  src/ai/components/settings/sections/ModelsSection.test.ts > ModelsSection > 19b. total === 0 → 进度条宽度是 0%,不是 NaN%(对照组)
AssertionError: expected '' to be '0%'
- Expected
+ Received
- 0%

 Tests  1 failed | 27 skipped (28)
```

说明:`0/0*100` 算出 `NaN`,`.toFixed(1)+'%'` 得到字符串 `"NaN%"`;jsdom 认为
`"NaN%"` 不是合法的 CSS `<length-percentage>`,直接拒绝写入,读回是空字符串
而不是字面 `"NaN%"`——但无论以哪种形式呈现,都**不是**测试期望的 `"0%"`,红得
干净利落,证明了守卫存在的必要性。

**GREEN**(复原三元守卫):
```
 Test Files  1 passed (1)
      Tests  1 passed | 27 skipped (28)
```

复原后 `git diff` 为空(用 `cp` 备份/恢复,未走 git,以 diff 确认精确复原)。

## 5. 结构调整声明(非行为改动)

`formatSize`/`etaLabel` 原是 Vue2 组件的 `methods`,抽成
`src/ai/util/formatModelSize.ts` 的两个纯函数(`formatModelSize`/
`formatEtaSeconds`),是为了能精确单测边界(GB/MB 边界、0/null/undefined、
sec/min/hr 边界)——组件 methods 混在一起无法独立单测到这些分支。逻辑逐字
未变。`formatEtaSeconds` 返回 `{unit,n}` 结构体而非字符串,i18n 挑键留在
组件里过 `t()`,与 P1c2 `formatDuration` 的既定处理同款(该文件头有引用)。

## 6. 实际测试条数

- `formatModelSize.test.ts`:**8 条**(`formatModelSize` 4 条 + `formatEtaSeconds` 4 条)
- `ModelsSection.test.ts`:**28 条**(`grep -c '  it('` 实测确认),对应 brief 21
  条用例清单(部分拆成多个 `it()` 便于精确定位失败点,只增不减):
  - 1-5(空态/加载中/表格/计数/刷新)= 5 条
  - 6-8(删除确认三段)= 3 条
  - 9-11(拉取:disabled/成功/回车)= 3 条
  - 12(pullingModels 有/无,对照组,同一条内两个断言)= 1 条
  - 13(HF 搜索 disabled/点击,拆 13a/13b)= 2 条
  - 14-17(搜索中/结果列表/文件区/导入按钮)= 4 条
  - 18(四态,18a-18d)= 4 条
  - 19(除零对照,19a/19b)= 2 条
  - 20(speed/eta 独立开关,20a/20b)= 2 条
  - 21(dismiss/cancel 分流,21a/21b)= 2 条
  合计 5+3+3+1+2+4+4+2+2+2 = 28。
- 两个新文件合计 **36 条测试**。

## 7. 自拟文案清单

**空。** 全部 39 处 `$t(...)` 调用对应的英文 key 都在 Vue2 生产
`zh_CN.json`/`en_US.json` 里查到了权威译文并逐字复用(命令见 brief Global
Constraints 一节),没有一条是自己拟的。

## 8. 对 Vue2 的偏离(逐条)

1. **formatSize/etaLabel 抽成独立纯函数**(ModelsSection.vue:170-180)——结构
   调整,非行为改动,理由见 §5。已在代码注释与本报告申报。
2. **进度条宽度测试用例改用 1/3 而非 brief 字面的 30/120**(测试文件内注释
   已写明)——不是对 Vue2/实现的偏离,是测试断言写法的修正:jsdom(与真实浏览器
   CSSOM 序列化规则一致)会把整数值的百分比字符串裁掉尾随 `.0`,用
   `element.style.width` 断言 `'25.0%'` 测不出 `toFixed(1)` 与 `toFixed(0)`
   的差异,换成不能整除的数字后测试才真正验证到「一位小数」这条逻辑分支。
3. **AlertDialog 需要必填 `title`,Buefy 原调用没有独立标题**(ModelsSection.vue
   文件头有完整说明)——`$buefy.dialog.confirm({message, type})` 没有单独的
   title 概念,而共享 `AlertDialog` 组件强制要求 `title`/`confirmText`/
   `cancelText` 三个 prop。这不是在修 Vue2 的 bug,是接一个更严格的共享原语时
   必须补的参数。照 `AgentSidebar.vue:192-200` 的先例,title 与 confirmText
   都复用「删除」(`aiCfgDelete`)这个动作名,不新造通用的「确认」文案。
4. **`aiCfgSearchBtn`(HF 搜索按钮)与既有 `aiCfgSearch`(P2b 导航「搜索」分区
   标签)不复用同一个键**,尽管当前字面值都是「搜索」——两者语义不同(本组件
   的 HF 模型检索 vs Agent 自身的检索设置项),Vue2 虽然字面上恰好都是同一个
   英文单词,但把两个不同概念耦合到一条译文上,将来任一处需要独立改文案时会
   互相牵连,故分开建键。
5. **测试文件与组件文件在同一批写完,未经过「组件不存在」这层古典 RED**——
   流程偏离,已在 §3.2 如实申报;虽跳过了这一层 RED,但仍然拿到了一条真实的
   断言级红(19a 的 jsdom 序列化问题)并据此修正,不是空转的伪 TDD。

## 9. 任务门判定过程

```
pnpm test                     → 272 files / 2063 tests, 全绿(初次跑遇到 1 个失败套件
                                  BlacklistSection.test.ts 缺 BlacklistSection.vue ——
                                  经确认是 P2b 会话在途文件,~1 分钟后 P2b 会话补上
                                  该文件并提交为 8a55456,复跑后 272/272 全绿)
pnpm exec vue-tsc --noEmit    → 无输出,干净
pnpm build                    → 构建成功,仅既有 >500KB chunk 第三方警告(ExcelViewer/
                                  index-DV-3r6h3/PdfViewer,与本任务无关,基线既有)
```

判定依据:
1. 我自己的两个测试文件(`formatModelSize.test.ts` 8/8、`ModelsSection.test.ts`
   28/28)在最终全量跑里全绿。
2. `vue-tsc --noEmit` 零输出。
3. 全量测试过程中唯一出现过的失败(`BlacklistSection.test.ts` 找不到
   `BlacklistSection.vue`)经 `git status`/`git log` 核实是并行 P2b 会话
   Task 4 的在途文件(该 `.vue` 文件在我的测试运行之间被对方补上,随后对方
   提交为 `8a55456`),不属于本任务改动范围;复跑后该失败已消失,不构成
   遗留的红项。

## 10. 工作区共享自查

- 全程未 `git add -A`/`git add .`。
- 提交前 `git status` 发现 P2b 会话已把 `BlacklistSection.vue`/
  `BlacklistSection.test.ts`/`apiError.ts`/`apiError.test.ts` 从暂存区提交为
  独立 commit `8a55456`(`git log` 确认作者/时间戳属于该会话),我的操作未曾
  触碰或提交这些文件。
- `git add` 只列本任务 7 个显式路径:
  ```
  src/ai/components/settings/sections/ModelsSection.vue
  src/ai/components/settings/sections/ModelsSection.test.ts
  src/ai/util/formatModelSize.ts
  src/ai/util/formatModelSize.test.ts
  src/ai/views/SettingsPage.vue
  src/i18n/zh_cn.ts
  src/i18n/en_us.ts
  ```
- `git commit -m ... -- <同 7 路径>` 用 pathspec 限定提交范围。提交前在
  `/tmp` 用最小复现验证:即使索引里存在其他已暂存但未随 pathspec 传入的文件,
  `git commit -m ... -- <pathspec>` 只会把 pathspec 覆盖的路径打进这次提交,
  其余已暂存文件保持原样留在索引里,不会被误卷入。
- `git show --stat HEAD` 确认提交恰好是这 7 个文件;`git status` 确认
  working tree clean、无残留改动。

## 11. `git show --stat HEAD`

```
commit a21a0b2547022c4f9505bfe8a98aeff0dc8711b0
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Jul 28 19:11:55 2026 +0800

    SP8-P2a Task 9: ModelsSection(本地模型)

 .../settings/sections/ModelsSection.test.ts        | 369 +++++++++++++++++++++
 .../components/settings/sections/ModelsSection.vue | 282 ++++++++++++++++
 src/ai/util/formatModelSize.test.ts                |  39 +++
 src/ai/util/formatModelSize.ts                      |  27 ++
 src/ai/views/SettingsPage.vue                       |   3 +-
 src/i18n/en_us.ts                                    |  50 +++
 src/i18n/zh_cn.ts                                    |  47 +++
 7 files changed, 816 insertions(+), 1 deletion(-)
```
