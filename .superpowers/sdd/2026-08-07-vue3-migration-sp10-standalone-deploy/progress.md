# SDD ledger — plan: /home/nimo/NimoTech/NimoOS-New-UI/docs/superpowers/plans/2026-08-07-vue3-migration-sp10-standalone-deploy.md

工作方式:两仓 master 主工作树直接做(SP10 跨 NimoOS-New-UI + NimoOS-UI 两仓,worktree 装不下;
New-UI 主工作树有 3 个 design-export staged 删除,checkout/stash 会卷走它们 —— SP9 全期既定做法)。
所有提交必须带明确 pathspec,不要 `git add -A`。

任务分工:
- Task 1/2(New-UI scripts) → subagent
- Task 3(NimoOS-UI Home.vue 死链) → subagent
- Task 4 Step 2/3(真机部署 + 动设备活文件)→ 需机主在场,控制器交给用户
- Task 5 Step 1(共享包归宿 A/B)→ 机主拍板,控制器交给用户

Task 1: BASE 7f37652 (New-UI)
Task 1: complete (commits 7f37652..532a5c9, review clean, spec ✅)
Task 1: 实现者偏离 brief 两行路径求值(`new URL(相对路径, import.meta.url)` 在 vitest/jsdom 下抛
  `TypeError: The URL must be of scheme file`、整套 0 collected;改用 `dirname(fileURLToPath(import.meta.url))` + join)。
  评审在 /tmp 隔离副本里双向复现,确认必要且未削弱任何断言。8 条断言逐字未动。
  ⇒ 后续任何要在 scripts/ 下读同目录文件的测试,一律用 HERE + join,别再写 new URL(相对路径)。
Task 1: minor (deferred): write-root-redirect.sh:39 `head` 遇 $TARGET 是目录时会以非 1 码 abort 而非干净 skip(deploy 流程里不可达)
Task 1: minor (deferred): 环境无 shellcheck,脚本没有静态 lint 门
Task 2: BASE 532a5c9 (New-UI)
Task 2: complete (commits 532a5c9..f8618d7, review clean, spec ✅)
Task 2: minor (deferred): writeRootRedirect.test.ts:60-64 顺序断言用 indexOf 取首次出现,将来 deploy.sh 若多出第二处 rsync 会退化为"在某个 rsync 之后"
Task 2: minor (deferred): 第一条 toContain 单独看不具备排除 /app 后缀的判别力(靠成对的 not.toContain 补足),可加一行注释说明分工
Task 3: BASE 7990d069 (NimoOS-UI,分支 docs/vue3-migration-sp3,docs/ 有他人未提交改动)
Task 3: fix round 1/5 (1 addressed, 0 open — 去掉 @vitest-environment node pragma 与被证伪的 jsdom 归因注释,
  改用 HERE+join;三条断言逐字未动;默认 jsdom 环境下 3/3 通过,评审独立复跑确认;commits 9c7dc7c0..c3103110)
Task 3: complete (commits 7990d069..c3103110, review clean, spec ✅)
Task 3: minor (deferred): not.toContain('/next/') / ('enter-next') 是整文件子串守卫,将来若有合法的不同 "next" 特性会误伤(plan 指定的做法)
Task 3: 教训:Vite 的 assetImportMetaUrlPlugin 会拦 `new URL('字面量', import.meta.url)`(正则见 vite/dist/node/chunks/node.js
  的 assetImportMetaUrlRE),两仓 vitest 下都会让 fileURLToPath 拿不到 file: 路径而整个 suite 崩。修法统一:HERE+join。

=== 全支终审(opus,New-UI 7f37652..f8618d7 + NimoOS-UI 7990d069..c3103110)===
结论 Ready to merge: With fixes —— Critical 0 / Important 1(I1)/ Minor 6。
5 条 deferred minor 全部裁定"可继续挂账",无一需合并前修。
⚠️ 更正上面 Task 1 那条 minor 的事实描述:$TARGET 是目录时 head 实测 **exit 1**(不是"非 1 码"),结论不变(deploy 流程不可达)。
I1(挡合并):deploy.sh 头部安装说明只 chown 了 www/app、没 chown www 本身 ⇒ 照它搭的"只装 New-UI"机器上
  (正是 SP10 唯一目标形态)新增那行写不进 www 根,set -euo pipefail 让部署在 rsync 已成功后中止并吞掉"部署完成"提示。
