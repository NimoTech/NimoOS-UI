# Task 1 报告:后端白名单补丁(`IsDiskSupported` 接受 `block:scsi:pseudo`)

## 状态:DONE

## 环境确认

```bash
export PATH="/usr/local/go/bin:$PATH"
cd /home/nimo/NimoTech/NimoOS-LocalStorage && git status && git branch --show-current && git log --oneline -3
```
输出:
```
On branch sp6-p5.5-raidlab
nothing to commit, working tree clean
sp6-p5.5-raidlab
1ab91a9 fix(storage/raid): 快照挂载遮蔽 RAID 卷 + lsblk 超时 + 创建 RAID 前清扫成员盘 (#6)
4795767 feat(snapshot): restore 支持选择目标目录、可选 .restored 标记与显式覆盖策略 (#5)
3dbe373 fix(snapshot): keep file extension on restore, insert marker before it (#4)
```
分支已是 `sp6-p5.5-raidlab`,base `1ab91a9`,working tree 干净,与 brief 描述一致,未做任何分支切换/新建。

读取确认:
- `service/disk.go:774-784` 函数体确实是 brief 描述的 9 个 `||` 串联(实际数到 `d.Tran == "usb"` 结尾共 9 项),改动位置与 brief 给出的代码一致。
- `service/disk_test.go` 确实已存在,`package service` + `gotest.tools/v3/assert`,当前没有任何 `IsDiskSupported` 相关测试。文件以 `TestParseBlockDevices_MountPointsPlural` 结尾。

## Step 1: 写失败测试

在 `service/disk_test.go` 末尾追加 brief 给出的 `TestIsDiskSupported`(逐字采用,7 个子用例),未新增 import(复用文件已有的 `model`、`assert`、`t.Run` 等)。

## Step 2: 跑测试确认它失败

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go test ./service -run TestIsDiskSupported -v
```
实际输出:
```
=== RUN   TestIsDiskSupported
=== RUN   TestIsDiskSupported/nvme_真盘
=== RUN   TestIsDiskSupported/sata_真盘
=== RUN   TestIsDiskSupported/usb_盘
=== RUN   TestIsDiskSupported/virtio_虚拟盘
=== RUN   TestIsDiskSupported/scsi_debug_假盘
    disk_test.go:84: assertion failed: false (got bool) != true (c.want bool)
=== RUN   TestIsDiskSupported/zram_之类裸_block
=== RUN   TestIsDiskSupported/未知传输方式
--- FAIL: TestIsDiskSupported (0.00s)
    --- PASS: TestIsDiskSupported/nvme_真盘 (0.00s)
    --- PASS: TestIsDiskSupported/sata_真盘 (0.00s)
    --- PASS: TestIsDiskSupported/usb_盘 (0.00s)
    --- PASS: TestIsDiskSupported/virtio_虚拟盘 (0.00s)
    --- FAIL: TestIsDiskSupported/scsi_debug_假盘 (0.00s)
    --- PASS: TestIsDiskSupported/zram_之类裸_block (0.00s)
    --- PASS: TestIsDiskSupported/未知传输方式 (0.00s)
