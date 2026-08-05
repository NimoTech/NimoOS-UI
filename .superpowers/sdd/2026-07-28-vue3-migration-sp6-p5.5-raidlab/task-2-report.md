# Task 2 报告:`raidlab.sh` 骨架 + 假盘护栏 + 测试 harness

- 仓库:`/home/nimo/NimoTech/nimo_os_docs`
- 分支:`sp6-p5.5-raidlab`(未切换,未新建)
- 提交:`e07cafe`

## 前置检查

跑 Task 前先确认了既有脏文件状态,与任务描述一致,未触碰:

```
$ cd /home/nimo/NimoTech/nimo_os_docs && git status
On branch sp6-p5.5-raidlab
Changes to be committed:
	modified:   CLAUDE.md
	modified:   DEV_DEPLOY.md
	modified:   scripts/deploy-ui.sh
Changes not staged for commit:
	modified:   scripts/deploy-agent.sh
Untracked files:
	docs/design/2026-07-21-files-paste-upload-design.md
```

这 5 个文件全程未被 `git add`,commit 后重新 `git status` 确认它们原样保留(见下文 Step 6)。

## Step 1: 写失败测试

按 brief 逐字创建 `nimo_os_docs/scripts/raidlab.test.sh`(内容与 brief Step 1 代码块完全一致,未做任何改动)。

## Step 2: 跑测试确认它失败

```
$ cd /home/nimo/NimoTech/nimo_os_docs/scripts && chmod +x raidlab.test.sh && ./raidlab.test.sh
./raidlab.test.sh: line 10: /home/nimo/NimoTech/nimo_os_docs/scripts/raidlab.sh: No such file or directory
== is_fake_disk / assert_fake_disk / list_fake_disks ==
  FAIL 带尾随空格的 scsi_debug 认得出  (期望成功,实际退出码 127)
  FAIL 无空格的 scsi_debug 认得出  (期望成功,实际退出码 127)
  ok   真盘型号被拒
  ok   无 device/model 的裸块设备被拒
  ok   不存在的设备被拒
  ok   空设备名被拒
  ok   名字含 nvme 一律拒(即便 model 是 scsi_debug)
  FAIL assert 接受裸设备名  (期望成功,实际退出码 127)
  FAIL assert 接受 /dev/ 全路径  (期望成功,实际退出码 127)
  ok   assert 拒绝真盘路径
  ok   assert 拒绝 nvme 路径
./raidlab.test.sh: line 89: list_fake_disks: command not found
  FAIL list_fake_disks 只列假盘且排序
    期望: [sda
sdb]
    实际: []

通过 7,失败 5
EXIT_CODE=1
```

符合预期:`raidlab.sh: No such file or directory`(被测脚本尚不存在),部分依赖未定义函数的用例失败(退出码 127 / command not found),不依赖被测函数的护栏用例(如「真盘型号被拒」——因为 `is_fake_disk` 未定义时命令本身就失败,天然判为"应失败"通过)侥幸通过,属正常现象,不影响本步骤"确认失败"的目的。

## Step 3: 最小实现

