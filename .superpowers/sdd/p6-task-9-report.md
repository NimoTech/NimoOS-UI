# P6 Task 9 报告 —— 台账与挂账落盘

## 结论摘要

三处暴露的东西都已复核还在,并按 brief + 台账要求逐一处置:
- `NimoOS-UI/docs/vue3-pending/`(8 文件/1574 行,2026-08-06 全期未做项审计)→ **已入库**(VUE2 commit `7dfe35ce` + `9b83c539`)。
- `NimoOS-UI/FRONTEND_API_GUIDE.md`(333 行)→ **机主 2026-08-06 拍板入库,已提交 `6c5c632f`**(见 §2)。
- `.sp8/NimoOS-Service/.superpowers/`(13 个文件,gitignore 掉)→ **9 个真区间 diff 全部可达/可重生成,不入库;2 个空文件零信息;1 个 18 行支撑文件已抄录进 `p6-ledger-migration.md` §7 兜底**(见 §3)。
- P5f 挂账(D-10/D-11/D-12/票 A-E/Wiki 运维票/守卫常量表)→ **全部落盘**,细目见 §4。

三份文档:`p6-ledger-migration.md`(处置细节+核验门,已 `git add -f`)、本报告(已 `git add -f`)。

---

## §1 Step 1 复核结果(原文照录自 `p6-ledger-migration.md`)

