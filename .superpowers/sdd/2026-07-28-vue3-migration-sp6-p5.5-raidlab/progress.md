# SDD ledger — plan: /home/nimo/NimoTech/NimoOS-New-UI/docs/superpowers/plans/2026-07-28-vue3-migration-sp6-p5.5-raidlab.md

## 工作区
- 计划所在仓:NimoOS-New-UI(master,只读——本期不改 New-UI 代码)
- 实施仓 1:NimoOS-LocalStorage 分支 `sp6-p5.5-raidlab`,base `1ab91a9`(Task 1)
- 实施仓 2:nimo_os_docs 分支 `sp6-p5.5-raidlab`,base `0c7329e`(Task 2–6)
- ⚠️ nimo_os_docs 建分支时带着 5 个**既有**脏文件(CLAUDE.md / DEV_DEPLOY.md / scripts/deploy-agent.sh / scripts/deploy-ui.sh 已暂存,docs/design/2026-07-21-files-paste-upload-design.md 未跟踪)——**不属本期,不得提交**。计划里每条 git add 都写死路径。

## 预检扫描(Task 1 派发前)
计划自身无内部矛盾;无「计划强制但评审规则视为缺陷」的条目。
Task 2 Step 5 与 Task 4 Step 5 是有意的「改坏实现必须转红」反向验证,属正当的真回归证明,非同义反复。

## 进度
Task 1: complete (LocalStorage 1ab91a9..c0d0861, review clean; spec ✅ / quality Approved 无 Critical/Important)
  - 评审独立推导确认「删掉新增白名单行 → 测试真转红」,非同义反复;7 例期望值逐一手算复核
  - ⚠️ 无法从 diff 验证项(route/v1/disk.go:128 端到端 avail 行为)= 控制者裁定:本就属验收环节范围,非缺口

Task 2: 首轮评审 spec ✅ / quality Approved(nimo_os_docs 0c7329e..e07cafe,12/12 测试);既有 5 脏文件已复核未夹带
  - Important×1 进修复轮:is_fake_disk 对含 `/`、`..` 的设备名无显式拒绝(代码逐字来自 brief,缺陷在计划作者)。
    判定为「真实缺陷、非计划冲突」:Task 3 的 verify_avail_only_fake 会把后端 HTTP 响应的 name 字段喂进 is_fake_disk,
    下游是 mdadm --create(清扫成员盘)——外部可影响输入流进安全关键判定;计划无任何条款禁止加此拒绝,
    加固与全局约束「护栏是安全关键」同向,故不需向用户请裁。
  - Minor×1 一并修:test.sh 里 `set +e` 的注释描述了不存在的 `set -e`(brief 原文笔误)
  - Minor×1 裁定 accept 不改:FAKE_DISK_MODEL 硬编码未用 `${VAR:-default}` 覆盖式 —— 判定基准值不该可被外部环境改动,
    硬编码对安全关键代码是更好的选择(评审自己也如此表述)。留档备查。
Task 2: fix round 1/5 (2 addressed, 0 open — 路径穿越拒绝 + set +e 注释失实;commits e07cafe..bc8f043)
  - 实施者自查抓出自己第一版穿越用例是同义反复(伪造 sysfs 里穿越路径无文件 → 护栏在不在都全绿),
    改为在 block/ 之外埋 3 个诱饵 model 文件让攻击串真能读到内容,重做反向验证真转红。
  - 复审独立重推路径算术(`.`→block/device/model、`..`→sys/device/model、`sda/../../etc`→sys/etc/device/model)
    与去护栏转红推演,核实报告为真非编造;确认 `.|..` 单列规则必要(两者全由允许字符组成,字符类排除法抓不到)
Task 2: minor (deferred): raidlab.sh 新增穿越注释自称「②」与下方既有「② sysfs 型号」编号重复(纯注释小疵,后续 Task 顺手改)
Task 2: complete (nimo_os_docs 0c7329e..bc8f043, review clean; 16/16 测试)

