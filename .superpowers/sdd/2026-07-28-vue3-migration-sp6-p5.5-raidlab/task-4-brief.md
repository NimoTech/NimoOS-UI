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

