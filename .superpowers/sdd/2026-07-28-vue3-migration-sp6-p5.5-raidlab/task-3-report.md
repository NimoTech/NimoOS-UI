# Task 3 报告:API 响应解析 + `avail` 核对 + `status` 子命令

分支:`sp6-p5.5-raidlab`,起点 `bc8f043`,产出提交 `bc57887`。
仓库:`/home/nimo/NimoTech/nimo_os_docs`。只改了 `scripts/raidlab.sh` 和
`scripts/raidlab.test.sh` 两个文件;5 个既有脏文件(`CLAUDE.md`、
`DEV_DEPLOY.md`、`scripts/deploy-agent.sh`、`scripts/deploy-ui.sh`、
`docs/design/2026-07-21-files-paste-upload-design.md`)未动,commit 用显式
pathspec(`git commit scripts/raidlab.sh scripts/raidlab.test.sh -m ...`),
未用 `-a` / `add -A`。

## 顺手修的编号疵

`raidlab.sh` 里 `is_fake_disk` 函数体注释:紧邻 case 语句上方的路径穿越
说明和下面的 sysfs 型号检查都标了「②」,重复。改为「① 名字硬否决 /
② 路径穿越防护 / ③ sysfs 型号检查」递增,纯注释,未动任何逻辑。

```diff
-	# ② sysfs 型号必须恰为 scsi_debug(去掉所有空白后比较)。
+	# ③ sysfs 型号必须恰为 scsi_debug(去掉所有空白后比较)。
```

## Step 1:写失败测试

在 `raidlab.test.sh` 的 `source` 行之后按 brief 逐字加了 `export -f`:

```bash
export -f is_fake_disk assert_fake_disk list_fake_disks avail_disk_names verify_avail_only_fake
export FAKE_DISK_MODEL
```

在汇总 `echo "通过 $PASS,失败 $FAIL"` 之前按 brief 逐字加了 8 条新用例
(`JSON_TWO_FAKE` / `JSON_EMPTY` / `JSON_HAS_REAL` / `JSON_NO_NAME` /
`JSON_NO_DATA` 五个 fixture + 8 条断言)。

**偏离说明:** `JSON_HAS_REAL` 这个 fixture 在 brief 原文里定义了但没有被
任何一条用例实际引用(brief 里的用例列表就是这样写的)。按「逐字采用」
的要求原样照抄,没有补一条用它的用例,也没有删掉这个 fixture——它是
brief 给出的死代码,不是我引入的偏离。

## Step 2:跑测试确认失败

```
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

实际输出(节选):

```
./raidlab.test.sh: line 16: export: avail_disk_names: not a function
./raidlab.test.sh: line 16: export: verify_avail_only_fake: not a function
== is_fake_disk / assert_fake_disk / list_fake_disks ==
  ok   (16 条既有用例全绿)
== avail_disk_names / verify_avail_only_fake ==
  FAIL 解析出两块假盘
  ok   avail 为空时输出空
  FAIL 缺 name 时回退用 path 尾段
  ok   缺 data 键时输出空而不报错
  FAIL 缺 data 键时退出码仍为 0  (期望成功,实际退出码 127)
  FAIL 全是假盘 → 通过  (期望成功,实际退出码 127)
  ok   混进真盘 → 拒绝
  ok   空清单 → 拒绝(补丁未生效的信号)

通过 20,失败 4
```

**偏离说明(非我引入,记录以便对账):** brief Step 2/4 写的预期是
「Task 2 的 12 条仍全绿」「预期:通过 20,失败 0」。但父任务下发的
brief 上游契约明确说明:「`raidlab.test.sh` 现有 16 条用例全绿」——这是
Task 2 修复轮(`bc8f043`,加了 3 条路径穿越用例)之后的真实基线,晚于
brief 文档本身的编写时间。所以此步实测是「16 条既有 + 8 条新增里 4 条
未定义函数导致失败」= 通过 20、失败 4,Step 4 全绿后是 24 条(不是
brief 字面写的 20)。行为完全符合预期,只是 brief 里这两处计数是过期的,
不是本 Task 的问题。

其中「缺 data 键时退出码仍为 0」「全是假盘 → 通过」在函数未定义阶段
报 FAIL(期望成功但 `command not found` 退出码 127);而「混进真盘」
「空清单」两条这时反而 "ok"——因为 `t_no` 期望失败,`command not found`
本身就是非 0,凑巧通过。这是过渡态的正常噪音,不代表用例本身有问题
(Step 4 全部函数到位后重新验证过语义正确,见下方 mutation 测试)。

## Step 3:最小实现

在 `list_fake_disks` 之后逐字追加了 brief 给出的三段:`api_get`、
`avail_disk_names`(python3 解析嵌套 JSON)、`verify_avail_only_fake`、
以及 `cmd_status`。代码与 brief 原文一字不差(仅顺手修了上面提到的
注释编号)。

## Step 4:跑测试确认通过

```
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