FAIL
FAIL	github.com/NimoTech/NimoOS-LocalStorage/service	0.016s
FAIL
```
与 brief 预期完全一致:仅 `scsi_debug 假盘` 失败(`got false, want true`),其余 6 个 PASS。未触发"已通过则停下报告"的分支,继续执行。

## Step 3: 最小实现

在 `service/disk.go` 的 `IsDiskSupported` 函数体里,`block:scsi:pci` 那条前面加入:
```go
// scsi_debug 伪 SCSI 主机(SP6-P5.5 存储区实盘验收测试台)。生产机上
// 这个子系统链只可能来自主动 modprobe scsi_debug,不会自然出现。
strings.Contains(d.SubSystems, "block:scsi:pseudo") ||
```
只加了这一个条件分支(含注释共 3 行),未改动函数其余部分,与 brief 给出的目标代码逐字一致。

## Step 4: 跑测试确认通过

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go test ./service -run TestIsDiskSupported -v
```
实际输出:
```
=== RUN   TestIsDiskSupported
=== RUN   TestIsDiskSupported/nvme_真盘
=== RUN   TestIsDiskSupported/sata_真盘
=== RUN   TestIsDiskSupported/usb_盘
=== RUN   TestIsDiskSupported/virtio_虚拟盘
=== RUN   TestIsDiskSupported/scsi_debug_假盘
=== RUN   TestIsDiskSupported/zram_之类裸_block
=== RUN   TestIsDiskSupported/未知传输方式
--- PASS: TestIsDiskSupported (0.00s)
    --- PASS: TestIsDiskSupported/nvme_真盘 (0.00s)
    --- PASS: TestIsDiskSupported/sata_真盘 (0.00s)
    --- PASS: TestIsDiskSupported/usb_盘 (0.00s)
    --- PASS: TestIsDiskSupported/virtio_虚拟盘 (0.00s)
    --- PASS: TestIsDiskSupported/scsi_debug_假盘 (0.00s)
    --- PASS: TestIsDiskSupported/zram_之类裸_block (0.00s)
    --- PASS: TestIsDiskSupported/未知传输方式 (0.00s)
PASS
ok  	github.com/NimoTech/NimoOS-LocalStorage/service	0.016s
```
7 个子用例全 PASS,符合预期。

