### Task 0: 清理 NimoOS-UI 工作区(P6 无关改动)

`NimoOS-UI` 有 3 个未提交改动,而本期要构建部署该仓,不处置就会静默上线。**必须先做完这个任务再动 P6 代码**,否则 P6 的提交会和它们混在一起。

**Files:**
- Commit as-is: `src/views/Home.vue`(+60,`/next/` 入口药丸,**已在现网**)
- Commit as-is: `src/views/AI/Agent/Agent.vue`(+13,接 `?message=` 种子消息)
- Revert: `src/views/Photos/PhotosTimeline.vue`(−163,撤掉了已提交的照片深链同步 + 重新启用 `PhotosDropZone`,疑似误 checkout)

**Interfaces:**
- Consumes: 无
- Produces: 干净的 `NimoOS-UI` 工作区(`git status --short` 只剩 `docs/` 与未跟踪文件),后续任务的提交才只含 P6 改动。

- [ ] **Step 1: 确认三处改动内容与判读一致**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git status --short -- src/
git diff --stat -- src/views/Home.vue src/views/AI/Agent/Agent.vue src/views/Photos/PhotosTimeline.vue
```

预期:恰好这 3 个 `src/` 下文件被修改(`M`)。若出现**第 4 个** `src/` 下的修改文件,**停下来报告**,不要自行处置。

- [ ] **Step 2: 验证 `/next/` 药丸确实已在现网**(决定「提交而非丢弃」的依据)

```bash
grep -rl "enter-next" /var/lib/nimoos/www --include=*.js 2>/dev/null | grep -v '/app/'
```

预期:命中 `src_components_common_KIcon_vue-src_views_Home_vue.*.js`(现网 Home chunk 里有这段样式类名)。若**无命中**,停下来报告 —— 判读前提不成立。

- [ ] **Step 3: 单独提交 Home.vue 的 `/next/` 药丸**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/views/Home.vue
git commit -m "feat(home): Vue2 桌面补「进入新主页」入口药丸

早前改动一直未提交但已在现网(部署的 Home chunk 含 enter-next)。
本次 SP6-P6 要构建部署 Vue2 仓,先把它正式入库,避免随 P6 提交混入。
与 SP6-P6 无关。"
```

- [ ] **Step 4: 单独提交 Agent.vue 的 `?message=` 接力**

```bash
git add src/views/AI/Agent/Agent.vue
git commit -m "feat(ai): Agent 页接收 ?message= 种子消息

New-UI 桌面 AI 小组件的 sendToAI 一直在发 /#/ai/agent?message=<text>,
接收端此前未提交。?search= 在场时跳过,两者不会双发。
本次 SP6-P6 要构建部署 Vue2 仓,先把它正式入库。与 SP6-P6 无关。"
```

- [ ] **Step 5: 撤回 PhotosTimeline.vue 的旧版本**

```bash
git checkout -- src/views/Photos/PhotosTimeline.vue
git diff --stat -- src/views/Photos/PhotosTimeline.vue
```

预期:第二条命令**零输出**(文件回到 HEAD)。

- [ ] **Step 6: 确认工作区干净并跑全量测试**

```bash
git status --short -- src/
pnpm test 2>&1 | tail -20
```

预期:第一条命令零输出;测试全绿(记下用例数,后续任务比对)。

- [ ] **Step 7: 无需额外提交,报告本任务结果**

报告:两个提交的 hash、`pnpm test` 的用例数。

---