Task 3: 首轮评审 spec ✅ / quality 有 Important(nimo_os_docs bc8f043..bc57887,24/24 测试 = 16 既有 + 8 新增)
  - Important×1 进修复轮:avail_disk_names 对 `avail` 为非空标量(int/bool)抛 TypeError 非 0 退出,
    违反自身注释「任何解析失败都输出空+退出0」;评审独立 python3 复现,非采信报告。字符串形状虽不炸但会逐字符输出(静默错误)。
    代码逐字来自 brief,缺陷在计划作者。非安全问题(崩溃在打印任何设备名之前,失败在安全侧,护栏未被绕过),
    但会让 cmd_status 漏 traceback 且把诊断误导向「白名单补丁未部署」。
  - Minor×2 一并修(均 brief 原文自带):JSON_HAS_REAL fixture 死代码未被引用;RAIDLAB_PROC_MDSTAT 未在顶部统一声明
  - ⚠️ 评审提出「Task 5 是否有 set -e 语境放大该崩溃」= 控制者裁定不存在:raidlab.sh 顶部为 `set -uo pipefail` 无 `-e`,
    Task 5 计划文本也不加 `-e`;赋值语句不因子命令非 0 而中止,cmd_status 仍恒返回 0。
  - 已知计划文本陈旧(非实施缺陷):brief Step 2/4 写的「12 条既有 / 通过 20」在 Task 2 修复轮后过期,实际基线 16 条

Task 3: fix round 1/5 (3 addressed, 0 open — JSON 类型闸门 + 死 fixture + PROC_MDSTAT 顶部声明;commits bc57887..a7ca719)
  - 复审独立复现 6 种畸形输入全部输出空+退出 0,合法输入未误杀
  - 重点裁决:实施者自查报告「avail 为字符串」那条用例不转红。复审证明这是**数学必然**非测试写得不刁:
    Python 迭代字符串产出的元素恒为长度 1 的 str,永不可能是 dict,故既有的 `isinstance(entry, dict)` 防线
    在任何字符串输入下都会挡掉全部字符 → 新旧代码在该路径永远同构,**不存在能区分的字符串输入**。
    复审逐条分析 10 条断言:4 条真杀(avail=int/bool 的退出码断言、path=数字的退出码断言、name=数字的内容断言),
    6 条不杀但属正常的「退出码+内容」配对防御深度设计。裁定:保留用例,不删不改造。
Task 3: minor (deferred): 「avail 为字符串」用例的注释归因不准(实际验证的是既有 entry 级 dict 检查,非本轮新增的 list 闸门),后续顺手改措辞
Task 3: minor (deferred): avail_disk_names 对 `name=0` 这类「falsy 但类型对」的边界无显式用例(行为正确会落回 path 分支)
Task 3: complete (nimo_os_docs bc8f043..a7ca719, review clean; 34/34 测试)

Task 4: 首轮评审 spec ✅(含裁定实施者自行修的两处为正当缺陷修正) / quality 有 Important×2
  (nimo_os_docs a7ca719..340ee51,50/50 测试;对抗性审视指示奏效——实施者自己抓出并修了 2 处 brief 精度缺陷)
  - I-1 进修复轮:fstab 过滤无用例覆盖后端真实行形状(制表符分隔/7 字段/尾注释)。评审用两个「看起来像改进」的
    变异(`BEGIN{FS="[ ]"}`、`NF==6 &&`)证明套件能全绿通过而生产真实行漏删。漏删比误删隐蔽:假盘 rmmod 后
    fstab 留下指向不存在设备的条目,而 cmd_down 第 6 步复核查不到这条。
  - I-2 控制者裁定**不在 Task 4 修,转 Task 5 必带项**:删除范围(全文所有 md 行)与核查范围(仅已组装阵列)
    结构性不匹配。改签名属范围变更(违 Task 4 已定对外契约),改为 cmd_down 加前置断言。今天影响为零
    (已核实:可见 /etc/fstab 无 md 条目、/etc/mdadm/mdadm.conf 零 ARRAY 行),伤害可恢复(.bak/后端重落/superblock 组装)。
  - M-1/M-7/M-8 一并进修复轮;M-3/M-4/M-5/M-6 裁定 accept 不改(与后端 pkg/mdadm 契约一致、失败方向安全、brief 原文如此)
  - ⚠️ 评审提出「faulty 成员盘的 sysfs dev-* 目录是否持续在场」无法在沙箱验证。评审独立判断实施者推理可靠
    (dev-<name> 是 rdev 的 kobject,`--fail` 只摘 md/rdN 符号链接,摘 kobject 只发生在 `--remove`)。
    **收口动作:Task 6 验收时真机记录 `ls /sys/block/mdX/md/` 在 --fail 前后的差异,把假设变成事实。**
  - ⚠️ 评审提出 overlayroot 疑虑 = **控制者已实测解除**:`/media/root-rw` 是真实 ext4 分区(nimoos-overlay,7.5G)
    非 tmpfs,写 /etc/fstab 落到 /media/root-rw/overlay/etc/fstab 且跨重启持久(已有 7-23 副本)。
    Task 5 直接 `sudo cp` 到 /etc/fstab 正确,不需 overlayroot-chroot,清理非空操作。

