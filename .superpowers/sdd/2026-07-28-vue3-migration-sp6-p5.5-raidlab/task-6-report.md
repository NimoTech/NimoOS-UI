# Task 6 报告：验收清单文档

## 结果

- 状态：完成
- Commit：`101ff09`（分支 `sp6-p5.5-raidlab`，仓库 `nimo_os_docs`）
- 文件：`nimo_os_docs/docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md`
- 清单条目（`- [ ]`）总数：**44 条**（含 `[我跑]` 命令行条目与 `[你点]` 浏览器操作条目）

## 提交事故与修复（务必记录）

第一次提交时用了 `git add docs/acceptance/... && git commit -m ...`（无 pathspec），把仓库里**已经预先 staged**（不是我改的）的 `CLAUDE.md`、`DEV_DEPLOY.md`、`scripts/deploy-ui.sh` 三个文件一并提交了进去（`git commit -m` 不带 pathspec 提交的是整个 index，不是"我 add 过的东西"）。发现后立刻：
1. `git reset --soft HEAD~1`（只回退 HEAD，不动 index/工作区）
2. `git restore --staged CLAUDE.md DEV_DEPLOY.md scripts/deploy-ui.sh`（把这三个文件退回到最初的"仅工作区改动、未 staged"状态）
3. 用 `git commit -m "..." -- docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md`（显式 pathspec）重新提交

修复后确认：新提交 `101ff09` 只有 1 个文件、155 行新增；`git status --short` 显示 5 个既有脏文件（含 `docs/design/2026-07-21-files-paste-upload-design.md` 未跟踪文件）状态与我开始工作前完全一致。教训：以后在有既有脏文件的仓库里提交，一律用 `git commit <pathspec>` 而不是 `git add` 分两步走。

## 自查改写

写完后通读一遍，检查是否有「验证 X 正常」「检查 Y 是否正确」这类不可判定的话：
- 只在文档最开头的一句总述里发现了"验证...是否表现正常"（不是清单条目，是引言段落），已改写为"按每一条『点哪里 → 应该看到什么』去核对，看到的和条目里写的对不上，就是发现了问题"。
- 逐条检查全部 44 个 `- [ ]` 条目，每一条都已经是「点哪里/看什么 → 应该出现的具体文案或状态」的形式（比如"应弹出提示『快照已创建』"而不是"确认创建成功"），未发现需要二次改写的条目。

## 从 raidlab.sh 核对过的命令/文案

读了完整脚本源码（`nimo_os_docs/scripts/raidlab.sh`，628 行），核对并直接采用了以下真实输出文案，避免清单里出现脚本从未打印过的话：
- `up` 成功末行：`raidlab: 测试台就绪。下一步按验收清单在 5273 预览页操作。`
- `up` 失败提示：`avail 为空` / `IsDiskSupported 白名单补丁未部署`
- `down` 成功末行：`raidlab: 已回到基线。`
- `down` 失败提示：`raidlab: 拆台未完全成功，请跑 ./raidlab.sh status 查看。`
- `status` 的六个分节标题与空值文案（`(无)`、`(空 —— 若假盘已在场，说明白名单补丁未部署)`）
- 标记文件路径 `/etc/nimoos/allow-pseudo-disks`，`down` 步骤 6 撤回它
- 备份文件命名规则：`$RAIDLAB_FSTAB.raidlab.bak` = `/etc/fstab.raidlab.bak`，`$RAIDLAB_MDADM_CONF.raidlab.bak` = `/etc/mdadm/mdadm.conf.raidlab.bak`（只有 diff 检测到实际改动才会生成，清单里已注明这个前提条件）
- 脚本第 278–295 行关于 `mdadm.conf` 符号链接风险的注释，原样搬进了清单「环境取证」一节

**偏离 Task 6 brief 骨架的一处**：brief 草稿里写的收尾检查是 `grep -c raidlab /etc/fstab` 为 0 —— 但读脚本后发现 fstab 里的 `@snapshots` 行本来就不含字符串 "raidlab"（那是脚本自己的名字，不是它写进 fstab 的内容），这条命令测出来恒为 0，测不出任何东西，属于 brief 草稿本身的笔误/占位。清单里换成了有实际意义的 `grep '/dev/md' /etc/fstab`（应无输出）和 `grep -c ARRAY /etc/mdadm/mdadm.conf`（应为 0），这才是脚本 `down` 真正要清干净的两类残留。

## 关于「恢复」按钮（第二轮 ④）的处理

追加做了一次调研（读 `NimoOS-New-UI/src/storage/util/raidView.ts` 和 `NimoOS-LocalStorage/service/v2/raid.go`）：「重新识别」按钮只在阵列状态为 `isRetrying`/`isFailed` 时才出现，而清单里设计的 `mdadm --fail` 单盘故障 + 换盘重建流程，正常只会走到 `degraded` → `rebuilding` → `active`（健康），不会触发 `retrying`/`failed`。所以没有像 brief 骨架那样断言"点击恢复按钮"，而是写成了条件分支：顺利完成不出现按钮是正常，标"不适用"；万一真出现了再给出对应判定标准。这是为了不让读者（项目所有者）对着一个大概率不会出现的按钮空等，怀疑自己操作错了。

## 认为清单里已经覆盖、值得一提的设计取舍

- 第一轮里让阵列 B 建阵列时**故意不勾选**"启用快照保护"，而不是像 A 一样默认勾选 —— 这样才能让"在 B 上开启保护"这个动作（brief 原文明确要求）有真实意义，同时创造出 A/B 两组数字上完全不同的"策略摘要 + 快照数"作为可对比的判定依据，比单纯目测两个页面像不像更可判定。
- 阵列重名校验的测试设计成"先去看现有存储卷叫什么名字，再故意重名"——因为后端校验是同时对已有阵列名和已有卷名去重（已用 Explore 子代理核实源码 `StorageRaidCreate.vue` 78-90 行），这样不需要先建第二个阵列就能触发这条校验，流程更短。

## 可能还缺的东西

- 清单没有覆盖"混规格盘容量警告"（已在已知盲区里注明 N/A + roadmap B8），以及 P7 文件区快照套件（spec 第二段，brief 说明本 Task 不含）——这两块本就不在 Task 6 范围内，只是提一下没有遗漏范围之外的东西。
- 清单里"记下 X"这类需要人工填空的地方（如 `mdadm.conf` 设备字段写法、`--fail` 前后 `dev-*` 目录对比）用了下划线占位符，实际验收时这些空需要执行者手写填入，文档本身没有自动记录机制——这是纯 markdown 清单的固有局限，若后续想要更强的可追溯性，可以考虑改成执行者验收时另开一份"验收记录"文件而不是直接在清单原文件上填空。
