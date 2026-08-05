# SP6-P6 存储区收口 + cutover — 台账

Plan: `docs/superpowers/plans/2026-07-30-vue3-migration-sp6-p6-cutover.md`
Spec: `docs/superpowers/specs/2026-07-30-vue3-migration-sp6-p6-cutover-design.md`
两仓:NimoOS-UI(Task 0-3,分支 `docs/vue3-migration-sp3`)+ NimoOS-New-UI(Task 4-5,分支 `master`)。
Task 5 执行于 2026-07-30。运行台账(逐条命令/结果来源):
`.superpowers/sdd/2026-07-30-vue3-migration-sp6-p6-cutover/progress.md`

## 1. 四个 cutover 点的行为矩阵(照 spec §4 抄录)

一把开关:`localStorage['strangler:disabled:/storage']`。

| # | 位置 | flag 未置 | flag = `'1'` |
|---|---|---|---|
| ① | New-UI `useOpenAction` storage 分支 | `router.push('/storage')` | `'/#/legacy'`(Vue2 桌面) |
| ② | Vue2 `Home.vue`(新盘通知卡) | `location.href = '/app/#/storage'` | `$buefy.modal.open(StorageManagerPanel)` |
| ③ | Vue2 `widgets/Disks.vue` | 同上 | 同上 |
| ④ | Vue2 `MountActionButton.vue` | 同上 | 同上 |

## 2. Task 0 三个文件的处置结果

Vue2 仓工作区在改代码前发现 3 个与 P6 无关的既存改动(用户 2026-07-30 拍板逐文件处置):

| 文件 | 处置 | 提交 |
|---|---|---|
| `src/views/Home.vue`(`/next/` 入口药丸,+60,已在现网 Home chunk) | 单独提交,注明与 P6 无关 | `ea959bd8` — `feat(home): Vue2 桌面补「进入新主页」入口药丸` |
| `src/views/AI/Agent/Agent.vue`(接 `?message=` 种子消息,+13,New-UI `useOpenAction.sendToAI` 的配套活功能) | 单独提交,注明与 P6 无关 | `7c4020d4` — `feat(ai): Agent 页接收 ?message= 种子消息` |
| `src/views/Photos/PhotosTimeline.vue`(工作区撤掉了已提交的照片深链同步 + 重开 `PhotosDropZone`,疑似误 checkout) | `git checkout` 回 HEAD(无新提交,只是工作区复位) | — |

## 3. Task 1–4 提交 hash(分仓列)

**NimoOS-UI**(`docs/vue3-migration-sp3` 分支):

| Task | 内容 | 提交 |
|---|---|---|
| 0 | Home.vue `/next/` 入口 + Agent.vue `?message=` 接收 | `ea959bd8` .. `7c4020d4` |
| 1 | `strangler.js` 加 `migratedEntries` 表 + `resolveEntryTarget()` | `5e978628` — `feat(strangler): 加无路由绞杀点表 migratedEntries + resolveEntryTarget` |
| 2 | Vue2 桌面存储入口(`Home.vue` 新盘通知卡)改跳 `/app/#/storage` | `ed9a2ac4` — `feat(storage): Vue2 桌面存储入口改跳 /app/#/storage(SP6-P6)` |
| 3 | `widgets/Disks.vue` + `MountActionButton.vue` 改跳 `/app/#/storage` | `2e6858fb` — `feat(storage): 桌面磁盘小组件与文件区挂载按钮改跳 /app/#/storage(SP6-P6)` |

**NimoOS-New-UI**(`master` 分支):

| Task | 内容 | 提交 |
|---|---|---|
| 4 | `useOpenAction.ts` storage 分支补回退 flag `strangler:disabled:/storage` | `c8bac32` — `feat(storage): 存储磁贴补回退 flag strangler:disabled:/storage(SP6-P6)` |

Task 6(部署 + 真机验收)尚未跑,不在本台账范围。

## 4. Step 1/2 三条扫描命令逐字 + 命中数 + 逐条核验结论

范围:`src/storage/`(components/stores/util)+ `src/views/Storage*.vue`(五个视图)。全部在
NimoOS-New-UI 仓根目录执行。