Task 4: fix round 1/5 (4 addressed, 0 open — I-1 真实行形状 fixture + M-1 用例名 + M-7 型号否决路径 + M-8 stderr 诊断;commits 340ee51..9cdd46d)
  - 复审独立核实 fixture 里的 `\t` 在 `printf` 格式串内会在运行时转义成真制表符(自跑 printf + od -c 验证),非假覆盖
  - 复审自己重跑评审给的两个变异(`BEGIN{FS="[ ]"}`、`NF==6 &&`),两次新用例都转红,改回后 53/53 且 git diff 归零
  - 复审交叉核对 pkg/fstab/fstab.go:53-55(Entry.String 用 \t 拼字段) + :88(追加尾注释),确认 fixture 精确复刻生产行形状
  - 确认过滤器签名仍是无参 stdin(I-2 留 Task 5),修复 diff 克制未越界
Task 4: complete (nimo_os_docs a7ca719..9cdd46d, review clean; 53/53 测试)

Task 1: rework (标记文件门控) complete (LocalStorage c0d0861..2e8edcd, 14 子测试全绿)
  - ⚠️ 派发的 opus 复审被**组织月度额度上限**打断(仅恢复到部分输出),故由**控制者亲自核实**(降级流程,已记录):
    · 门控实现正确:`(Contains(pseudo) && allowPseudoDisks())`,其余 8 个分支一字未动 → 出厂默认与打补丁前完全一致
    · 包级变量 `allowPseudoDisksMarkerFile` 可注入;测试用 `t.TempDir()` + `defer` 正确还原
    · `os.Stat` err==nil 判存在;失败方向全部朝「拒绝」(坏符号链接/父目录不可遍历 → err → false)
    · `os` 已在 disk.go:9 导入,无新依赖;三条要求的注释(标记文件 vs 环境变量/配置项、不用 build tag、调用频率)齐
    · **可证伪性亲自验证**:退回无条件放开 → 「出厂默认拒绝」用例转红(disk_test.go:93);还原后全绿、git status 干净
  - Minor×2 (deferred,纯注释不准无行为影响):
    ① 注释称「会被 route/v1/disk.go 在磁盘列表循环里调用」,实际有 **6 个调用点**
       (misc.go:27、route/v1/disk.go:129,201、route/v1/storage.go:105,254、service/disk.go:649)
    ② 注释称「每次调用都做一次 os.Stat」偏悲观 —— Go `||` 从左到右短路,`Contains(pseudo)` 先求值,
       故 os.Stat **只在真的出现 pseudo 盘时**才调用,正常机器一次都不跑(实际比注释描述的更好)

Task 5: 首轮评审 spec ✅ / quality 有 Important×1(nimo_os_docs 9cdd46d..0428fef,65/65 测试)
  - 实施者对抗性审视自行修 brief 一处:`umount -R "/dev/$md"` → `umount -A`。**评审独立核实为正确**:
    后端把同一 /dev/mdN 挂成两个平级挂载点(service/v2/raid_filesystem.go:125 基础子卷 +
    service/snapshot/btrfs.go:158-162 的 .snapshots 子卷),是两次独立 mount(2) 非 bind mount;
    `-A`=该设备的所有挂载点(正确),`-R`=按挂载树递归 target(语义单位是目录层级,给它传设备路径
    未必覆盖平级挂载点)。若不改,`mdadm --stop` 会因设备仍被占用而失败。
  - Important 进修复轮:两处 `sudo cp`(raidlab.sh:471-472、498-499)未检查返回码。顶部是 `set -uo pipefail`
    **无 `-e`**,故备份 cp 失败会静默继续、照样覆写目标 → 击穿 commit message 承诺的「改前必留 .bak」。
    缺陷源自 brief 原文,但本层是唯一真执行破坏性动作的护栏层,应比草稿更严。
  - 评审独立实测(桩 sudo/mdadm/rmmod/lsmod + 伪造 sysfs/mdstat/fstab/mdadm.conf,全在临时目录):
    · 前置断言拒绝时 fstab/mdadm.conf/marker 三者 md5 与存在性均未变、无 .bak 产生 → 「一个文件都不动」为真
    · 连续两次 down **不会**毁掉好备份(第二次 `diff -q` 判无变化 → 整个 if 分支含备份行被跳过)
    · 12 条新用例**无一条**是改坏实现不转红的假测试;尤其「verified 集合为空 → 拒绝一切」锁死了安全默认值
  - Minor×2 一并修:usage() 漏列 RAIDLAB_FSTAB/RAIDLAB_MDADM_CONF;mktemp 无 trap 兜底
  - 🔴 **全篇最大开放风险点,Task 6 必须第一时间实证**:`mdadm --detail --scan`(pkg/mdadm SaveConfig 调它
    整体覆写 mdadm.conf)生成的 ARRAY 行设备字段,可能是 `/dev/md127` 也可能是 `/dev/md/名字` 符号形式
    —— **格式由 mdadm 二进制自身决定,不受 Go 仓库控制**(Create() 不传 --name,但 --detail --scan 的输出格式是外部行为)。
    若是符号形式,前置断言会在**每次正常 down 上都拒绝**,把「安全拒绝」变成「功能永久不可用」(评审已模拟证实会拒绝)。
    失败方向安全(不误删),但功能不可用。补救方向:断言里对 `/dev/md/*` 做 readlink 解析后再比对。已要求写进代码注释。
  - ⚠️ 测试盲区(项目既有惯例,非本期引入):cmd_up/cmd_down 本体因要动内核状态/sudo 被排除在单测外,
    故「前置断言确实被 cmd_down 按正确顺序调用」测试套件证明不了,靠代码审查+评审的桩模拟担保。
    **若后人改动 cmd_down 的调用顺序,现有测试不会报警。**