实际输出:

```
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

== avail_disk_names / verify_avail_only_fake ==
  ok   解析出两块假盘
  ok   avail 为空时输出空
  ok   缺 name 时回退用 path 尾段
  ok   缺 data 键时输出空而不报错
  ok   缺 data 键时退出码仍为 0
  ok   全是假盘 → 通过
  ok   混进真盘 → 拒绝
  ok   空清单 → 拒绝(补丁未生效的信号)

通过 24,失败 0
```

24/24(16 既有 + 8 新增),与上一节的偏离说明一致。

## 自我复审:mutation 测试(「改坏实现,测试会转红吗」)

按任务要求,对两个契约关键点做了「故意改坏 → 确认测试转红 → 复原」的
验证(用 `cp` 备份、`python3` 就地替换、验证 diff 后恢复,未污染提交):

**Mutation 1 —— 去掉 `verify_avail_only_fake` 的空清单判定**(直接把
`if [[ "$count" -eq 0 ]]; then ... return 1; fi; return 0` 简化成
`return 0`):

```
  ok   全是假盘 → 通过
  ok   混进真盘 → 拒绝
  FAIL 空清单 → 拒绝(补丁未生效的信号)  (期望失败,实际成功)

通过 23,失败 1
```

转红,说明「空清单也算失败」这条用例确实在守护这个真实诊断路径,不是
同义反复。

**Mutation 2 —— 去掉 `avail_disk_names` 的 path 尾段回退**(把
`entry.get("name") or (entry.get("path") or "").rsplit("/", 1)[-1]` 简化
成 `entry.get("name")`):

```
  ok   解析出两块假盘
  ok   avail 为空时输出空
  FAIL 缺 name 时回退用 path 尾段
    期望: [sdb]
    实际: []
  ok   缺 data 键时输出空而不报错
  ...
通过 23,失败 1
```

同样转红。两次 mutation 后都用 `diff raidlab.sh /tmp/raidlab.sh.bak` 确认
文件已精确复原,复原后重跑 `./raidlab.test.sh` 确认回到 24/24。

## Step 5:手工确认 `cmd_status` 在真机上不炸(验收基线)

```
cd /home/nimo/NimoTech/nimo_os_docs/scripts && RAIDLAB_LIB_ONLY=1 bash -c 'source ./raidlab.sh; cmd_status'
```

**实际输出(完整,Task 6 验收对账用基线,采集于 2026-07-28,当前设备无假盘、无 RAID 阵列):**

```
=== 假盘(sysfs model == scsi_debug)===
(无)

=== /proc/mdstat ===
Personalities : [raid0] [raid1] [raid4] [raid5] [raid6] [raid10] [linear] 
unused devices: <none>

=== lsblk ===
NAME          SIZE TYPE FSTYPE MOUNTPOINT     MODEL
zram0         4.6G disk swap   [SWAP]         
nvme0n1     476.9G disk                       WPBSNM8-512GTP
├─nvme0n1p1   243M part vfat   /boot/efi      
├─nvme0n1p2   244M part ext4                  
├─nvme0n1p3   7.6G part ext4   /media/root-ro 
├─nvme0n1p4   244M part ext4                  
├─nvme0n1p5   7.6G part ext4                  
├─nvme0n1p6   244M part ext4   /mnt/metadata  
├─nvme0n1p7   7.6G part ext4   /mnt/overlay   
└─nvme0n1p8 453.1G part ext4   /DATA          

=== 后端 avail(GET /v1/disks)===
(空 —— 若假盘已在场,说明白名单补丁未部署)

=== 后端快照卷(GET /v2/snapshot/volumes)===
{"success":200,"message":"ok","data":[]}

=== 后端 RAID 阵列(GET /v2/raid)===
{"success":200,"message":"ok","data":[]}
```

五段全部打印,函数全程无异常退出、无破坏性动作(未 modprobe、未碰真实
块设备)。符合预期:「假盘」为 `(无)`、mdstat 无阵列、`avail` 为空。

**一处与项目记忆略有出入,记录供参考(非本 Task 范围):** memory 里
`vue3-migration-plan.md` 记的挂账是「快照后端仍 2026-06-22 版
`/v2/snapshot/*` 全 404 走优雅降级」,但此刻实测 `GET /v2/snapshot/volumes`
返回的是 `200 {"success":200,"message":"ok","data":[]}`,不是 404。可能是
本机 local-storage 服务在这之间已升级/重启过。不影响本 Task 的实现或
测试,仅如实记录观测差异,留给 Task 6 或后续期核对。

