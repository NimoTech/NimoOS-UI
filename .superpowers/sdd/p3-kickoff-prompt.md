# SP8-P3 开工提示词(2026-07-30 生成,给下一个会话直接粘)

下面这段整块复制粘贴即可。

---

开 SP8-P3:AI 设置区的「技能」分区迁移。工作路径 `.sp8`。

## 起点

- P0/P1/P2a/P2b 全部收官,用户验收通过。New-UI 坐标 `sp8-ai`@`105e6bb`,Service `sp8-ai`@`2af8262`,工作树干净、**未 push**。
- 全量门基线:**286 文件 / 2335 例绿 · `pnpm exec vue-tsc --noEmit` exit 0 · `vite build` ✓**(只余既有 >500 kB chunk 警告)。开工前先复跑一遍确认基线,别采信这段话。
- 台账 `.sp8/NimoOS-New-UI/.superpowers/sdd/progress.md`(**gitignore,不进 git**),SDD 工件用 `p3-` 前缀(避免与 `p1b-`/`p1c1-`/`p1c2-`/`p2a-`/`p2b-` 撞名)。
- roadmap/plan/spec 提交在 **NimoOS-UI 仓的 `docs/vue3-migration-sp3` 分支**(不是 master),plan 放 `docs/superpowers/plans/`。

## 本期范围

把设置区导航里的「技能」分区(`sections.ts` 的 `id: 'skills'`,英文标签 `aiCfgSkills`)从占位面板变成真实现。当前它和 `mcp` 一起在 `DEFERRED_SECTIONS`/`SPLIT_SECTIONS` 里,点进去是 `SectionPlaceholder`(coming soon)。

Vue2 蓝本在 `NimoOS-UI/src/views/AI/Skills/`,共 7 个组件 1051 行 + `skills-styles.scss` 782 行:

| 文件 | 行数 |
|---|---|
| `SkillsSection.vue` | 226 |
| `SkillDetail.vue` | 271 |
| `AddSkillModal.vue` | 188 |
| `TestPanel.vue` | 182 |
| `SkillIcon.vue` | 77 |
| `SkillGroup.vue` | 64 |
| `SkillTile.vue` | 43 |

后端:`ai.db` 的 `user_skills` / `skill_state` 两张表;技能测试跑在 `bwrap --unshare-net` 沙箱里(**测试运行无网络**,见工作区根 CLAUDE.md 的 NimoOS-AI 小节)。

## 必须先读

1. `.sp8/NimoOS-New-UI/CLAUDE.md` —— 尤其 **★ 主题/配色约定**(颜色只能来自 token,禁裸色字面量)。
2. 记忆 `sp8-ai-migration-progress.md` —— 整期的坑与流程教训都在里面,**特别是 P2b 那节的"一族根因:嵌套主题作用域"**。
3. 记忆 `vue2-port-visual-only-fix-logic.md` —— 移植纪律:**界面严格 1:1,Vue2 的 bug/竞态/吞错不照抄、改正确逻辑并在代码注释 + 报告里申报**;禁与需求无关的重构。**未申报的偏离本身就是缺陷。**
4. 台账里 P2a/P2b/1c-2 三节的教训清单(译文必须现场查语言包、评审禁 haiku 且须自读源码、任务门必须跑全量而非子集等)。

## 这一期必须复用 P2 已经踩平的东西

- **弹窗**:用 `src/ai/components/settings/SkModal.vue`(reka Dialog 外壳),别再手写 `.sk-modal-bg` 裸 div。视觉规则在 `sk-shared.scss`。
- **复制按钮**:用 `src/ai/composables/useCopyFeedback.ts`(toast + 「已复制」打勾态,同时只有一个按钮打勾)。**别再手写 `copy()`**。
- **错误提示**:表单类错误走**行内、落在对应输入框上方**(先例 `ChannelsSection.vue` 的 `addError` + `.chan-field-err`),不要 toast。界面上**永不回显后端原文/JSON** —— 需要本地化就写「后端串 → i18n 键」的纯函数映射(先例 `channelsFormat.addBotErrorKey`),不要直接用 `apiErrorMessage` 的返回值当最终文案。
- **`apiErrorMessage`** 现在认 `message`(Go)与 `detail`(FastAPI)两种形状,且**不再** JSON 序列化未知对象。
- **原生控件 / 应用级浮层**:AI 区是嵌套主题作用域(`data-theme` 在 `.agent-app` 容器上)。新增原生表单控件不用管(`color-scheme` 已在两个主题块声明);但**若本期新增任何挂在 AI 区外面的浮层,先想清楚它读的是哪套调色板**。
- **i18n**:新键必须同时进 `zh_cn.ts` 与 `en_us.ts`(parity 测试会红),文案里的裸 `@` 要写成 `{'@'}`(messageSyntax 守卫会红)。**译文一律现场从 Vue2 生产语言包查,不许凭印象写。**

## 开工方式

按 superpowers 的 SDD 流程走:先 brainstorming 把范围/拆批/决策点问清楚(P2 是拆成 P2a/P2b 两批验收的,技能区 1051 行 + 782 行样式,是否拆批请先问我),再写 plan 提交到 NimoOS-UI 的 `docs/vue3-migration-sp3` 分支,然后逐任务实现 + 独立评审。

**验收约定**:起 `:5288` dev server(`cd .sp8/NimoOS-New-UI && pnpm dev --host --port 5288`),入口 `http://192.168.1.143:5288/app/#/ai/settings?section=skills`。**不跑 `deploy.sh`、不碰真机。** 肉眼项一律等我人眼验收,你不许声称已验。

## 手上还挂着的账(P3 不做,但别弄丢)

1. **一条未定性的偶发全量红**:出现 1 次,连跑 4 轮复现不出,失败用例名因输出被截而丢失。**以后跑全量门保留完整输出**(`grep -E "×|Failed|Test Files|Tests "`),别只 `tail`。
2. **5 条需要写真机的验收项**,用户拍板挂到合并 master 之后:非管理员视角(设备上只有 1 个 admin 账号)· 真实 Telegram/Discord 配对(无 bot)· Phoenix 全新安装流程与安装中途卸载守卫(容器已装且在跑)· 「打开 Phoenix」· inotify 复制按钮(本机 `max_user_watches` 恰等于推荐值,按钮渲染条件不成立)。
3. **设备侧后端票(与 New-UI 无关)**:`/var/lib/nimoos/apps/arize-phoenix/docker-compose.yml` 端口映射写错 —— 容器内 uvicorn 听 6006,compose 却 `published: 8099 → target: 8099`,宿主两个端口都连不上,所以「打开 Phoenix」必然打不开。
4. **`sp8-ai` 未合 master**:领先 99 提交、落后 72,`git merge-tree` 预演 4 个冲突文件(`src/i18n/{zh_cn,en_us}.ts`、`src/router/index.ts`、`vite.config.ts`)。**`sp7-photos` 压在同一 base、冲突文件高度重叠,合并顺序必须我拍板,别自作主张。**
5. P1/P2 的其余小挂账见 roadmap §SP8 与台账。