Task 5: fix round 1/5 (3 addressed + 文档项 addressed, 0 open;commits 0428fef..a1a1e13)
  - 备份 cp 失败 → 拒绝覆写并 return 1;覆写 cp 失败 → rc=1 传播到 `return "$rc"`(复审核实非只打日志)
  - trap 兜底:tmp 变量提为脚本级(避开 set -u 下 trap 在局部变量出栈后触发的 unbound);
    复核确认此前无脚本级 trap 故无覆盖;测试里 cmd_down 在独立 bash -c 子进程,不污染 harness 自己的 trap
  - 实施者二次自查:第一版桩 sudo 对所有 cp 无差别失败 → 「有守卫」与「没守卫」表现一样(同义反复),
    改为按目标路径后缀 `.raidlab.bak` 精确区分备份/覆写才真复现漏洞
  - 复审独立转红/转绿:去掉守卫 → 67/2(失败的正是「fstab 内容未变」与「诊断提到拒绝继续覆写」);还原 → 69/0;git status 干净
  - 复审证实报告自承的「4 条新用例里 2 条不是判别点」准确(「cmd_down 返回非 0」恒真=桩 sudo 未预期调用兜底致 rc=1;
    「没留 .raidlab.bak」恒真=桩从不真正创建该文件)。真正判别点 2 条确实能转红转绿。
  - Task 6 待验证项注释已写(raidlab.sh:278-295),含核实步骤与 readlink -f 补救方向
Task 5: complete (nimo_os_docs 9cdd46d..a1a1e13, review clean; 69/69 测试)

Task 6: complete (nimo_os_docs a1a1e13..101ff09, 44 条清单;文档交付,真正的评审者是用户本人)
  - 控制者亲自通读全文核实(降级流程,额度上限下节省派发):每条均为「点哪里→看到什么」可判定式、标注 [我跑]/[你点]、
    假盘盲区标 N/A、两个取证项(mdadm.conf 设备字段格式 / --fail 前后 sysfs dev-* 目录)都在、收尾复核 6 条齐
  - 实施者主动纠正一处:「恢复」按钮在正常 --fail+换盘流程下不会出现(isRetrying/isFailed 不满足),
    改写成条件分支 + 标「不适用」,避免用户对着不会出现的按钮空等
  - 🔴 **提交卫生事故(已修复,记录备查)**:实施者首次提交误用 `git add` + `git commit -m`(无 pathspec),
    把仓库既有的 3 个预暂存脏文件(CLAUDE.md/DEV_DEPLOY.md/deploy-ui.sh)一并提交。它自行用
    `git reset --soft` + `git restore --staged` + 带 pathspec 重提修复。
    **控制者独立核实**:101ff09 只含 1 文件 155 行;`git log 0c7329e..101ff09 -- <那4个文件>` 为空(无 commit 碰过);
    4 个文件改动量仍在(7/237/7/11 行)、未跟踪文件 5369 字节仍在 → **内容零丢失**。
    但 `reset --soft` 丢掉了 3 个文件的**暂存状态**(内容未丢)→ **控制者已 `git add` 还原**,
    现状与开工时逐字一致(`M `/` M` 标记位全对)。
    教训:该仓禁止两步式提交,必须 `git commit -m "..." -- <path>`。