```bash
cd /home/nimo/NimoTech/NimoOS-UI && git status --short && ls docs/vue3-pending/ && wc -l docs/vue3-pending/*
```
```
?? FRONTEND_API_GUIDE.md
?? docs/vue3-pending/
00-总览.md 01-文件区-SP4.md 02-应用与商店-SP5.md 03-存储-SP6.md 04-相册-SP7.md
05-设置与KVM与搜索-SP9.md 06-跨区与大外壳.md 07-后端票汇总.md
合计 1574 行
```

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && git status --ignored --short && find .superpowers -type f | wc -l
```
```
!! .superpowers/
!! dist/
!! node_modules/
13
```

三处暴露全部确认还在,且数字与 brief 描述吻合(8 文件/1574 行、13 个文件)。

---

## §2 FRONTEND_API_GUIDE.md 定性 —— 🟢 机主 2026-08-06 拍板:入库,已提交

**机主拍板理由**(原话要点):文档记的几个坑(缺 `Bearer` 前缀、响应信封层数、401 刷新队列)正是本项目反复栽过的地方,SP10 删掉 Vue2 之前都是活的参考;不入库则一次 `git clean` 就没了。

**入库前的安全复核**(不可逆动作,提交前再核一遍全文 333 行):逐行检查了真实 token/密码/私钥、内网 IP 或主机名、机主个人信息三类——**三类均未发现**。`VUE_APP_DEV_IP`/`VUE_APP_DEV_PORT`、`access_token`/`refresh_token` 等只是字段名/环境变量名,不是实际取值;全篇无 IP 地址、无主机名、无姓名/邮箱等个人信息。

**已提交**:VUE2(`NimoOS-UI`,`docs/vue3-migration-sp3`)commit `6c5c632f`,`git add FRONTEND_API_GUIDE.md` 带 pathspec。

### §2.0 🔴 订正:上一版本报告「读了全部 179 行」是错的,实际全文 333 行

三种独立方法交叉验证:`wc -l` → 333;`awk 'END{print NR}'` → 333;文件内容第 333 行是文末「一句话给后续 AI」段落的最后一句,第 334 行是尾随空行。**333 与 brief 背景段自己写的数字、以及机主长期记忆里记的数字一致。**

**误读是怎么发生的**:第一次探查这份文件时,我先用 `Read(limit=60)` 读了第 1-60 行,接着用 `Read(offset=60, limit=120)` 读了第 61-180 行——但那次调用返回的实际内容在第 179 行(3.5 节「`$openAPI`」小节)处刚好收尾,读起来像一个自然的段落结束点。**我把"我这次调用的 `limit` 窗口到此为止"当成了"文件到此为止"**,没有跑任何独立的行数命令(`wc -l`/`find`/文件大小)去核实"179"是不是真的是 EOF,就直接在两份文档里写下了「读了全部 179 行」。真实情况是第 4-8 节(实时通信三套机制、Vuex、i18n、Home.vue 结构、9 条重构红线)全部落在 179 行之后,当时完全没读到,却在摘要与建议里被我说成"读了全部"。

**下次怎么防**:任何要写「读了全部 N 行」这类过程性断言之前,先跑一条独立的行数确认命令(`wc -l <file>`),把这个数字当成读取目标的上限,而不是拿"最后一次 Read 调用碰巧在哪里停"去反推文件长度。这条和本刀 Minor 里"取数命令要支撑结论"是同一类问题——**工具窗口的边界不是真相的边界**,过程性断言和数字断言一样需要独立验证,不能凭一次调用的表面结果下结论。

### §2.1 内容判断(已补读第 4-8 节,基于完整 333 行)

面向"接手重构 `Home.vue` 的开发者"的 Vue2 前端架构说明,共 8 节:

- **第 1-2 节**:技术栈清单(Vue2/Buefy/Vuex/vue-router/axios/socket.io/vue-i18n 等版本号)、目录地图。
- **第 3 节(HTTP 对接核心)**:axios 单例的 `baseURL` 规则、`/v1` 前缀自动补全逻辑(`testVisionNum()`)、鉴权机制(token 存 localStorage、**`Authorization` 头没有 `Bearer` 前缀**这个容易踩的坑、401 自动刷新+并发队列、会话管理、关机时静默丢错误)、标准响应结构 `{success,message,data}`(及 KVM 例外)、`$api`/`$openAPI` 两个全局对象清单与调用范式、Buefy 错误提示组件用法。
- **第 4 节(实时通信,三套机制)**:Socket.io 主力推送(`sockets:{}` 声明式订阅,payload 在 `res.Properties.*` 且多为 JSON 字符串)、原生 WebSocket(备用,当前基本注释掉)、Vue EventBus(组件间通信,`casaUI:` 前缀历史命名,主页常用事件如 `showSettingsPanel`/`showKVMPanel`/`showStorageManager`)、埋点上报 `$messageBus`。
- **第 5 节(Vuex 状态管理)**:主页会读写的关键 state(`access_token`/`hardwareInfo`/`sidebarOpen`/`wallpaperObject` 等)、常用 mutation、`photos`/`fileUpload` 两个用 IndexedDB 持久化上传任务的模块(明确提示"不要在主页重构里动它们")。
- **第 6 节(i18n)**:`vue-i18n` 配置、语言包位置、`$t()` 用法、无 `this` 场景的 `ice_i18n()`、切换语言的 `setLang()`。
- **第 7 节(当前主页结构,重构对象)**:`Home.vue` 的组件树(SideBar/widgets、SearchBar、CoreService、Apps/AppSection)、初始化流程、后端自定义存储 key(`system`/`widgets_config`/`app_order`/`wallpaper`)。
- **第 8 节(重构红线,9 条)**:鉴权层别碰、响应解构固定、保留事件名常量、`$EventBus.$on` 要随组件迁移不能删、Socket.io 用声明式订阅、配置持久化走 `getCustomStorage`/`setCustomStorage`、新版接口优先 v2、文案全部走 `$t`、技术栈维持 Vue2+Buefy+pnpm(除非另立项做 Vue3 整体升级)。结尾有一段「一句话给后续 AI」的总结。

补读后的判断:全篇纯描述性,**无密钥无敏感数据**,内容与代码/CLAUDE.md 核对一致(含第 4-8 节),没发现错误。第 4-8 节进一步印证了这份文档的价值不止第 3 节的 HTTP 对接——第 8 节的"9 条重构红线"和第 5 节"别动 IndexedDB 持久化模块"这类提示,是**任何后续要动 Home.vue 或其依赖的人都需要的护栏**,不是只服务于 HTTP 层的窄范围文档。

### §2.2 建议(结论不变,现在基于完整内容):入库 —— 🟢 机主已拍板采纳,已执行

理由:① 内容有长期价值,不止服务于一次性的 Home.vue 重构任务,覆盖了 Vue2 前端从 HTTP、鉴权、实时通信、状态管理到 i18n 的完整消费层图景,现有 CLAUDE.md 没有这个颗粒度(尤其是 `Authorization` 头无 `Bearer` 前缀、`sockets:{}` 声明式订阅、`getCustomStorage`/`setCustomStorage` 持久化约定这几条,别处找不到);② 第 8 节的"重构红线"本身就是一份可复用的验收清单,对任何后续 Vue2→Vue3 迁移或重构工作都有参考价值,不止 Home.vue;③ 没有需要保密或丢弃的理由,全篇无密钥无敏感数据。

**机主 2026-08-06 拍板:入库。已提交 VUE2 commit `6c5c632f`(`git add FRONTEND_API_GUIDE.md`,带 pathspec)。**

---

## §3 Step 4:Service 侧 13 个文件的可达性实测与处置

### 3.1 可达性实测输出

```bash
cd /home/nimo/NimoTech/NimoOS-Service
for sha in f9a0096 2af8262 dadfb0e 3bf15b3 ca34772 39e8a4e 501cc97 f405eee 1126162 f3e32d0; do
  if git cat-file -e "$sha" 2>/dev/null; then
    reachable=$(git merge-base --is-ancestor "$sha" HEAD 2>/dev/null && echo YES || echo NO)
    echo "$sha: exists, ancestor-of-HEAD=$reachable"
  else
    echo "$sha: DOES NOT EXIST in this repo"
  fi
