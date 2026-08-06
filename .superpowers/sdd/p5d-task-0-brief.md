# P5d · T0 任务 brief —— 验蓝本源 + 三附录 + fixture + tiptap 可测性(**零产品代码**)

> 本文件是你的**需求书**。权威优先级:
> **上级设计 > `p5d-common-constraints.md` + P5a/P5b/P5c 治理 > `p5d-plan.md` > 本 brief。**
> 本 brief **不重复**治理文件与计划书的内容,只补协调者层面的坐标、订正与交付契约。

## 0. 必读顺序(计划书 §0.6,**跳读会出事**)

1. `.superpowers/sdd/p5a-common-constraints.md` 全文
2. `.superpowers/sdd/p5b-common-constraints.md` 全文
3. `.superpowers/sdd/p5c-common-constraints.md` 全文
4. `.superpowers/sdd/p5d-common-constraints.md` 全文 ← **本期治理,最高**
5. `.superpowers/sdd/p5d-plan.md` 全文(尤其 **§0 开工必读** 与 **§T0**)
6. 本 brief

全部路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。
**同一节里后读的那份为准。** 计划书 §T0 的 9 条 DoD 是你的验收口径,**逐条兑现、逐条在报告里回答**。

## 1. 协调者补充的坐标(**与计划书不一致处以本节为准**)

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| 🔴 **实际 HEAD** | **`23515cd`**(计划书 §0.2 / 坐标表写的起点是 `b905943`;之后又落了 3 个提交 `d8dcc5f` / `eef771f` / `23515cd`,**全是 `.superpowers/sdd/*.md`**,`git diff --name-only b905943..HEAD \| grep -v '\.md$'` = **0 行**)→ **产品代码与 `b905943` 逐字一致,基线数字照旧。你从 `23515cd` 往下接。** |
| 蓝本 | `NimoOS-UI`@**`7a6ee6b7`**,一律 `git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:<path>` 读 |
| 前置状态 | **P5d 至今零产品代码提交,T0 就是本期第一刀。** 三份附录与 `p5d-fixtures/` 目前**都不存在**,由你新建 |
| 台账目录 | `.superpowers/sdd/`(被 `.gitignore` 盖 → **一律 `git add -f`**) |

## 2. 交付物(全部落 `.superpowers/sdd/`,**`src/` 下一个字都不许改**)

1. `p5d-appendix-A-i18n.md` —— 计划书 §T0 第 2 条(含 §A.4 动态 `$t()` / §A.5 全角标点 / §A.6 占位符 / §A.7 撞车表)
2. `p5d-appendix-B-tokens.md` —— 第 3 条(治理 §6.1 普查表**全部 26 行 / 39 处**,一行一处)
3. `p5d-appendix-D-classes.md` —— 第 4 条(66 类白名单 + **§D.6 tiptap 可测性结论**)
4. `p5d-fixtures/**` —— 第 5 条(真机响应体 + `README` 的重抓命令)
5. `p5d-task-0-report.md` —— 报告(契约见 §4)

**文件数必须仍是 326**(`.superpowers/` 不参与计数)。**零 `.vue`、零 `src/` 改动、零依赖安装。**

## 3. 明确的禁止事项(违反即缺陷)

- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push` / `rebase` / `reset` / `stash` / `merge`、禁 `git add -A` / `git add .`。
- 🔴 **`/home/nimo/NimoTech/NimoOS-UI` 只读**,**永远别在那里 `checkout` / `stash` / `reset`**。
  `git fetch <ssh-url> main` 只写 `FETCH_HEAD`、不动工作树,**允许**(计划书 §0.2 已实测;HTTPS 无凭据必失败,用 SSH)。
- 🔴 **别碰** `/home/nimo/NimoTech/NimoOS-New-UI`、`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(并发会话)。
- 🔴 **`.sp8/NimoOS-Service` 本期零改动**,不跨仓 build(除非 §0.5 那张表命中,即 `dist/` 真被清过)。
- 🔴 **DoD 第 0 条(三门基线复核)对不上就立刻停下写 `NEEDS_CONTEXT`**,把四个实测数字与差异贴给协调者。
  **不许自己「修」到对得上。**
- 🔴 蓝本源核验若比出**功能性差异(非注释)**→ **停下写 `NEEDS_CONTEXT`**,不许自己决定换不换基准。
- 拿不准的任何一处 → 报告里写 `NEEDS_CONTEXT` 并**停下**,不要自己拍。

## 4. 报告契约

- 全文写进 `.superpowers/sdd/p5d-task-0-report.md`(治理 §10 的契约照用)。
- **返回给协调者的正文 ≤ 25 行**,只含:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
  提交 sha · 三门四个数字 · 蓝本源核验结论一行 · **tiptap 可测性结论一行(mock 还是真 Editor)** ·
  **新查出的 kickoff 勘误编号列表** · 遗留 `NEEDS_CONTEXT` 条目 · 报告文件路径。
- 报告里必须显式回答:
  - 计划书 §T0 的 **DoD 0–8 逐条**兑现情况;
  - 「造了哪几条 `/DATA/Notes` 数据 / 怎么清理干净 / 清理后重新取数确认」;
  - `knowledge.scss` 8 段边界的**逐个括号配平**复核结果(哪几段与协调者给的行号有偏差、偏几行);
  - 5 个组件行数(271/338/47/50/11)核对结果;
  - 治理 §12 的 E-26 ~ E-30 复核 + **新增编号**登记;
  - A-12:上游 `NimoOS-Service/src/notes.test.ts` 承接了哪几条 mapper 行为、缺的登记成上游票。

## 5. 提交

**一刀 = 一个语义提交**,提交前跑三门(计划书 §0.4,输出完整落盘、不许 `| tail`)。
台账/附录/fixture 用 `git add -f <具体路径>`;提交后自查 `git show --stat HEAD` + `git status`。
提交信息用本档习惯的 `docs(sdd): …` 前缀(T0 零产品代码)。
