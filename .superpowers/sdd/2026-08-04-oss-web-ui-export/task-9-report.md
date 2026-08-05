# Task 9 报告 —— 类 2 替换:桌面默认布局重排

## 做了什么

只改了三处,都在允许范围内:

- 新建 `oss/files/defaultLayout.ts`(brief Step 3 给的坐标,逐字照抄,15 项)。
- `oss/manifest.mjs`:`REPLACE` 数组从 `[]` 填成 1 条,带私有侧哈希钉。
- `oss/tree.test.mjs`:追加 `describe('类 2 · 桌面默认布局', …)`,4 个 it(brief Step 1 原文逐字抄入)。

未碰 `src/**` 任何产品代码(Step 6 负向验证期间对 `src/home/grid/defaultLayout.ts` 的临时
追加已用 `cp` 还原,详见下文)。未做 T10(MediaViewer)/T11(AddPanel)/T12(README)/T13(测试
同步)/T14(守卫白名单)的活。

## registry min/max 现场核对结果

读 `src/home/widgets/registry.ts` 逐项核对(不是抄 brief,是现场读源码):

| key | registry min | registry max | brief 给的 min/max | 一致? |
|---|---|---|---|---|
| clock | [2,1] | [4,2] | [2,1]–[4,2] | 一致 |
| storage | [2,2] | [4,2] | [2,2]–[4,2] | 一致 |
| network | [2,2] | [4,4] | [2,2]–[4,4] | 一致 |
| events | [2,2] | [2,4] | [2,2]–[2,4] | 一致 |
| gpu | [2,2] | [4,2] | [2,2]–[4,2] | 一致 |
| cpu | [2,2] | [4,3] | [2,2]–[4,3] | 一致 |

brief 给的 6 个小组件 min/max 与 registry 逐字一致,**没有越界项**,不需要 BLOCKED。

坐标表里每项的实际落位尺寸也都在范围内(手算 + 测试断言双重确认):
clock 4×2(∈[2,1]-[4,2])· storage 4×2(∈[2,2]-[4,2])· gpu 4×2(∈[2,2]-[4,2],注意 gpu 的
max 是 [4,2] 不是 [4,4],4×2 恰好压边界但不越界)· network 4×4(∈[2,2]-[4,4])·
cpu 4×3(∈[2,2]-[4,3])· events 2×4(w 必须恒为 2,brief 给的正是 w=2,h=4∈[2,4] 上边界)。

## 坐标表与 69 格的算式

15 项矩形,逐项面积:

```
clock    4×2=8   storage 4×2=8   gpu 4×2=8         → 顶部三条 24
network  4×4=16  cpu     4×3=12  events  2×4=8      → 中段三个 36
files/settings/appstore/vm/storage(app) 五个 1×1    → 5
Documents/Downloads/Media/Gallery 四个 1×1          → 4
合计 24+36+5+4 = 69
```

跑测试脚本里同款的逐格枚举(`oss/tree.test.mjs` 的第二个 it)验证:15 项、无重叠、
`cells===69`、每项 `c+w-1≤12`、`r+h-1≤8`。全部通过(见下方测试输出)。

末两行留空:15 项里 `r+h-1` 的最大值是 6(`network`/`events`/四个文件夹磁贴都止于 r6),
第三个 it 断言 `Math.max(...)===6`,通过——r7/r8 确实完全没有任何格子落入。

## 哈希钉的取法与结果

```
$ node -e "console.log(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync('src/home/grid/defaultLayout.ts','utf8')).digest('hex'))"
15da0c4b305f9cdf5cee5ce6a8126cc441d18a889eadc28681ee1b14785e87ed
```

（64 位十六进制,针对的是**私有侧当前的旧文件**——含 `PHOTO_PLACEHOLDERS` 的那份,不是
`oss/files/` 里的新文件)已填入 `manifest.mjs` 的 `REPLACE[0].privateSha256`。

## Step 5:产出树测试

```
$ pnpm exec vitest run oss/tree.test.mjs
 Test Files  1 passed (1)
      Tests  38 passed (38)
```

34(既有)+ 4(本任务新增)= 38 全绿。

```
$ node oss/export.mjs --out /tmp/t9-tree --skip-guard --no-commit --allow-dirty-oss
[oss] 3/6 应用清单(DELETE 21 · REPLACE 1 · PATCH 99)
[oss] 完成 → /tmp/t9-tree
EXIT=0
```

`/tmp/t9-tree/src/home/grid/defaultLayout.ts` 内容与 `oss/files/defaultLayout.ts` 逐字节一致
(REPLACE 生效,`applyReplace` 内部先核对哈希再 `copyFileSync`)。

## Step 6:哈希钉负向验证(重要发现,如实报告)

按 brief 给的**原文命令**执行(全程 `cp` 备份/还原,未碰 `git checkout`/`git stash`/`git reset`):

```
$ F=src/home/grid/defaultLayout.ts
$ cp "$F" /tmp/probe-backup.ts
$ printf '\n// probe\n' >> "$F"
$ node oss/export.mjs --out /tmp/oss-probe2 --skip-guard --no-commit
[oss] 1/6 前置检查
Error: /home/nimo/NimoTech/NimoOS-New-UI 工作树不干净,导出中止:
 M oss/manifest.mjs
 M oss/tree.test.mjs
 M src/home/grid/defaultLayout.ts
?? oss/files/
    at checkClean (file:///home/nimo/NimoTech/NimoOS-New-UI/oss/apply.mjs:15:11)
EXIT=1
$ cp /tmp/probe-backup.ts "$F" && rm /tmp/probe-backup.ts
$ git status --porcelain -- "$F"
（空)
```