按 brief 逐字创建 `nimo_os_docs/scripts/raidlab.sh`(内容与 brief Step 3 代码块完全一致)。已用 diff 核对与 brief 原文的唯一差异只是 markdown 代码围栏(\`\`\`bash / \`\`\`)行,脚本正文逐字符一致。

## Step 4: 跑测试确认通过

```
$ cd /home/nimo/NimoTech/nimo_os_docs/scripts && chmod +x raidlab.sh && ./raidlab.test.sh
== is_fake_disk / assert_fake_disk / list_fake_disks ==
  ok   带尾随空格的 scsi_debug 认得出
  ok   无空格的 scsi_debug 认得出
  ok   真盘型号被拒
  ok   无 device/model 的裸块设备被拒
  ok   不存在的设备被拒
  ok   空设备名被拒
  ok   名字含 nvme 一律拒(即便 model 是 scsi_debug)
  ok   assert 接受裸设备名
  ok   assert 接受 /dev/ 全路径
  ok   assert 拒绝真盘路径
  ok   assert 拒绝 nvme 路径
  ok   list_fake_disks 只列假盘且排序

通过 12,失败 0
EXIT_CODE=0
```

符合预期:`通过 12,失败 0`,退出码 0。

## Step 5: 反向验证护栏真的在守

把 `is_fake_disk` 里的

```bash
case "$dev" in
*nvme*) return 1 ;;
esac
```

改为

```bash
case "$dev" in
# *nvme*) return 1 ;;  # TEMP: Step 5 反向验证,故意注释掉
esac
```

重跑测试(**改坏后的实际输出**):

```
$ cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
== is_fake_disk / assert_fake_disk / list_fake_disks ==
  ok   带尾随空格的 scsi_debug 认得出
  ok   无空格的 scsi_debug 认得出
  ok   真盘型号被拒
  ok   无 device/model 的裸块设备被拒
  ok   不存在的设备被拒
  ok   空设备名被拒
  FAIL 名字含 nvme 一律拒(即便 model 是 scsi_debug)  (期望失败,实际成功)
  ok   assert 接受裸设备名
  ok   assert 接受 /dev/ 全路径
  ok   assert 拒绝真盘路径
  FAIL assert 拒绝 nvme 路径  (期望失败,实际成功)
  FAIL list_fake_disks 只列假盘且排序
    期望: [sda
sdb]
    实际: [nvme0n1
sda
sdb]

通过 9,失败 3
EXIT_CODE=1
```

转红确认:brief 预期的两条(`名字含 nvme 一律拒` 和 `assert 拒绝 nvme 路径`)确实 FAIL。额外多了第三条 `list_fake_disks 只列假盘且排序` 连带失败——因为名字否决被拆掉后,`nvme0n1`(model 被测试用例伪造成 `scsi_debug`)被 `is_fake_disk` 误判为假盘,进而混入 `list_fake_disks` 的输出。这不是 brief 预期之外的坏结果,而是同一处护栏漏洞的自然扩散,进一步证明「名字硬否决」这道防线的必要性——若无它,`list_fake_disks` 遍历到的假 nvme 也会被拿去当靶子破坏。

改回去(去掉注释,恢复 `*nvme*) return 1 ;;`),重跑测试(**改回后的实际输出**):

```
$ cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
== is_fake_disk / assert_fake_disk / list_fake_disks ==
  ok   带尾随空格的 scsi_debug 认得出
  ok   无空格的 scsi_debug 认得出
  ok   真盘型号被拒
  ok   无 device/model 的裸块设备被拒
  ok   不存在的设备被拒
  ok   空设备名被拒
  ok   名字含 nvme 一律拒(即便 model 是 scsi_debug)
  ok   assert 接受裸设备名
  ok   assert 接受 /dev/ 全路径
  ok   assert 拒绝真盘路径
  ok   assert 拒绝 nvme 路径
  ok   list_fake_disks 只列假盘且排序

通过 12,失败 0
EXIT_CODE=0
```

确认回到全绿:`通过 12,失败 0`,退出码 0。

## Step 6: 提交

只 `git add scripts/raidlab.sh scripts/raidlab.test.sh`(未用 `-A`/`.`)。

发现:该仓库既有 3 个文件(`CLAUDE.md`、`DEV_DEPLOY.md`、`scripts/deploy-ui.sh`)在开工前就已经处于 **staged** 状态(`git status` 显示 "Changes to be committed"),若直接 `git commit`(不带 pathspec)会把它们一并提交,违反"绝不提交它们"的要求。为规避这个坑,改用 `git commit <pathspec>` 的形式——只提交指定路径的改动,不动其余已暂存内容:

```
git commit scripts/raidlab.sh scripts/raidlab.test.sh -m "..."
```

提交结果:

```
[sp6-p5.5-raidlab e07cafe] feat(raidlab): 测试台骨架 + 假盘护栏 + 手写测试 harness
 2 files changed, 164 insertions(+)
 create mode 100755 scripts/raidlab.sh
 create mode 100755 scripts/raidlab.test.sh
