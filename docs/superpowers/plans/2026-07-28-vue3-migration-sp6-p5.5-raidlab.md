# SP6-P5.5 多盘测试台 + P3/P4/P5 实盘验收 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在单盘设备上造出可信的多盘 RAID + btrfs 环境,让 SP6 的 P3/P4/P5 三期从「只有单测锁着」变成「真实请求/响应契约验证过」。

**Architecture:** 两块交付物。① `NimoOS-LocalStorage` 后端 `IsDiskSupported` 白名单加一行 `block:scsi:pseudo`,让 `scsi_debug` 假盘能进磁盘列表(实测证明这是唯一挡路的过滤)。② `nimo_os_docs/scripts/raidlab.sh`,`up`/`down`/`status` 三个子命令管理测试台,所有破坏性操作前过「假盘白名单」硬护栏。脚本按「纯函数 + 薄接线」组织:判定/解析/过滤逻辑全是无副作用函数,由手写测试 harness 覆盖(设备上没有 bats),子命令只负责把它们串起来 + 调 `modprobe`/`mdadm`。

**Tech Stack:** Go 1.x + `gotest.tools/v3/assert`(后端);Bash + 手写测试 harness + `python3`(JSON 解析)+ `awk`(文本过滤);`scsi_debug` 内核模块;`mdadm`。

## 执行期变更（2026-07-28，已生效，覆盖下方原文）

三处偏离原始计划，均已定案，实施时以本节为准：

1. **Task 1 的白名单补丁改为标记文件门控**（用户拍板）。原文是无条件放开 `block:scsi:pseudo`，那等于把测试脚手架漏进产品——`IsDiskSupported` 是「什么设备可被格式化建 RAID」的安全边界，出厂产品不该接受内存假盘。改为：只在 `/etc/nimoos/allow-pseudo-disks` 存在时才认 pseudo。产品默认行为与打补丁前完全一致。用标记文件而非环境变量/配置项，因为服务在 systemd 下、前者要改 unit、后者要重启；不用 build tag，因为那样验证的就不是出厂二进制。
2. **Task 5 的 `cmd_up`/`cmd_down` 各加一行**管理该标记文件：`up` 在 `modprobe` 之后 `sudo touch`，`down` 在 `rmmod` 之后 `sudo rm -f`。与假盘生命周期绑定。
3. **Task 5 的 `cmd_down` 加一道前置断言**（控制者裁定）。原因:两个过滤器是按行全局删除（凡 md 源的 `.snapshots` 行、凡 `ARRAY` 行），而 `assert_md_all_fake` 只核查**已组装**的阵列——一台有真实但未组装阵列的机器上，`down` 不核查它却照样删它的配置行。**过滤器签名保持无参 stdin 不变**（那是 Task 4 已定的对外契约），改法是在 `cmd_down` 步骤 1 之后、步骤 2 之前插入：从 fstab 提取全部 `/dev/md*` 源、从 mdadm.conf 提取全部 `ARRAY` 行涉及的设备，凡有一个不在「已通过 `assert_md_all_fake` 的阵列」集合里 → 报错退出、不动任何文件。把「默默删错」变成「安全拒绝」。

## Global Constraints

