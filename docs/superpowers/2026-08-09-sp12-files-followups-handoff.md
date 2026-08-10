# SP12 Files 后续批次交接 —— 票 E · plan-b 收尾 · F10 · F3(F4 挂账)

> 2026-08-09。分支 `sp12-files-fixes`(worktree `.claude/worktrees/sp12-files-fixes`)。
> 台账:`.superpowers/sdd/2026-08-09-sp12-files-followups/progress.md`。
> HEAD `36ea94c`,分支共 29 提交(含一个把 master 合进来的合并提交)。

**五门全绿**:`vue-tsc` 0 · 全量 **683 文件/10983 例** 零失败 · oss+parity 8/155 ·
`pnpm build` 0 · 与 master 合并预演 exit 0(tree `e1f1c20`,无冲突)。

**⚠️「五门全绿」证明什么、不证明什么**:证明类型对得上、断言在回归时会真红、导出树不泄漏、
构建出得来、与 master 不冲突。**不证明任何人看过屏幕。**本批四项里,票 E / F10 / 受保护前置
的判定逻辑都有会真红的端到端断言(并逐条做过变异验证,见台账),而
**「用户看到的样子」——菜单长什么样、弹窗在浅色主题下好不好看、右键手感顺不顺——一步没验**。
下面第四节 12 步清单是唯一能把「预期」变成「核验过」的手段。

---

## 一、改了什么

### 1. 票 E:上传冲突弹窗提到 App 级(`9dedba4`)

**用户应该能看到的变化**:拖一批会撞名的文件进来 → 弹窗出现 → 这时点浏览器后退/切到别的区
→ **弹窗还在,还能回答**;回答完文件照常入队。以前弹窗跟着文件区一起被拆掉,当时在等的那一批
按「取消」处理,而**排在它后面的批次会永久挂起** —— 屏幕上什么都不剩,拖进去的文件凭空消失。

代码:新 `src/files/stores/uploadConflicts.ts`(Pinia setup store 包住原 composable,
composable 一行未改)+ 新 `src/files/components/UploadConflictHost.vue`(零逻辑)挂进
`App.vue`,与 `AppToast`、unloadGuard 并列;`Files.vue` 改读 store、模板里删掉弹窗。

**验证状态**:逻辑**是测出来的** —— `Files.conflictHostLifetime.test.ts` 三例覆盖
「拆掉视图后弹窗仍在且答案仍生效」「排队在后面的那一批仍会弹」「视图与宿主共用同一实例」,
并做过变异验证(把 `Files.vue` 改回自己 new 一份 ⇒ 三条全红)。真机上「导航走之后弹窗浮在
哪一层、会不会被别的区盖住」**未验** —— 清单第 1、2 步。

### 2. plan-b 收尾 a:受保护目录的拒绝挪到弹窗之前(`7d2bcf6`)

**用户能看到的变化**:把一个名叫 `Documents`/`AppData` 之类的文件夹拖进已有同名目录 →
**直接告诉你「位于受保护目录,已跳过」**,不再先让你回答一遍「合并/保留两者/跳过」再说不行。

代码:纯函数 `splitProtectedUploads`(`src/files/util/protect.ts`,与 store 里那条规则逐字等价),
`Files.vue:commitSelectedFiles` 在 `resolveEntries` 前分流。store 侧检查保留作最后防线。

### 3. plan-b 收尾 b:删三个孤儿 i18n 键(`81e690a`)

`filesUploadOverwrite`/`filesUploadRename`/`filesUploadSkip` —— plan-b 换代后无人引用。
**用户看不到任何变化**(这是纯清理)。`messageSyntax.test.ts` 的撞车表里那一行同步删掉,
对数 27→26。

### 4. F10:多选删除不再 all-or-nothing(`df74cc6`)