## Step 5: 全量测试

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go build ./... && go test ./service/... 2>&1 | tail -20
```
实际输出:
```
ok  	github.com/NimoTech/NimoOS-LocalStorage/service	0.022s
?   	github.com/NimoTech/NimoOS-LocalStorage/service/model	[no test files]
ok  	github.com/NimoTech/NimoOS-LocalStorage/service/snapshot	0.053s
ok  	github.com/NimoTech/NimoOS-LocalStorage/service/v2	0.013s
?   	github.com/NimoTech/NimoOS-LocalStorage/service/v2/fs	[no test files]
?   	github.com/NimoTech/NimoOS-LocalStorage/service/v2/wrapper	[no test files]
```
`go build ./...` 无任何输出(成功);`go test ./service/...` 全 PASS,没有既有失败需要在此列出。

## Step 6: 提交

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage
git add service/disk.go service/disk_test.go
git status --short
```
输出确认只有这两个文件被暂存:
```
M  service/disk.go
M  service/disk_test.go
```
随后用 brief 给出的提交信息逐字提交(HEREDOC 方式,含 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`):

```
[sp6-p5.5-raidlab c0d0861] feat(disk): IsDiskSupported 接受 block:scsi:pseudo,并补齐该函数单测
 2 files changed, 29 insertions(+)
```

commit 哈希:`c0d0861`

## 偏离记录

无偏离。所有 Step 1-6 均按 brief 逐字执行,未跳步,未修改 brief 之外的文件,未部署。

## 自我复审

- 复查 diff:`service/disk.go` 只新增 3 行(1 行代码 + 2 行注释),未触碰函数其余逻辑;`service/disk_test.go` 只在文件末尾追加了一个新测试函数,未改动已有测试或 import 块。
- 确认未 `git add -A`/`git add .`,只显式 add 了 brief 点名的两个文件。
- 确认未涉及 `NimoOS-UI`/`NimoOS-New-UI`/`NimoOS-Service`/`nimo_os_docs` 任何文件。
- 确认未跑 `deploy.sh` 或任何部署/服务重启命令。
- 该改动是纯白名单新增分支,不影响任何既有 `Tran`/`SubSystems` 组合的判定结果(只有新增的 `block:scsi:pseudo` 子串命中时才从 false 变 true),对生产环境无副作用风险。

---

## 返工:标记文件开关(用户产品质量意见,已拍板采纳)

**问题**:上一版加的白名单分支是**无条件**放行 `block:scsi:pseudo`,等于把测试脚手架漏进了产品安全边界——`IsDiskSupported` 决定"什么设备可以被格式化/建 RAID"。万一某台出厂机器意外 `modprobe scsi_debug`(管理员手滑、诊断脚本、镜像预置),产品会把内存盘当真实存储推给用户建阵列,重启即全部丢失。

**改法**:`IsDiskSupported` 仍认 `block:scsi:pseudo`,但只在标记文件 `/etc/nimoos/allow-pseudo-disks` 存在时才认;默认关闭。

### 实现

在 `service/disk.go` 的 `IsDiskSupported` 之前新增:

```go
// allowPseudoDisksMarkerFile 是"允许 scsi_debug 伪盘"开关的标记文件路径。
//
// 用包级变量而不是 const:测试需要把它指向临时目录里的文件(改完 defer 还原),
// const 做不到这件事。
//
// 为什么用标记文件而不是环境变量/配置项来控制这个开关:服务跑在 systemd 下,
// 改环境变量要改 unit 或写 drop-in 才能生效,配置项通常要重启服务才会被重新
// 读取;标记文件在每次调用 IsDiskSupported 时实时 os.Stat,测试台脚本一句
// touch/rm 就能开关,不用碰 systemd、不用重启任何服务。
//
// 为什么不用 build tag 编两个二进制:那样测试台验证的就不是出厂那个二进制了,
// "在真实产品二进制上验证 RAID/快照界面"这个目的会被削掉一半。要的是同一个
// 二进制、运行时的显式开关,默认关闭。
var allowPseudoDisksMarkerFile = "/etc/nimoos/allow-pseudo-disks"

// allowPseudoDisks 报告 scsi_debug 伪盘白名单开关是否打开。只看标记文件是否
// 存在,不看内容、不看权限。
func allowPseudoDisks() bool {
	_, err := os.Stat(allowPseudoDisksMarkerFile)
	return err == nil
}
```

并在函数上方补充调用频率注释(`route/v1/disk.go` 对每块盘都调一次,盘数是个位数,开销可接受),把白名单条件从
```go
strings.Contains(d.SubSystems, "block:scsi:pseudo") ||
```
改为
```go
(strings.Contains(d.SubSystems, "block:scsi:pseudo") && allowPseudoDisks()) ||
```

`os` 包在 `disk.go` 里已有 import,未新增依赖。

### 测试改造

`service/disk_test.go` 新增 `os`、`path/filepath` import(原来没有)。把原来单一的 `TestIsDiskSupported` 拆成两个测试:

1. `TestIsDiskSupported`——把 `allowPseudoDisksMarkerFile` 临时指向 `t.TempDir()` 里一个保证不存在的路径(不依赖测试机上是否真的存在 `/etc/nimoos/allow-pseudo-disks`),跑 7 个用例,`scsi_debug 假盘` 这条期望值改成 `false`(出厂默认拒绝)。
2. `TestIsDiskSupported_AllowPseudoDisks`——在 `t.TempDir()` 里 `os.Create` 出标记文件,把 `allowPseudoDisksMarkerFile` 指向它,跑**同样的 7 个用例**,只有 `scsi_debug 假盘` 期望值是 `true`,其余 6 条与场景 1 完全一致——用来证明开关只影响 pseudo 这一条分支。

两个测试都用 `defer` 把包级变量还原,避免污染同包其他测试。

### 验证命令与实际输出

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage
export PATH="/usr/local/go/bin:$PATH"
go test ./service -run TestIsDiskSupported -v
```
实际输出(改造后,首次跑,标记文件默认关闭状态下 7 例全过 + 显式开启状态下 7 例全过):
```
=== RUN   TestIsDiskSupported
=== RUN   TestIsDiskSupported/nvme_真盘
=== RUN   TestIsDiskSupported/sata_真盘
=== RUN   TestIsDiskSupported/usb_盘
=== RUN   TestIsDiskSupported/virtio_虚拟盘
=== RUN   TestIsDiskSupported/scsi_debug_假盘(标记文件不存在,出厂默认拒绝)
=== RUN   TestIsDiskSupported/zram_之类裸_block
=== RUN   TestIsDiskSupported/未知传输方式
--- PASS: TestIsDiskSupported (0.00s)
    --- PASS: TestIsDiskSupported/nvme_真盘 (0.00s)
    --- PASS: TestIsDiskSupported/sata_真盘 (0.00s)
    --- PASS: TestIsDiskSupported/usb_盘 (0.00s)
    --- PASS: TestIsDiskSupported/virtio_虚拟盘 (0.00s)
    --- PASS: TestIsDiskSupported/scsi_debug_假盘(标记文件不存在,出厂默认拒绝) (0.00s)
    --- PASS: TestIsDiskSupported/zram_之类裸_block (0.00s)
    --- PASS: TestIsDiskSupported/未知传输方式 (0.00s)
=== RUN   TestIsDiskSupported_AllowPseudoDisks
=== RUN   TestIsDiskSupported_AllowPseudoDisks/nvme_真盘
=== RUN   TestIsDiskSupported_AllowPseudoDisks/sata_真盘
=== RUN   TestIsDiskSupported_AllowPseudoDisks/usb_盘
=== RUN   TestIsDiskSupported_AllowPseudoDisks/virtio_虚拟盘
=== RUN   TestIsDiskSupported_AllowPseudoDisks/scsi_debug_假盘(标记文件存在,显式放行)
=== RUN   TestIsDiskSupported_AllowPseudoDisks/zram_之类裸_block
=== RUN   TestIsDiskSupported_AllowPseudoDisks/未知传输方式
--- PASS: TestIsDiskSupported_AllowPseudoDisks (0.00s)
    --- PASS: TestIsDiskSupported_AllowPseudoDisks/nvme_真盘 (0.00s)
    --- PASS: TestIsDiskSupported_AllowPseudoDisks/sata_真盘 (0.00s)
    --- PASS: TestIsDiskSupported_AllowPseudoDisks/usb_盘 (0.00s)
    --- PASS: TestIsDiskSupported_AllowPseudoDisks/virtio_虚拟盘 (0.00s)
    --- PASS: TestIsDiskSupported_AllowPseudoDisks/scsi_debug_假盘(标记文件存在,显式放行) (0.00s)
    --- PASS: TestIsDiskSupported_AllowPseudoDisks/zram_之类裸_block (0.00s)
    --- PASS: TestIsDiskSupported_AllowPseudoDisks/未知传输方式 (0.00s)
PASS
ok  	github.com/NimoTech/NimoOS-LocalStorage/service	0.018s
```

```bash
go build ./... && go test ./service/...
```
实际输出:
```
ok  	github.com/NimoTech/NimoOS-LocalStorage/service	0.016s
?   	github.com/NimoTech/NimoOS-LocalStorage/service/model	[no test files]
ok  	github.com/NimoTech/NimoOS-LocalStorage/service/snapshot	(cached)
ok  	github.com/NimoTech/NimoOS-LocalStorage/service/v2	(cached)
?   	github.com/NimoTech/NimoOS-LocalStorage/service/v2/fs	[no test files]
?   	github.com/NimoTech/NimoOS-LocalStorage/service/v2/wrapper	[no test files]
```
`go build ./...` 无输出即成功。全绿,无既有失败。

### 反向验证(证明测试真的在测开关,不是摆设)

**第一次**:临时把 `service/disk.go` 里的条件从
```go
(strings.Contains(d.SubSystems, "block:scsi:pseudo") && allowPseudoDisks()) ||
```
退回无条件放行:
```go
strings.Contains(d.SubSystems, "block:scsi:pseudo") ||
```
重跑:
```bash
go test ./service -run TestIsDiskSupported -v
```
实际输出(`TestIsDiskSupported` 的默认拒绝用例如预期转红,`_AllowPseudoDisks` 那组因为本来就该是 true 所以仍全绿):
```
=== RUN   TestIsDiskSupported
=== RUN   TestIsDiskSupported/nvme_真盘
=== RUN   TestIsDiskSupported/sata_真盘
=== RUN   TestIsDiskSupported/usb_盘
=== RUN   TestIsDiskSupported/virtio_虚拟盘
=== RUN   TestIsDiskSupported/scsi_debug_假盘(标记文件不存在,出厂默认拒绝)
    disk_test.go:93: assertion failed: true (got bool) != false (c.want bool)
=== RUN   TestIsDiskSupported/zram_之类裸_block
=== RUN   TestIsDiskSupported/未知传输方式
--- FAIL: TestIsDiskSupported (0.00s)
    --- PASS: TestIsDiskSupported/nvme_真盘 (0.00s)
    --- PASS: TestIsDiskSupported/sata_真盘 (0.00s)
    --- PASS: TestIsDiskSupported/usb_盘 (0.00s)
    --- PASS: TestIsDiskSupported/virtio_虚拟盘 (0.00s)
    --- FAIL: TestIsDiskSupported/scsi_debug_假盘(标记文件不存在,出厂默认拒绝) (0.00s)
    --- PASS: TestIsDiskSupported/zram_之类裸_block (0.00s)
    --- PASS: TestIsDiskSupported/未知传输方式 (0.00s)
=== RUN   TestIsDiskSupported_AllowPseudoDisks
    (7 个子用例全 PASS,省略)
FAIL
FAIL	github.com/NimoTech/NimoOS-LocalStorage/service	0.018s
FAIL
```
证明:去掉开关守卫后,"标记文件不存在也应该拒绝"这条用例确实会失败——测试真的在验证开关生效,不是摆设断言。

**第二次**:改回带 `allowPseudoDisks()` 的守卫版本,重跑确认恢复全绿:
```bash
go build ./... && go test -count=1 ./service/...
```
实际输出:
```
BUILD_OK
ok  	github.com/NimoTech/NimoOS-LocalStorage/service	0.023s
?   	github.com/NimoTech/NimoOS-LocalStorage/service/model	[no test files]
ok  	github.com/NimoTech/NimoOS-LocalStorage/service/snapshot	0.049s
ok  	github.com/NimoTech/NimoOS-LocalStorage/service/v2	0.019s
?   	github.com/NimoTech/NimoOS-LocalStorage/service/v2/fs	[no test files]
?   	github.com/NimoTech/NimoOS-LocalStorage/service/v2/wrapper	[no test files]
```
（用 `-count=1` 强制重跑绕过测试缓存,确保这不是缓存命中的假阳性。）全绿。

### 提交

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage
git add service/disk.go service/disk_test.go
git status --short
```
输出确认只有这两个文件被暂存:
```
M  service/disk.go
M  service/disk_test.go
```
提交信息(中文,含 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` 结尾):
```
[sp6-p5.5-raidlab 2e8edcd] fix(disk): scsi_debug 伪盘白名单默认关闭,需标记文件显式开启
 2 files changed, 79 insertions(+), 6 deletions(-)
```

