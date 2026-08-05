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