## Step 6:提交

```
git commit scripts/raidlab.sh scripts/raidlab.test.sh -m "..."
```

提交哈希:`bc57887`。`git status --short` 确认提交后 5 个既有脏文件
状态未变,未被误收。

## 交付契约确认(供 Task 5 消费)

- `avail_disk_names`:stdin 读 `GET /v1/disks` 响应 JSON,stdout 逐行打
  `data.avail[]` 里每个盘的设备名;JSON 畸形/缺 `data`/`avail` 键时输出
  空且返回 0。
- `verify_avail_only_fake`:stdin 读设备名清单(每行一个);全假盘→0;
  混入非假盘→1(stderr 报出具体是哪个);清单为空→1(stderr 提示白名单
  补丁未部署 + `deploy.sh local-storage` 命令)。
- `api_get <path>`:`curl -sS -m 20 "$RAIDLAB_API_BASE<path>"`。
- `cmd_status`:打印假盘/mdstat/lsblk/后端 avail/后端快照卷/后端 RAID
  阵列六段(brief 称"四视图",实际打印了 6 个 `===` 分段,含 avail 和
  两个后端接口),始终返回 0。

---

# 修复轮 1/5:`avail_disk_names` 类型闸门

评审独立复现的 bug:`avail` 为非空标量(int/bool)时,内联 python3 脚本的
`try/except` 只包住了 `json.load`,后面 `for entry in data.get("avail") or []`
在遍历 int/bool 上直接 `TypeError`,退出码非 0,违反函数注释自己承诺的
「任何解析失败都输出空 + 退出 0」。字符串形状的 `avail`(如 `"sda"`)因为
可迭代不会崩,但会被逐字符当设备名吐出——这是比崩溃更隐蔽的错误。

覆盖被改代码的测试文件:`scripts/raidlab.test.sh`(唯一覆盖 `raidlab.sh`
的测试文件)。

## 复现(评审给出的命令,独立验证)

```
$ echo '{"data":{"avail":5}}' | python3 -c '<修复前的内联脚本>'
Traceback (most recent call last):
  File "<string>", line 10, in <module>
    for entry in data.get("avail") or []:
                 ^^^^^^^^^^^^^^^^^^^^^^^
TypeError: 'int' object is not iterable
exit=1
```

确认复现,退出码 1、stderr 裸露 traceback。

## 修复

`scripts/raidlab.sh` 里 `avail_disk_names` 改为三层类型闸门:

1. `avail = data.get("avail")`;`if not isinstance(avail, list): sys.exit(0)`
   —— 挡掉 int/bool/字符串等一切非 list 形状,字符串不再被逐字符吐出。
2. `entry.get("name")` 取值后判 `isinstance(name, str) and name`,不是
   合法非空字符串就转去看 `path`。
3. `entry.get("path")` 同理判 `isinstance(path, str) and path`,不合法
   就整条记录判空跳过(不再对数字调用 `.rsplit`)。

## 顺手修的两条 Minor(brief 原文问题,非我引入)

1. 删除了 `raidlab.test.sh` 里从未被任何用例引用的死代码 fixture
   `JSON_HAS_REAL`。
2. `RAIDLAB_PROC_MDSTAT` 从 `cmd_status` 内联的 `${RAIDLAB_PROC_MDSTAT:-/proc/mdstat}`
   移到文件顶部,和 `RAIDLAB_SYSFS_ROOT` / `RAIDLAB_API_BASE` 等外部依赖
   变量并列声明为 `RAIDLAB_PROC_MDSTAT="${RAIDLAB_PROC_MDSTAT:-/proc/mdstat}"`;
   `cmd_status` 里改成直接 `cat "$RAIDLAB_PROC_MDSTAT"`。Task 4 需要这个
   变量,顶部声明是它的前置条件。

## 新增测试用例

在 `raidlab.test.sh` 里加了 10 条(5 组场景 × 「输出为空」+「退出码为 0」
各一条):`avail` 为 int、为 bool、为字符串,`entry.path` 为数字,
`entry.name` 为数字。字符串场景特别用「不逐字符吐出」措辞标注其重要性。

## 跑测试(修复后,一次性全绿)

```
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

```
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