- **只动两个仓**:`NimoOS-LocalStorage`(Task 1)和 `nimo_os_docs`(Task 2–6)。**禁止改 `NimoOS-UI` / `NimoOS-New-UI` / `NimoOS-Service` 任何代码** —— 本期不迁 UI,只清环境挂账。roadmap/spec 文档已由上游会话改完,也不要再动。
- **护栏是安全关键,不是可选项**:后端创建 RAID 前会**清扫成员盘**(`NimoOS-LocalStorage`@`1ab91a9`),选错盘等于抹掉 `/DATA`(286 GB 用户数据)。凡涉及具体块设备的破坏性操作(`mdadm --create`/`--stop`/`--fail`、`wipefs`、`rmmod`),调用前必须先过 `assert_fake_disk`。
- **假盘判定的两道条件必须同时满足**:① 设备名**不含** `nvme`(名字硬否决,与 model 无关);② `<sysfs>/block/<dev>/device/model` 去空白后**恰好等于** `scsi_debug`。缺一不可。
- **实测事实,不要凭想象改**:真实 scsi_debug 的 model 文件内容是 `scsi_debug` **后面跟 6 个空格再跟换行**(`lsblk` 实测),所以判定必须先 trim。
- **测试用手写 harness**:设备上**没有** `bats`,也**没有** `shellcheck`,不要在计划外引入依赖。`python3` 在 `/usr/bin/python3`,可用。
- **注释与输出用中文**,与 `nimo_os_docs/scripts/deploy.sh` 现有风格一致(`#!/bin/bash` + `set -euo pipefail` 家族)。
- **脚本必须可 source**:`RAIDLAB_LIB_ONLY=1` 时只定义函数、不执行 `main`,测试靠这个加载被测函数。
- **所有外部路径经环境变量注入**,测试可替换:`RAIDLAB_SYSFS_ROOT`(默认 `/sys`)、`RAIDLAB_PROC_MDSTAT`(默认 `/proc/mdstat`)、`RAIDLAB_FSTAB`(默认 `/etc/fstab`)、`RAIDLAB_MDADM_CONF`(默认 `/etc/mdadm/mdadm.conf`)、`RAIDLAB_API_BASE`(默认 `http://127.0.0.1`)。
- **提交粒度**:每个 Task 一个 commit,commit message 用中文,结尾带 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`。
- **不要在 Task 里执行 `up`/`down` 真跑测试台** —— 那是 Task 6 之后由用户在验收环节做的事。Task 2–5 只写代码 + 跑手写测试。

## 文件结构

| 文件 | 责任 |
|---|---|
| `NimoOS-LocalStorage/service/disk.go`(改 `:774-785`) | `IsDiskSupported` 白名单加一条 |
| `NimoOS-LocalStorage/service/disk_test.go`(改,追加) | `IsDiskSupported` 的表驱动测试(现无覆盖) |
| `nimo_os_docs/scripts/raidlab.sh`(新建) | 测试台全部逻辑:纯函数 + 三个子命令 |
| `nimo_os_docs/scripts/raidlab.test.sh`(新建) | 手写测试 harness + 全部纯函数用例 |
| `nimo_os_docs/docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md`(新建) | 两轮验收逐条清单,用户勾选用 |

---

### Task 1: 后端白名单补丁(`IsDiskSupported` 接受 `block:scsi:pseudo`)

**Files:**
- Modify: `NimoOS-LocalStorage/service/disk.go:774-785`
- Test: `NimoOS-LocalStorage/service/disk_test.go`(追加,文件已存在)

**Interfaces:**
- Consumes: 无(本 Task 是起点)
- Produces: 部署后 `GET /v1/disks` 的 `disks`/`avail` 数组会包含 `subsystems` 含 `block:scsi:pseudo` 的盘。Task 3 的 `avail_disk_names` 与 Task 5 的 `cmd_up` 依赖这个行为。

**背景(实施者需要知道的全部上下文):**

`route/v1/disk.go:128` 有一句 `if !service.IsDiskSupported(currentDisk) { continue }`,它会把不在白名单里的盘从 `disks` 和 `avail` **两个返回数组里同时抹掉**。`scsi_debug` 造出的假盘实测特征是 `tran` 为空、`subsystems` 为 `block:scsi:pseudo`,现有白名单一条都不匹配,所以假盘对前端完全不可见 —— 这是整个测试台唯一的阻塞点。

- [ ] **Step 1: 写失败测试**

在 `NimoOS-LocalStorage/service/disk_test.go` 末尾追加。注意 `package service`、`gotest.tools/v3/assert` 都是文件里已有的,不要重复 import:

```go
// scsi_debug 假盘(SP6-P5.5 测试台)的 subsystems 是 block:scsi:pseudo,
// tran 为空 —— 白名单必须认它,否则 route/v1/disk.go:128 会把它从
// disks/avail 两个数组同时抹掉,存储区实盘验收就无盘可用。
func TestIsDiskSupported(t *testing.T) {
	cases := []struct {
		name       string
		tran       string
		subSystems string
		want       bool
	}{
		{"nvme 真盘", "nvme", "block:nvme:pci", true},
		{"sata 真盘", "sata", "block:scsi:pci", true},
		{"usb 盘", "usb", "block:scsi:usb:pci", true},
		{"virtio 虚拟盘", "", "block:scsi:virtio:pci", true},
		{"scsi_debug 假盘", "", "block:scsi:pseudo", true},
		{"zram 之类裸 block", "", "block", false},
		{"未知传输方式", "fibre", "block:unknown", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := IsDiskSupported(model.LSBLKModel{Tran: c.tran, SubSystems: c.subSystems})
			assert.Equal(t, got, c.want)
		})
	}
}
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go test ./service -run TestIsDiskSupported -v
```

预期:`scsi_debug 假盘` 这个子用例 FAIL(`got false, want true`),其余 6 个 PASS。**如果 `scsi_debug 假盘` 已经通过,停下来报告** —— 说明白名单已被人改过,后续步骤会变成空改动。

- [ ] **Step 3: 最小实现**

`service/disk.go:774` 的函数改成(只加一行,位置放在 `block:scsi:pci` 那条前面):

```go
func IsDiskSupported(d model.LSBLKModel) bool {
	return d.Tran == "sata" ||
		d.Tran == "nvme" ||
		d.Tran == "spi" ||
		d.Tran == "sas" ||
		strings.Contains(d.SubSystems, "virtio") ||
		strings.Contains(d.SubSystems, "block:scsi:vmbus:acpi") || // Microsoft Hyper-V
		strings.Contains(d.SubSystems, "block:mmc:mmc_host:pci") ||
		strings.Contains(d.SubSystems, "block:mmc:mmc_host:platform") ||
		// scsi_debug 伪 SCSI 主机(SP6-P5.5 存储区实盘验收测试台)。生产机上
		// 这个子系统链只可能来自主动 modprobe scsi_debug,不会自然出现。
		strings.Contains(d.SubSystems, "block:scsi:pseudo") ||
		strings.Contains(d.SubSystems, "block:scsi:pci") || d.Tran == "usb"
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go test ./service -run TestIsDiskSupported -v
```

预期:7 个子用例全 PASS。

- [ ] **Step 5: 跑该包全量测试确认没打破别的**

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage && go build ./... && go test ./service/... 2>&1 | tail -20
```

预期:`go build` 无输出(成功);测试全 PASS 或维持改动前的既有失败状态(若有既有失败,在报告里列出来,不要试图修 —— 超出本期范围)。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-LocalStorage
git add service/disk.go service/disk_test.go
git commit -m "feat(disk): IsDiskSupported 接受 block:scsi:pseudo,并补齐该函数单测

SP6-P5.5 存储区实盘验收需要 scsi_debug 假盘,但它 tran 为空、
subsystems=block:scsi:pseudo,白名单一条不沾,被 route/v1/disk.go:128
从 disks/avail 两个数组同时抹掉。生产机不会自然出现该子系统链。
该函数此前无任何单测,顺带补齐 7 例表驱动覆盖。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

**⚠️ 不要在本 Task 里部署** —— 部署是 Task 6 之后验收环节的第一步,由执行者按验收清单做(需要 `sudo` 且会重启服务)。

---

### Task 2: `raidlab.sh` 骨架 + 假盘护栏 + 测试 harness

**Files:**
- Create: `nimo_os_docs/scripts/raidlab.sh`
- Create: `nimo_os_docs/scripts/raidlab.test.sh`

**Interfaces:**
- Consumes: 无
- Produces:
  - `is_fake_disk <dev>` → 退出码 0 表示是 scsi_debug 假盘,非 0 表示不是。`<dev>` 是裸设备名如 `sda`(不带 `/dev/`)。
  - `assert_fake_disk <dev-or-path>` → 接受 `sda` 或 `/dev/sda` 两种形式;是假盘返回 0,否则往 stderr 打中文拒绝信息并返回 1。**不 exit**,由调用方决定。
  - `list_fake_disks` → 往 stdout 打所有假盘的裸设备名,每行一个,字典序。无假盘时输出空。
  - 全局变量 `RAIDLAB_SYSFS_ROOT` / `RAIDLAB_API_BASE` / `RAIDLAB_NUM_TGTS` / `RAIDLAB_DEV_SIZE_MB` / `FAKE_DISK_MODEL`。
  - `RAIDLAB_LIB_ONLY=1 source raidlab.sh` 只定义函数不执行。

- [ ] **Step 1: 写失败测试**

创建 `nimo_os_docs/scripts/raidlab.test.sh`:

```bash
#!/bin/bash
# raidlab.sh 的测试 harness。
# 设备上没有 bats/shellcheck,所以手写:source 被测脚本(RAIDLAB_LIB_ONLY=1
# 让它只定义函数不执行 main),用临时目录伪造 sysfs/fstab 等外部依赖。
# 用法: ./raidlab.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=raidlab.sh
RAIDLAB_LIB_ONLY=1 source "$HERE/raidlab.sh"
set +e   # source 进来的 set -e 会让第一个失败断言直接杀掉 harness

PASS=0
FAIL=0

# t_ok <用例名> <命令...>   —— 命令应成功(退出 0)
t_ok() {
	local name="$1"; shift
	if "$@" >/dev/null 2>&1; then
		echo "  ok   $name"; PASS=$((PASS + 1))
	else
		echo "  FAIL $name  (期望成功,实际退出码 $?)"; FAIL=$((FAIL + 1))
	fi
}

# t_no <用例名> <命令...>   —— 命令应失败(非 0)。护栏类用例全靠这个。
t_no() {
	local name="$1"; shift
	if "$@" >/dev/null 2>&1; then
		echo "  FAIL $name  (期望失败,实际成功)"; FAIL=$((FAIL + 1))
	else
		echo "  ok   $name"; PASS=$((PASS + 1))
	fi
}

# t_eq <用例名> <期望> <实际>
t_eq() {
	local name="$1" want="$2" got="$3"
	if [[ "$want" == "$got" ]]; then
		echo "  ok   $name"; PASS=$((PASS + 1))
	else
		echo "  FAIL $name"
		echo "    期望: [$want]"
		echo "    实际: [$got]"
		FAIL=$((FAIL + 1))
	fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 伪造 <sysfs>/block/<dev>/device/model
mk_disk() {
	local dev="$1" model="$2"
	mkdir -p "$TMP/sys/block/$dev/device"
	printf '%s\n' "$model" > "$TMP/sys/block/$dev/device/model"
}

# 伪造一个没有 device/ 子目录的块设备(zram、md 阵列都是这样)
mk_bare_block() {
	mkdir -p "$TMP/sys/block/$1"
}

export RAIDLAB_SYSFS_ROOT="$TMP/sys"

echo "== is_fake_disk / assert_fake_disk / list_fake_disks =="

# 真实 scsi_debug 的 model 文件内容尾部带 6 个空格(lsblk 实测),必须 trim
mk_disk sda "scsi_debug      "
mk_disk sdb "scsi_debug"
mk_disk sdc "WPBSNM8-512GTP"
mk_bare_block zram0
# 名字硬否决用例:model 骗人也不能放行
mk_disk nvme0n1 "scsi_debug"

t_ok "带尾随空格的 scsi_debug 认得出"        is_fake_disk sda
t_ok "无空格的 scsi_debug 认得出"            is_fake_disk sdb
t_no "真盘型号被拒"                          is_fake_disk sdc
t_no "无 device/model 的裸块设备被拒"        is_fake_disk zram0
t_no "不存在的设备被拒"                      is_fake_disk sdz
t_no "空设备名被拒"                          is_fake_disk ""
t_no "名字含 nvme 一律拒(即便 model 是 scsi_debug)" is_fake_disk nvme0n1

t_ok "assert 接受裸设备名"                   assert_fake_disk sda
t_ok "assert 接受 /dev/ 全路径"              assert_fake_disk /dev/sda
t_no "assert 拒绝真盘路径"                   assert_fake_disk /dev/sdc
t_no "assert 拒绝 nvme 路径"                 assert_fake_disk /dev/nvme0n1

t_eq "list_fake_disks 只列假盘且排序" "sda
sdb" "$(list_fake_disks)"

echo
echo "通过 $PASS,失败 $FAIL"
[[ "$FAIL" -eq 0 ]]
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && chmod +x raidlab.test.sh && ./raidlab.test.sh
```

预期:失败,报 `raidlab.sh: No such file or directory`(被测脚本还不存在)。

- [ ] **Step 3: 最小实现**

创建 `nimo_os_docs/scripts/raidlab.sh`:

```bash
#!/bin/bash
# NimoOS 存储区实盘验收测试台(SP6-P5.5)
#
# 在单盘设备上用 scsi_debug 造若干假盘,好让 RAID 与 btrfs 快照这两条链路
# 能真机验证。设备只有一块 NVMe,而后端「快照卷 == RAID 阵列」
# (route/snapshot.go 的 currentVolumes = VolumesFromRAIDArrays),没有阵列
# 就没有快照卷,P3/P4/P5 三期全都无从验起。
#
# 用法: ./raidlab.sh up | down | status
#
# ⚠️ 安全:后端创建 RAID 前会清扫成员盘,选错盘等于抹掉 /DATA。所以本脚本
#    每个涉及具体块设备的破坏性操作前都必须先过 assert_fake_disk —— 它同时
#    要求「设备名不含 nvme」和「sysfs model 恰为 scsi_debug」,缺一不可。
set -uo pipefail

# 外部依赖全部经环境变量注入,测试可替换成临时目录。
RAIDLAB_SYSFS_ROOT="${RAIDLAB_SYSFS_ROOT:-/sys}"
RAIDLAB_API_BASE="${RAIDLAB_API_BASE:-http://127.0.0.1}"
RAIDLAB_NUM_TGTS="${RAIDLAB_NUM_TGTS:-4}"
RAIDLAB_DEV_SIZE_MB="${RAIDLAB_DEV_SIZE_MB:-512}"

# scsi_debug 假盘在 sysfs 里的型号标识。真实内容尾部带空格,判定时会 trim。
FAKE_DISK_MODEL="scsi_debug"

# --- 假盘护栏 ---------------------------------------------------------------

# is_fake_disk <dev> —— <dev> 为裸设备名(sda),不带 /dev/。
# 两道条件必须同时满足,缺一不可。
is_fake_disk() {
	local dev="${1:-}"
	[[ -n "$dev" ]] || return 1

	# ① 名字硬否决。model 文件理论上可被伪造(scsi_debug 允许自定义型号),
	#    而 nvme0n1 是本机唯一真盘、承载 /DATA,所以名字这层不给任何余地。
	case "$dev" in
	*nvme*) return 1 ;;
	esac

	# ② sysfs 型号必须恰为 scsi_debug(去掉所有空白后比较)。
	local model_file="$RAIDLAB_SYSFS_ROOT/block/$dev/device/model"
	[[ -r "$model_file" ]] || return 1
	local model
	model="$(tr -d '[:space:]' < "$model_file")"
	[[ "$model" == "$FAKE_DISK_MODEL" ]]
}

# assert_fake_disk <dev-or-path> —— 接受 sda 或 /dev/sda。
# 不是假盘就往 stderr 说明并返回 1(不 exit,由调用方决定怎么处理)。
assert_fake_disk() {
	local raw="${1:-}"
	local dev="${raw#/dev/}"
	if ! is_fake_disk "$dev"; then
		echo "raidlab: 拒绝操作 '$raw' —— 它不是 scsi_debug 假盘。" >&2
		echo "         破坏性操作只允许作用于测试台假盘,请先跑 ./raidlab.sh status 确认。" >&2
		return 1
	fi
	return 0
}

# list_fake_disks —— 打印所有假盘裸设备名,每行一个,字典序。
list_fake_disks() {
	local path dev
	for path in "$RAIDLAB_SYSFS_ROOT"/block/*; do
		[[ -e "$path" ]] || continue
		dev="$(basename "$path")"
		if is_fake_disk "$dev"; then
			echo "$dev"
		fi
	done | sort
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && chmod +x raidlab.sh && ./raidlab.test.sh
```

预期:`通过 12,失败 0`,退出码 0。

- [ ] **Step 5: 反向验证护栏真的在守(改坏它必须转红)**

临时把 `is_fake_disk` 里的 `*nvme*) return 1 ;;` 那两行注释掉,重跑测试:

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:`名字含 nvme 一律拒` 和 `assert 拒绝 nvme 路径` 两条 FAIL。确认转红后**把注释改回去**再重跑,确认回到全绿。这一步是为了证明护栏用例不是同义反复 —— 它是本脚本唯一挡在用户数据前面的东西。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/nimo_os_docs
git add scripts/raidlab.sh scripts/raidlab.test.sh
git commit -m "feat(raidlab): 测试台骨架 + 假盘护栏 + 手写测试 harness

SP6-P5.5 存储区实盘验收测试台。假盘判定要求「名字不含 nvme」与
「sysfs model 恰为 scsi_debug」同时成立 —— 后端创建 RAID 会清扫成员盘,
选错盘等于抹掉 /DATA,故名字这层不给余地。model 实测尾部带空格,先 trim。
设备无 bats,测试用手写 harness + 临时目录伪造 sysfs。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: API 响应解析 + `avail` 核对 + `status` 子命令

**Files:**
- Modify: `nimo_os_docs/scripts/raidlab.sh`(追加函数)
- Modify: `nimo_os_docs/scripts/raidlab.test.sh`(追加用例)

**Interfaces:**
- Consumes: Task 2 的 `is_fake_disk`
- Produces:
  - `avail_disk_names` → 从 stdin 读 `GET /v1/disks` 的响应 JSON,往 stdout 打 `data.avail[]` 里每个盘的设备名(每行一个)。JSON 畸形/缺键时输出空且返回 0(不炸)。
  - `verify_avail_only_fake` → 从 stdin 读设备名清单(每行一个),全是假盘则返回 0;出现任何非假盘则往 stderr 报出是哪个并返回 1;**清单为空也返回 1**(见下)。
  - `api_get <path>` → `curl` 拿 `$RAIDLAB_API_BASE<path>`,失败返回非 0。
  - `cmd_status` → 打印测试台四视图,始终返回 0。

**空清单为什么算失败:** `up` 的核对点是「假盘已经能被后端看见」。空 `avail` 恰恰是 Task 1 白名单补丁未部署时的表现(实测:补丁前 4 块假盘齐全而 `avail` 恒为 `[]`)。把空当失败,`up` 才能给出「补丁未生效」这个准确诊断,而不是含糊地说没盘。

- [ ] **Step 1: 写失败测试**

在 `raidlab.test.sh` 的 `echo` 汇总行**之前**插入:

```bash
echo
echo "== avail_disk_names / verify_avail_only_fake =="

# 真实响应形状(GET /v1/disks):{"success":200,"message":"ok","data":{"avail":[...],"disks":[...]}}
JSON_TWO_FAKE='{"success":200,"message":"ok","data":{"avail":[{"name":"sda","path":"/dev/sda"},{"name":"sdb","path":"/dev/sdb"}],"disks":[{"name":"nvme0n1"}]}}'
JSON_EMPTY='{"success":200,"message":"ok","data":{"avail":[],"disks":[{"name":"nvme0n1"}]}}'
JSON_HAS_REAL='{"success":200,"message":"ok","data":{"avail":[{"name":"sda"},{"name":"nvme0n1"}]}}'
JSON_NO_NAME='{"success":200,"message":"ok","data":{"avail":[{"path":"/dev/sdb"}]}}'
JSON_NO_DATA='{"message":"no matching operation was found"}'

t_eq "解析出两块假盘" "sda
sdb" "$(printf '%s' "$JSON_TWO_FAKE" | avail_disk_names)"
t_eq "avail 为空时输出空" "" "$(printf '%s' "$JSON_EMPTY" | avail_disk_names)"
t_eq "缺 name 时回退用 path 尾段" "sdb" "$(printf '%s' "$JSON_NO_NAME" | avail_disk_names)"
t_eq "缺 data 键时输出空而不报错" "" "$(printf '%s' "$JSON_NO_DATA" | avail_disk_names)"
t_ok "缺 data 键时退出码仍为 0" bash -c "printf '%s' '$JSON_NO_DATA' | avail_disk_names"

t_ok "全是假盘 → 通过"    bash -c "printf 'sda\nsdb\n' | verify_avail_only_fake"
t_no "混进真盘 → 拒绝"    bash -c "printf 'sda\nnvme0n1\n' | verify_avail_only_fake"
t_no "空清单 → 拒绝(补丁未生效的信号)" bash -c "printf '' | verify_avail_only_fake"
```

**注意:** `t_ok`/`t_no` 用 `bash -c` 包一层是因为要走管道;`bash -c` 起的子 shell 不继承已 source 的函数,所以这几条用例需要在 `raidlab.test.sh` 顶部 `source` 之后加一行 `export RAIDLAB_SYSFS_ROOT` (已有) 并把函数导出。在 harness 的 `source` 行**之后**补上:

```bash
export -f is_fake_disk assert_fake_disk list_fake_disks avail_disk_names verify_avail_only_fake
export FAKE_DISK_MODEL
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:Task 2 的 12 条仍全绿;新增 8 条里凡调用未定义函数的全 FAIL(`export -f` 会先报 `not a function`)。

- [ ] **Step 3: 最小实现**

在 `raidlab.sh` 的 `list_fake_disks` 之后追加:

```bash
# --- API 视图 ---------------------------------------------------------------

# api_get <path> —— 取 $RAIDLAB_API_BASE<path>。走本机 Gateway,localhost
# 免 JWT,所以不需要带令牌。
api_get() {
	curl -sS -m 20 "$RAIDLAB_API_BASE$1"
}

# avail_disk_names —— stdin 读 GET /v1/disks 响应,stdout 打 avail 里的设备名。
# 用 python3 而不是 grep/sed:响应是嵌套 JSON,文本切割在 children 数组上必错。
# 任何解析失败都输出空 + 退出 0,由调用方(verify_avail_only_fake)去判定。
avail_disk_names() {
	python3 -c '
import json, sys
try:
    doc = json.load(sys.stdin)
except Exception:
    sys.exit(0)
data = doc.get("data") if isinstance(doc, dict) else None
if not isinstance(data, dict):
    sys.exit(0)
for entry in data.get("avail") or []:
    if not isinstance(entry, dict):
        continue
    name = entry.get("name") or (entry.get("path") or "").rsplit("/", 1)[-1]
    if name:
        print(name)
'
}

# verify_avail_only_fake —— stdin 读设备名清单(每行一个)。
# 全是假盘返回 0;出现非假盘返回 1;空清单也返回 1 —— 空 avail 正是 Task 1
# 白名单补丁未部署时的表现,当成失败才能给出准确诊断。
verify_avail_only_fake() {
	local dev
	local count=0
	while IFS= read -r dev; do
		[[ -n "$dev" ]] || continue
		count=$((count + 1))
		if ! is_fake_disk "$dev"; then
			echo "raidlab: 后端 avail 里出现非假盘 '$dev',中止。" >&2
			echo "         测试台不能在真盘可被选中的状态下使用。" >&2
			return 1
		fi
	done
	if [[ "$count" -eq 0 ]]; then
		echo "raidlab: 后端 avail 为空 —— 假盘存在但后端看不见。" >&2
		echo "         几乎肯定是 IsDiskSupported 白名单补丁未部署:" >&2
		echo "         cd ~/NimoTech && nimo_os_docs/scripts/deploy.sh local-storage" >&2
		return 1
	fi
	return 0
}

# --- status ----------------------------------------------------------------

# cmd_status —— 打印测试台四视图,验收时对账用。始终返回 0(纯观测)。
cmd_status() {
	echo "=== 假盘(sysfs model == scsi_debug)==="
	local fakes
	fakes="$(list_fake_disks)"
	if [[ -n "$fakes" ]]; then
		echo "$fakes"
	else
		echo "(无)"
	fi

	echo
	echo "=== /proc/mdstat ==="
	cat "${RAIDLAB_PROC_MDSTAT:-/proc/mdstat}" 2>/dev/null || echo "(读不到)"

	echo
	echo "=== lsblk ==="
	lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL 2>/dev/null || echo "(lsblk 失败)"

	echo
	echo "=== 后端 avail(GET /v1/disks)==="
	local names
	names="$(api_get /v1/disks 2>/dev/null | avail_disk_names)"
	if [[ -n "$names" ]]; then
		echo "$names"
	else
		echo "(空 —— 若假盘已在场,说明白名单补丁未部署)"
	fi

	echo
	echo "=== 后端快照卷(GET /v2/snapshot/volumes)==="
	api_get /v2/snapshot/volumes 2>/dev/null || echo "(请求失败)"
	echo

	echo "=== 后端 RAID 阵列(GET /v2/raid)==="
	api_get /v2/raid 2>/dev/null || echo "(请求失败)"
	echo
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:`通过 20,失败 0`。

- [ ] **Step 5: 手工确认 `cmd_status` 在真机上不炸**

`status` 是纯观测、无破坏性,可以直接跑:

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && RAIDLAB_LIB_ONLY=1 bash -c 'source ./raidlab.sh; cmd_status'
```

预期:五段都打印出来;当前状态下「假盘」应为 `(无)`、mdstat 无阵列、`avail` 为空。**这是基线,记录进报告** —— Task 6 的验收清单要拿它对账。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/nimo_os_docs
git add scripts/raidlab.sh scripts/raidlab.test.sh
git commit -m "feat(raidlab): avail 解析/核对 + status 子命令

avail_disk_names 用 python3 解析嵌套 JSON(文本切割会在 children 上出错)。
verify_avail_only_fake 把「空 avail」也判为失败并指向 deploy.sh —— 空 avail
正是白名单补丁未部署时的实测表现,当成失败才能给出准确诊断而非含糊报没盘。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: md 阵列成员核查 + fstab / mdadm.conf 过滤

**Files:**
- Modify: `nimo_os_docs/scripts/raidlab.sh`(追加函数)
- Modify: `nimo_os_docs/scripts/raidlab.test.sh`(追加用例)

**Interfaces:**
- Consumes: Task 2 的 `is_fake_disk`
- Produces:
  - `md_arrays` → 从 `$RAIDLAB_PROC_MDSTAT` 读,打印所有 md 设备名(如 `md127`),每行一个。
  - `md_members <md>` → 打印该阵列的成员盘裸设备名,每行一个,字典序。数据源是 `<sysfs>/block/<md>/md/dev-*` 目录名。
  - `assert_md_all_fake <md>` → 该阵列全部成员都是假盘则返回 0;有任一非假盘成员、或阵列没有任何成员,则报错返回 1。
  - `fstab_drop_snapshots` → stdin 读 fstab 内容,stdout 打删掉「源为 `/dev/md*` 且挂载点以 `.snapshots` 结尾」的行之后的内容。其余行(含注释、空行)原样保留。
  - `mdadm_conf_drop_arrays` → stdin 读 mdadm.conf 内容,stdout 打删掉 `ARRAY` 行之后的内容。

**为什么 `md_members` 读 sysfs 而不是 `mdadm --detail`:** `down` 要在**停阵列之前**核查成员,而 `mdadm --detail` 需要 root。sysfs 的 `dev-<name>` 目录名普通用户可读,且格式稳定(`dev-sda` → 成员 `sda`)。

**为什么 fstab 过滤只认 `/dev/md*` 源:** 后端 `service/snapshot/fstab.go` 的 `Persist` 写的条目形如
`/dev/md127 /DATA/vol1/.snapshots btrfs subvol=/@snapshots,nofail,x-systemd.device-timeout=10s 0 0`
—— 源恒为阵列的 `DevicePath`,挂载点恒以 `/.snapshots` 结尾。两个条件同时匹配才删,避免误伤用户自己写的条目。

- [ ] **Step 1: 写失败测试**

在 `raidlab.test.sh` 的汇总行之前插入(并把新函数加进 `export -f` 那行):

```bash
echo
echo "== md_arrays / md_members / assert_md_all_fake =="

# /proc/mdstat 真实形状
cat > "$TMP/mdstat" <<'EOF'
Personalities : [raid0] [raid1] [raid4] [raid5] [raid6] [raid10] [linear] 
md127 : active raid1 sdb[1] sda[0]
      524224 blocks super 1.2 [2/2] [UU]
      
unused devices: <none>
EOF
export RAIDLAB_PROC_MDSTAT="$TMP/mdstat"

# 成员目录:sysfs 里是 <md>/md/dev-<成员名>
mkdir -p "$TMP/sys/block/md127/md/dev-sda" "$TMP/sys/block/md127/md/dev-sdb"
# 一个混进真盘的阵列
mkdir -p "$TMP/sys/block/md126/md/dev-sda" "$TMP/sys/block/md126/md/dev-nvme0n1"
# 一个没有任何成员的阵列(异常态)
mkdir -p "$TMP/sys/block/md125/md"

t_eq "从 mdstat 列出阵列" "md127" "$(md_arrays)"
t_eq "列出阵列成员且排序" "sda
sdb" "$(md_members md127)"
t_eq "无成员阵列返回空" "" "$(md_members md125)"
t_ok "全假盘阵列通过核查"        assert_md_all_fake md127
t_no "混进真盘的阵列被拒"        assert_md_all_fake md126
t_no "无成员阵列被拒"            assert_md_all_fake md125

echo
echo "== fstab_drop_snapshots / mdadm_conf_drop_arrays =="

FSTAB_IN='# /etc/fstab: static file system information.
UUID=78db4224-e926-42c4-a899-8f8f00224d22 /boot ext4 defaults 0 2
/dev/nvme0n1p8 /DATA ext4 defaults 0 2
/dev/md127 /DATA/vol1/.snapshots btrfs subvol=/@snapshots,nofail,x-systemd.device-timeout=10s 0 0
/dev/nvme0n1p1 /boot/efi vfat umask=0077 0 1'

FSTAB_WANT='# /etc/fstab: static file system information.
UUID=78db4224-e926-42c4-a899-8f8f00224d22 /boot ext4 defaults 0 2
/dev/nvme0n1p8 /DATA ext4 defaults 0 2
/dev/nvme0n1p1 /boot/efi vfat umask=0077 0 1'

t_eq "只删 md 源的 .snapshots 行" "$FSTAB_WANT" "$(printf '%s' "$FSTAB_IN" | fstab_drop_snapshots)"

# 不能误伤:非 md 源的 .snapshots 挂载点(用户自建)必须留下
FSTAB_KEEP='/dev/sdz1 /mnt/backup/.snapshots ext4 defaults 0 2'
t_eq "非 md 源的 .snapshots 行不动" "$FSTAB_KEEP" "$(printf '%s' "$FSTAB_KEEP" | fstab_drop_snapshots)"

# 也不能误伤:md 源但挂载点不是 .snapshots
FSTAB_KEEP2='/dev/md127 /DATA/vol1 btrfs defaults 0 0'
t_eq "md 源但非 .snapshots 挂载点不动" "$FSTAB_KEEP2" "$(printf '%s' "$FSTAB_KEEP2" | fstab_drop_snapshots)"

MDADM_IN='# mdadm.conf
DEVICE partitions
ARRAY /dev/md/nimo1 metadata=1.2 name=nimo:1 UUID=1234:5678:9abc:def0
MAILADDR root'

MDADM_WANT='# mdadm.conf
DEVICE partitions
MAILADDR root'

t_eq "只删 ARRAY 行" "$MDADM_WANT" "$(printf '%s' "$MDADM_IN" | mdadm_conf_drop_arrays)"
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:前 20 条仍绿,新增 10 条 FAIL(函数未定义)。

- [ ] **Step 3: 最小实现**

在 `raidlab.sh` 的 `cmd_status` **之前**追加(保持「纯函数在前、子命令在后」的顺序):

```bash
# --- md 阵列核查 ------------------------------------------------------------

# md_arrays —— 从 /proc/mdstat 列出所有 md 设备名,每行一个。
# mdstat 的阵列行形如 "md127 : active raid1 sdb[1] sda[0]"。
md_arrays() {
	local f="${RAIDLAB_PROC_MDSTAT:-/proc/mdstat}"
	[[ -r "$f" ]] || return 0
	awk '/^md[0-9]+ +:/ { print $1 }' "$f"
}

# md_members <md> —— 打印成员盘裸设备名,每行一个,字典序。
# 读 sysfs 的 <md>/md/dev-<name> 目录名,而不是 mdadm --detail:down 需要在
# 停阵列「之前」核查成员,而 mdadm --detail 要 root;sysfs 普通用户可读。
md_members() {
	local md="${1:-}"
	[[ -n "$md" ]] || return 0
	local dir="$RAIDLAB_SYSFS_ROOT/block/$md/md"
	[[ -d "$dir" ]] || return 0
	local path base
	for path in "$dir"/dev-*; do
		[[ -e "$path" ]] || continue
		base="$(basename "$path")"
		echo "${base#dev-}"
	done | sort
}

# assert_md_all_fake <md> —— 阵列所有成员都是假盘才返回 0。
# 无成员也算失败:那意味着我们读不到成员信息,不能据此做破坏性操作。
assert_md_all_fake() {
	local md="${1:-}"
	local members
	members="$(md_members "$md")"
	if [[ -z "$members" ]]; then
		echo "raidlab: 阵列 '$md' 读不到任何成员盘,拒绝对它做破坏性操作。" >&2
		return 1
	fi
	local dev
	while IFS= read -r dev; do
		[[ -n "$dev" ]] || continue
		if ! is_fake_disk "$dev"; then
			echo "raidlab: 阵列 '$md' 的成员 '$dev' 不是假盘,拒绝操作该阵列。" >&2
			echo "         这不是测试台建的阵列,可能承载真实数据。" >&2
			return 1
		fi
	done <<< "$members"
	return 0
}

# --- 配置文件清理(纯文本过滤,不落盘)--------------------------------------

# fstab_drop_snapshots —— stdin 读 fstab,删掉后端写的 @snapshots 条目。
# 两个条件同时满足才删:源是 /dev/md*,挂载点以 .snapshots 结尾。
# 后端写的形状(service/snapshot/fstab.go):
#   /dev/md127 /DATA/vol1/.snapshots btrfs subvol=/@snapshots,nofail,... 0 0
fstab_drop_snapshots() {
	awk '$1 ~ /^\/dev\/md/ && $2 ~ /\.snapshots$/ { next } { print }'
}

# mdadm_conf_drop_arrays —— stdin 读 mdadm.conf,删掉 ARRAY 行,其余原样。
# 调用方必须先对每个在场阵列跑过 assert_md_all_fake。
mdadm_conf_drop_arrays() {
	awk '$1 == "ARRAY" { next } { print }'
}
```

同时把新函数加进 `raidlab.test.sh` 的 `export -f` 行:

```bash
export -f is_fake_disk assert_fake_disk list_fake_disks avail_disk_names verify_avail_only_fake \
	md_arrays md_members assert_md_all_fake fstab_drop_snapshots mdadm_conf_drop_arrays
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:`通过 30,失败 0`。

- [ ] **Step 5: 反向验证 fstab 过滤不会误伤**

把 `fstab_drop_snapshots` 的条件临时放宽成只看挂载点(删掉 `$1 ~ /^\/dev\/md/ &&` 那半段),重跑:

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:`非 md 源的 .snapshots 行不动` 这条 FAIL。确认转红后改回去、重跑确认全绿。理由同 Task 2 Step 5:这条用例守的是「不误删用户 fstab 条目」,必须证明它真的在守。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/nimo_os_docs
git add scripts/raidlab.sh scripts/raidlab.test.sh
git commit -m "feat(raidlab): md 阵列成员核查 + fstab/mdadm.conf 过滤

md_members 读 sysfs dev-* 目录而非 mdadm --detail:down 要在停阵列之前
核查成员,而 --detail 需要 root。assert_md_all_fake 把「读不到成员」也判失败。
fstab 过滤要求「源为 /dev/md* 且挂载点以 .snapshots 结尾」双条件,避免误删
用户自建的同名挂载点。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `up` / `down` 子命令 + `main` 接线

**Files:**
- Modify: `nimo_os_docs/scripts/raidlab.sh`(追加子命令与 `main`,末尾加执行守卫)
- Modify: `nimo_os_docs/scripts/raidlab.test.sh`(追加参数校验用例)

**Interfaces:**
- Consumes: Task 2–4 的全部函数
- Produces:
  - `cmd_up` → 加载 scsi_debug、等设备就绪、核对 `avail`,成功返回 0
  - `cmd_down` → 核查并停阵列、清 fstab/mdadm.conf、卸模块、复核基线,成功返回 0
  - `main <subcmd>` → 分派;未知子命令打用法并返回 1
  - 执行守卫:`RAIDLAB_LIB_ONLY=1` 时不跑 `main`

- [ ] **Step 1: 写失败测试**

在 `raidlab.test.sh` 汇总行之前插入。子命令本身要 root + 改内核状态,**不在单测里跑**;这里只锁参数分派与用法输出:

```bash
echo
echo "== main 参数分派 =="

t_no "未知子命令返回非 0"  main frobnicate
t_no "无参数返回非 0"      main
t_eq "未知子命令打出用法" "1" "$(main frobnicate 2>&1 | grep -c '用法: ')"
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:前 30 条绿,新增 3 条 FAIL(`main` 未定义)。

- [ ] **Step 3: 最小实现**

在 `raidlab.sh` 的 `cmd_status` 之后追加:

```bash
# --- up --------------------------------------------------------------------

# cmd_up —— 加载 scsi_debug、等设备就绪、核对后端能看见且只看见假盘。
cmd_up() {
	if [[ -n "$(list_fake_disks)" ]]; then
		echo "raidlab: 假盘已在场,无需重复 up。当前状态:" >&2
		list_fake_disks >&2
		echo "         要重建请先 ./raidlab.sh down。" >&2
		return 1
	fi

	echo "raidlab: 加载 scsi_debug(num_tgts=$RAIDLAB_NUM_TGTS dev_size_mb=$RAIDLAB_DEV_SIZE_MB)..."
	sudo modprobe scsi_debug \
		"num_tgts=$RAIDLAB_NUM_TGTS" \
		"dev_size_mb=$RAIDLAB_DEV_SIZE_MB" || {
		echo "raidlab: modprobe scsi_debug 失败。" >&2
		return 1
	}

	# 等设备节点出现(udev 异步)。10 次 × 1s 足够;实测约 2s。
	echo "raidlab: 等待设备节点..."
	local i count
	for i in $(seq 1 10); do
		count="$(list_fake_disks | wc -l)"
		[[ "$count" -ge "$RAIDLAB_NUM_TGTS" ]] && break
		sleep 1
	done
	count="$(list_fake_disks | wc -l)"
	if [[ "$count" -lt "$RAIDLAB_NUM_TGTS" ]]; then
		echo "raidlab: 只出现 $count 块假盘,期望 $RAIDLAB_NUM_TGTS 块。" >&2
		return 1
	fi
	echo "raidlab: 假盘就位:"
	list_fake_disks | sed 's/^/  /'

	# 后端磁盘列表有 100s 缓存(GetDiskList 走 LSBLK(false) 不吃缓存,但
	# SMART 缓存与 udev 仍需时间),重试几轮再判定。
	echo "raidlab: 核对后端 avail..."
	for i in $(seq 1 6); do
		if api_get /v1/disks 2>/dev/null | avail_disk_names | verify_avail_only_fake 2>/dev/null; then
			echo "raidlab: 后端已看见全部假盘,且 avail 里没有真盘。"
			echo
			echo "raidlab: 测试台就绪。下一步按验收清单在 5273 预览页操作。"
			return 0
		fi
		sleep 3
	done

	# 最后一次不吞 stderr,把准确诊断打给用户
	echo "raidlab: 核对失败,详情:" >&2
	api_get /v1/disks 2>/dev/null | avail_disk_names | verify_avail_only_fake
	return 1
}

# --- down ------------------------------------------------------------------

# cmd_down —— 拆台并复核回基线。顺序不可调换:必须在停阵列「之前」核查成员,
# 停完阵列成员信息就没了。
cmd_down() {
	local md rc=0

	# 1. 核查所有在场阵列都是测试台建的
	local arrays
	arrays="$(md_arrays)"
	if [[ -n "$arrays" ]]; then
		while IFS= read -r md; do
			[[ -n "$md" ]] || continue
			assert_md_all_fake "$md" || return 1
		done <<< "$arrays"
	fi

	# 2. 清 fstab(在停阵列前做,条目里的 /dev/md* 此刻还有意义)
	local fstab="${RAIDLAB_FSTAB:-/etc/fstab}"
	if [[ -r "$fstab" ]]; then
		local tmp_fstab
		tmp_fstab="$(mktemp)"
		fstab_drop_snapshots < "$fstab" > "$tmp_fstab"
		if ! diff -q "$fstab" "$tmp_fstab" >/dev/null 2>&1; then
			echo "raidlab: 清理 $fstab 里的 @snapshots 条目..."
			sudo cp "$fstab" "$fstab.raidlab.bak"
			sudo cp "$tmp_fstab" "$fstab"
		fi
		rm -f "$tmp_fstab"
	fi

	# 3. 卸挂载点并停阵列
	if [[ -n "$arrays" ]]; then
		while IFS= read -r md; do
			[[ -n "$md" ]] || continue
			echo "raidlab: 停止阵列 /dev/$md..."
			sudo umount -R "/dev/$md" 2>/dev/null || true
			sudo mdadm --stop "/dev/$md" || rc=1
		done <<< "$arrays"
	fi

	# 4. 清 mdadm.conf
	local mdconf="${RAIDLAB_MDADM_CONF:-/etc/mdadm/mdadm.conf}"
	if [[ -r "$mdconf" ]]; then
		local tmp_mdconf
		tmp_mdconf="$(mktemp)"
		mdadm_conf_drop_arrays < "$mdconf" > "$tmp_mdconf"
		if ! diff -q "$mdconf" "$tmp_mdconf" >/dev/null 2>&1; then
			echo "raidlab: 清理 $mdconf 里的 ARRAY 行..."
			sudo cp "$mdconf" "$mdconf.raidlab.bak"
			sudo cp "$tmp_mdconf" "$mdconf"
		fi
		rm -f "$tmp_mdconf"
	fi

	# 5. 卸模块
	if lsmod | grep -q '^scsi_debug'; then
		echo "raidlab: 卸载 scsi_debug..."
		sudo rmmod scsi_debug || rc=1
	fi

	# 6. 复核基线
	echo "raidlab: 复核基线..."
	local left
	left="$(list_fake_disks)"
	if [[ -n "$left" ]]; then
		echo "raidlab: 仍有假盘残留:" >&2
		echo "$left" >&2
		rc=1
	fi
	if [[ -n "$(md_arrays)" ]]; then
		echo "raidlab: 仍有 md 阵列残留:" >&2
		md_arrays >&2
		rc=1
	fi

	if [[ "$rc" -eq 0 ]]; then
		echo "raidlab: 已回到基线。"
	else
		echo "raidlab: 拆台未完全成功,请跑 ./raidlab.sh status 查看。" >&2
	fi
	return "$rc"
}

# --- 分派 ------------------------------------------------------------------

usage() {
	cat <<'EOF'
用法: ./raidlab.sh <子命令>

  up      加载 scsi_debug 造假盘,核对后端能看见且只看见假盘
  down    核查并停阵列、清 fstab/mdadm.conf、卸模块、复核回基线
  status  打印假盘/mdstat/lsblk/后端 avail/快照卷/RAID 六视图(纯观测)

环境变量(默认值):
  RAIDLAB_NUM_TGTS=4          假盘数量
  RAIDLAB_DEV_SIZE_MB=512     每块假盘大小
  RAIDLAB_API_BASE=http://127.0.0.1
EOF
}

main() {
	case "${1:-}" in
	up) cmd_up ;;
	down) cmd_down ;;
	status) cmd_status ;;
	*)
		usage >&2
		return 1
		;;
	esac
}

# 执行守卫:被 source 时(测试)只定义函数,不跑 main。
if [[ "${RAIDLAB_LIB_ONLY:-0}" != "1" ]]; then
	main "$@"
fi
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts && ./raidlab.test.sh
```

预期:`通过 33,失败 0`。

- [ ] **Step 5: 确认执行守卫两个方向都对**

```bash
cd /home/nimo/NimoTech/nimo_os_docs/scripts
# 直接执行无参数 → 打用法、退出码 1
./raidlab.sh; echo "退出码=$?"
# status 子命令 → 正常打印
./raidlab.sh status | head -5
```

预期:第一条打出 `用法: ./raidlab.sh <子命令>` 且 `退出码=1`;第二条打出「假盘」段。

**不要在本步跑 `up` 或 `down`。**

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/nimo_os_docs
git add scripts/raidlab.sh scripts/raidlab.test.sh
git commit -m "feat(raidlab): up/down 子命令 + main 分派与执行守卫

down 的步骤顺序不可调换:必须在停阵列之前核查成员并清 fstab,停完成员信息
就读不到了。改 fstab/mdadm.conf 前都留 .raidlab.bak 备份。up 对后端 avail
重试 6 轮 × 3s 后才判失败(udev 与 SMART 缓存需要时间),最后一次不吞
stderr 以便打出准确诊断。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 验收清单文档

**Files:**
- Create: `nimo_os_docs/docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md`

**Interfaces:**
- Consumes: Task 1 的部署产物、Task 5 的 `raidlab.sh`
- Produces: 用户逐条勾选的验收清单。执行者不勾 —— 这份文档的读者是用户。

**写作要求:** 每条必须是「点哪里 → 应该看到什么」的可判定描述,不要写「验证 X 功能正常」这种没法判定的话。假盘的 SMART/温度/通电时长字段为空,凡涉及这些字段的观察点标 `N/A(假盘无 SMART)`。

- [ ] **Step 1: 写清单文档**

创建 `nimo_os_docs/docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md`,内容结构如下,**每一条都要写全**:

```markdown
# SP6-P5.5 实盘验收清单

> 前置:① `nimo_os_docs/scripts/deploy.sh local-storage` 部署白名单补丁;
> ② `NimoOS-New-UI` 起 5273 预览(`pnpm build && pnpm exec vite preview --host`);
> ③ 5273 是独立端口,localStorage 独立 → 需要重新登录一次。
>
> 每轮开始前 `./raidlab.sh status` 记录基线,结束后 `./raidlab.sh down` 复核回基线。

## 第 0 步:补丁生效自检
- [ ] `./raidlab.sh up` 最后一行是「测试台就绪」。若报「avail 为空 / 白名单补丁未部署」,回去确认 Task 1 已部署。

## 第一轮:两个 2 盘 RAID1 —— 专验换阵列复位
(建阵列步骤、逐条观察点……)

## 第二轮:3 盘 RAID5 + 1 备用 —— P4 写操作全套
(创建向导 / 故障注入 / 换盘 / 恢复 / 快照面板 / 删阵列,逐条观察点……)

## 收尾
- [ ] `./raidlab.sh down` 输出「已回到基线」
- [ ] `./raidlab.sh status` 显示假盘 `(无)`、mdstat 无阵列、avail 为空
- [ ] `grep -c raidlab /etc/fstab` 为 0;`ls /etc/fstab.raidlab.bak` 存在(备份保留备查)
```

具体逐条内容按 spec §4.3 展开。第一轮必须包含:两个阵列都建成后在 `/storage/raid` 看到两张卡;进阵列 A 详情页记下快照开关状态/快照数/策略摘要;**直接切到阵列 B 的详情页**;确认面板显示的是 B 自己的状态而非 A 的残留;在 B 上开启保护并保存策略;回到 A 确认 A 的策略没被改。第二轮必须包含 spec §4.3 列出的 6 个步骤,每步展开成可判定的观察点。

- [ ] **Step 2: 自查清单可判定性**

通读一遍,把任何「验证 X 正常」「检查 Y 是否正确」改写成「点 X → 应看到 Y」。确认每条都有明确的失败判据。

- [ ] **Step 3: 提交**

```bash
cd /home/nimo/NimoTech/nimo_os_docs
git add docs/acceptance/2026-07-28-sp6-p5.5-验收清单.md
git commit -m "docs(acceptance): SP6-P5.5 实盘验收清单(两轮建台)

第一轮两个 2 盘 RAID1 专验 P5 终审那条 Critical(换阵列后面板复位);
第二轮 3 盘 RAID5 + 1 备用走 P4 写操作全套故障演练。
假盘无 SMART,相关观察点标 N/A。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 验收环节(Task 6 之后,由用户主导)

计划到 Task 6 为止是**代码与文档交付**。之后的实盘验收不是 Task,因为它需要用户在浏览器里点、判断视觉与交互是否符合预期:

1. 执行者跑 `deploy.sh local-storage` 部署白名单补丁
2. 执行者起 5273 预览并确认可访问
3. 执行者跑 `./raidlab.sh up` 并确认「测试台就绪」
4. **用户**按清单逐条验收,把结果告诉执行者
5. 暴露的缺陷按 TDD 修 —— 每个缺陷单独走一轮「失败测试 → 修 → 通过 → 提交」
6. 执行者跑 `./raidlab.sh down` 复核回基线
7. 更新 roadmap:关闭台账 C11、C12,记录 P5.5 结论

## Self-Review

**Spec 覆盖检查:**
- §4.1 机制选型(白名单补丁)→ Task 1 ✅
- §4.2 `raidlab.sh` 护栏 → Task 2 ✅;up/down/status → Task 3(status)、Task 5(up/down)✅
- §4.3 两轮验收拓扑 → Task 6 清单 ✅
- §4.4 5273 验收伺服 → Task 6 清单前置 ✅
- §4.5 缺陷 TDD 处理 → 验收环节第 5 步 ✅
- §4.6 完成定义 6 条 → Task 1(补丁+单测)、Task 2 Step 5 与 Task 4 Step 5(护栏反向测试)、Task 6(清单)、验收环节 6–7(基线复核、台账关闭)✅

**类型/命名一致性检查:** `is_fake_disk`/`assert_fake_disk`/`list_fake_disks`/`avail_disk_names`/`verify_avail_only_fake`/`api_get`/`md_arrays`/`md_members`/`assert_md_all_fake`/`fstab_drop_snapshots`/`mdadm_conf_drop_arrays`/`cmd_up`/`cmd_down`/`cmd_status`/`usage`/`main` —— 全文命名一致,Task 3/4 的 `export -f` 行与实际定义的函数集合对齐。环境变量 `RAIDLAB_SYSFS_ROOT`/`RAIDLAB_PROC_MDSTAT`/`RAIDLAB_FSTAB`/`RAIDLAB_MDADM_CONF`/`RAIDLAB_API_BASE`/`RAIDLAB_NUM_TGTS`/`RAIDLAB_DEV_SIZE_MB`/`RAIDLAB_LIB_ONLY` 一致。

**已知缺口(有意留白,非计划失败):**
- Task 6 的清单正文没有把每一条逐字写死,只给了必含项与写作标准。理由:清单是给人读的验收脚本,逐字写死会让执行者机械抄写而不检查每条是否真的可判定;必含项已经把 spec §4.3 的全部场景钉住了。
- 混规格盘验不了(`scsi_debug` 单次 modprobe 尺寸统一),已在 spec §7 与 roadmap 台账 B8 记账,不在本计划范围。