```

`git show --stat HEAD` 确认本次提交只含这两个文件:

```
commit e07cafee851a73d0498804a298bcc69ab64b1e52
    feat(raidlab): 测试台骨架 + 假盘护栏 + 手写测试 harness
    ...
    Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

 scripts/raidlab.sh      | 70 ++++++++++++++++++++++++++++++++++++
 scripts/raidlab.test.sh | 94 +++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 164 insertions(+)
```

提交后重新 `git status` 确认 5 个既有脏文件原样保留、无一被带入本次提交:

```
On branch sp6-p5.5-raidlab
Changes to be committed:
	modified:   CLAUDE.md
	modified:   DEV_DEPLOY.md
	modified:   scripts/deploy-ui.sh
Changes not staged for commit:
	modified:   scripts/deploy-agent.sh
Untracked files:
	docs/design/2026-07-21-files-paste-upload-design.md
```

## 自我复审

- `bash -n scripts/raidlab.sh` / `bash -n scripts/raidlab.test.sh` 均语法通过。
- 全程未 `modprobe`/`rmmod`,未碰任何真实块设备,未用 `sudo`。
- 未引入 `bats`/`shellcheck` 依赖。
- 三个契约函数 `is_fake_disk`/`assert_fake_disk`/`list_fake_disks` 的名字与语义(返回码 0 = 是假盘;`assert_fake_disk` 只 `return 1` 不 `exit`)与 brief 逐字一致,未做任何"顺手改进"。
- brief 给出的 `raidlab.sh`(Step 3)本身没有 `main()` 或脚本末尾的执行入口——`RAIDLAB_LIB_ONLY=1` 目前是无操作的(因为脚本从未执行任何顶层逻辑,source 进来天然只定义函数),这是 brief 原文如此,留给 Task 3/4/5 添加 `up`/`down`/`status` 主流程时去消费这个变量,未做任何超出本 Task 范围的补充。
- 仅动了 `nimo_os_docs` 仓库的 2 个新文件,未碰其他仓库、未碰既有 5 个脏文件。

## 结论

按 brief Step 1→6 顺序无跳步执行,测试从"确认失败"到"确认通过"到"反向验证护栏"再到"确认回到全绿"全部按实际命令输出核验,无编造。最终提交 `e07cafe`,测试 12 通过 0 失败。

---

# 修复轮 1/5:设备名路径穿越护栏 + 注释修正

- 提交:`bc8f043`
- 覆盖被改代码的测试文件:`nimo_os_docs/scripts/raidlab.test.sh`(`./raidlab.test.sh` 是本仓库唯一的测试文件,覆盖 `raidlab.sh` 的全部函数)

## 评审意见 1(Important):设备名路径穿越未做显式拒绝

### 修法

在 `is_fake_disk` 的 `case` 块里,`*nvme*) return 1 ;;` 同一处新增两条模式:

```bash
case "$dev" in
*nvme*) return 1 ;;
.|..) return 1 ;;
*[!A-Za-z0-9._-]*) return 1 ;;
esac
```

- `.|..)`:显式拒绝设备名恰为 `.` 或 `..`(这两个值全部由允许字符组成,字符类排除法本身抓不到它们,必须单独判断)。
- `*[!A-Za-z0-9._-]*)`:字符类反选,设备名里只要出现一个不在 `[A-Za-z0-9._-]` 集合里的字符(最典型就是 `/`)就拒绝。真实块设备名(`sda`、`nvme0n1`、`md127`、`dm-0`)全部落在这个集合内,不会被误杀。

未引入 `grep`/`sed`,纯 `case` 模式匹配实现。

### 测试:先证明"能真失败"不是同义反复

第一版测试(`is_fake_disk "sda/../../etc"` / `".."` / `"."`)在临时伪造的 sysfs 里其实是"假红":这些穿越路径在 `$TMP` 下根本不存在对应文件,所以就算不加护栏,`is_fake_disk` 也会在读 `model` 文件那一步自然失败——测试测不出护栏到底有没有在起作用。

修正做法:在 `block/` 目录**之外**的、这几个攻击字符串实际会解析到的位置埋"诱饵" `model` 文件,内容就是 `scsi_debug`:

```bash
#   dev="."               -> $TMP/sys/block/./device/model      = $TMP/sys/block/device/model
#   dev=".."              -> $TMP/sys/block/../device/model     = $TMP/sys/device/model
#   dev="sda/../../etc"   -> $TMP/sys/block/sda/../../etc/device/model = $TMP/sys/etc/device/model
mkdir -p "$TMP/sys/block/device" "$TMP/sys/device" "$TMP/sys/etc/device"
printf 'scsi_debug\n' > "$TMP/sys/block/device/model"
printf 'scsi_debug\n' > "$TMP/sys/device/model"
printf 'scsi_debug\n' > "$TMP/sys/etc/device/model"
```

用 `python3 -c "import os; print(os.path.normpath(...))"` 实测核对过这三条路径的解析结果,与代码里 `"$RAIDLAB_SYSFS_ROOT/block/$dev/device/model"` 的拼接方式一致。

新增用例:

```bash
t_ok "合法带连字符名字认得出(dm-0)"          is_fake_disk dm-0
t_no "路径穿越:名字含 / 被拒(诱饵已埋,不靠文件不存在侥幸过关)" is_fake_disk "sda/../../etc"
t_no "路径穿越:名字恰为 .. 被拒(诱饵已埋)"                     is_fake_disk ".."
t_no "路径穿越:名字恰为 . 被拒(诱饵已埋)"                      is_fake_disk "."
```

并配套 `mk_disk dm-0 "scsi_debug"`,同时把 `list_fake_disks` 的期望值从 `sda\nsdb` 改成 `dm-0\nsda\nsdb`(dm-0 是合法假盘,理应出现在字典序列表里)。

### 反向验证(第一次尝试暴露了同义反复,已按上面修正后重新验证)

**第一次尝试**(测试还没埋诱饵时):把 case 里两条新增规则注释掉重跑,结果仍然全绿(`通过 16,失败 0`)——证明当时的测试是假的,没有真正验证护栏。发现后立即补埋诱饵文件,重新做以下反向验证。

**改坏后(埋诱饵之后,真实失败)**:

```
$ cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
== is_fake_disk / assert_fake_disk / list_fake_disks ==
  ok   带尾随空格的 scsi_debug 认得出
  ok   无空格的 scsi_debug 认得出
  ok   真盘型号被拒
  ok   无 device/model 的裸块设备被拒
  ok   不存在的设备被拒
  ok   空设备名被拒
  ok   名字含 nvme 一律拒(即便 model 是 scsi_debug)
  ok   合法带连字符名字认得出(dm-0)
  FAIL 路径穿越:名字含 / 被拒(诱饵已埋,不靠文件不存在侥幸过关)  (期望失败,实际成功)
  FAIL 路径穿越:名字恰为 .. 被拒(诱饵已埋)  (期望失败,实际成功)
  FAIL 路径穿越:名字恰为 . 被拒(诱饵已埋)  (期望失败,实际成功)
  ok   assert 接受裸设备名
  ok   assert 接受 /dev/ 全路径
  ok   assert 拒绝真盘路径
  ok   assert 拒绝 nvme 路径
  ok   list_fake_disks 只列假盘且排序