== 整支终审: Ready to merge = With fixes → 修复后 Yes (nimo_os_docs @256e922) ==
终审(base 两仓 1ab91a9/0c7329e → 2e8edcd/101ff09):跨 Task 契约无破坏、8 个环境变量全被用上且可注入、
**标记文件跨仓闭环逐字符核对一致**(disk.go:39 vs raidlab.sh:26)、验收清单文案与实现相符。
安全性终审结论:**未发现正常调用下能破坏真实数据的路径** —— umount/mdadm --stop 前有两层核实
(assert_md_all_fake + devices_not_in_set),两次循环用同一 $arrays 快照故**无 TOCTOU 窗口**;备份失败已加固。
Important×2 已修(终审修复轮 101ff09..256e922,84/84):
  ① cmd_down 安全拒绝路径补两条端到端回归测试(此前仅评审员一次性手工桩验证,重排步骤无测试报红)
  ② 验收清单补「down 失败退出也要检查并清理标记文件」分支(此前只覆盖成功路径)
Minor×1 已修:assert_fake_disk 加注释说明无生产调用点(实际走阵列级 assert_md_all_fake),防后人给新单盘操作漏挂护栏
**🔑 本期最有价值的测试设计教训(复审独立验证成立)**:把「清 fstab」挪到「核查」之前后,`cmd_down` 的
**返回码不转红**(仍非 0,因后置 assert_md_all_fake 终究会失败),只有文件内容/mtime/`.raidlab.bak` 断言转红
—— **只断言退出码的测试会完全漏掉这类「顺序错了但最终仍报错」的回归**。mtime 用 `stat -c %Y` 秒级 + 显式 sleep 1 规避同秒假通过。

== 终审残留发现:控制者裁定 park(不再开修复轮)==
Task 5 终审修复轮新增 15 条断言里 **3 条恒真**(复审独立发现并验证):
  · 「混入真盘/未核实设备:标记文件 mtime 未变」×2 —— 根因 `mk_permissive_sudo_stub` 的 `rm` 分支只 `exit 0` 从不真删,
    故无论 cmd_down 正确拒绝还是误跑到步骤 6,标记文件永不被删、mtime 永不变(mutation 1 实测:返回码已转红而此断言仍 ok)
  · 「未核实设备:fstab 内容未变」×1 —— 该用例 fstab 只有一行 /boot,本就不含匹配过滤条件的行
**裁定 park 理由**:不承重 —— 同一用例内的兄弟断言(mdadm.conf 内容/mtime、`.raidlab.bak` 有无、诊断文案)
已被复审独立验证真实生效、非恒真,足以锁住「步骤顺序」这条安全属性。3 条属虚假覆盖率信心,不是漏防护。
清理方向(后续顺手):让桩 `rm` 真删除临时文件,或直接删掉这 3 条断言。

== 🟢 实盘验收进行中(2026-07-28 16:28 起)==
环境:后端补丁已部署(local-storage 版本串带 2e8edcd);5273 vite preview;raidlab 测试台

**已被真机验证的项**
- ✅ 标记文件门控真机生效(现场实验:标记在→avail 4 块假盘 / 移走→`[]` / 放回→又可见,**全程不重启服务**)
- ✅ **P5 那条 Critical 首次真机确认**:第一轮两个 2 盘 RAID1,两个关键判定点(切到 B 不显示 A 的残留 /
  在 B 上写策略后 A 的 5/9/2 未被改)用户报告全部通过 —— 此前只有单测锁着
- ✅ **「全期最大开放风险」关闭**:阵列存在时 `grep ^ARRAY /etc/mdadm/mdadm.conf` 实测为
  `ARRAY /dev/md0 metadata=1.2 UUID=...` **数字形式**,非 `/dev/md/<name>` 符号形式 → 前置断言不会误拒,预备的 readlink 补丁不用打
- ✅ **Task 4 的 I-1 修复被真机证明必要**:后端实际写入 fstab 的是
  `/dev/md0\t/media/RAID_<name>/.snapshots\tbtrfs\tsubvol=/@snapshots,nofail,x-systemd.device-timeout=10s\t0\t0\t# Added by the NimoOS`
  —— 制表符分隔/7 字段/尾注释,正是补的那条 fixture 的形状。没补就会漏删。
- ✅ fstab/mdadm.conf 清理精度:`diff` 备份与现文件,**恰好**只删掉 2 条 @snapshots 行 + 2 条 ARRAY 行,其余 42 行一字未动
- ✅ 「改前必留 .bak」:`/etc/fstab.raidlab.bak`(2400B)、`/etc/mdadm/mdadm.conf.raidlab.bak`(138B) 均已生成
- ✅ 快照卷真的活了:2 个卷 `supported=True`

