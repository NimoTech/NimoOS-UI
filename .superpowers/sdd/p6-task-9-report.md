# P6 Task 9 报告 —— 台账与挂账落盘

## 结论摘要

三处暴露的东西都已复核还在,并按 brief + 台账要求逐一处置:
- `NimoOS-UI/docs/vue3-pending/`(8 文件/1574 行,2026-08-06 全期未做项审计)→ **已入库**(VUE2 commit `7dfe35ce` + `9b83c539`)。
- `NimoOS-UI/FRONTEND_API_GUIDE.md`(333 行)→ **保持原状,等机主拍板**(见 §2)。
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

## §2 FRONTEND_API_GUIDE.md 定性 —— 需机主拍板

**没有 `git add`,也没有删除,保持原状。**

读了全部 179 行。内容:面向"接手重构 `Home.vue` 的开发者"的 Vue2 前端架构说明——技术栈清单、目录地图、第 3 节(核心)讲 axios 单例的 `baseURL`/`/v1` 前缀自动补全规则、鉴权机制(token 存 localStorage、`Authorization` 头**没有 `Bearer` 前缀**这种容易踩的坑、401 自动刷新+并发队列、会话管理、关机时静默丢错误)、标准响应结构 `{success,message,data}`(及 KVM 例外)、`$api`/`$openAPI` 两个全局对象清单。纯描述性,**无密钥无敏感数据**,内容与代码/CLAUDE.md 核对一致,没发现错误。

**我的建议:入库。** 理由:内容有长期价值(不止服务于一次性的 Home.vue 重构任务),是 Vue2 前端 HTTP/鉴权层唯一一份字段级细节文档,现有 CLAUDE.md 没有这个颗粒度;没有需要保密或丢弃的理由。

**这条需要机主本人答复,我没有替他决定。**

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
cd /home/nimo/NimoTech/NimoOS-UI && git status --short FRONTEND_API_GUIDE.md
cd /home/nimo/NimoTech/NimoOS-New-UI && git status --short
cd /home/nimo/NimoTech/NimoOS-Service && git status --short
```

完整命令与每条的期望输出见 `p6-ledger-migration.md` §6。

---

## §6 本刀提交

VUE2(`NimoOS-UI`,分支 `docs/vue3-migration-sp3`):

```
7dfe35ce docs: Vue3 迁移未做项全期审计入库(8 文件)
9b83c539 docs(p6-t9): P5f 挂账落进长期台账 + 撤 worktree 前核验门
```

NEW-UI(`NimoOS-New-UI`,master,`git add -f` 因为 `.superpowers/` 被 gitignore):见本仓 git log(本报告所在的那次提交)。

SERVICE:本刀未写任何东西(遵守全局约束"不要往 SERVICE 仓写任何临时文件")。

---

## §7 结束状态

- NEW-UI `git status --short`:恰好 3 行 ` D design-export/...`(未受本刀影响)。
- SERVICE `git status --short`:0 行。
- VUE2:除 `FRONTEND_API_GUIDE.md`(等机主拍板,故意保持未跟踪)外,全部改动已提交。
- `.sp8/NimoOS-Service/.superpowers/`:内容未变(不需要变,已在 gitignore 里且信息已妥善处置),T10 撤 worktree 时会被一并丢弃,按 §3 结论这是安全的。