通过 13,失败 3
EXIT_CODE=1
```

（`case` 块当时是:
```bash
case "$dev" in
*nvme*) return 1 ;;
# .|..) return 1 ;;                        # TEMP: 修复轮反向验证,故意注释掉
# *[!A-Za-z0-9._-]*) return 1 ;;            # TEMP: 修复轮反向验证,故意注释掉
esac
```）

三条路径穿越用例真实转红,证明诱饵确实被攻击字符串读到、且没有护栏时会被误判为假盘——这才是护栏真正在守的证据。

**改回后(全绿)**:

```
$ cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
== is_fake_disk / assert_fake_disk / list_fake_disks ==
  ok   带尾随空格的 scsi_debug 认得出
  ok   无空格的 scsi_debug 认得出
  ok   真盘型号被拒
  ok   无 device/model 的裸块设备被拒
  ok   不存在的设备被拒
  ok   空设备名被拒
  ok   名字含 nvme 一律拒(即便 model 是 scsi_debug)
  ok   合法带连字符名字认得出(dm-0)
  ok   路径穿越:名字含 / 被拒(诱饵已埋,不靠文件不存在侥幸过关)
  ok   路径穿越:名字恰为 .. 被拒(诱饵已埋)
  ok   路径穿越:名字恰为 . 被拒(诱饵已埋)
  ok   assert 接受裸设备名
  ok   assert 接受 /dev/ 全路径
  ok   assert 拒绝真盘路径
  ok   assert 拒绝 nvme 路径
  ok   list_fake_disks 只列假盘且排序

