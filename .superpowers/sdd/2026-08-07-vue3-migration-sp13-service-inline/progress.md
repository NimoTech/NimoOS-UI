# SDD ledger — plan: docs/superpowers/plans/2026-08-07-vue3-migration-sp13-service-inline.md

施工位置:主工作树 master(机主 2026-08-07 明确授权)。
⚠️ 另有一条会话同时在改本工作树(README.md / oss/manifest.mjs)。每次提交必须带 pathspec。

控制器对计划两处歧义的裁定(开工前记录):
- Task 1 是纯探测任务、零代码 diff ⇒ 不派 task reviewer,由控制器直接核验 FINDINGS.md。
- Task 4 计划原文写「不产生提交」,但它又要求填「取证留痕」小节 ⇒ 裁定为:
  Task 4 提交填好的取证留痕(计划文件),这样它有可评审产物,且取证结果落盘不丢。

Task 1: complete (无提交 —— 纯探测;控制器已核验 spike 三处接缝 + node_modules 软链指向
  packages+service + 两个真仓零改动)
  结论 TYPECHECK_OK=true(vue-tsc 全量 69 源文件 0 错,~19s)
  结论 JSDOM_RED_FILES=无(37 文件/377 例在 jsdom + 全局 Blob 替换下全绿,
  含预判的 sys/photos.uploads/ai 三个)
  ⇒ Task 2 的 Step 5(逐文件 @vitest-environment node)整步跳过
Task 2: 实现完成 (commit 95a2083, 105 文件/+11299 行, 带 pathspec -- packages/service)
  测试基线 = 600 文件(603)/9867 例 → 搬入后 637 文件(640)/10244 例,Δ 精确 +37/+377
  新增 377 例全绿,Step 5 按 Task 1 结论整步跳过

⚠️ 控制器查实的外部阻塞(与本期无关,但卡 Task 5 的门):
  oss 三个测试文件(media-wave / tree / export-rsync)在搬入前后同样失败。
  根因已取证:`node oss/export.mjs …` 输出
    「[oss] 失败:… 工作树不干净,导出中止: M README.md」
  即另一条会话未提交的 README.md 触发 export.mjs 的 checkClean 中止
  (--allow-dirty-oss 只豁免 oss/ 与 design-export/,不含 README.md)。
  ⇒ Task 5 的「pnpm exec vitest run oss/」在那条会话提交 README.md 之前跑不绿。
  Task 3 / Task 4 不受影响,继续。
Task 2: complete (commits cc0dde4..95a2083, review clean —— 规格 ✅ / 质量 Approved)
  评审独立取证:diff -rq 逐字节与 Service@ac39cd7 一致、commit 未夹带并发会话文件、
  独立重跑 packages/service 377 例全绿、独立复现三个 oss 失败并确认归因属实
  评审顺带记录(非缺陷):packages/service/vitest.config.ts 惰性(根仓无 workspace/projects
  声明,不被读取)—— Task 3 的 CLAUDE.md 文案已计划写明这一点