终审独立核实过的几件事(以后不用重查):① 跳转目标构造不出开放重定向(search 必带 ?、hash 必带 #,路径段封死在 /app/)
  ② Gateway 对 `/` 发 no-cache ⇒ 根 index.html 被换掉时浏览器不会拿旧页 ③ oss manifest 的 M2 补丁锚点在 deploy.sh 第 2 行、未被尾部追加打断
  ④ tree.test.mjs:69 的"保留面"是开放列表不是闭合白名单,新增两文件不撞门 ⑤ public/next/ 目录本身不存在、两个 i18n 键零命中。
终审新发现的形态(已写进 plan 的 roadmap 债务 ②):曾装过 Vue2 后又退役的机器,根 index.html 是 Vue2 遗留(chunk 已无)
  ⇒ / 白屏,而 New-UI 每次部署只会 skip、永远修不回来,脚本无 --force。
=== Task 4 Step 1 全量门 ===
New-UI:9866 passed / 1 failed / 70 skipped,tsc 0 错,build ✓(16.5s)。3 个 oss 文件红=计划文档未跟踪触发
  export.mjs 自己的脏工作树守卫,用例没跑到真断言 ⇒ 修复轮里提交计划文档后重跑。
Vue2:1480 passed / 8 failed(nimoTaskBar 5 + settingsStore 3 的 openvino 键),经 grep 取证 **0 条与本期改动有关**;
  新 spec 单跑 3/3。
开源自查:三文件 grep 干净;manifest 的 deploy.sh 锚点仍恰好命中一次。

=== 终审修复轮(唯一一轮)===
b1c032b:I1(deploy.sh 头部 chown 补 www 本身 + 脚本写前预检目录存在/可写、报错带具体 chown 命令、保持 fail-loud)
       + M1(mktemp 独立临时名 + trap EXIT 清理 + chmod 644,原固定名 "$TARGET.tmp" 有并发截断竞态)
       + M2(git ls-files 模式断言加优雅退化:先探 git rev-parse --is-inside-work-tree,非 git 产物树里只留 statSync 位判断)
       + M4(noscript 降级丢 query/hash 的不对称写进注释)+ 计划文档入库
6ac1582:修复者自己写的 M4 注释撞上公开面禁词 grep,改措辞
3811365:🔴 新发现并修掉 —— 本期代码打红了开源导出门:重定向页里的 `location.search`(DOM API)
       撞上剥离词表的 `search` ⇒ 「泄漏守卫命中 2 处,一个字节都不落盘」。按守卫自己给的第二条路
       (误报加精确白名单、禁止放宽词表)往 oss/forbidden.mjs 的 SOFT 'search' 项加两条 exactLine 豁免。
       复跑 oss/tree.test.mjs 66/66(修前 65/66)、oss/ 整批 138/138。
       ⚠️ 教训:oss 的泄漏词表覆盖面比本期自建的四词 grep 宽得多(它收 search/photo/ai 等被剥离功能的词),
       **在 New-UI 写任何新代码时,普通 DOM API 名(location.search 这类)都可能撞词表** —— 新增 git 跟踪文件后
       必须跑一次 `pnpm exec vitest run oss/`,不能只跑自建 grep。
       ⚠️ 另一条:export.mjs 扫的是 `git archive HEAD` 而不是工作树,且 checkClean 会拒绝脏的 scripts/ ⇒
       想对守卫做变异验证,改工作树是无效的,要么提交要么直接调 forbidden.mjs 的 scanText()。
SP10 编码侧状态:New-UI 7f37652..3811365(5 提交)· NimoOS-UI 7990d069..c3103110(2 提交)。
未推 origin、未部署。Task 4 Step 2/3(真机)与 Task 5(共享包 A/B 拍板)待机主。

=== Task 4(真机形态 A)+ Task 5(决策)===
Task 4: 机主 2026-08-07 授权真机部署。从 New-UI master 3811365 跑 ./scripts/deploy.sh:
  主判据 `skip: /var/lib/nimoos/www/index.html 已存在且非本脚本所写(根目录另有首页),不覆盖` 出现 ✓
  Vue2 首页 md5 前后一致 057ff050696e62ba99d0f576cc73a572 ✓ · 根目录无 .tmp/.index.* 残渣 ✓
  /app/index.html 更新到 08-07 10:02 ✓ · curl / → 200 且首行 <!DOCTYPE html>(Vue2)✓ · curl /app/ → 200 ✓
  末尾 "Deployed to ..." 正常打印(说明新增那行没让部署中止)。
  ⚠️ 形态 B(临时 mv 走 Vue2 首页)**未执行** —— 机主只授权了"真机部署",没有单独授权动设备活文件;台账照实记"仅单元测试覆盖"。
Task 5: 机主拍板 **B(带条件)**:New-UI 内联共享包、只依赖仓内那份;Vue2 继续依赖原来的独立
  @nimotech/nimoos-service 包。⇒ 两侧从此各自演进、不再共用源码。已写进 roadmap §4 SP10 T3
  (NimoOS-UI 37c472f2 + 状态标记提交)。**内联施工不在 SP10 范围,另起一期。**
Task 5: complete。SP10 五个任务全部关账;New-UI 未推 origin。
注:plan 里 Task 4 Step 4 要求 commit progress.md,但 .superpowers/sdd/ 被 .superpowers/sdd/.gitignore 忽略
  ⇒ 本台账是本机文件、不进 git。撤 worktree/清理前必须先搬走(SP7 就这么丢过)。
