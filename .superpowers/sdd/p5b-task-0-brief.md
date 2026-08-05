# P5b · T0 任务书 —— 治理文件、三份附录、fixture 抓取

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b,知识库「索引运维」两页:
已收录文件页 + 任务队列页)。上一批 P5a(知识库外壳 + 概览页)已收官。本批共 T0–T10 十一个任务,
单车道串行,**你是 T0 —— 全批的权威源**。后面 10 个实现者都不读计划原文,只读你产出的治理文件与附录。
P5a 的实践查实了**计划自身的 9 处错**,所以这份最贵:你的每一条都要能回权威源复核。

## 你的权威输入(按此顺序读)

1. **计划书**(本任务唯一的需求来源,**你是全批唯一被允许通读它的 agent**):
   `/home/nimo/NimoTech/NimoOS-UI/docs/superpowers/plans/2026-08-01-vue3-migration-sp8-p5b-indexops.md`
   —— 尤其 §2 的「T0」小节(你的 DoD)、§6 附录 A、§7 附录 B、§8 附录 D、§9 附录 C。
2. **设计稿**(计划书的上位,冲突时以它为准):
   `/home/nimo/NimoTech/NimoOS-UI/docs/superpowers/specs/2026-08-01-vue3-migration-sp8-p5b-indexops-design.md`
   —— §4(K9–K19 偏离)、§5(实测数据契约)、§6.2(4 个新 token 的两档取值)。
3. **上一批的治理文件**(本期直接沿用,你只写差异):
   `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5a-common-constraints.md`
4. **Vue2 蓝本**(只读,只能 `git show main:<path>`,**禁止在那个工作树里改任何东西 / 提交任何东西**):
   仓库 `/home/nimo/NimoTech/NimoOS-UI`,相关文件
   `src/pages/AI/knowledge/{QueueView,IndexedFilesView}.vue` · `src/pages/AI/styles/knowledge.scss` ·
   `src/assets/lang/zh_CN.json`(具体路径以计划书里给的行号引用为准,自己 `git show main:` 找)
5. **两档色板权威源**(New-UI 仓内):暗档 `src/styles/tokens.scss`、浅档 `src/styles/theme.css`

## 你要产出什么