Task 3: 实现完成 (New-UI 690b80a / NimoOS-Service 16d9963) —— DONE_WITH_CONCERNS
  三道门与基线完全一致(640 文件 637 passed 3 failed / 10315 例 10244 passed 1 failed)
  两处计划外偏离(已声明,非隐瞒):
   1. pnpm-lock.yaml 必须一并提交(计划 Step 10 的 pathspec 漏了它,否则 lock 与 pkg 不一致)
   2. src/viteOptimizeDepsGuard.test.ts 是既有守卫,断言 optimizeDeps.exclude 必须含该包;
      Step 4 删掉配置后它必红。实现者把它翻成反向守卫(越过「不改 src/**」边界,但已声明)

*** 控制器独立取证:计划的核心前提是错的(load-bearing plan defect) ***
  实测(rm -rf node_modules/.vite -> pnpm dev -> curl):
   - curl /app/src/main.ts ==> import 被改写成
     "/app/node_modules/.vite/deps/@nimotech_nimoos-service.js?v=cd3a5bcb"
     ==> 删掉 optimizeDeps.exclude 之后,Vite 仍把这个包当 node_modules 依赖预打包
   - 就地 append 探针到 packages/service/src/sys.ts,不重启不构建:
     预打包 chunk 里 grep SP13_PROBE = 0(没生效)
     而 /@fs/.../packages/service/src/sys.ts 里 grep = 1(源码本身是新的)
   ==> 「入口指 TS 源码 => 预打包漂移根治」是错的。真正在挡这条坑的一直是
       optimizeDeps.exclude,而计划让删的正是它。
  探针已清除,dev server 已停,工作树只剩并发会话那几处。

  附带查实:CLAUDE.md 新文案写「个别文件头带 // @vitest-environment node」——
  实际 0 个文件带(Task 1 探测发现一个都不用回落)。该句为事实错误,须改。

Task 3: 待机主裁定 —— 计划文本 vs 实测冲突,已按 SDD 规矩上交人类决定

机主裁定(2026-08-07):恢复 optimizeDeps.exclude(方案 A)。
  理由盘点:入口指 src 消掉 pnpm build 这一半仍然成立;exclude 负责另一半(dev 即时生效)。
  两条都要,才是本期完整收益。否掉了 pnpm-workspace.yaml 那条路。

Task 3: fix round 1/5 已派发(resume 原实现者 abe8da4d4a1cab19b),4 条 finding:
  1 Critical 恢复 optimizeDeps.exclude + include:['axios'],注释重写成准确因果
  2 Critical src/viteOptimizeDepsGuard.test.ts 翻回正向守卫(用 git show 95a2083 取原文)
  3 Important CLAUDE.md 两处事实错误(「已根治」说法 + 「个别文件头带 @vitest-environment node」实为 0 个)
  4 Minor 核一下 NimoOS-Service/CLAUDE.md 有无被牵连
  验收判据:重跑决定性实验并把命令+输出贴进报告(不接受「验证通过」四个字)

Task 3: fix round 1/5 完成 (New-UI 4e6d458) —— exclude 已恢复、守卫用 git show 逐字节翻回、
  CLAUDE.md 改写。三道门仍等于基线。

控制器复验(把「就地改」与「重启」拆成两个独立变量,比实现者那轮更细):
  - 恢复 exclude 后 curl /app/src/main.ts ⇒ import 指
    /.pnpm/…/@nimotech/nimoos-service/src/index.ts  = 真源码,不再是 .vite/deps  ✅
  - 就地 printf >> 追加探针(inode 前后同为 2516052,硬链完好),不重启:
    curl 该模块 grep 探针 = 0   ❌ 仍旧代码(Vite watcher 默认忽略 node_modules/**)
  - 干净重启(不 --force / 不 rm .vite / 不 pnpm install):grep = 1  ✅
  * 我自己犯过一次取证错误:第一次测重启时 kill 打错 PID,旧进程仍占 5273、新进程换端口,
    于是误得「重启也没用」。重测才对。判据要落在「确认自己问的是新进程」上。
  探针已用 git show HEAD 还原 + pnpm install 重链,inode 仍成对,dev server 已停。

机主裁定(第二次):接受「改包 → 重启 dev server → 生效(无需 build/清缓存/pnpm install)」
  为本期最终标准,不再追真实时 HMR。Task 4 的取证判据同步改。

Task 3: fix round 2/5 已派发 —— 只改文案三处:
  1 CLAUDE.md「存盘即生效靠 exclude 撑着」改成实情(exclude 守的是"服真源码 vs 服陈旧
    预打包产物",不是即时性);2 把硬链接陷阱(原子重命名保存会断链 ⇒ 连重启都读旧内容,
    需 pnpm install)写进 CLAUDE.md 并给自查命令;3 同步改计划 §6 与 Task 4 的判据,
    保留「原判据已证伪」的记载
Task 3: fix round 2/5 完成 (9a4ce20) —— 三处文案改准(CLAUDE.md / vite 注释 / spec §6 + 计划 Task 4);
  实现者查实:验收门表格其实在 spec 文件不在计划文件,按内容匹配改了两处,保留「原判据已证伪」记载
Task 3: complete (commits 95a2083..9a4ce20, 三个 commit, review clean —— 规格 ✅ / 质量 Approved)
Task 3: minor (deferred): src/viteOptimizeDepsGuard.test.ts 顶部注释仍写「该包是 file:../NimoOS-Service
  依赖」—— 逐字节还原带来的历史措辞残留,断言逻辑正确但描述已与现实不符
Task 3: minor (deferred): 未实际跑 pnpm install --frozen-lockfile 复核 lockfile,只核对了 diff 一致性

Task 4: 实现完成 (5c30d6c, 计划 md 的「取证留痕」小节) —— 真无头 chromium 取证
  主判据 CONFIRMED:重启 dev server 后浏览器拿到新代码;重启前硬刷新拿不到(A/B 隔离,
  证明确实是「重启」这一步在起作用,不是缓存假象)
  硬链接陷阱**真实复现**(不是理论):用 sed -i 清理时断链(仓内文件换新 inode 2516054,
  .pnpm 那份停在旧 inode 2516052 且仍含探针),pnpm install 修回;最终改用
  git show HEAD:... > file(O_TRUNC 重定向,不 rename)才保住 inode

*** Task 4 挖出第三层坑(控制器已独立复核) ***
  curl -s -D - 该模块 URL ⇒ Cache-Control: max-age=31536000,immutable
  URL 上的 ?v=<hash> 来自 lockfile/config,**不随包源码内容变**
  ⇒ 已加载过该页的标签页会一直命中磁盘缓存,普通 F5 永远看不到新代码,必须硬刷新
  控制器额外佐证:前后两次观察 ?v= 从 262bd7ea 变成 4539fc70,而两次之间只改过
  vite.config.ts(仅注释)+ pnpm install —— 正好反证哈希跟的是 config 不是包源码
  ⇒ 完整口诀:改包源码 → 重启 dev server → 硬刷新浏览器(Ctrl-Shift-R)

Task 4: fix round 1/5 已派发 —— 把这第三条警告写进 CLAUDE.md + 补操作口诀 + 同步 spec §6
  (第三次判据修订,保留前两次记载)
Task 4: fix round 1/5 完成 (5d69067) —— CLAUDE.md 补第三条警告 + 操作口诀;spec §6 第三次判据修订
Task 4: complete (commits 9a4ce20..5d69067, 2 commit 纯 markdown, review clean —— 规格 ✅ / 质量 Approved)
Task 4: minor (deferred): CLAUDE.md「dev server 的实际生效方式」主段落只写「重启→生效」,
  硬刷新只出现在紧随其后的口诀框与第三条警告里 —— 只读主段落者可能误判普通 F5 够用

Task 5: 触发计划预写的停止条件 —— oss/manifest.mjs 仍被并发会话占着(M),已上交机主。
  查实:README.md 与 oss/manifest.mjs 是**配套的一对**(manifest 里 privateSha256
  = 316642c3… 正是当前 README 的 sha256),看起来是 SP10 那张「deploy-ui.sh 装机说明
  只 chown 了 www/app」小票的完整收尾,只是没提交。manifest 全文件只改了这 1 行。

(控制器代提交)089ee6c8 docs(sp10): 装机说明补 chown www 本身 + 同步 oss privateSha256
  —— 非 SP13,是 SP10 遗留在工作树未提交的配套改动;机主确认「已经没占了,正常进行」后
  由本会话代为提交,以解开 export.mjs 的洁净检查。提交后导出恰好停在计划预测的断裂点:
  「失败:package.json 的 file: 锚点未唯一命中」= Task 5 要修的正是它。

Task 5: complete (commits 089ee6c..c83206e, review clean —— 规格 ✅ / 质量 Approved,5 Minor)
  oss 批 6 文件 / 138 例 / 0 失败(评审独立重跑核实),含 tree.test.mjs 真跑 pnpm install + vue-tsc
  评审的强取证:① 新旧 manifest 都 import 进来做结构比对 ⇒ SERVICE_DELETE 19 条逐字节相同、
  SERVICE_PATCH 恰好移除 1 条 0 条误删;② 变异验证 —— 把依赖改回 file:../NimoOS-Service,
  第 4.5 步 pnpm install --lockfile-only 报 ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND 硬拦
  ⇒ 删掉的两个 throw 不是「无人看守的假设」;③ apply.mjs:43-45 对不存在路径是硬 throw
  不是静默跳过 ⇒「基准目录改错会静默失去剥离能力」这个风险不成立
Task 5: minor (deferred) x5: export.mjs:118 进度显示 3/6→4.5/6 断档("4"悬空);
  export.mjs:78 注释仍举例「sibling NimoOS-Service 不存在」;export.mjs:63,68-74 那段
  437 处泄漏事故的注释仍写「两个仓」;oss/README.md 仍写「两个源仓工作树必须干净」
  (brief 未授权改,建议开后续小票);task-5-report.md 对 off-by-one 的定性一半是反的

*** 待机主定的观察项(非本期引入,但本期加重了) ***
  产物树里有 8 处 `NimoOS-Service` + 2 处 `superpowers`,全在代码注释:
  vite.config.ts:39,44,61(**SP13 Task 4 期新写的**)· viteOptimizeDepsGuard.test.ts:4,7 ·
  storage.ts:221 · storage.test.ts:426 · RaidMemberList.vue:8 · MobileHome.vue:31 · waveform.ts:2
  两个词都不在 forbidden.mjs 词表里 ⇒ 守卫「零泄漏」与设计一致、不是哑火。
  但这与既有政策(tree.test.mjs:516 断言公开 README 不得出现 file:../NimoOS-Service)不一致。
Task 6: complete (New-UI 无新提交仍 c83206e;NimoOS-UI 5bb63dfa 关账 roadmap)
  六道门实测:① pnpm test 640 文件全绿 / 10315 例全绿,0 failed 0 skipped
  ② vue-tsc 0 错 ③ pnpm build ✓ ④ oss 6 文件 / 138 例全绿
  ⑤ Vue2 零影响(本期零触碰 NimoOS-UI 代码) ⑥ 内联彻底性:package.json / pnpm-lock.yaml /
  tsconfig.json 对 NimoOS-Service 零引用,只剩 vite.config.ts 4 行解释性注释
  与旧基线差异:600/9867 → 640/10315(+40 文件/+448 例)。其中 +37/+377 是 service 包测试
  (精确对上);另 +3 个 oss 文件由红转绿(Task 5 修流水线 + 089ee6c8 补提交 README);
  skipped 70→0 —— 那 70 例原本是 export.mjs 在 beforeAll 抛错导致的连带 skip
  控制器订正:实现者报告称 roadmap 里混进「另一条并发会话的 2 处 checkbox 翻转」——
  归因错了,那两处是**本会话最开头**机主让「打勾补上」时我改的(SP7-P7 / SP8-P5),内容正确

整支终审(opus)完成:总体「可以合并」,无 Critical 无阻塞。终审独立重跑:vue-tsc exit 0 /
  pnpm install --frozen-lockfile 无漂移 / export.mjs 六步跑通零泄漏(产物树 packages/service/src
  51 文件、.superpowers 剥净) / pnpm test 第 1 次 **1 failed** 第 2 次全绿
  🔴 F3:src/files/upload/persist.test.ts:55 是 SP4 期既有 flake(dropPersisted fire-and-forget
     + setTimeout(0)),单跑 3/3 绿;SP13 的 +377 例抬高负载把它顶出来
     ⇒「六道门 0 失败」不可复现,关账文字不能这么写
  Q5 裁定(推翻台账原记载):8 处 NimoOS-Service + 2 处 superpowers **不算泄漏** ——
     ① 词表意图是「被剥离的功能」,仓名/冲刺号从不在范畴 ② 公开树里 New-UI/Vue2 存量实测
     1214 处/291 文件,8 处是噪声 ③ tree.test.mjs:516 作用域是 README 而非全树,真实产物树
     README 命中数 = 0 ⇒ 台账那句「与既有政策不一致」**前提不成立**。
     但本期新写的 3 处该改,理由是**指令错误**(叫开源使用者 cd ../NimoOS-Service && pnpm build)
  D2 关闭(终审跑了 frozen-lockfile,330ms 无漂移)· F8 确认 spec §3.2 不加 gitignore 是对的
  合并前修 5 项:F1(New-UI README 仍教人克隆同级仓)· F2(计划文件是唯一没跟上三次修订的)
  · D1(守卫测试头注释)· D3(CLAUDE.md 主段落缺硬刷新)· D6(「两个仓」注释 + oss/README)

终审修复波完成 (efb8846 + 0a7e6fb),8 项全修。范围内复评:8/8 ADDRESSED、无新引入破坏
  ⇒ **可以合并**。复评独立重跑:oss 138/138、vue-tsc exit 0、守卫测试 1/1、
  sha256sum README.md 与 manifest 登记值一致
  修复波有一处「必要越界」:改 vite.config.ts:88 的注释打断了 manifest.mjs 里一条 I6 的
  精确字符串 PATCH 锚点(与 README sha256 无关),不同步会抛「锚点未命中」⇒ 按 oss/README.md
  自己写的漂移锚点流程改了 find 串、replace 意图不变,单独成 commit 0a7e6fb。复评核实通过。
  控制器抽核:README sha256 = bc304205… 与 manifest 一致;vite.config.ts 与
  viteOptimizeDepsGuard.test.ts 过滤注释行后非注释改动为零

补修一项(控制器组织修复波时漏掉的范围,非实现者疏漏):roadmap 关账文字两处把
  「640 文件/10315 例 0 失败」写成了确定结论,而终审 F3 已证其不可复现
  (persist.test.ts:55 是 SP4 期既有 flake,SP13 的 +377 例只是加重不是引入)。已派修。