**实盘验收抓出的缺陷(全部已修)**
1. **scsi_debug 假盘共享底层存储** → RAID 建不起来(`ADD_NEW_DISK ... Device or resource busy`,永远第二块盘失败)。
   决定性实验:写 sda 后 sdb/sdc 读到同一串。根因=`num_tgts=N` 是单 host 多 target=共享 store。
   修:`per_host_store=1 add_host=N num_tgts=1`;并给 `cmd_up` 加**盘独立性自检**(测试台曾静默产出坏假盘却报告"就绪")。
   排除过程:手工同款命令同样失败(排除前后端代码)→停 UI 轮询仍失败→暂停 udev 仍失败→建前可独占打开 sdb→换盘对同样第二块失败→wwid 各异。
   nimo_os_docs @`9437a98`(88/88)
2. **RAID 域三个端点是裸信封,被 `unwrap()` 误判为失败** → 「报创建失败但阵列出现了」。
   `POST /v2/raid`(raid.go:187 `{task_id,status}`+202)、`GET /v2/raid/tasks`(:299 裸数组)、`GET /v2/raid/tasks/:id`(:307/309 裸对象);
   **其余 6 个端点是标准信封**(已逐个 curl+读码核实)。**第二层 bug 被第一层藏住**:store 的 `createRaid` 读 `res?.data?.task_id`
   多了一层 `.data`,只修第一层会让 taskId 为空串、任务卡永不动。**这是本项目第三次栽同一个坑**(记忆里已警告过两次)。
   顺手核实快照域全部走同一个 `ctx.JSON(status, model.Result{})` 出口、信封一致,`unwrap` 用得对,不用改。
   Service @`bfa3d62`(133/133)+ New-UI @`ab0fe3f`(1508/1508,两侧均有 RED 证据)
3. **StorageShell 用 `min-height` 致存储区全部 5 个视图无法滚动** → 快照面板被裁且不能下拉。
   三者叠加:`theme.css:302` `body{overflow:hidden}` + 壳用 `min-height:100dvh`(容器随内容长高、永不受视口约束)
   + `.st-body{flex:1;overflow-y:auto}` 拿不到受限高度→滚动条永不激活。
   修法照抄仓内已工作的 `AreaShell`(`height:100vh;height:100dvh` + `flex:0 0 auto` + `flex:1 1 auto;min-height:0`)。
   **根源是同型外壳被实现了两遍**(文件区用共享 AreaShell、存储区自写 StorageShell),建议后续合并(修复者同判定)。New-UI @`46cce21`
4. **`lsmod | grep -q` 在 `pipefail` 下被 SIGPIPE 咬死致 `rmmod` 被跳过** → `down` 报「仍有假盘残留」。
   `lsmod` 输出 217 行、目标在第 3 行,`grep -q` 提前退出→`lsmod` 吃 SIGPIPE 退 141→`pipefail` 判整条管道失败→`if` 走 else。
   **⚠️ 控制者早先"这是竞态"的判断是错的**:交互 Bash 工具里 `grep` 是 Claude Code 的 shell 函数(内部 ugrep),
   那次测出 0 是**测量无效**;以脚本方式(子进程不继承该函数、用真 GNU grep)实测 **5/5 恒为 141**,即稳定失效非偶发。
   修:改读 `/proc/modules` 无管道;抽 `module_loaded` 纯函数 + 200 行伪 /proc/modules 用例锁 SIGPIPE 回归 + 名字锚定防前缀误判。
   nimo_os_docs @`17b427e`(93/93)
5. **`down` 不清后端 DB 记录致 UI 显示幽灵阵列** → down/up 后列表仍有 2 个不存在的阵列(mdstat 已空)。
   修:`cmd_down` 加第 7 步核对 `GET /v2/raid` 残留并醒目提示 + **置 rc=1**(与既有假盘/阵列残留检查同尺度);
   **红线:不让脚本代调 `DELETE /v2/raid/:id`** —— 删阵列是清单里要人工验的功能点,脚本抢做会抹掉验收点。
   验收清单「回合切换」改为先在 UI 走删除阵列再 `down`。nimo_os_docs @`75c2564`(104/104)

**待验(第二轮 3 盘 RAID5 + 1 备用)**:创建向导全走查 / `mdadm --fail` 故障演练(含 sysfs dev-* 前后对比取证)/
换盘 + 重建 5000ms 自动刷新 / 恢复按钮 / 快照面板全套 / type-to-confirm 删阵列

