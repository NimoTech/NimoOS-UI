# SDD ledger — plan: docs/superpowers/plans/2026-08-08-vue3-migration-sp14-ai-catchup.md
Task 0: complete (commit 1212485, conclusion 不支持 → Task 10 走 CDP 注入验收)
NOTE: .superpowers/sdd/.gitignore 是裸 * (8289a1a 引入, 505e3bf 只修了父级) ⇒ 本期台账一律 git add -f
Task 1: complete (commits 1212485..f3ae4ac, review clean)
Task 1: minor (deferred): useConfirmResolve.ts:124 冗余 as Ref 断言
Task 1: minor (deferred): 测试断言中文文案字面量,文案改动会连带红
Task 2: complete (commit 8e9e347, review clean, isolated package commit)
Task 2: minor (deferred): ai.test.ts 新增的「不传 extra」回归例与既有 :89-93 那条完全重复(brief 的锅)
Task 3: complete (commit b90f891, review clean; ⚠️ commit trailer 项已由控制者自查确认)
Task 3: minor (deferred): cancel 分支无直接用例(decline 已覆盖 confirmed=false)
NOTE: 改 packages/service 后 pnpm 硬链接会断,vue-tsc 会报旧签名 ⇒ 跑一次 pnpm install(见 newui-inlined-service-package)
Task 4: fix round 1/5 (1 addressed, 0 open — 中文注释一律翻英文; commits 0afb5c5..00536b1)
Task 4: complete (commits b90f891..00536b1, review clean)
Task 4: minor (deferred): title 为空串时回落 key(后端不会给空 title)
Task 4: minor (deferred): min_items+max_items 同时满足的合法用例未覆盖
DECISION 2026-08-09: 代码注释一律英文(用户裁定),计划已在 254f902 改约束;台账/简报/设计文档仍中文
Task 5: complete (commit 7e1d59e, review clean; 全量 650 文件/10451 例通过)
Task 5: minor (deferred, 建议终审优先): FORMAT_INPUT_TYPE 的 uri 不得映射成 type=url 无回归守卫(设计文档点名的载重规则)
Task 5: minor (deferred): boolean/multi_enum 渲染与 cancel 按钮无用例
NOTE: sdd 工作台目录的 .gitignore(裸 *)由 superpowers 脚本每次重建且自我忽略 ⇒ 台账提交一律 git add -f
Task 6: complete (commit b6b7022, review clean; ⚠️ trailer 已自查)
Task 6: minor (deferred): 模板注释措辞含糊(实际护的是 message 不走 v-html)
Task 7: complete (commit 3f184c7, review clean; aiChange 因 McpInstallCard 仍在用而保留)
Task 7: minor (deferred): BlockRenderer 两条新断言只查 .mcc-perm,form/url 映射对调也能过
Task 8: complete (commits 35a4006 前端 + ebd525c 包超时,两 commit 分离已自查, review clean)
Task 8: minor (deferred): 组件级无「旧后端整个不给协议字段」的端到端用例(单元层已证)
Task 9: complete (commit d4d3771, review clean; 网格空格 c10,r2 已独立复算,brief 建议的 c9,r6 会与 events 撞)
Task 9: minor (deferred): useOpenAction.test.ts 新用例名仍是中文(我在派单里说过测试名可中文,与「新写的一律英文」裁定有张力)
Task 9: minor (deferred): .ic-knowledge 琥珀色与 .ic-storage 相近,相邻磁贴视觉易混(待机主眼验)
Task 10: complete (closeout 提交 bb08862 + 修复 6 个 commit;门数见 .superpowers/sdd/sp14/closeout.md)
FINAL REVIEW (opus, 全支 65c7928..bb08862): 0 Critical;3 Important + 3 必修测试项已在 df91b6b/03e6ba1/0cf986a 修完并过定向复审
FINAL: 未采纳项(交机主定): McpInstallCard 仍是旧 409 形态+「更改」按钮(Vue2 #136 也没动它,属范围外)

FINAL GATES (控制者复跑于修复轮之后,2026-08-09):
- vitest 全量: 655 文件 / 10499 例 全绿 (exit 0)
- vue-tsc --noEmit: 0 错
- pnpm build: 成功(仅 chunk>500kB 的既有告警)
- oss 导出: 一度红 —— 修复轮给 useOpenAction.ts 补注释又打断了 PATCH 锚点(T10 刚重锚过),已在 df3847c 修并把锚点拆细;现 6 文件/141 例全绿,导出树里 knowledge//ai/agent/sendToAI 零命中
⚠️ 我曾把这次 oss 红判成「工作树脏」,干净树复跑才证伪 —— 记一笔防复发
Task 11: complete (commits 7e3f780 + 0868c0f 修复轮, review clean) —— McpInstallCard/ConfirmCard 接入 useConfirmResolve、删「更改」按钮与 aiChange 死键;PermissionRequestCard 按其 409=别处已决 的语义**刻意不动**,只补英文注释
Task 11: 顺带把 detail 优先级(response.data.detail > e.message)提进 composable,三张新卡也一并受益

MERGE (2026-08-09): master(34 提交,SP12 Plan A+C)已合入本分支,合并提交见 git log;merge-tree 预演零冲突,实合也零冲突
合并后五门:vitest 663 文件/10574 例(三次全量分别红 1/0/2 条且每次不同文件,单独跑全通过 ⇒ 负载相关偶发,基线上也有) · vue-tsc 0 错 · build 成功 · oss 141 例全绿(锚点未被合并推走)
🔴 合并后 vue-tsc 一度报 master 侧 service.uploadBatches/UploadBatch 不存在 —— 是 pnpm 硬链接被合并的原子写打断(inode 实测不同),pnpm install 重链后即 0 错。Vitest 走 Vite 解析所以照样全绿,两者不矛盾