新 commit 哈希:`2e8edcd`(基于旧的 `c0d0861`,同一分支 `sp6-p5.5-raidlab` 上追加,未 amend、未 rebase)。

### 偏离记录

无偏离。返工要求的三种测试用例(标记文件不存在→false、存在→true、存在时其余 6 例不变)、反向验证(退回无条件放行确认转红、改回确认全绿)均已按要求逐条完成,输出已贴入本报告。约束(只动 `service/disk.go`/`service/disk_test.go`、不部署、只 `git add` 这两个文件、commit message 中文+Co-Authored-By 结尾)均遵守。

### 自我复审(返工部分)

- 复查最终 `service/disk.go` diff:新增的 `allowPseudoDisksMarkerFile` 包变量、`allowPseudoDisks()` 辅助函数、`IsDiskSupported` 顶部的调用频率注释,以及条件里的 `&& allowPseudoDisks()`,没有改动函数其余任何分支的判定逻辑。
- `os` 是 `disk.go` 已有 import,未引入新依赖;测试文件新增的 `os`、`path/filepath` 都是标准库,未引入新依赖或配置框架。
- 两个测试函数都用 `t.TempDir()` + `defer` 把包级变量改回原值,不会污染同包内其他测试的执行顺序或状态(Go test 默认顺序执行同包内的 top-level test,但并发跑其他包不受影响;`disk_test.go` 里没有 `t.Parallel()`,顺序执行足够安全)。
- 确认没有 touch/依赖真实的 `/etc/nimoos/allow-pseudo-disks` 路径做测试,全部用临时目录,不会在跑测试的机器上留下副作用文件,也不需要额外权限。
- 确认未 `git add -A`/`git add .`,只显式 add 了两个指定文件;确认未部署、未重启任何服务。
