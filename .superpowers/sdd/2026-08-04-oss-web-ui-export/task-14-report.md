# Task 14 报告:泄漏守卫接入导出流程,白名单调到零命中

## 结论

`node oss/export.mjs --out <dir> --no-commit --allow-dirty-oss`(**不带** `--skip-guard`)
**EXIT=0,守卫零命中**。三个 oss 测试文件 113 例全绿(forbidden 25→34、apply 20→21、
tree 55→58)。产出树 `pnpm test` 366 文件/3157 例全绿,`vue-tsc --noEmit` 0 错。私有仓自身
`pnpm test`(355/3191)与 `vue-tsc` 也保持全绿(未受影响)。

---

## 1. 首次全量命中清单(163 处)分类

跑 `node oss/export.mjs --out /tmp/... --no-commit --allow-dirty-oss`(不带 `--skip-guard`)
第一次拿到 163 处命中(另有 1 处 `settings.png` 二进制预期内跳过,不计入)。逐条分类:

### 1a. 真泄漏(17 处,靠 manifest.mjs 新增 PATCH 修,不碰 forbidden.mjs 词表)

| 位置 | 泄漏内容 | 处理 |
|---|---|---|
| `src/styles/theme.css:1` | 滚动条注释列了"搜索"这个已删场景 | PATCH 去掉"搜索、" |
| `src/styles/theme.css`(dark/light 各一处) | 注释点名已删组件 `SearchDialog` | PATCH 去掉 `SearchDialog·`/`SearchDialog/` |
| `src/styles/theme.css` | 分节标题"2.6 环形图 / 迷你图 / **AI 光球**"(token 早被 T8 删了,标题文字漏网) | PATCH 去掉后半截 |
| `src/home/components/StartAppDialog.vue:36` | spinner 注释拿已删的 `SearchDialog` 当参照物 | PATCH 改成不点名 |
| `src/home/components/GridItem.vue` | CSS 注释"is not clipped on app/folder/**photo** items"(photo kind 早被 T9/T11 删净,注释漏网) | PATCH 去掉 photo |
| `src/home/components/MobileHome.vue` | 注释"photo 磁贴占 2×2"(同上) | PATCH 去掉该分句 |
| `src/home/grid/gridMath.test.ts:130` | 测试标题仍写"snaps app/folder/**photo**"(该 kind 已不存在) | PATCH 改标题 |
| `src/files/upload/dropEntries.ts` + `.test.ts` | 注释点名已删私有模块的函数名 `Photos 的 collectFilesFromDataTransfer` | PATCH 改成不点名 |
| `src/views/Files.vue:265` | 注释"来源:**Vue2 AI**「打开文件位置」" —— 点名了已删的 AI 功能 | PATCH 改成"旧版" |
| `src/kvm/composables/useIsoBrowser.test.ts:11` | fixture 是真机 `curl GET /v1/folder?path=/DATA` 的**逐字**抓取,里面真的有 `.wiki.md`(NimoOS-Wiki 在真实设备上生成的文件,2558 字节的真实大小) | PATCH 换成占位文件名 `notes.txt`,过滤逻辑(非目录非 .iso → 剔除)不受影响 |
| `SystemStatusPanel.test.ts`(2 处)+ `components.test.ts`(1 处) | fixture 是真机 `curl GET /v1/gateway/components` 抓取,`external` 分组下真实列出了 **Qdrant**(暴露私有部署真的跑着 Search/Parser 的依赖) | PATCH 换成占位名 `External Component` |
| `src/views/Home.integration.test.ts:13` | `vi.mock` 里还留着 `service.photos` 的死 mock(Home.vue 早不用了) | PATCH 整行删除 |

**每条都用 `grep -c` 先确认 `find` 锚点在文件里恰好命中 1 次**,`node oss/export.mjs --skip-guard` 跑通确认 PATCH 应用无报错。

### 1b. 误报(146 处,加精确白名单)

全部按 **文件正则 + `exactLine()` 整行精确匹配** 加入 `forbidden.mjs` 的 `SOFT[].allow`(除
pnpm-lock.yaml 两条见下方专门说明)。分类:

- **`photo`(约 50 处)**:`'Photos'`(大写 P)在文件区/快照(时间机器)测试里全部是**举例
  用的普通文件夹名**(与 `Documents`/`Media` 同类),不是被删的相册 app —— 相册 app 的字面量
  是小写 `kind:'photo'`,已被 T9/T11 的 PATCH 删净。逐一核实每个文件后加 exactLine。
  另外 `raidLevel1Usecase` 的英文原文(`en_us.ts`)是 `raidLevels.ts`/`zh_cn.ts` 已有白名单的
  同一条 RAID 用途说明的英文侧,与相册无关。
- **`gallery`(约 17 处)**:全部是 `Gallery=系统默认文件夹` 这条既有保留面(`protect.ts`/
  `icons.ts`/`migrateBrowse.ts` 等)各自的**测试镜像**,练的是同一条代码路径。
- **`search`(15 处)**:`StorePage.vue`(9→实际 15 处,见下方"意外发现")+ `StorePage.test.ts`
  的应用商店分类/作者/关键字过滤器,`composeSettings.ts` 的 Linux capability 常量
  `DAC_READ_SEARCH`,`widget-kit.css` 第三方小组件开发指南里的示例 JS。
- **`ai`(约 4 处 + lockfile)**:`fileCategories.ts` 的 `APPLICATION_ILLUSTRATOR = ['ai','eps']`
  (Adobe Illustrator 扩展名);3 个文件夹图标 svg 内嵌 base64 位图里巧合出现的 `ai` 子串。
- **`pnpm-lock.yaml`(两个文件,根目录 + `packages/service/`)**:第三方包名/resolution/
  integrity 哈希里含 `ai`/`search`/`parser` 子串的噪声,见第 3 节专门说明。

**意外发现(不在 brief 的"9+6"清单里)**:把 `StorePage.vue` 原来"文件+子串"松口径
(`/query\.search|searchInput|filterStoreApps|appsStoreSearch/`)换成整行精确匹配后,
发现该松口径此前**顺带放过了另外 6 行**真正的 search 相关代码(`const search = computed(...)`、
`const searchInput = ref(...)`、`watch(searchInput, ...)` 等)——这些行本身无害(都是应用商店
过滤逻辑),但松口径本身就是"给整个文件按子串开洞"的同一类洞(见 T6.5 复审 Critical 的教训),
必须先枚举全部真实命中再逐行精确匹配,不能只满足于 brief 给的采样数。已用
`grep -n -i search src/apps/views/StorePage.vue` 取到完整清单,15 行(不是 9 行)全部加白名单。

---

## 2. 每条新白名单的理由 + "同文件真泄漏仍被抓"实测

按word归类,每类举 1-2 个代表性例子(完整清单见 `oss/forbidden.mjs` 的 T14 注释):

- **`photo`/`gallery` 系列**:理由已写在 forbidden.mjs 对应行上方的注释块里(逐条说明
  "为什么这是保留面")。实测:`forbidden.test.mjs` 新增
  `T14:新增白名单的合法原文放行 + 同文件真泄漏仍被抓` 这个 describe 块,验证
  `protect.test.ts`/`useFileOps.test.ts`/`StorePage.vue` 等合法原文放行,**追加真实泄漏文本
  后必须命中**(exactLine 的结构性保证:整行精确匹配,任何追加都会让匹配失效)。
- **`fileCategories.ts` 的 `APPLICATION_ILLUSTRATOR`**:Adobe Illustrator 文件扩展名 `ai`,
  与 AI 功能无关。实测:同文件混入 `const askNimoAi = true` 仍命中。
- **3 个图标 svg 的 base64**:`folder-hdd.svg`/`folder-usb.svg` 用"整行只有
  `[A-Za-z0-9+/=]`"的形状规则(base64 续行的唯一特征,真实代码不会写出这种行);
  `folder-root.svg` 用"整行含 `data:image/png;base64,`"字面标记。实测:同文件换成
  `<!-- 这里也集成了 AI 图标生成 -->` 这种正常注释仍命中(因为不含 base64 字符集/
  data URI 标记)。