**用户能看到的变化**:选一批文件删除,里面混进受保护项(系统文件夹/已共享/挂载点)时——
- 以前:整批都删不掉,而且**先让你确认「删除 8 项」,确认完才告诉你受保护,实际删了 0 项**
- 现在:确认框直接说「确定删除选中的 6 项?另有 2 项受保护,将被跳过」,确认后删掉那 6 项、
  toast 补一句「已跳过 2 个受保护项」;**全都不可删**时不弹确认框,直接 toast 说明

代码:纯函数 `deletableEntries` + `useFileOps.remove` 改过滤 + `Files.vue:askDelete()` 统一入口
(右键删除与工具栏删除都走它)+ 新键 `filesDeleteConfirmWithProtected`。

### 5. F3:收藏项右键菜单(`98736f9`)

**用户能看到的变化**:左侧栏收藏项**右键**能出菜单了,内容与文件区列表里右键同一个文件夹**完全一样**
(重命名/删除/下载/复制路径/共享到局域网/取消收藏……),而不是只能悬停点 ×。

**⚠️ 这不是「Vue2 有我们漏做」** —— 取证见台账 §0:Vue2 侧栏同样零右键菜单。这是 roadmap 排的
新功能,机主本批明确选了它。

实现要点(为什么不是简单接一行):收藏项只存 `{name, path}`,菜单却要 `is_dir` 和
`extensions.share/mounted`。只有文件夹能被收藏 ⇒ `is_dir` 已知;`extensions` 右键时去父目录
listing 现拿,拿到前先用合成项把菜单撑起来(原生 contextmenu 是同步的,来不及先 await)。
listing 失败就一直用合成项 —— 降级,不是坏掉。动作由侧栏 `emit` 上去,`Files.vue` 用同一个
`onCtxAction` 分发,并把被点收藏项**强制**成唯一目标(否则它恰好也在列表选区里时,右键它会
作用到整个选区)。

---

## 二、开工前推翻的两条清单条目(下一轮审计别重复开工)

| 条目 | 判定 | 证据 |
|---|---|---|
| **F3 收藏项右键菜单** | **不是同步缺口**,是新功能 | Vue2 `origin/main:src/components/filebrowser/sidebar/` 整目录零 `contextmenu`/`ctxMenu`;`TreeListItem.vue:114` 只有悬停 × |
| **F4 视频封面** | **不是同步缺口,且前端做不了** | Vue2 `mixin.js:31` 的 `hasThumbImageType` 只有 7 种图片扩展名;core `grep -rn "ffmpeg\|ffprobe" --include=*.go` 零命中;`GetFileImage` thumbnail 分支解码失败会 **fall through 发原文件全量字节**(`file.go:1155-1168`)⇒ 给视频开缩略图 = 每个瓦片下载整个视频;Photos 只有按 asset id 的端点,没有按路径的 |

⇒ **F4 需要先开一张 NimoOS core 的后端票**(ffmpeg 抽帧 + 缓存,或 Photos 开按路径端点)。
前端单方面的替代方案(`<video preload="metadata">` 抽帧)会让每个网格瓦片拉视频头部若干 MB,
在 NAS 大目录上不可接受,不建议。

---

## 三、两条可迁移的教训

1. **merge/checkout 也会断 pnpm 硬链接。** 合完 master 后 `vue-tsc` 报
   `agentStore.ts:1134` 参数个数不对,而那个文件与 master 一字不差 —— git 的原子重命名换掉了
   `packages/service/` 那一侧,`node_modules/.pnpm` 还留着旧 inode 的旧代码。
   `stat -c '%i %n' packages/service/src/ai.ts node_modules/.pnpm/@nimotech+nimoos-service@*/node_modules/@nimotech/nimoos-service/src/ai.ts`
   两侧 inode 不同即可确诊,`pnpm install` 重链。CLAUDE.md 原文只把这条挂在「编辑器保存/Edit 工具」
   名下,**checkout 类操作同样触发**。