done
```
```
f9a0096: exists, ancestor-of-HEAD=YES
2af8262: exists, ancestor-of-HEAD=YES
dadfb0e: DOES NOT EXIST in this repo
3bf15b3: exists, ancestor-of-HEAD=YES
ca34772: exists, ancestor-of-HEAD=YES
39e8a4e: exists, ancestor-of-HEAD=YES
501cc97: exists, ancestor-of-HEAD=YES
f405eee: exists, ancestor-of-HEAD=YES
1126162: exists, ancestor-of-HEAD=YES
f3e32d0: exists, ancestor-of-HEAD=YES
```

抽测三条区间 `--stat`(brief 只要求一条,补测两条加强把握):

```bash
git diff 3bf15b3..ca34772 --stat | tail -3   # 5 files changed, 1636 insertions(+), 1 deletion(-)
git diff f9a0096..2af8262 --stat | tail -3   # 2 files changed, 21 insertions(+)
git diff 39e8a4e..501cc97 --stat | tail -3   # 2 files changed, 445 insertions(+)
```

全部产出真实非空 diff,证明这些区间在合流后的 `NimoOS-Service` master(当前 `ac39cd7`)上完整可达、可重生成。

### 3.2 结论

| 类别 | 处置 |
|---|---|
| 9 个真区间 diff(`review-*.diff`,除 `dadfb0e` 那条) | **不入库**,`p6-ledger-migration.md` §4.1 逐条登记重生成命令 |
| `p2a-review-dadfb0e..2af8262.diff` | `dadfb0e` 是 **NEW-UI** 仓的 commit,不在 Service 仓,理论上"不可达"——但**文件本身只有 5 行空模板骨架,零实际 diff 内容**,判定无信息可丢,**不入库** |
| `p5a-task-1-rereview-pkg.diff` | 0 字节空文件,**不入库** |
| `progress.md`(18 行,P2b 历史记录片段) | 出于谨慎(即便判断它与长期记忆重复),**全文抄录进 `p6-ledger-migration.md` §7** 兜底,原文件不单独 `git add -f` |
| `.gitignore`(裸 `*`) | 是问题肇因本身,不搬 |

**没有任何一条不可达区间需要 `git add -f`**——因为唯一命中"不可达"的那一条,内容恰好是空的。

---

## §4 Step 5:P5f 挂账落盘明细

全部落进 VUE2 仓(`NimoOS-UI`),commit `9b83c539`:

| 条目 | 落到哪 |
|---|---|
| D-10 / D-11 / D-12 / 票 B(color-guard 盲区)/ `isDeferred` 知情项 | `docs/vue3-migration-roadmap.md` §SP8 新增子节「🔴 SP8 债务台账」,表一 |
| `?raw` 全仓性空转 / T8-D3 三条陷阱 / oss lockfile 三条挂账 / `strangler.js:28` 注释数字错(8→11+2)/ D47 泄漏扩大(37→59) | 同上,表二(本期新产生) |
| `NimoOS-Web` 未提交的 ` M README.md` | 同上,单列一条「🔴 发布前人工检查项」 |
| 守卫常量终值表 | 同上,每个数字标「P5f 收官值(仅 ai 分支范围)vs 取数命令(现测)」双列,并实测标注 `.vue` 已从 188(P5f 分支)涨到 340(合流后全仓) |
| 票 A(Agent notes 分组) | `docs/vue3-pending/07-后端票汇总.md` 附录 `BE-A8`(明确标注这其实是前端功能缺口,按机主裁定归档于此) |
| 票 C(搜索链路授权根缺失) | 同上 `BE-30`(🔴 一等) |
| 票 D(Parser rerank 500) | 同上 `BE-31`(🟡 二等) |
| 票 E(未分组扩展名不可管理) | 同上 `BE-32`(🟡 二等) |
| Wiki 数据库运维票 | 同上 `BE-29`(🔴 一等) |

🔴 **凡带数字的条目,落盘时都在文中注明「有保质期,以现测为准」并附取数命令**——不是只写死一个数字。

---

## §5 Step 6:核验门(可执行,已落进 `p6-ledger-migration.md` §6)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI && git status --ignored --short
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && git status --ignored --short
cd /home/nimo/NimoTech/NimoOS-UI && git log --oneline -2
cd /home/nimo/NimoTech/NimoOS-UI && git status --short docs/vue3-pending/ docs/vue3-migration-roadmap.md
cd /home/nimo/NimoTech/NimoOS-New-UI && git status --short .superpowers/sdd/p6-ledger-migration.md .superpowers/sdd/p6-task-9-report.md
cd /home/nimo/NimoTech/NimoOS-UI && git status --short   # FRONTEND_API_GUIDE.md 已入库,现应无输出(0 行)
cd /home/nimo/NimoTech/NimoOS-New-UI && git status --short
cd /home/nimo/NimoTech/NimoOS-Service && git status --short
```

