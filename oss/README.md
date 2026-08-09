# oss/ —— NimoOS-Web 导出机制运维手册

`oss/` 本身**不进产物**(`DELETE` 表第一条就是 `'oss'`)——这份文档只服务于在
`NimoOS-New-UI`(本仓)里维护导出机制的人,不随 NimoOS-Web 发布。

台账 / 决策记录在 `.superpowers/sdd/`,但那个目录被 `.gitignore` 排除、不进 git
——本文件是**唯一进 git、能存活下来的**导出运维手册。写完请连同代码一起提交。

---

## 1. 六步流程 + 五道门

`oss/export.mjs` 单文件编排,固定六步(见该文件内 `1/6`..`6/6` 的 log):

1. **前置检查** —— 本仓(`NimoOS-New-UI`)工作树必须干净(`checkClean`),记录 HEAD。
   (共享包 `@nimotech/nimoos-service` 已内联在 `packages/service/`——SP13 之前这里
   还要额外检查同级仓 `NimoOS-Service` 是否干净,内联后那个仓已经不在导出路径里了。)
2. **取源** —— `git archive HEAD | tar -x` 到临时目录(天然排除 `.git`/`node_modules`/
   `dist`/`.superpowers` 等未跟踪或被 gitignore 的内容);`packages/service/` 是本仓的
   子目录,随这一次 `archive` 一起取出,不再需要对另一个仓再 archive 一遍。