全部落在 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/`,四份文件:

- `p5b-common-constraints.md` —— **只写与 `p5a-common-constraints.md` 的差异,不从零重写**;11 节骨架照 P5a 的编号
- `p5b-appendix-A-i18n.md` —— 计划书 §6 全表
- `p5b-appendix-B-tokens.md` —— 计划书 §7 色值映射表
- `p5b-appendix-D-classes.md` —— 计划书 §8 类白名单

**每一节的具体要求见计划书 §2「T0」小节,逐条照做。**

### 外加(计划书没挂到任何任务下,协调者裁定并进 T0)

5. **抓 fixture**:跑计划书 §9 附录 C 的 **C.1(只读,全部)+ C.2(幂等写,全部)**,原始响应体
   **逐字**落盘到 `.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-fixtures/`(一条一个 `.json`,文件名见名知意,
   例如 `stats.json` / `jobs-pending.json` / `files-default.json` / `distill-jobs.json` …)。
   同目录再写一份 `README.md`,列「文件名 → 原始 curl 命令 → 抓取时间 → 关键形状备注」。
   - 🔴 **C.3(破坏性)一条都不许跑。**
   - 🔴 服务必须直连 Parser `:8283` / agent `:8282`;走 `/v1/ai/*` 必 400(NimoOS-AI 对 localhost 也强制 JWT)。
     两个端口协调者已确认活着(2026-08-01 12:30 各返 200)。
   - C.2 最后那条「501 个 file_ids 求 400 形状」的 shell 里有个坏的 python fallback,自己改对
     (要的是 `MAX_REINDEX_FILE_IDS = 500` 的 400 响应体形状)。`MAX_REINDEX_BY_FILTER = 10000`
     本机触发不了,按后端源码记录形状即可,并在 README 里注明「未实测,源码推定」。
   - 这批 fixture 是 T5 / T8 / T9 / T10 的 mock 唯一来源(禁手编,已栽过三次)。

## 协调者已裁定的 3 条(直接写进 `p5b-common-constraints.md`,不要再问)

- **F1 · 附录 B 与 §2 里的「T4 已做」「承 T11 先例」「照 T10/T12 先例」全是 *P5a* 的任务号,不是本期的 T4/T10/T11/T12。**
  一律读作「P5a 已经做过,现状就在 `src/ai/styles/knowledge.scss` 里,本期不要重复改」。
  唯一落地判据:**下笔前 grep 现状文件,已存在即不动**。请在治理文件里把这条写成一条硬规则。
- **F2 · 计划书 §2 T2 第 4 条与附录 B.2 对两个 token 的归属自相矛盾。**
  T2 说「本段用到 `--success-soft-border` / `--purple-soft` / `--danger-hover`,`--danger-soft-faint` 留 T6」;
  但 B.2(T2 段)的 `:1417` 明确映射 `--danger-soft-faint`,而 `--purple-soft` 在 B.2 里一处没有
  (它只出现在 B.3 = T6 段的 `:1894`)。
  裁定:**「只声明真正用到的」是硬规则,附录 B 的逐行映射表是权威,T2 第 4 条那句枚举是笔误。**
  你要按 B.2 / B.3 逐行核过之后,在治理文件 §6 里写死一张
  「token 名 → 在哪个任务声明 → 暗档值 → 浅档值 → 被哪几行用到」的表,并显式登记本条勘误。
- **F3 · fixture 抓取归 T0**(即上面第 5 条),C.3 不跑。

## 全批硬约束(写进治理文件 §1,也约束你自己)

- 可写仓只有 `.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。`.sp8/NimoOS-Service` **本期零改动**
  —— 因此不需要跨仓 `pnpm build` / `pnpm install`。
- `/home/nimo/NimoTech/NimoOS-UI` 只读,且是**多个会话共享的检出**,只能 `git show main:<path>`。
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**。
- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push。
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`。
- **实测基线(协调者跑的,以此为准,不要用计划书 §5 的预测数)**:`pnpm test` → **313 文件 / 2872 例全绿**。
  三门 = `pnpm test` + `pnpm exec vue-tsc --noEmit` + `pnpm build`。

## 提交

`.superpowers/sdd/` 被 `.gitignore` 盖住,四份治理/附录文件用 **`git add -f <显式路径>`** 逐个加。
`p5b-fixtures/` 也 `git add -f`。**只用显式 pathspec,一次 commit。**

## DoD

- `grep -c "^## " p5b-common-constraints.md` ≥ 11
- 附录 A 行数 = 99 + 表头;附录 D 类数 = 85(32 + 53)
- 三份附录的每一条都能回权威源(Vue2 `zh_CN.json` / `tokens.scss` / `theme.css` / 蓝本 scss)复核过
  —— **不是照抄计划书就算数,要真的去 `git show main:` 核**,核出与计划书不符的地方就是你的产出价值,
  逐条在治理文件末尾开一节「§12 计划书勘误」登记
- 文件里不出现「大概 / 待定 / TODO」
- `p5b-fixtures/` 有 C.1 的 13 条 + C.2 的 3 条,外加 `README.md`

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-0-report.md`,内容:
产出清单 · 逐条回源复核的结果(尤其**计划书勘误**要单列一节,每条给「计划书原文 / 权威源实际 / 我的处置」)·
fixture 抓取记录(哪条跑了、返回什么形状、哪条没跑为什么)· 遗留疑问。

**返回给我的正文只要 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 勘误条数 · fixture 条数 · 最要紧的 1–2 个 concern。**不要把报告正文贴回来。**