完整命令与每条的期望输出见 `p6-ledger-migration.md` §6(该文档同一轮已同步更新)。

---

## §6 本刀提交

VUE2(`NimoOS-UI`,分支 `docs/vue3-migration-sp3`):

```
7dfe35ce docs: Vue3 迁移未做项全期审计入库(8 文件)
9b83c539 docs(p6-t9): P5f 挂账落进长期台账 + 撤 worktree 前核验门
8ba172b7 fix(p6-t9): 修复轮 1/5 —— 取数命令订正
6c5c632f docs: 前端架构 & API 对接指南入库(机主 2026-08-06 拍板)
6ff26538 docs(p6-t9): oss/export.mjs 的 DEFAULT_OUT 危险默认值单独立票
```

NEW-UI(`NimoOS-New-UI`,master,`git add -f` 因为 `.superpowers/` 被 gitignore):见本仓 git log(本报告所在的那次提交)。

SERVICE:本刀未写任何东西(遵守全局约束"不要往 SERVICE 仓写任何临时文件")。

---

## §7 结束状态

- VUE2 `git status --short`:**0 行**(`FRONTEND_API_GUIDE.md` 从 `??` 变成已提交,工作树干净)。
- NEW-UI `git status --short`:恰好 3 行 ` D design-export/...`(未受本刀影响)。
- SERVICE `git status --short`:0 行。
- VUE2:全部改动已提交,`FRONTEND_API_GUIDE.md` 经机主拍板已入库(commit `6c5c632f`)。
- `.sp8/NimoOS-Service/.superpowers/`:内容未变(不需要变,已在 gitignore 里且信息已妥善处置),T10 撤 worktree 时会被一并丢弃,按 §3 结论这是安全的。

---

## §8 修复轮 1/5(独立评审:1 Important + 1 Minor,均文档,零代码改动)

### 8.1 Important —「读了全部 179 行」——处置见 §2.0/§2.1/§2.2(已订正为 333 行,已补读并重写第 4-8 节摘要与建议)

不再重复,完整内容见上。

### 8.2 Minor ——`strangler.js:28` 那条取数命令支不上「13」这个结论,已自查全部同类命令