3. **应用清单** —— 顺序固定 `DELETE → REPLACE → PATCH`(`manifest.mjs` 的五张表);
   `SERVICE_DELETE`/`SERVICE_PATCH` 额外应用在 `packages/service/` 子目录上(参见
   `export.mjs` 里那两条独立表存在的理由——不是"两个仓各自一套",是"同一棵树里
   两个各自独立入库的台账目录都要剔除")。
4. **重算 lockfile** —— 清单摘掉了部分 `package.json` 依赖(`dependencies`),
   `pnpm install --lockfile-only` 让 `pnpm-lock.yaml` 与之保持一致。(SP13 内联前这一步
   还要把 `package.json`/`pnpm-lock.yaml` 里 `file:../NimoOS-Service` 的路径重写成
   `file:packages/service`;内联后私有仓本身写的就是 `file:packages/service`,这项
   路径重写已经不存在,只剩 lockfile 重算这一件事。)
5. **泄漏守卫** —— `forbidden.mjs` 的 `scanTree` 扫全部文本文件(HARD 硬禁词 + SOFT 中文
   软禁词,逐条白名单),命中即 `throw`,一个字节都不落盘。
6. **落盘**(+ **只在 `--publish` 时**零历史提交)—— `rsync --delete` 覆盖 `--out` 目录;
   给了 `--publish` 才会 `git init -b main`(或 `--amend` 已有仓库)得到 **rev-list 恒为 1**
   的单提交仓库。**不给 `--publish` 就只落盘,不建仓、不提交。**

### 两个阶段:预览随便跑,发布才写公开仓

**默认(不带 `--publish`)导到临时预览目录 `/tmp/nimoos-web-preview`,碰不到公开仓。**
所以"改一版看一眼"想跑几遍跑几遍;只有你确认满意了,才用 `--publish` 发布。

```bash
# 门 0:oss/ 自身单测(改完 manifest.mjs / *.mjs 之后先跑这个)
cd NimoOS-New-UI
pnpm exec vitest run oss/

# ── 阶段一:预览(安全,可反复跑)─────────────────────────────────────────
# 不带 --skip-guard / --allow-dirty-oss —— 工作树必须干净、清单必须描述 HEAD 的真实内容
node oss/export.mjs
# 期望末行 [oss] 完成 → /tmp/nimoos-web-preview,5/6 报「零真实泄漏命中」

# 五道门跑在预览目录上。`vue-tsc --noEmit` 是唯一能抓到「PATCH 漏改导致类型不匹配」
# 这类错误的门,**不在任何自动测试里**,不可省。
cd /tmp/nimoos-web-preview

# 门 1:装依赖(★ C1 的回归保护,CI 默认 --frozen-lockfile,裸 install 测不出这类问题)
rm -rf node_modules
pnpm install --frozen-lockfile   # 必须 EXIT=0,且装完 lockfile 一字节不变

# 门 2:测试
pnpm test                        # 必须 EXIT=0

# 门 3:类型检查(不可省,唯一能抓 PATCH 漏改的门)
pnpm exec vue-tsc --noEmit       # 必须 EXIT=0

# 门 4:构建
pnpm build                       # 必须 EXIT=0(vue-tsc --noEmit + vite build)

# 门 5:构建产物扫描 + 品牌 grep
cd -
node oss/scan-dist.mjs /tmp/nimoos-web-preview/dist   # 必须 EXIT=0,零命中
grep -ric "nimoos-search\|nimoos-parser\|nimoos-photos\|nimoos-ai" \
  /tmp/nimoos-web-preview/dist | grep -v ':0$'        # 必须无输出

# ── 阶段二:发布(五道门全绿、且你确认满意之后才跑)────────────────────
node oss/export.mjs --publish
# 这一步才会 rsync --delete 覆盖 ../NimoOS-Web 并 git commit --amend 改掉它的 HEAD
```

发布后再验零历史 + 幂等:

```bash
git -C ../NimoOS-Web rev-list --count HEAD   # 必须是 1
node oss/export.mjs --publish                # 再跑一次
git -C ../NimoOS-Web status --porcelain      # 应为空(幂等)
git -C ../NimoOS-Web rev-list --count HEAD   # 仍是 1(--amend,不是新提交)
```

> ⚠️ **已知待处理**:本地 `NimoOS-Web` 目前有 **2 个提交**(`748aa8f` + 手工写的 README
> `4957653`),而上面那条断言要求恒为 1 ⇒ **现在跑 `--publish` 必定在最后一步报错,而且是
> "先 amend 掉那条 README 提交、再报错"**。发布前要先把这 2 个提交理顺(挤回单提交,
> 或者放弃零历史约束并改掉 `export.mjs` 里那条断言)。另:本地领先 `origin/main` 一个提交。

## 2. 七个 flag

| flag | 用途 |
|---|---|
| `--publish` | **发布模式**:产出目录切到公开仓 `../NimoOS-Web` 并建仓提交。**不给它,公开仓一个字节都不会变。** |
| `--out <dir>` | 指定产出目录,覆盖默认值(默认:不带 `--publish` 时 `/tmp/nimoos-web-preview`,带 `--publish` 时 `../NimoOS-Web`)。 |
| `--no-commit` | 即使给了 `--publish` 也只落盘、不提交。 |
| `--skip-guard` | 跳过第 5 步泄漏守卫,**只供开发期**(比如临时确认取源/清单本身没问题,不代表内容安全)。 |
| `--keep-temp` | 落盘后不删中间临时目录(取源 + 应用清单之后的那份),排查"清单到底改出了什么"时有用。 |
| `--allow-dirty-oss` | 放行 `oss/` 目录下的未提交改动(其余源码仍必须干净)。**只供 oss/ 自身的开发迭代**——反复改 `manifest.mjs` 时不用每次都先 commit 才能跑一次导出验证。 |
| `-h`, `--help` | 打印用法后退出,不执行任何导出。 |

**不认识的参数一律拒绝执行**(白名单校验,先于一切),来由见下面 §8。

**正式发布一律不带 `--skip-guard` 与 `--allow-dirty-oss`。** 前者会让一次导出完全不经过
安全检查;后者会让产物对不上 `git archive HEAD` 实际取到的源码版本——"清单描述的删改"
和"清单描述时刻的源码"必须是同一个 commit。

## 3. 三条决策树

**锚点漂了怎么办**(`applyPatch`/`applyReplace`/`applyDelete` 抛"未命中"/"目标不存在"类错误)：
私有主干这行代码已经变了(改名、重排、被别的改动动过)。打开对应文件现场
`sed -n` 逐字抓新的原文，更新 `manifest.mjs` 里的 `find`/`path`。**不要**猜一个大概齐的
新锚点就往上填——命中次数必须现场用 `node -e` 或 `grep -c -F` 验证恰好 1 次再写进去，
这是本项目在"手编 fixture"上吃过三次亏后定的规矩。

**哈希钉响了怎么办**(`REPLACE` 的 `privateSha256` 不匹配)：私有侧那个源文件被后续开发
改动过，`oss/files/` 里的冻结分身没跟着更新。**禁止删掉哈希钉让脚本跑过**——那等于让这条
路重新变成哑火（私有侧继续变化，产出树永远停在旧快照）。正确做法：对比私有侧新内容和
冻结分身，把新增/删改的部分**重新做一遍剥离**（不是整份复制过去——分身本来就是"私有版
减掉不该公开的部分"），改完再把 `privateSha256` 更新为私有侧的新哈希。

**守卫误报怎么办**(`forbidden.mjs` 的 `scanTree`/`scanDist` 命中了合法内容)：先确认真的
是误报（合法上下文里包含了词表里的字面量，比如"上传照片库"里的"照片"其实是文件类型
枚举、不是相册功能）。**禁止放宽词表/删词/改松正则来消除误报**——往对应词条的 `allow`
数组里加一条**精确**的原文白名单（`SOFT` 表每条都有 `word` + `allow: []`），使其只放行
这一处具体上下文，不放行其他任何含同一字面量的位置。加完记得反向验证：在同一行**紧邻**
处人为注入一句真泄漏，确认白名单不会连带放过它（`forbidden.test.mjs` 里的"同行加泄漏
必命中"就是这个模式）。

## 4. 两条铁律

1. **禁止放宽词表消除误报。** 见上面"守卫误报怎么办"——唯一允许的动作是加精确白名单，
   不允许删词、放松正则、缩小扫描范围。
2. **禁止删哈希钉。** 见上面"哈希钉响了怎么办"——`privateSha256` 存在的意义就是逼着人
   在私有侧变化时**看一眼**要不要同步冻结分身，删掉它等于放弃这层保护。

## 5. 发布路径：走 `git push`，不是打包目录

`export.mjs` 落盘后得到的是**一个本地 git 仓库**（`rev-list --count HEAD === 1`），
发布方式是把这个仓库 `git push` 到公开托管平台（GitHub 等），**不是**把 `NimoOS-Web/`
目录整个打包（tar/zip）发出去。

这个区别是硬性的，原因是两个已知的"只在打包时才会漏"的坑：

- `.export-report.txt`（含两个私有仓的 commit hash）在产出仓的 `.gitignore` 里，
  `git push` 天然不会带上它；但如果改成"打包整个目录"发布，这个文件会原样躺在压缩包里。
- `public/demo/`（空目录）同理——git 不跟踪空目录，`git push` 不会带上它；打包目录会。

**结论：发布前先确认走的是 `git remote add` + `git push` 这条路，不要图省事直接打包
`NimoOS-Web/` 目录整个发出去。**

## 6. E10 预告：sp7/sp8 合流后要扩清单

`manifest.mjs` 顶部已有一段拍板记录：sp7-photos / sp8-ai 两支在快照发布后仍要合进
`master`。**本清单目前只覆盖 master 上的 AI/相册残留面**——sp7/sp8 合流后，
`src/photos/**` 与 `src/ai/**` 会作为两个完整功能区出现在主干上，需要为它们扩张
`DELETE`/`REPLACE`/`PATCH` 三张表（路由、i18n 分片、数十个测试文件）。这是一次独立的
工作，不是本次修复波的范围。合流开工前建议先过一遍 `.superpowers/sdd/` 里
`2026-08-04-oss-web-ui-export/` 目录下的评审记录（若已按 §「顺带建议」放行进 git，
否则先找回台账副本）。

---

## 7. 2026-08-04 修复波改了什么(final-review 发布前必修 10 条)

评审记录：`.superpowers/sdd/2026-08-04-oss-web-ui-export/final-review-findings.md`
第 1 节「发布前必修」。这一波只动了 `oss/` 下的文件，`170` 条 `PATCH`（原 `150`）：

1. **C1(Critical)** `package.json` 的 `file:` 依赖路径与 `pnpm-lock.yaml` 的路径写法
   不一致(`file:./packages/service` vs `file:packages/service`)，CI 默认
   `--frozen-lockfile` 直接报 `ERR_PNPM_OUTDATED_LOCKFILE`。改 `export.mjs`/
   `tree.test.mjs`/`oss/files/README.md` 三处统一成不带 `./` 的写法。
2. **I3** `theme.css` 5 个孤儿 token(`--hit-bg`/`--hit-fg`/`--hl-star`/`--brand-shadow`/
   `--inner-bg-hi`)——唯一消费方（SearchDialog/AiWidget/MediaViewer 的转录高光）已被
   剥离，定义留着会误导读者以为还有对应功能。新增 8 条 `PATCH`（深色/浅色块各 4 行）
   整行删除。
3. **I4** 产出树残留 13 处 `strangler`/`cutover` 措辞 + 一条永远为真的死代码回归测试
   （`cutoverDisabled` 已经是恒 `false`，测它的用例测不出任何东西）。改了 2 条已有
   `PATCH` 的 `replace`（`cutoverDisabled` 整块删除、调用点去掉恒 false 守卫），
   新增 8 条 `PATCH`（删恒真用例、清 `beforeEach`、洗白 3 处注释 + 2 处 `it()` 标题、
   洗白 `protocol.ts` 注释）。
4. **I5a** `oss/files/defaultLayout.ts`（冻结分身）注释里写着"开源版默认桌面"——
   暗示还有一个"非开源版"，改成不带版本区分的措辞。
5. **I5-guard** `tree.test.mjs` 的固定禁词清单原来只扫 4 个 `REPLACE` 冻结分身、不扫
   `PATCH` 的 `replace` payload，且缺"开源版/本版/社区版/strangler/cutover"几个词、
   `NimoOS-UI` 正则抓不到私有仓名 `NimoOS-New-UI`。补齐词表 + 把断言作用域扩到全部
   `PATCH`。**扩大扫描范围后额外揪出 7 处此前从未被检查覆盖的残留**（`appPaths.ts`/
   `AppsPanel.vue`/`tabs.test.ts`/`AppsPanel.test.ts`/`appPaths.test.ts` 里的
   "Vue2"/"政策三「做样子」"字样）——已一并改写对应 `PATCH` 的 `replace`，都是纯文字
   洗白，不改变任何测试断言的行为。**已知例外**：`zh_cn.sp9.ts`/`en_us.sp9.ts` 两个
   文件互相引用对方文件名本身（`See zh_cn.sp9.ts.`）不算泄漏——这两个文件名自己带
   `sp9` 后缀是已裁定的范围外问题（见 §6 与评审 M11），词表对 `SP\d`/`sp[789]` 加了
   `(?!\.ts)` 的精确豁免，只放行"指代自己文件名"这一种写法，不放行其他任何含
   `SP` + 数字的内容。
6. **I6** `vite.config.ts` 注释直接点名 "Claude Code"，与"删 `CLAUDE.md` 因为它是最
   直白的 AI 辅助开发标记"的理由自相矛盾。新增 1 条 `PATCH` 改成不点名工具的措辞
   （`.claude/**` 的 `exclude` 数组本身保留，功能无害）。**未做**：findings 里"顺带
   建议"的 `vite.config.ts:38` 那条(`file:../NimoOS-Service` 的开发态注释)——那是
   标注为可选的加分项，为了让这次改动的 `PATCH` 新增数量精确对应评审给出的预期
   （20 条），没有顺带做，需要的话可以单独开一条。
7. **I7a** `src/settings/util/ifaceForm.ts` 注释里的 `.superpowers/sdd/sp9/03-p2.md`
   台账路径 + 债务编号 `D18`，泄露内部 SDD 工作流目录结构。新增 1 条 `PATCH` 改成
   不带路径的措辞。
8. **M1** `package.json` 的 `name` 是 `nimoos-new-ui`——发布仓叫 `NimoOS-Web`，
   `new-ui` 暗示还有一个 old UI。新增 1 条 `PATCH` 改成 `nimoos-web`。
9. **M2** `scripts/deploy.sh` 注释里写着私有仓名 `NimoOS-New-UI`。新增 1 条 `PATCH`
   改成不带仓名的措辞。
10. **I9** 就是本文件——`oss/` 此前零 `.md`，唯一的决策记录（`.superpowers/sdd/`）被
    `.gitignore` 排除、不进 git。

**这一波之外、明确不动的范围**（评审第 2/3/4 节）：产出树类型检查/装依赖/`--no-commit`
提交块从不自动跑（I0/I0-a/I0-c）、泄漏守卫按行扫描漏折行禁词（I1）、`applyPatch` 不校验
`replace` 字段类型（I2）、`scanDist` 的挖空法重叠绕过（I8）、`assertSafeRelPath` 放行
`'.'`（M12）等——这些留给"合流前必修"，不在本次修复波范围内，理由见 findings 文档 §0。

---

## 8. 2026-08-08:参数误传导致公开仓被覆盖并提交(已修)

**发生了什么。** 有人想看看这个脚本有哪些参数,敲了 `node oss/export.mjs --help`。当时的
参数解析只有两个 helper —— `flag()` 是 `argv.includes()`、`opt()` 是 `indexOf()`,**不认识
的参数不报错,等同于没传**。于是 `--help` 被当成"你什么参数都没传",走完了全套默认值:

- `--out` 默认 `DEFAULT_OUT` = `../../NimoOS-Web`,**真实公开仓**
- `NO_COMMIT` 默认 `false`,**提交默认开启**

⇒ `rsync --delete` 覆盖公开仓目录 + `git commit --amend` 改掉它的 HEAD
(`4957653` → `548e53c`,83 文件 / +5339 −2619)。靠 `git reset --hard 4957653` 还原;
**GitHub 上的 `origin/main` 始终是 `748aa8f`,从未受影响,没有代码泄漏出去。**

**三道本该拦住的关卡为什么都没响:**

| 关卡 | 为什么没拦住 |
|---|---|
| `export.mjs` 的 `--out` 护栏 | 判据是"目录里有没有 `.git`/`.export-report.txt`"。真公开仓两样都有 → 判定为"是之前的导出产物" → 放行。**这道护栏防的是手滑指到别的普通目录,恰好不防它最该防的那个目标。** |
| `checkClean` | 只检查私有仓工作树干净,不看产出仓 |
| `rev-list --count HEAD` 必须是 1 | **确实响了,但代码顺序是先提交、后检查** —— 响得太晚,等于没响 |

**根因不是某一行逻辑,是默认值的方向:危险动作(写公开仓 + 提交)是默认,安全动作要手动
叠三个 flag。**

**修法(两条,缺一不可):**

1. **参数白名单校验,先于一切执行** —— 不认识的参数立刻 `exit 1`,不进入任何流程;
   补上 `--help`/`-h` 打印用法后退出。
2. **翻转默认值** —— `DEFAULT_OUT` 拆成 `PREVIEW_OUT`(临时目录,默认)与 `PUBLISH_OUT`
   (公开仓,**只有 `--publish` 才用**);提交也改成只在 `--publish` 时发生。

**回归保护:`oss/cli-args.test.mjs`(5 例)。** 其中"不带 `--publish` 不建仓"与"带
`--publish` 建仓"两条**必须成对存在** —— 任何单独一条都分辨不出"默认关"和"永远关"
(RED 阶段实测:后者在未修复的代码上照样通过,单独留它等于没有守卫)。该文件每条用例都
显式传 `--out <临时目录>`,因为守卫没落地时不传 `--out` 的调用会真的写进公开仓 ——
**测试本身绝不能重演它要防的那场事故。**

**这类事故的通用形状**(值得推广到别的脚本):一个会造成不可逆外部副作用的工具,把
"最危险的那条路径"设成了默认值,再配上"不认识的输入 = 沉默"。两者单独都不致命,凑一起
就变成"手滑一次就发布"。判据很简单:**问一句"什么都不传时它会做什么" —— 答案必须是无害的。**