2. **泄漏守卫命中要先分清哪一种。** 本批命中 3 处 `Gallery`(我拿 `/DATA/Gallery` 当受保护目录举例)。
   上一批的命中是**真悬空引用**(注释指向被剥离的相册区文件),必须改写;这次是**纯词形碰撞**
   (`/DATA/Gallery` 是用户目录,`forbidden.mjs:230-238` 已为同类留了一批精确白名单)。
   两种修法不同:前者改写,后者可加白名单 —— 但这次夹具只需要**某个**受保护目录名,换成
   `Downloads` 比花白名单额度更便宜。
   另:**跑 oss 门前先提交**,未提交的 `src/**` 改动会让 `checkClean` 拒绝导出(`--allow-dirty-oss`
   只放行 `oss/` 下的脏),表现成另外 3 条 export 测试红,容易误判成新缺陷。

---

## 四、真机验收清单(12 步,**一步没跑**)

验收方式:本工作树起 dev server(`pnpm dev --host --port <避开 5273/5277/5288 的端口>`)。
非 cutover 期**不要** `deploy.sh`。

**票 E**
1. 拖一批会撞同名的文件进 `/files` → 弹窗出现 → **点浏览器后退离开文件区** → 弹窗**仍在**,
   仍能点「覆盖」;点完回到文件区,该文件确实被覆盖了(不是多出 `xxx(1)`,也不是什么都没发生)
2. 连着拖两批都会撞名的 → 第一批的弹窗出现后离开文件区 → 回答第一批 → **第二批的弹窗接着出现**
   (以前这一批会永久挂起、屏幕上什么都不剩)

**受保护目录前置**
3. 把一个名叫 `Documents` 的文件夹拖进已经有 `Documents` 的目录 → **直接** toast
   「「Documents/…」位于受保护目录,已跳过。」,**不弹**同名冲突框
4. 一次拖入「一个 `Documents` 文件夹 + 一个会撞名的普通文件」→ 只为那个普通文件弹一次窗,
   弹窗上写的是「第 1 项,共 1 项」(不是 2 项)

**F10 多选删除**
5. 选一批文件,里面混 2 个受保护项(如 `Documents`、某个已共享文件夹)→ 按删除 →
   确认框写「确定删除选中的 N 项?另有 2 项受保护,将被跳过。」→ 确认 → 那 N 项没了,
   受保护的两个还在,toast 补一句「已跳过 2 个受保护项」
6. 选区**全部**是受保护项 → 按删除 → **不弹确认框**,直接 toast「此项目受保护,无法删除」
7. 选区全部可删 → 确认框仍是原来那句「确定删除选中的 N 项?此操作不可恢复。」(没多出跳过那半句)

**F3 收藏项右键**
8. 右键左侧栏一个收藏项 → 出菜单,内容与在文件区列表里右键同一个文件夹**一致**
9. 菜单里点「重命名」→ 弹重命名框,改名成功后侧栏与列表都跟着变
10. **先在列表里多选几项(包含那个收藏对应的文件夹)**,再右键侧栏那个收藏项点「删除」→
    确认框只说 1 项,删掉的只有它,**列表里其它选中项不受影响**
11. 右键一个**已共享**的收藏文件夹 → 菜单里**没有**「共享到局域网」(证明父目录 listing 的
    `extensions` 真的接上了,不是只用合成项)

**主题**
12. 浅色 / 深色各看一遍第 1 步的弹窗与第 8 步的菜单:按钮、提示条、危险色项都不能白底白字或看不见

---

## 五、挂账

- **F4 视频封面** —— 见第二节,等后端票
- **`cut` 仍是 all-or-nothing**(`useFileOps.ts:89`)。与 F10 同族,本批只做了删除;
  照抄 `deletableEntries` 的模式即可,文案要另拟(剪切语义是移动)
- **plan-b「已知未修」#2/#5/#6** 未动:重传+类型不匹配会静默降级 / `:queue-index` 的取证缺口 /
  「已跳过 500 项」按条目计而非按组
- 上一批(F17/F11/F12)的 **10 步验收清单**同样一步没跑,与本文第四节可以一起验