**原问题**:`roadmap.md` 里那行写的是 `/usr/bin/grep -n "'/ai" NimoOS-UI/src/router/route.js | wc -l` → 实测输出 **9**,而旁边结论写「11 条真实路由 + 2 条 redirect = 13」。命令能跑、有输出,但输出既不支持 11、也不支持 13、也不支持 8——是一条自己都验证不了自己旁边那句话的命令。

**修法**:改成三段式、每段都单独现测验证过的命令(现测输出见括号):

```bash
cd NimoOS-UI
/usr/bin/grep -cE "^\s*path: '/ai/(agent|settings|parser|parser/test|knowledge)',"  src/router/route.js   # → 5(4 个独立页面 + /ai/knowledge 布局父路由)
sed -n "/path: '\/ai\/knowledge',/,/\],\$/p" src/router/route.js | /usr/bin/grep -c "path: '[a-z]"           # → 6(/ai/knowledge 下 6 个非空子路由,第 7 个 child 是 path:'' 落地页,与父路由是同一条不重复计)
/usr/bin/grep -c "redirect: {" src/router/route.js                                                          # → 2
# 5 + 6 + 2 = 13
```

三段分别实测输出 5 / 6 / 2,加总 13,与结论一致。已写进 `roadmap.md` §SP8 债务表。

### 8.3 🔴 自查了本刀落盘的其它全部取数命令,再改出 4 个同类问题(评审没抽到,自己巡查发现)

评审提醒"自查一遍其它命令有没有同样的毛病"后,把 §SP8 债务台账里每一条带反引号命令的 cell 全部重新在本机实跑一遍,除 Minor 里那条外,还发现并修了 4 处:

| 位置 | 原问题 | 修法(现测通过) |
|---|---|---|
| `T8-D3`「产物树能构建」门的复跑命令 | 写的是 `cd NimoOS-Service/oss && node export.mjs`——**`oss/` 目录根本不在 `NimoOS-Service` 仓,在 `NimoOS-New-UI/oss/`**,原命令会直接报「目录不存在」 | 改成 `cd NimoOS-New-UI && node oss/export.mjs`,现测该路径下 `export.mjs` 确实存在 |
| 同上,附带的安全隐患(自查时新发现,不只是路径错) | 🔴 `oss/manifest.mjs` 的 `DEFAULT_OUT` 硬编码成 `../../NimoOS-Web`——**不带 `--out` 直接跑这条"复跑门"命令,会真的往公开仓 `NimoOS-Web` 的实际路径写**,且不带 `--no-commit` 默认会提交,与本刀"不要碰 `NimoOS-Web`"的全局约束正面冲突 | 命令改成 `node oss/export.mjs --out /tmp/oss-dry-run --no-commit`,并在旁边加了 🔴 警告,同时**没有自己真的跑它**(只验证了参数存在、路径存在,没有执行实际导出,避免任何触碰 `NimoOS-Web` 的风险) |
| `D47` 泄漏统计的产物树取数命令 | 占位符 `cd <产物树或 NimoOS-Service/oss 导出结果目录>` 隐含同一个"跑默认导出"风险,且路径同样写错 | 改成先引用上面 T8-D3 那条安全的 `--out /tmp/oss-dry-run --no-commit` 方式,再对 `/tmp/oss-dry-run` 取数;`NimoOS-Web` 现有值那半边命令**已现测跑过**,输出 **37**,与旁边结论一致 |
| 守卫常量表:`aiKb*` 键 / 全表键 那一行 | 原命令 `wc -l src/i18n/zh_cn.*.ts` 给的是**整个文件的物理行数**(789/913/1527/586),根本不是键数,离旁边写的「757/702/1207/459」差几百行,是同款「命令能跑但支不上结论」的错 | 改成精确正则 `^  ('[^']+'|[A-Za-z0-9_]+):`(同时匹配裸标识符键与带引号的点号键,如 `'ai.searchMyNas'`),现测四片输出**恰好 757/702/1207/459,合计 3125**,与 Task 4 台账原话逐字对上;顺带把 `aiKb*` 单独那格也从近似的 `grep -c "aiKb"`(568,含误命中)换成精确锚定 `^  aiKb[A-Za-z0-9]+:`,现测**恰好 520**,与 P5f 收官值完全一致 |