**exit code 如预期是 1,且已完全靠 `cp` 还原**(`git status --porcelain -- "$F"` 输出为空)。
但**实际报错文本与 brief 预期的不同**:brief 预期看到 `applyReplace` 里的
`私有仓的 … 变了(sha256 …)` 消息,实际先撞上的是 `checkClean`(`apply.mjs:11-17`)的
"工作树不干净"检查。

**原因**:`export.mjs` 用 `git archive HEAD | tar -x` 取源(见 `export.mjs` 第 2 步注释),
不是直接读工作区文件。`applyReplace` 的 sha256 校验作用于**从 HEAD 归档出来的内容**。
本任务的探针只是 `printf >>` 追加未提交的改动,这类改动根本不会进入 `git archive HEAD`
的产物——但 `checkClean`(`export.mjs` 第 1 步,先于 3/6 应用清单)会先看到工作区脏了并直接
`throw`,exit 1 提前发生,`applyReplace` 那一步根本没跑到。

这仍然满足"私有侧一改就报错、不会静默盖旧文件"的设计目标(而且是更早的一道防线),
但严格说**这次探针并没有实际验证 `applyReplace` 内部的 sha256 比对逻辑本身**——它验证的是
`checkClean` 会拦住任何未提交改动。若要让改动"穿过" `checkClean` 走到 `applyReplace`,
必须先 `git commit`(让 HEAD 真的变化、工作区变干净),但那样一来"用 cp 完全还原"就做不到
(commit 已经进了历史,cp 只能还原文件内容,不能撤销 commit,而本任务铁律又明确禁止
`git reset`/`checkout`/`stash`)。

为了不违反"不碰 git 历史"的铁律、同时仍然把 `applyReplace` 的哈希比对逻辑本身**跑一遍**,
额外在 `/tmp` 内(不碰本仓库任何文件)直接 `import` 项目自己的 `oss/apply.mjs`,用一个
伪造的错误 `privateSha256` 对着一份合成的"私有侧漂移后"文件调用 `applyReplace`:

```
$ node -e "
import('./oss/apply.mjs').then(({ applyReplace }) => {
  ...对 /tmp 下的合成 target 目录调用 applyReplace(target, [{ path: 'src/home/grid/defaultLayout.ts',
      from: 'defaultLayout.ts', privateSha256: 'deadbeef...' }], /tmp 下的 files 目录)
})
"
THREW AS EXPECTED:
私有仓的 src/home/grid/defaultLayout.ts 变了(sha256 b648c5a63f9f… ≠ 钉住的 deadbeefdead…)。
请复核 oss/files/defaultLayout.ts 是否需要同步,然后把 manifest.mjs 里的 privateSha256 更新为新值。
⚠️ 禁止为了让脚本跑过而删掉哈希钉 —— 那会让这条路重新变成哑火。
```

这条独立于本仓库的合成验证证实:`applyReplace` 的哈希比对逻辑本身完全按设计工作,报错文本与
brief 预期逐字一致。**结论**:哈希钉这道防线是双重的——`checkClean` 挡未提交的私有侧改动,
`applyReplace` 挡"已提交但没同步哈希钉"的私有侧改动(这才是设计文档强调的"REPLACE 天生会
哑火,必须靠哈希钉"要防的真实场景:私有主干正常提交了一次改动,但没人记得回来更新
`manifest.mjs`)。本任务用的是 brief 给的探针手法(未提交追加),只触发了前一道防线;
后一道防线用独立合成脚本单独验证过,同样能拦下。

## Step 7:按指示跳过

未对产出树跑 `pnpm install`/`pnpm dev`/`vue-tsc`/`pnpm build`/截图——遵照指示,T10-T13 未完成
前产出树编译不过是预期状态,眼验已挪到 T15。

## 自查结论

1. 新文件不含 `PHOTO_PLACEHOLDERS`/`kind: 'photo'`/`key: 'ai'`(第一个 it 直接断言,通过)。
2. 15 项、69 格、无重叠、不越界、末两行留空(第二、三个 it 断言,通过)。
3. 全部小组件尺寸落在 registry 各自 min/max 内(第四个 it 断言,通过;上表已逐项现场核对
   registry 原文,不是照抄 brief)。
4. 用真实 `oss/forbidden.mjs` scanner 对新文件全文扫描,0 命中。
5. 产出树 `/tmp/t9-tree` 里的 `defaultLayout.ts` 与 `oss/files/defaultLayout.ts` 内容比对一致。
6. `git status --porcelain` 只剩改动的 3 个目标文件 + 长期存在的 3 行 `design-export` 删除态,
   无其它污染。

## 遗留疑问

1. brief Step 6 的预期报错文本与实际不完全一致(见上文详细分析)——不是本任务实现有问题,是
   brief 对"未提交追加"这种探针方式命中哪一道防线的预判有误;`applyReplace` 内部的哈希比较
   逻辑本身已用独立合成脚本验证与预期完全吻合。建议后续任务(T10-T12,同样是 REPLACE 类型)
   在写各自报告的 Step 6 时留意这一点,不必再重复纠结"报错文本对不上 brief"是不是自己做错了。