== 代码交付完成,验收阶段未开始 ==
坐标:NimoOS-LocalStorage `sp6-p5.5-raidlab`@**2e8edcd** / nimo_os_docs `sp6-p5.5-raidlab`@**256e922**(84/84 测试)
⚠️ **工作区不删**:验收阶段(部署 → up → 用户逐条眼验 → down)尚未开始,清单与开放风险记录仍需用。
⚠️ **不跑 finishing-a-development-branch**:合并决策应在实盘验收通过后再做。
验收阶段待办(计划「验收环节」节):① deploy.sh local-storage(**会重启运行中的存储服务,需用户放行**)
② 起 5273 预览 ③ raidlab.sh up ④ **用户按 44 条清单眼验** ⑤ 缺陷按 TDD 修 ⑥ down 复核基线 ⑦ 关台账 C11/C12

### 🔴 执行期计划变更(2026-07-28,已写进计划文件「执行期变更」节)
1. **Task 1 返工**:白名单改为标记文件 `/etc/nimoos/allow-pseudo-disks` 门控(用户拍板)。理由=不把测试脚手架
   漏进产品;IsDiskSupported 是「什么设备可被格式化建 RAID」的安全边界,出厂产品不该接受内存假盘。
   不用环境变量/配置项(systemd 下要改 unit / 要重启);不用 build tag(那样验证的不是出厂二进制)。
2. **Task 5 加两行**管理该标记文件(up touch / down rm),与假盘生命周期绑定。
3. **Task 5 的 cmd_down 加前置断言**解决 I-2,过滤器签名保持无参 stdin 不变。

### ⚠️ Task 3/4/5 必须知道的契约变更
`is_fake_disk` 在 Task 2 修复轮后共三道否决(顺序在读 model 之前):
  ① 名字含 `nvme` → 拒  ② 名字恰为 `.` 或 `..` → 拒  ③ 名字含 `[A-Za-z0-9._-]` 之外字符(含 `/`)→ 拒
计划原文只写了①。后续 Task 的测试若要构造非法设备名,须知道②③也会拦。

---

## ✅ 验收阶段完成 —— 2026-07-30 用户逐屏点验通过,本期关账

两轮实盘(第一轮 2×RAID1 换卷;第二轮 3 盘 RAID5 故障演练:创建向导 → `mdadm --fail` →
换盘 → 重建 → 快照面板 → type-to-confirm 删阵列)共抓出 **9 个真缺陷,全部修完**,
每条各带回归测试并**逐条做过变异验证**(撤回修复即有对应测试变红)。

**完整分层记账在 `NimoOS-UI/docs/vue3-migration-roadmap.md`@`22e4d1fc` 的 P5.5 条目**
(产品缺陷 7 / 迁移引入偏离 2 / 测试台自身 4 / 实盘证实的 5 件事 / 方法论教训 4 条),
此处不重复抄写,只留交付坐标与遗留决策。

### 交付坐标(全部已 commit,**未 push、未合并**)
| 仓 | 分支 | HEAD | 内容 |
|---|---|---|---|
| NimoOS-LocalStorage | `sp6-p5.5-raidlab` | `9d5e79b` | 白名单标记门控 + mdadm 解析器修复(faulty/spare 行)+ `MemberDisk.Slot` |
| nimo_os_docs | `sp6-p5.5-raidlab` | `dd17adf` | `raidlab.sh` 测试台 + 104 测试 + 验收清单(已关账) |
| NimoOS-Service | `master` | `425f4f0` | 裸信封容错(3 个 raid 端点)+ `RaidMemberDisk.slot` |
| NimoOS-New-UI | `master` | `5323e43` | 8 个前端缺陷修复 + 换盘看板 + 1569 测试全绿 |
| NimoOS-UI | `docs/vue3-migration-sp3` | `22e4d1fc` | roadmap 关账(仅提交 roadmap 一个文件) |

### 🔴 待用户决策:两个分支未合并
`NimoOS-LocalStorage@sp6-p5.5-raidlab` 与 `nimo_os_docs@sp6-p5.5-raidlab` 仍未合入主干。
**LocalStorage 那条尤其要处理** —— 它上面混着两类东西:
- **产品缺陷修复**(mdadm 解析器 + `Slot` 字段):已被实盘验收背书,真实用户会受益,应该进主干
- **测试脚手架**(伪盘白名单标记门控):默认关闭、出厂行为与打补丁前一致,但性质上是测试设施