**没问题、抽查后确认支持结论的**(不改):`.vue` 总数(`find src -name "*.vue" | wc -l` → 340)、`WHITELIST_425`/`NON_K_HELPER_CLASSES` 两条(`toHaveLength(425)`/`toHaveLength(20)` 现测两行都还在)、`?raw` 空转排查命令(跑出真实的 4 个命中文件)、color-guard 实扫文件数(换成具体的 `find src -name "*.vue" -o -name "*.css" | wc -l` → 345,取代了原来"读 glob 结果集大小"这种非可执行的描述性建议)。

**这次自查的教训**(同一条,写进 `roadmap.md` 引言段):**「命令能跑」不等于「输出支持旁边写的结论」,也不等于「路径是对的仓」**——本刀一次性踩中路径错(strangler.js/T8-D3/D47 共 3 处指向错仓或错目录)、取数口径错(aiKb/全表用错了行数 vs 键数)两类问题,且都是在"看起来像能用"的状态下混进文档的。以后落盘任何取数命令前,都要**在目标仓库实际跑一次**,确认输出数字与旁边的中文结论对得上,而不是凭命令语法「看起来对」就收录。

---

## §9 机主拍板执行(2026-08-06,§2 那条"等机主拍板"已解除)

### 9.1 拍板内容与执行

机主拍板:`FRONTEND_API_GUIDE.md` **入库**。理由(机主原话要点):文档记的几个坑(缺 `Bearer` 前缀、响应信封层数、401 刷新队列)正是本项目反复栽过的地方,SP10 删掉 Vue2 之前都是活的参考;不入库则一次 `git clean` 就没了。

**入库前的第三次安全复核**(不可逆动作,进 git 历史就在了,再核一遍):逐行核对全文 333 行,专门过一遍三类——① 真实 token/密码/私钥:**无**(只有 `access_token`/`refresh_token`/`login(u,p)` 这类字段名/参数名,没有任何字面值);② 内网 IP 或主机名:**无**(`VUE_APP_DEV_IP`/`VUE_APP_DEV_PORT` 只是环境变量名,文中没有出现任何实际 IP 或域名);③ 机主个人信息:**无**(全篇零姓名/邮箱/其它 PII)。三类均干净,未发现需要暂停报告的内容。

**执行**:`cd NimoOS-UI && git add FRONTEND_API_GUIDE.md && git commit`,带 pathspec,commit `6c5c632f`。VUE2 工作树自此归零(`git status --short` 0 行)。

### 9.2 `DEFAULT_OUT` 危险默认值单独立票

按要求把 §8.3 里发现的 `oss/export.mjs` `DEFAULT_OUT` 问题从"藏在 T8-D3 取数命令旁注里"提升成 `roadmap.md` §SP8 债务台账里的**独立一行**(排在"本期新产生的债务"表最前面,🔴 标记),标题直接点名"会伤人的默认值",不再需要点开 T8-D3 那格才看到。VUE2 commit `6ff26538`。该行的两条取数命令(`DEFAULT_OUT` 定义行 + `NO_COMMIT` 分支逻辑)已现测验证,输出与断言一致。

### 9.3 本轮涉及的全部 VUE2 commit(按时间顺序)

```
7dfe35ce docs: Vue3 迁移未做项全期审计入库(8 文件)
9b83c539 docs(p6-t9): P5f 挂账落进长期台账 + 撤 worktree 前核验门
8ba172b7 fix(p6-t9): 修复轮 1/5 —— 取数命令订正
6c5c632f docs: 前端架构 & API 对接指南入库(机主 2026-08-06 拍板)
6ff26538 docs(p6-t9): oss/export.mjs 的 DEFAULT_OUT 危险默认值单独立票
```

### 9.4 最终结束状态(本轮结束时实测)

- VUE2 `git status --short`:**0 行**。
- NEW-UI `git status --short`:恰好 3 行 ` D design-export/...`。
- SERVICE `git status --short`:0 行。
- `NimoOS-Web` 未被本刀触碰,仍停在 `748aa8f`(那处已知的未提交 `M README.md` 是既有状态,不是本刀引入的)。