### Step 1 — 模板中文文本节点扫描(期望 0)

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
for f in $(ls src/storage/components/*.vue src/views/Storage*.vue); do
  awk '/<template>/,/^<\/template>/' "$f" | sed 's/<!--.*-->//' \
    | grep "[一-龥]" | grep -vE "^\s*(<!--|[^<]*-->)"
done | grep -v "^\s*$" | tee /tmp/sp6p6-tpl-cn.txt | wc -l
```

**命中数:3**(非 0,逐行核验如下)

| 文件 | 内容 | 判定 |
|---|---|---|
| `src/storage/components/RaidReplacingCard.vue:49` | `<!-- 逃生门:重建万一挂住(内核没接手、盘再次掉线),看板不该永远转下去无法关闭。` | 多行 `<!-- ... -->` 注释的续行(开合标记不在同一行,`sed` 的单行 `<!--.*-->` 剥不掉跨行内容)。注释,非文案。 |
| `src/storage/components/SnapshotTimeline.vue:96` | `<!-- [浏览] 未迁:跳文件区快照只读浏览属文件区快照套件(只读横幅/禁写/退出),` | 同上,多行注释续行。注释,非文案。 |
| `src/views/StorageRaidDetail.vue:205, 237` | `detail 为空只发生在两处…` / `v-if="detail" 门:SnapshotPanel …` | 同上,两处不同的多行注释续行。注释,非文案。 |

**结论:0 条真实硬编码用户可见中文。3 条命中全部是多行 HTML 注释的续行**(`sed 's/<!--.*-->//'`
只处理"开始与结束标记同行"的注释,续行本身不含 `<!--`/`-->` 因此漏过滤,和 SP4-P8/SP5-P8 遇到
的情形同款)。不构成欠账,不补 i18n 键。

### Step 2 — `<script>` / `.ts` 中文字面量扫描(逐条核验)

```bash
grep -rn "[一-龥]" src/storage --include="*.ts" | grep -v "\.test\.ts" \
  | grep -vE "^[^:]+:[0-9]+:\s*//" | grep -E "['\"\`][^'\"\`]*[一-龥]" | tee /tmp/sp6p6-ts-cn.txt | wc -l
```

**命中数:1**

| 文件 | 内容 | 判定 |
|---|---|---|
| `src/storage/util/storageMap.ts:45` | `if (raidMountPoints.has(c?.mount_point \|\| '')) continue // RAID 卷归 /storage/raid(P3)` | 行尾 `//` 注释(过滤器 `grep -vE "^[^:]+:[0-9]+:\s*//"` 只挡"整行以 `//` 开头"的注释,挡不住"代码 + 行尾注释"这种)。注释,非文案。 |

```bash
for f in $(ls src/storage/components/*.vue src/views/Storage*.vue); do
  awk '/<script/,/<\/script>/' "$f" | grep -n "[一-龥]" \
    | grep -vE ":\s*(//|\*|/\*)" | grep -E "['\"\`][^'\"\`]*[一-龥]" | sed "s|^|$f:|"
done | tee /tmp/sp6p6-vue-script-cn.txt | wc -l
```

**命中数:1**

| 文件 | 内容 | 判定 |
|---|---|---|
| `src/storage/components/SnapshotPanel.vue:89` | `if (ok) manualLabel.value = ''   // Vue2 同款:只有成功才清备注` | 行尾 `//` 注释,同上过滤器盲区。注释,非文案。 |

**结论:两条命令共 2 条命中,全部是代码行尾的 `//` 注释,不是面向用户的字符串字面量。与
SP4-P8 / SP5-P8 的结论一致(「全是代码注释,欠账不存在」)。**

**Step 1/2 总计:5 条命中,逐条核验后全部判定为注释,0 条真实 i18n 欠账。不补键,不提交。**

## 5. 两仓全量测试用例数、tsc、color-guard、parity、build 结果

**NimoOS-New-UI**(`master`):

| 检查 | 命令 | 结果 |
|---|---|---|
| i18n parity + color-guard | `pnpm vitest run src/i18n/parity.test.ts src/styles/color-guard.test.ts` | 2 files / **125 passed** — 绿 |
| 全量 | `pnpm test` | **247 files / 1572 tests passed**,0 failed — 绿(与预期基线 ~1572 一致) |
| 类型检查 | `pnpm exec vue-tsc --noEmit` | 零输出 = **零错误** |
| 构建 | `pnpm build`(内部先跑 `vue-tsc --noEmit` 再 `vite build`) | **成功**,`✓ built in 11.01s`(仅有 chunk 体积警告,非错误,`ExcelViewer`/`index-DqQrYxNE` 超 500kB 提示,与本任务无关) |

**NimoOS-UI**(`docs/vue3-migration-sp3`):

| 检查 | 命令 | 结果 |
|---|---|---|
| 全量 | `pnpm test` | **154 files passed / 2 files failed;1440 passed / 8 failed**。失败均在 `tests/nimoTaskBar.test.js`(5 条)+ `tests/settingsStore.test.js`(3 条),与 Task 0 记录的**已知预先失败基线(8 条,同两个文件)完全一致**,数量未变坏,未新增红。不修(brief 明确要求不修)。 |
| 工作区 | `git status --short -- src/` | 无输出 = **`src/` 干净**,所有改动已提交 |

## 6. 变异验证记录(每个任务撤回了什么、哪条测试变红)— 摘自运行台账

- **Task 1**(`migratedEntries` + `resolveEntryTarget`,`strangler.spec.js` 16/16):
  变异 A(撤回主逻辑)变红;变异 B(撤回 `enabled` 分支,当前无 `enabled:false` 条目覆盖)
  按 plan 明示不补测试(YAGNI),不变红为预期,已裁定。
- **Task 2**(`Home.vue` 早退 + `Home.storageCutover.spec.js` 3/3):两处变异(撤回早退判断、
  撤回 flag 读取)各自使对应断言变红。
- **Task 3**(`Disks.vue` + `MountActionButton.vue` 早退,4 文件单提交):两处变异验证(各撤回
  一处早退)均按预期变红;评审记录两条 Minor(vi.mock 子组件桩、变异不落最终 diff),判非缺陷。
- **Task 4**(`useOpenAction.ts` storage 分支 + flag,12/12 spec):plan 原定变异指令第二条点错
  字面量(会命中 `/apps` 而非 `/storage`),实现 agent 改为对 storage 分支参数做变异,评审确认
  该变异证明「`/storage` 与 `/apps` 两把 flag 互不干扰」,变红符合预期。
- **Task 5(本任务)**:无源码改动,无新增测试,故无对应的变异验证动作 —— 本任务的"验证"是
  对既有 5 条扫描命中逐条读文件核验(见 §4),而非撤回代码看测试变红。

## 7. 留白待 Task 6 填

- 部署产物入口 chunk(New-UI `deploy.sh` / Vue2 `deploy-ui.sh` 跑完后的实际 chunk 名/hash)。
- 真机验收结果(spec §8 的 A/B/C 三组、共 7 条路径的实测勾选)。

---

## 部署结果(2026-07-30,填补留白)

| 仓 | 命令 | 结果 |
|---|---|---|
| New-UI | `./scripts/deploy.sh` | 13:07 成功 → `/var/lib/nimoos/www/app/`,入口 chunk **index-DqQrYxNE.js** |
| Vue2 | `nimo_os_docs/scripts/deploy-ui.sh` | 13:08 成功 → `/var/lib/nimoos/www/`,Build Hash **0017d5c593c93239** |

部署后核实:`/app/` 未被 Vue2 部署覆盖(13:07 vs 13:08,`deploy-ui.sh` 内建 `--exclude app/`);
Vue2 产物里 `/app/#/storage` 与 `strangler:disabled:/storage` 均可查到(FilePanel chunk + Home chunk)。

**顺带上线(用户 2026-07-30 拍板)**:`deploy-ui.sh` 构建工作树,故 SP8-P0 的 SSE 401 自愈
(`e2581e7f`/`e7637215`/`9f5e7a22`,`src/service/ai.js` + `agentStream.js`)一并生效 —— SP8 那条
「P0 代码就绪但真机未部署」挂账随之清掉。验收须多验一条:**AI 对话 token 过期后自愈不掉线**。
出问题可单独回滚这 3 个提交重部署。

## 最终坐标

- NimoOS-UI `docs/vue3-migration-sp3`@**5c325a42**(代码)/ **b66b9b82**(roadmap 记账)
  —— ⚠️ 该仓**没有 master 分支**,Vue2 侧迁移工作一直在此分支(领先 `main` 163,从未合并)。
- NimoOS-New-UI `master`@**c8bac32**(代码)/ **4e4b522**+**d489c5f**(spec/plan)
- 门:New-UI 1572/1572 + vue-tsc 零错 + color-guard/parity 125/125 + build 成功;
  Vue2 1440 passed / 8 failed(那 8 条预先失败与本期无关)。

## 真机验收:待用户执行(清单见 spec §8)