留在测试台分支上意味着产品缺陷修复没进主干。合并方式(整支合 / 只挑产品修复那两个 commit)
以及是否 push,均待用户拍板 —— 用户本次只说「提交本地仓库」,故只 commit,未合并未推送。

### 设备状态
已回到基线:假盘 0 / `/proc/mdstat` 空 / `scsi_debug` 已卸载 / 标记文件已撤 /
fstab 与 mdadm.conf 零残留 / 后端 RAID 记录 0 条 / 真盘 `/DATA` 141G-282G 完好 /
重建限速已恢复出厂值 200000 KB/s / 5273 预览已停。
清理时的备份留档:`/etc/fstab.raidlab.bak.1785379678`、`/etc/mdadm/mdadm.conf.raidlab.bak.1785379678`。

### ⚠️ 工作区仍不删
交接项(未合并的两个分支、B-bis 19 后端票、P6 待办)尚未落地,`finishing-a-development-branch`
仍未跑。等合并决策做完再清理。

---

## 🔚 收尾处置(2026-07-30 用户拍板)—— 两个分支已删,交接项清零

**决定:测试脚手架不进版本库,产品里也不留运行时开关。**

- **伪盘白名单从产品代码彻底移除。** `c0d0861`/`2e8edcd` 两个 commit **未合并**,`sp6-p5.5-raidlab`
  分支**已删**(两仓皆删)。`NimoOS-LocalStorage@main` 的 `IsDiskSupported` 恢复原样,
  另新增 `TestIsDiskSupported`(`4bd5514`)**钉死「`block:scsi:pseudo` 必须被拒」** ——
  这条测试是本决定的守卫。`/etc/nimoos/allow-pseudo-disks` 运行时开关一并取消。
- **产品缺陷修复已 cherry-pick 进 main**:`9c4d0c5`(解析器丢 faulty 行)、`f933666`(`Slot` 字段)。
- **测试台移到 `nimo_os_docs/scripts/raidlab/`,整目录 gitignore**:`raidlab.sh` + 手写测试
  harness(104 例仍全过)+ `pseudo-disk.patch`。`up` 打补丁 → 构建 → 部署 → 造假盘;
  `down` 拆台 → 撑回干净版 → 再部署。幂等;LocalStorage 工作区不干净时拒绝动手。
- **验收清单归档进 `nimo_os_docs@main`**(`b6fe3d2`)—— 它是文档不是脚手架。
- **端到端实测确认出厂行为**:`down` 之后手工 `modprobe scsi_debug`,内核里假盘在场
  而后端 `avail` 仍为空。完整 up→down 循环跑通。

### 最终坐标(全部 main / master,**未 push**)
| 仓 | 分支 | HEAD |
|---|---|---|
| NimoOS-LocalStorage | `main` | `4bd5514` |
| nimo_os_docs | `main` | `b6fe3d2` |
| NimoOS-Service | `master` | `425f4f0` |
| NimoOS-New-UI | `master` | `5323e43` |
| NimoOS-UI | `docs/vue3-migration-sp3` | `5ac4bcfb` |

### 🔴 记账:测试台的耐久性风险
`scripts/raidlab/` **只存在于本机磁盘**,不在 git 里。换机器 / 重新 clone / `git clean -fdx`
都会丢。而 **P7 文件区快照套件依赖它**(`.snapshots` 只存在于 btrfs 快照卷上,单盘设备
没阵列一行都跑不起来)。做 P7 前先确认这个目录还在;丢了要按 roadmap P5.5 条目重建。

### ⚠️ 事故记录:提交时误带走别人的暂存文件
本次收尾在 `nimo_os_docs` 用了 `git add` + `git commit` 两步,而该仓有 3 个**其它会话预先
暂存**的文件(`CLAUDE.md`/`DEV_DEPLOY.md`/`scripts/deploy-ui.sh`)—— `git commit` 会带走
索引里的全部内容,于是它们被一起提交了。已 `reset --soft` 撤回并改用单步
`git commit -m "…" -- <路径>` 重做,三个文件已回到原「已暂存未提交」状态、指纹核对一致。
**这个仓早先就出过同一次事故,教训在台账里写过却仍复发** —— 凡在有他人未提交改动的仓里
提交,必须用带 pathspec 的单步 commit,不许 `git add` 后裸 commit。

### 工作区可以清理了
交接项已清零(分支已删 / 产品修复已进 main / 脚手架已 gitignore / 文档已归档)。
仅剩两项非本期待办:**后端票 B-bis 19**(删阵列不清 fstab 与 mdadm.conf,已二次复现)
与 **P6 cutover / P7**。`finishing-a-development-branch` 已无对象可跑(分支都删了)。