- **`pnpm-lock.yaml` 的 `ai`/`search`(宽口径)**:自动生成文件,"整行精确匹配"起不到应有
  作用(依赖升级一次,精确到字节的哈希/版本锚点全部作废)。改用"像不像 pnpm-lock 记录行"
  的**形状**规则(`PNPM_LOCK_LINE = /^\s+(resolution|version|specifier|'?@?[\w@/.-]+'?:)/`,
  取自 brief Step 3 给的建议正则)。**只豁免这两个词** —— `photo`/`gallery`/`transcript`/
  `wiki` 在 lockfile 里仍然报,依赖名里真出现这些词才是要人看的信号。实测:同一个文件里插入
  `// 这里我们悄悄集成了 AI 智能推荐` 这种不符合 lockfile 记录行形状的手写注释,仍然命中
  (不是给整个文件开洞)。
- **`pnpm-lock.yaml` 的 `parser`(窄口径,与 ai/search 刻意不同)**:brief 原文要求
  "photo/gallery/transcript/wiki/**parser** 在 lockfile 里仍然报",但实测发现 lockfile 里
  真实存在 7 个知名第三方包名字含 `parser`(`@babel/parser`、`@babel/helper-string-parser`、
  `@csstools/css-parser-algorithms`、`@csstools/css-color-parser`、`engine.io-parser`、
  `socket.io-parser`、`yargs-parser`),与私有的 NimoOS-Parser(RAG 索引服务)毫无关系,不
  应该继续报。权衡后按**包名精确枚举**(不用 ai/search 那条宽松的"像不像记录行"规则)——
  假如 lockfile 里哪天真的出现 `nimoos-parser` 或任何其他 `*-parser` 新依赖,这条正则**不会
  匹配到它**,仍然会被抓到人工看一眼。实测:虚构的 `nimoos-parser@1.0.0:` 与
  `'@nimotech/nimoos-parser@0.1.0':` 两条都仍然命中。

---

## 3. B 组 5 条处理结果

1. **✅ 已修**——`export.mjs` 主流程包了一层 `try/catch`,失败时只打
   `[oss] 失败:${err.message}` + `process.exit(1)`,不再打原始 Node stack trace。实测:
   故意触发 checkClean 失败,输出干净、EXIT=1,无 `at ModuleJob.run` 一类的堆栈噪音。
2. **✅ 已修**——`isExpectedSkip` 连同两条固定文案 `SKIP_REASON_SYMLINK`/`SKIP_REASON_BINARY`
   一起从 `forbidden.mjs` **导出**,`scanTree` 内部 `skip()` 调用也改用这两个常量(消灭了
   "两处硬编码中文字符串必须逐字相同"这个漂移点,结构上而非人工约定上防止分类滑向 fatal)。
   `forbidden.test.mjs` 新增 3 个单测直接锁住分类结果,包括"改一个标点(顿号→逗号)就不再
   判定为预期内"的负向断言。
3. **✅ 已修**——`applyPatch` 的 `find` 检查从 `find === ''` 放宽成
   `typeof find !== 'string' || find === ''`,给出设计过的诊断文案而不是原生
   `TypeError: The "searchString" argument must be of type string`。`apply.test.mjs` 新增
   1 个测试覆盖 `find` 缺失(字段名拼错)和 `find: null` 两种情形,并断言抛出的**不是**
   `TypeError` 实例。
4. **✅ 已修**——`tree.test.mjs` 的 `FORBIDDEN` 固定清单里 `/SP\d/i` 改成 `/\bSP\d/i`。新增
   一个直接测正则边界的用例:`wasp7`/`grasp789`/`crisp42` 不再误伤,`SP9`/`sp7`/`(SP8)`
   仍然命中。