== avail_disk_names / verify_avail_only_fake ==
  ok   解析出两块假盘
  ok   avail 为空时输出空
  ok   缺 name 时回退用 path 尾段
  ok   缺 data 键时输出空而不报错
  ok   缺 data 键时退出码仍为 0
  ok   avail 为 int 时输出空
  ok   avail 为 int 时退出码仍为 0(不崩)
  ok   avail 为 bool 时输出空
  ok   avail 为 bool 时退出码仍为 0(不崩)
  ok   avail 为字符串时输出空(不逐字符吐出)
  ok   avail 为字符串时退出码仍为 0(不崩)
  ok   path 为数字时跳过该条目而不崩
  ok   path 为数字时退出码仍为 0
  ok   name 为数字时跳过该条目而不崩
  ok   name 为数字时退出码仍为 0
  ok   全是假盘 → 通过
  ok   混进真盘 → 拒绝
  ok   空清单 → 拒绝(补丁未生效的信号)

通过 34,失败 0
```

34/34(16 既有 + 8 上一轮 + 10 本轮新增,减 0 因为本轮没删既有用例,只删了
未被引用的 fixture 变量本身)。

## 反向验证(要求的强制步骤):注释掉类型闸门,确认转红

用 `python3` 脚本把 `raidlab.sh` 里已修复的三段类型闸门逻辑替换回评审
复现时的原始(有 bug)版本(`cp` 备份在先,修改后 `diff` 校验复原,过程不
触碰其它文件、不污染提交):

```
$ ./raidlab.test.sh   # 类型闸门被去掉之后
```

```
== avail_disk_names / verify_avail_only_fake ==
  ok   解析出两块假盘
  ok   avail 为空时输出空
  ok   缺 name 时回退用 path 尾段
  ok   缺 data 键时输出空而不报错
  ok   缺 data 键时退出码仍为 0
  ok   avail 为 int 时输出空
  FAIL avail 为 int 时退出码仍为 0(不崩)  (期望成功,实际退出码 1)
  ok   avail 为 bool 时输出空
  FAIL avail 为 bool 时退出码仍为 0(不崩)  (期望成功,实际退出码 1)
  ok   avail 为字符串时输出空(不逐字符吐出)
  ok   avail 为字符串时退出码仍为 0(不崩)
  ok   path 为数字时跳过该条目而不崩
  FAIL path 为数字时退出码仍为 0  (期望成功,实际退出码 1)
  FAIL name 为数字时跳过该条目而不崩
    期望: []
    实际: [123]
  ok   name 为数字时退出码仍为 0
  ok   全是假盘 → 通过
  ok   混进真盘 → 拒绝
  ok   空清单 → 拒绝(补丁未生效的信号)

通过 30,失败 4
```

4 条转红,分别对应:`avail=int` 崩溃退出码非 0、`avail=bool` 崩溃退出码
非 0、`path=数字` 崩溃退出码非 0、`name=数字` 时没有类型判断直接把
`123`(int)打印出来(输出变成 `123` 而不是期望的空)。

**说明一处不转红的场景,不是漏测:** 「avail 为字符串时退出码仍为 0」
在去掉闸门后仍是 `ok`——因为字符串本身可迭代不会崩,这条用例本来测的
就是「不崩」这一半,退出码本来就是 0(去闸门前后都是 0),这条不该转红,
转红的应该是同组的「输出为空(不逐字符吐出)」——而这条在两次运行里都
显示 `ok`。这是因为 mutation 脚本替换回的旧版本对 `avail="sda"` 遍历
字符串 `"sda"`,每个字符(`'s'`, `'d'`, `'a'`)都不是 `dict`(是
`str`),被 `if not isinstance(entry, dict): continue` 挡掉,所以旧版本
在这个特定输入下碰巧输出也是空——这是本次复现范围内的巧合,不代表
「avail 为字符串」这条用例是同义反复:如果 `avail` 是形如 `["abc"]`
(list 套字符串元素,而非字符串本身)的畸形数据,旧版本会因
`isinstance(entry, dict)` 判负而跳过,新旧行为一致,是预期内的;但如果
`avail` 本身是字符串且长度更长或字符恰好会被误判(理论上 `entry` 恒为单
字符 `str`,不会被误当 `dict`),两版本行为其实一致空输出——**这条用例
在"avail 为字符串"这个具体维度上,新旧实现巧合地表现一致,真正体现
差异并被本轮验证转红的是另外 4 条**(int/bool/path 数字/name 数字)。
已如实记录这个巧合,不掩饰。

## 复原并确认恢复到 34/34

```
$ diff raidlab.sh /tmp/raidlab.sh.fixbak && echo RESTORED-CLEAN
RESTORED-CLEAN
$ ./raidlab.test.sh | tail -3
通过 34,失败 0
```

## 提交

```
git commit scripts/raidlab.sh scripts/raidlab.test.sh -m "fix(raidlab): avail_disk_names 加类型闸门(修复轮 1/5) ..."
```

提交哈希:`a7ca719`。`git status --short` 确认 5 个既有脏文件状态未变。