通过 16,失败 0
EXIT_CODE=0
```

## 评审意见 2(Minor):`set +e` 注释与事实不符

原注释「source 进来的 set -e 会让第一个失败断言直接杀掉 harness」描述了一个不存在的情况(两个脚本目前都只有 `set -uo pipefail`,没有 `-e`)。已改为:

```bash
set +e   # 防御性关闭 -e:两个脚本目前都只用 set -uo pipefail,没有 -e;
         # 但万一以后给 raidlab.sh 加上 -e,这行能保证它不会拖垮这个 harness。
```

## 提交

```
$ git status   # 修复前
On branch sp6-p5.5-raidlab
Changes to be committed:
	modified:   CLAUDE.md
	modified:   DEV_DEPLOY.md
	modified:   scripts/deploy-ui.sh
Changes not staged for commit:
	modified:   scripts/deploy-agent.sh
Untracked files:
	docs/design/2026-07-21-files-paste-upload-design.md
```

依旧只用 `git commit <pathspec>` 形式,避开这 5 个既有脏文件:

```
git commit scripts/raidlab.sh scripts/raidlab.test.sh -m "..."
```

```
[sp6-p5.5-raidlab bc8f043] fix(raidlab): is_fake_disk 加设备名路径穿越护栏(修复轮 1/5)
 2 files changed, 34 insertions(+), 2 deletions(-)
```

提交后 `git status` 确认 5 个既有脏文件原样保留,未被带入本次提交。

## 自我复审

- `bash -n scripts/raidlab.sh` / `bash -n scripts/raidlab.test.sh` 均语法通过。
- `git diff scripts/raidlab.sh scripts/raidlab.test.sh` 核对过,改动范围与本轮评审要求完全对应,没有夹带其他改动。
- 未引入 `bats`/`shellcheck`/`grep`/`sed`,未 `modprobe`/`rmmod`,未用 `sudo`。
- 发现并修正了第一版路径穿越测试的同义反复问题(埋诱饵前测试红不了),已在报告里如实记录这个过程,而不是只交付修正后的结果。

## 结论

按评审要求逐条修复:护栏补了路径穿越拦截(名字合法字符集 + `.`/`..` 显式拒绝),注释改正,测试补了 4 条新用例(含 1 条正向 `dm-0` + 3 条路径穿越)并用埋诱饵的方式确保了反向验证的真实性。最终提交 `bc8f043`,测试 16 通过 0 失败。