5. **✅ 已修**(brief 标"优先级最低,做不完可挂账",但做完了)——`--allow-dirty-oss` 的
   放行正则从 `/^.{2}\s+oss\//`(只看 rename 行的旧路径)改成
   `/^.{2}\s+oss\/(?:(?!\s->\s).)*(?:\s->\s+oss\/.*)?$/`(消费掉整行:如果是 rename/copy,
   `->` 后面的新路径也必须落在 `oss/` 下才放行)。用一个真实的一次性临时 git 仓库复现了
   原 bug(`git mv oss/foo.mjs src/moved.ts` 产生的 `R  oss/foo.mjs -> src/moved.ts` 行,
   旧正则放行、新正则正确拦截),复现脚本用完即删,未触碰本仓库任何状态。

---

## 4. Category C:`smart`/`settingsFpIntro` 人工核对结论

brief 点名的 `src/i18n/en_us.sp9.ts` 的 `settingsFpIntro` **在私有源码里其实还在**
(`en_us.sp9.ts:238`、`zh_cn.sp9.ts:246`,消费方 `FolderPermissionsPanel.vue` 也还在)——
brief 说"已被 T8 删掉"指的是**导出流程**(T8 的 PATCH 从两个 locale 文件里摘掉了这个键,
`FolderPermissionsPanel.vue` 本身在 DELETE 清单里整个不导出),不是私有仓删除。

实测确认:
```
grep -rn "settingsFpIntro\|FolderPermissionsPanel" /tmp/t14-tree/src/   # 无输出,确认已从导出树消失
grep -rn -i "smart" /tmp/t14-tree/src/                                  # 10 处,全部是磁盘 S.M.A.R.T. 健康检测文案
```
导出树里没有任何"英文侧含 smart、键名不含 ai"的残留,没有发现同类盲区。**未放宽词表**,
`smart` 依旧不在词表里,靠中文孪生键(`智能`)+ 整块删除(DELETE/PATCH)双重保证。

---

## 5. 负向验证

按 brief 的方法(cp 备份/还原,不用 git checkout/stash):

```
F=src/home/components/HomeTopbar.vue
cp "$F" /tmp/guard-backup.vue
echo "// 打开相册看看" >> "$F"
node oss/export.mjs --out /tmp/oss-guard2 --no-commit --allow-dirty-oss
```
输出:
```
[oss] 1/6 前置检查
[oss] 失败:.../NimoOS-New-UI 工作树不干净,导出中止:
 M src/home/components/HomeTopbar.vue
EXIT=1
```
`/tmp/oss-guard2` 未创建,`git status --porcelain -- "$F"` 还原后为空。

**重要发现(记入疑问区)**:`git archive HEAD` 只取**已提交**内容,完全不看工作区的
未提交改动——所以往一个已跟踪文件的工作区副本里追加文字,实际拦下它的是 `checkClean`
(工作树不干净),**根本走不到内容扫描那一步**;`export.mjs` 也确实"一个字节都不落盘"
(EXIT=1,输出目录未创建),满足负向验证的核心诉求,只是拦截点在检查清洁度而不是在
内容扫描。为了同时证明**内容扫描本身**(`scanText`/`scanTree`,导出真正用来判定的那段
逻辑)独立地也会抓住这句话,额外直接调用 `scanText()` 扫了被追加后的 `HomeTopbar.vue`:
命中 `{"word":"相册","line":62,"excerpt":"// 打开相册看看"}`(以及该文件私有原文里本来就有
的一批 `search` 命中,这些会在导出时被 T6 的 PATCH 提前清洗掉,私有源里还在)。两条证据
合起来:守卫在"工作区脏改动"和"已提交内容"两个层面都会拦住真泄漏,没有任何一层是摆设。

---

## 6. 测试结果

```
node oss/export.mjs --out /tmp/t14-tree --no-commit --allow-dirty-oss   # 不带 --skip-guard
```
```
[oss] 1/6 前置检查
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 30 · REPLACE 4 · PATCH 150)
[oss] 4/6 内嵌共享包
[oss] 5/6 泄漏守卫
[oss]   ⚠ 1 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定):
[oss]     ⚠ 未扫描:src/home/apps/icons/settings.png —— 判定为二进制,未扫描
[oss]   零真实泄漏命中(1 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成 → /tmp/t14-tree
EXIT=0
```

| 检查 | 结果 |
|---|---|
| `pnpm exec vitest run oss/forbidden.test.mjs` | 34 例全绿(25 基线 + 9 新增) |
| `pnpm exec vitest run oss/apply.test.mjs` | 21 例全绿(20 基线 + 1 新增) |
| `pnpm exec vitest run oss/tree.test.mjs` | 58 例全绿(55 基线 + 3 新增) |
| `pnpm exec vitest run oss/` | 3 文件 / 113 例全绿 |
| 产出树 `pnpm install && pnpm test` | 366 文件 / 3157 例全绿(与任务描述基线一致) |
| 产出树 `pnpm exec vue-tsc --noEmit` | 0 错 |
| 私有仓自身 `pnpm test`(确认未被 T14 影响) | 355 文件 / 3191 例全绿 |
| 私有仓自身 `vue-tsc --noEmit` | 0 错 |

---

## 7. 自查结论

- 未放宽任何词表;`HARD`/`SOFT` 的正则本体一个字符都没改,只加了 allow 条目 + 两条新工具
  (`PNPM_LOCK_LINE`、`isExpectedSkip`)。
- 所有新增白名单都能回答"为什么是合法保留面",且逐类做了"追加真实泄漏仍被抓"的实测
  (第 2 节 + `forbidden.test.mjs` 的 `T14` describe 块)。
- 除 `pnpm-lock.yaml` 的 `ai`/`search`/`parser`(自动生成文件,已在第 3 节说明为何不用
  exactLine)外,**全部新增白名单用 `exactLine()` 整行精确匹配**,没有退回子串/键名匹配。
- 真泄漏(17 处)全部通过 `oss/manifest.mjs` 的新 PATCH 条目在导出阶段改写,**没有触碰
  `src/**` 或 `../NimoOS-Service/**` 任何一个文件**——`git status --porcelain` 只剩 7 个
  `oss/*` 的 `M` 和 3 行既有的 `design-export/*` 的 ` D`。
- 既有测试一条没变红(forbidden 25/apply 20/tree 55 全部保留,只新增不修改断言内容,除了
  两条因 T14 收紧 `search` 白名单口径而必须同步更新真实内容的旧样本,已在 §疑虑 说明)。

## 疑虑

1. **`forbidden.test.mjs` 里两条旧样本被改了内容(不是新增)**:`'search' 保留面不许误报`
   测试原来的 `["src/apps/views/StorePage.vue", "route.query.search as string"]` 和
   `'const searchInput = ref("")'` 是**编造的简化文本**,只是碰巧匹配旧的"文件+子串"松口径
   ——本身不是真实源码。收紧 `StorePage.vue` 的白名单为整行精确匹配后,这两条编造文本自然
   不再匹配任何新条目(它们本来就不是源码原文)。已换成逐字摘自 `StorePage.vue` 源码的真实
   行。这是本次任务范围内必要的修正,不是新增测试掩盖旧测试,但因为改的是"内容"而不是纯
   增量,单独标注请复核。
2. **`git archive HEAD` 与 checkClean 的关系**(第 5 节已详述):brief Step 4 的负向验证方法
   在"修改已跟踪文件的工作区副本"这个具体场景下,实际拦截点是 `checkClean`(工作树不干净)
   而不是内容扫描本身——因为 `git archive` 从不读工作区脏改动。这不是缺陷(两层拦截叠加,
   结果都是"零字节落盘"),但如果后续有人想专门针对"内容扫描"本身做端到端负向验证,需要
   把泄漏提交进一个临时 commit 再验证(本次为避免操作仓库历史,改用直接调用 `scanText()`
   的方式独立验证了内容扫描逻辑,细节见第 5 节)。
3. `oss/README.md`(面向外部开发者)提到"四条已知缺口"是 T12 的产出,本次任务未涉及,
   未检查是否需要因 T14 的改动同步更新(判断不需要,因为 T14 不改变导出行为的用户可见面,
   只是让守卫真正生效)。
