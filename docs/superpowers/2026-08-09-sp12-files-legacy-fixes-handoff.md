# SP12 并行批次交接 —— Files 区三条遗留缺陷（F17 / F11 / F12）

> 2026-08-09。分支 `sp12-files-fixes`，隔离在 worktree
> `.claude/worktrees/sp12-files-fixes`。设计文档：
> `docs/superpowers/specs/2026-08-09-sp12-files-legacy-fixes-design.md`。
> 本文档写于 Task 6（收尾门 + 交接文档），首次成文时 HEAD 为 `8fbecf7`；
> 六道门里两道红（Gate 2/5）经 Task 5 实现者补一个改注释的提交（`3080275`）修复后，
> 于 HEAD `3080275` 补验全部六道门，本次修订反映的是补验后的状态。
>
> **2026-08-09 追加修订（整支终审后的修复批）**：终审复核推翻了 F11 最初的诊断——清单
> 描述的用户可见缺陷从未成立（`onItemContextmenu` 在本批次之前就已把选区收窄到该缺陷永远
> 触发不到的地步）。「一、三条改了什么」的 F11 小节、「二」的 F14 同类补记、「四、真机验收
> 清单」第 6/7 步已按修正后的结论改写；新增第 11 步（窄屏顶栏挤压检查）；`Files.vue` 的
> `onShare` 注释与 `FileGridView.vue` 的滚动祖先注释也在这批一并改写，详见
> `.superpowers/sdd/2026-08-09-sp12-files-legacy-fixes/final-fix-report.md`。

**六道门现状：全绿**。首次跑收尾门时 Gate 2（全量测试）与 Gate 5（开源导出闸）因同一根因
各命中一次失败——`sp12-files-fixes` 自身新增的一个测试文件注释里两次提到 "photo"，撞上
开源导出的软禁词守卫。这是本批次（Task 5）留下的真实缺口，当时按 Global Constraints
未在 Task 6 里现场修（不改源码），只如实记录、留给合并前处理。Task 5 实现者随后用**改写
注释措辞**（不是加白名单）把它修掉了，六道门在新 HEAD 上全部补验通过。取证链与教训见下方
「三、收尾门实测数字」。

**⚠️「六道门全绿」证明的是什么、不证明什么，读这份文档前先分清**：六道门（类型检查/全量
测试/i18n parity/构建/开源导出闸/合并预演）证明的是**代码层面自洽、没有引入已知回归**——
类型对得上、单测断言的逻辑真会在回归时报红、构建产物能出、导出树不泄漏、与 master 合并不
冲突。**它们不证明任何人看过屏幕**。三条修复里，F11/F12 的核心判定逻辑有端到端单测覆盖
（断言"接到了正确目标集""发出了正确请求""toast 说对了文案"），回归了会真的变红——这部分
可以说是"测出来的"。**F17 完全不是这种情况**：jsdom 不做布局（`getBoundingClientRect`
恒返回 0），F17 唯一的自动化覆盖是一个纯源文本字符串匹配闸，只能证明"三行 CSS 规则还在、
没有被写回旧值"，**不能证明、也从未尝试证明滚动/框选在真实浏览器里表现正确**。也就是说
本批次里，**F11/F12 的"逻辑正确"是测出来的，F17 的"布局正确"目前完全是推理出来的**（根据
CSS 机制推断"应该"生效），三者的"用户能看到的变化"一段都是在描述**预期效果**，不是已核验
效果。「四、真机验收清单」10 步**一步都还没跑**——这是唯一能把"预期"变成"核验过"的手段，
在它跑完之前，不应该把这份文档读成"F17/F11/F12 已经验证好了"。

---

## 一、三条改了什么

### F17 —— 侧栏 / 面包屑跟着文件列表滚走

**用户应该能看到的变化（尚未真机核验，见下方"验证状态"）**：进 `/files`，文件多到需要
滚动时，以前左侧栏（收藏/磁盘/共享/互传）和顶部面包屑会跟着列表内容一起往下滚出屏幕，
侧栏自己的滚动条永远不出现，收藏项一多就够不着。按 CSS 机制推断，改完之后侧栏与面包屑应
钉在原位不动，只有文件列表自己滚，侧栏收藏项多时侧栏应自己出现滚动条、能滚到底。

**代码坐标**：`src/views/Files.vue` 的 `<style scoped>`：
- `.files-layout`（约 `:687`）：`min-height: 100%` → `height: 100%`
- `.files-main`（同处附近）：新增 `min-height: 0`（打通 flex 收缩链，否则子元素撑破父容器，
  封顶等于白封）
- `.files-listwrap`（约 `:695`）：`min-height: 200px` → `overflow-y: auto` + `min-height: 0`
  （接管滚动）

防复发闸：`src/views/__tests__/filesLayoutHeightCap.test.ts`（正向断言三条规则都在，反向
断言不许回退成 `min-height: 100%`，源文本字符串匹配，读盘用 `node:fs`）。

**验证状态（务必读）**：这道闸能证明的只有"这三行 CSS 源文本还在、没有被写回旧值"。
**jsdom 不做布局**——`getBoundingClientRect` 恒返回 0——所以这道闸、乃至本批次任何一个
单元测试，**都没有、也不可能证明滚动/框选在真实浏览器里真的表现正确**。上面那段"用户应该
能看到的变化"是根据 CSS 机制（`height` 封顶 + `min-height:0` 打通收缩链 + 子容器接管
`overflow`）**推理**出来的预期效果，不是已经在屏幕上看到过的效果。design doc §0 附近
（`docs/superpowers/specs/2026-08-09-sp12-files-legacy-fixes-design.md:219`）原话："F17 的
**实际布局效果**不在测试覆盖内（jsdom 不做布局），以真机验收为准"——这一条到目前为止一步
未跑，「四、真机验收清单」第 1-5、10 步专门对应这里，必须先跑完才能把上面那段"应该能看到"
改写成"已核验"。

提交：`70c24b0`；`3080275`（该闸的头部注释改写，见「三、收尾门实测数字」的教训小节，
不改断言、不改 CSS）。

### F11 —— 复核结论：清单描述的用户可见缺陷不成立；改动作为防御性收拢保留

**⚠️ 本轮终审复核推翻了 F11 最初的诊断，这里是修正后的说法，与本文档 2026-08-09 首次成文
时的措辞不同——如果读到别处还留着"迁移回归"的说法，以这里为准。**

清单原文说：此前选中了 B、C 两项，右键点未选中的 A，选「复制」，粘贴出来的却是 B、C，界面上
没有任何提示。**这条现象在 New-UI 里走不到**——`src/views/Files.vue:81-85` 的
`onItemContextmenu`（本批次之前就存在，本批次未改动这一段）在记录 `ctxEntry` **之前**就已经
调用 `files.selectOnly()` 把选区收窄成被点项（`src/files/stores/files.ts:145` 整段替换选区）。
换句话说，右键点未选中的 A 时，选区在菜单打开前就已经变成"只有 A"，旧代码的 `selectedOr()`
和 `FileContextMenu` 的 `single = selectedCount <= 1` 因此本来就会对着"只有一项"的输入求值，
结果与 Vue2 规则一致——**清单描述的这个用户可见缺陷从未存在过**，证据坐标就是
`Files.vue:81-85` + `files.ts:145`。

本批次仍然值得保留这次改动，但理由要换：把"有效目标集"的判定收拢到一处纯函数
（`contextTargets`），让 `onCtxAction` 的每个动作分支和菜单形态都读同一个结果，消灭了
`delete` 分支曾经内联的第二份重复逻辑，是**防御性的单点真相收拢**，不是修复一个用户能碰到
的 bug。**用户看不到任何行为变化**——改完之后：选中 B、C 右键点 A → 菜单呈单项态，动作只
作用于 A；右键点选区内的 B → 菜单呈多选态，动作作用于 B、C——这两条**在改动前后都成立**，
是既有行为，不是新引入的正确行为。

**代码坐标**：
- 新建纯函数 `src/files/util/contextTarget.ts`：`contextTargets(entry, selected)`，
  复刻 Vue2 `ContextMenu.vue:271-279` 的判据（选区多于一项且被点项在选区内才用选区，否则
  只用被点项）
- `src/views/Files.vue`：`selectedOr` 换成基于 `contextTargets` 的 `ctxTargets`，
  `onCtxAction` 的 `copy`/`cut`/`download`/`delete`/`share` 各分支统一取它的返回值
  （`delete` 原本是内联的第二处实现，一并收编）
- `src/files/components/FileContextMenu.vue`：`selectedCount` prop 改喂**有效目标集**的
  长度，不再是原始选区条数

提交：`4592db2`（纯函数）、`69d8fcf`（测试描述译英）、`e22b106`（Files.vue 接线）、
`ce85005`（菜单 prop 断言改读子组件实收值而非父组件计算属性）。

**验证状态**：这条的核心判定逻辑**是测出来的**——`contextTargets` 的四种组合有纯函数
单测，`FileContextMenu` 的 `selectedCount` prop 有组件测断言菜单形态跟着有效目标集走，
`Files.vue` 层还有端到端断言（选中 B、C 右键点 A 点复制 → 断言剪贴板 `operateObject` 里
只有 A）——这三层任何一层回归都会真的让测试变红。**这些端到端断言最初有一个取证缺口**：
它们直接写 `(w.vm as any).ctxEntry = a` 来构造"选区仍是 B、C 但 ctxEntry 是 A"这个状态，
而这个状态 UI 自己永远到不了（进菜单前选区已被收窄）——也就是说测试证明的是"如果走到这个
状态，逻辑是对的"，没有证明"UI 真的会走到这个状态"。本轮终审后已在
`src/views/Files.contextTarget.test.ts` 补了一个走真实路径的测试：对渲染出的行元素派发
真实 `contextmenu` DOM 事件（用 `[data-path]` 定位），断言选区确实收窄成被点项、随后的
`copy` 只作用于它——这个测试记录的是"通过 UI 能达到的真实契约"，用倒置
`onItemContextmenu` 里的判断做过强制失活验证（能真的变红，不是摆设）。**仍未覆盖的**：
菜单在真实浏览器里渲染成单项态是否真的"看起来对"、右键交互本身顺不顺手——「四、真机验收
清单」第 6、7 步对应这里，同样没跑，且这两步验的是"没有回归"而不是"新增能力生效"（详见
该清单步骤本身的措辞）。

### F12 —— 多选批量共享不门控「已共享」

**用户能看到的变化**：多选一批文件夹批量共享，其中如果有已经共享过的，以前整批会因后端
`SHARE_ALREADY_EXISTS` 报错而全部失败。改完之后：有可共享的、也有已共享的 → 只共享未共享
的，toast 追加"已跳过 N 个已共享项"；全部都已共享 → 不发请求，toast 直接说明原因；全部可
共享 → 行为不变。

**代码坐标**：
- 新建 `src/files/util/shareGate.ts`：`isAlreadyShared(entry)` / `shareableFolders(entries)`
  → `{ targets, skipped }`，与单项右键菜单的门控**共用**同一判定
- `src/files/components/FileContextMenu.vue:22`：`alreadyShared` 改为调用
  `isAlreadyShared`（消除与批量分支曾经存在的判定不对称）
- `src/views/Files.vue`：`onShare` 改用 `shareableFolders(ctxTargets(entry))` 分流
- 新增 i18n 键 `filesShareSkippedShared` / `filesShareAllAlreadyShared`，
  `zh_cn.base.ts` + `en_us.base.ts` 两处都加

提交：`aa17ea1`（门控辅助函数）、`89ff85b`（Files.vue 接线 + i18n）。

**验证状态**：同样是**测出来的**——`isAlreadyShared`/`shareableFolders` 的四种分流有
纯函数单测，`Files.vue` 层有端到端断言（`createShare` 收到的路径集、toast 文案、全已
共享时断言**没有**发请求），回归了会真的变红。但真机上"toast 具体长什么样、共享成功后
UI 刷新是否顺滑"仍未核验——「四、真机验收清单」第 8、9 步对应这里，同样没跑。

---

## 二、F14 判为不成立的取证链（照抄 spec §0）

清单原文说 `deleteConnection` / `umountUsb` 不 unwrap 响应信封 ⇒ 错误信封被当成成功 ⇒
删除网络连接、弹出 U 盘失败时界面静默显示成功。**这条诊断的前提不存在。**

| 端点 | 后端实际返回 |
|---|---|
| `DELETE /v1/samba/connections/:id`（`NimoOS/route/v1/samba.go:212-238`） | 三条失败分支 = HTTP **400 / 500 / 500**（`common_err.CLIENT_ERROR=400`、`SERVICE_ERROR=500`，见 `NimoOS-Common/utils/common_err/e.go:5-6`）；成功才 200 |
| `DELETE /v1/disks/usb`（`NimoOS-LocalStorage/route/v1/usb.go:128-143`） | 三条失败分支 = `http.StatusBadRequest` / `StatusBadRequest` / `StatusInternalServerError`；成功才 200 |

而 `packages/service/src/http.ts:41` 的 `validateStatus` 是默认的 2xx-only ⇒ axios 在
4xx/5xx 上 reject ⇒ `src/files/stores/mounts.ts:61,72` 已有的 `catch` 会触发、toast 会弹。
**这两个端点从不返回「HTTP 200 + 错误信封」**，清单假设的那个形状不存在。

残留的只是一条加固项（万一后端将来改成信封报错就会静默通过），机主 2026-08-09 拍板
**不做**。清单那条应改判为「不成立」，下一轮审计免于重复开工。

**F11 后来加入 F14 同类（本轮终审补记）**：终审复核发现 F11（见「一」的 F11 小节）同属
"诊断前提不存在"这一类——清单描述的用户可见现象在当前代码上走不到。与 F14 的区别：F14 是
"后端从不返回清单假设的那种响应形状"，F11 是"上游代码（`onItemContextmenu`）已经把输入收
窄到清单假设的分支永远不会被触发的地步"——成因不同，但都是靠代码级证据（不是靠猜测或省事）
推翻的清单条目。

---

## 三、收尾门实测数字（Step 1-6 真实输出，HEAD `3080275`）

**测量归属说明**：本文档的产出者（Task 6 执行 agent）在 HEAD `3080275` 上亲自重跑并确认
了 Gate 1、Gate 4；Gate 2、3、5、6 的数字来自协调者（controller）在同一 HEAD 上的复核，
经协调者消息转述后原样写入本表，本文档产出者未亲自重跑这四项。数字本身没有理由怀疑（协调
者的复核方法与首次跑一致，且 Gate 3 的结果与首次跑吻合），但"谁量的"与"数字对不对"是两件
事，下表用「归属」列把这个区分标出来，供后续审计判断"这是一手测量还是转述"。

| # | 门 | 命令 | 结果 | 归属 |
|---|---|---|---|---|
| 1 | 类型检查 | `pnpm exec vue-tsc --noEmit` | **PASS** — exit 0，零输出 | 本文档产出者亲自重跑（`3080275`） |
| 2 | 全量测试 | `pnpm test`（前台，167s） | **PASS** — `Test Files 659 passed (659)`；`Tests 10510 passed (10510)`，零失败 | 协调者复核，转述 |
| 3 | i18n parity | `pnpm exec vitest run src/i18n/parity.test.ts` | **PASS** — `Test Files 1 passed (1)`；`Tests 9 passed (9)`（与首次跑一致） | 协调者复核，转述（与首次跑吻合） |
| 4 | 构建 | `pnpm build` | **PASS** — exit 0，`✓ built in 16.80s`（唯一提示仍是预置的 >500kB chunk 体积告警，非本批次引入，不是错误） | 本文档产出者亲自重跑（`3080275`） |
| 5 | 开源导出闸 | 见下方"Gate 5 命令换过一次"——**协调者用的是** `pnpm exec vitest run oss/` | **PASS** — `Test Files 6 passed (6)`；`Tests 141 passed (141)` | 协调者复核，转述 |
| 6 | 与 `sp12-plan-b` 的重叠面检查 | `git merge-tree --write-tree sp12-files-fixes master`（对象已改为 master，理由见下） | **PASS** — exit 0，单行 tree OID `c9338f2f608d21a8978b5e1531e75dc257bd53f4` ⇒ 无冲突 | 协调者复核，转述 |

### Gate 5 命令换过一次，跟 brief 字面不一样（如实说明，别让人重现时懵）

brief Step 5 指定的字面命令是
`node oss/export.mjs --out … --no-commit --allow-dirty-oss`——本文档产出者第一次跑收尾门
时用的正是这一条，命中了失败（见下）。修复后协调者复核 Gate 5 时改用了
`pnpm exec vitest run oss/`，报的是 `Test Files 6 passed (6)` / `Tests 141 passed (141)`，
**不是**同一条命令。两者等价的理由：`oss/tree.test.mjs`（`oss/` 目录 6 个测试文件之一）
本身就会以 `--skip-guard` 关闭和打开两种方式各跑一遍 `node oss/export.mjs`，其中"不带
`--skip-guard`"那次跑的正是同一套泄漏守卫逻辑；`vitest run oss/` 是更细粒度的等价形式
（顺带跑了 export 相关的其余 5 个测试文件），不是另一套判定标准。若要**逐字复现** brief
的 Step 5，应该跑：
```bash
node oss/export.mjs --out /tmp/claude-1000/oss-check --no-commit --allow-dirty-oss
```
本文档产出者在修复前用这条命令跑出过失败（exit 1，见下方教训小节的原始命中），修复后
未逐字重跑这一条（转述的是协调者用 `vitest run oss/` 跑出的结果）——如果需要严格按 brief
字面命令复现"当前是绿的"这个结论，请重新跑一次上面这行。

### Gate 2 / Gate 5 首次跑时的失败，及修复方式（教训：可迁移的经验，别丢）

首次跑收尾门时（HEAD `8fbecf7`），`pnpm test` 里唯一红的测试文件是 `oss/tree.test.mjs`，
具体用例 `泄漏守卫 > 不带 --skip-guard 也能跑通`；`node oss/export.mjs` 单独跑也是同一
失败。命中：

```
✗ src/views/__tests__/filesLayoutHeightCap.test.ts:2 [photo] // same origin and logic as photosLayoutHeightCap.test.ts in the photos area,
✗ src/views/__tests__/filesLayoutHeightCap.test.ts:11 [photo] // Unlike the photos area: photos had 11 pages each with an inner scroll container already,
```

根因：本批次 Task 5 新增的 `src/views/__tests__/filesLayoutHeightCap.test.ts`
（提交 `70c24b0`）的头部注释里用 "photo" 一词类比相册区同名守卫文件
（`photosLayoutHeightCap.test.ts`），还描述了它"11 个页面"这个细节。这是本批次
（Task 5）引入的真实缺口，不是环境噪音——Task 5 当时大概率只跑了该文件自身的
vitest，没有跑到会触发开源导出闸的路径，直到 Task 6 的全量收尾门才第一次暴露。

Task 5 实现者用提交 `3080275`（"reword layout-cap guard comments to drop cross-area
reference"）修复：**只改了注释措辞，断言与 CSS 一字未动**——技术内容（双向检查、为什么
三条 CSS 规则是一个整体、jsdom 的局限、为什么要用 `node:fs`）原样保留，只是不再点名
"photos 区" 或该区的任何文件。

**为什么是改写措辞，而不是像其余 40+ 条先例那样往 `oss/forbidden.mjs` 加一条精确白名单**
——这是本条真正该被记住、可迁移到别处的教训：`forbidden.mjs` 里现存的每一条 `photo` 白
名单，命中的都是**偶然的字面碰撞**（用户路径 `/DATA/Photos`、测试夹具文件名
`photo.jpg`、大小写敏感性测试的关键字表……），词面上出现 "photo" 但语义上跟相册 app 毫无
关系。而这次的两行注释不是偶然碰撞，是**真的在跨区引用一个会被开源导出整个剥离掉的文件**
——相册区在导出树里根本不存在，这条引用对着一个开源读者打开就是**悬空引用**（指向一个不
存在的文件、描述一个读者验证不了的细节）。往 `forbidden.mjs` 加白名单只会把这个真实缺陷
盖住，让守卫对着一个货真价实的问题装哑巴；改写措辞才是对症的修法。**一条通用规律**：
**守卫注释里只要指向一个会被剥离的区域，就会触发泄漏守卫——这不是误报，是该被修的信号，
遇到同类命中先检查是不是这一种，再决定改写还是加白名单。**

### Gate 6 的说明

按 brief 字面执行 `git merge-tree --write-tree sp12-files-fixes sp12-plan-b`：

```
exit=1
merge-tree: sp12-plan-b - not something we can merge
```

**`sp12-plan-b` 分支已经不存在**——查 `git log --all --oneline` 发现 master 上已有提交
`9100418 Merge sp12-plan-b: same-name conflict dialog, upload conflicts and folder merge`
（2026-08-09 13:15:27，即本任务开工前后），说明 plan-b 的 T1/T7/T8 已经合入 master，
分支与其 worktree 按本仓惯例被清理掉了。brief 撰写时 plan-b 仍在进行中的前提已经不成立。

为了不让 Gate 6 白跑，额外做了一次等价的实质性检查——`sp12-files-fixes` 与**当前
master**（已经包含 plan-b 的改动）的合并预演。这次预演跑了两遍：一遍在本分支修复
Gate 2/5 之前（HEAD `8fbecf7` 对 master `9100418`），一遍在修复之后（HEAD `3080275`
对同一个 master），两遍都是：

```bash
git merge-tree --write-tree sp12-files-fixes master
```
```
exit=0
```

第一遍 tree OID 为 `dc2ecbcf2e2bb661bdd0bf54cc35d478af2e8769`，第二遍（`filesLayoutHeightCap.test.ts`
注释改写之后）为 `c9338f2f608d21a8978b5e1531e75dc257bd53f4`——两次 OID 不同是预期的
（本分支内容变了，tree 自然不同），**两次都是 exit=0 + 单行 OID，结论一致：无冲突**。
spec §7 记录的重叠面（`Files.vue` 与两个 i18n base 文件，plan-b 的 hunk 落在
16-31/204-245/492-514/621-639，本期落在 86-145/687-695）在 plan-b 已合入 master 之后
依然验证为不相交。

### 已知无害噪音（未追查，按 brief 要求如实记录）

- 全量测试里出现 jsdom `Not implemented: navigation` 警告，来自不相关的相册区测试
  （`src/photos/stores/__tests__/favorites.test.ts` 的 `exportZip`）
- `/tmp/nimoos-www-xxxxx 不存在或当前用户不可写` 报错同样来自上述相册测试的 `exportZip`
  分支，与本批次无关
- 未在孤立运行下复测 `DesktopContextMenu.test.ts`（已知在全量套件里通过，单独跑才会因
  reka-ui 测试隔离问题变红）——本次是全量跑，未受影响

---

## 四、真机验收清单（照抄 spec §5，一步不删）

**状态：尚未执行，一步都没跑。** 上面「一」的三段"用户能看到的变化"全部是根据代码/CSS
机制推理出的预期效果，不是已经在真实设备上看到过的效果——本清单跑完之前，请勿把它们当
"已验证"。

1. 进 `/files`，找一个文件多到需要滚动的目录，向下滚 —— 左侧栏与面包屑钉住不动
2. 侧栏收藏项加到超过一屏 —— 侧栏自己出现滚动条、能滚到底
3. **网格视图**下滚到很深处 —— 不出现空白区（虚拟滚动窗口没算错）
4. **网格视图**在列表下方空白处起框选，拖过若干卡片 —— 框线跟手、选中项与框覆盖范围一致
5. 滚到中途再起框选 —— 同上（这一步专查滚动容器换了之后的坐标系）
6. 选中 B、C 两项，右键点未选中的 A → 选区收窄为只有 A、菜单呈**单项**态（有重命名/复制
   路径），点「复制」再粘贴 → 粘出来的是 **A**。**这一步验的是既有行为没有被破坏，不是
   一项新能力**——`onItemContextmenu` 早在本批次之前就会在开菜单前把选区收窄成被点项，
   本批次只是把"有效目标集"的判定收拢到一处（`contextTargets`），没有改变这一步能观察到
   的结果；跑不出预期现象说明部署没生效或另有回归，不能反过来把"看到了"当成"新行为终于
   生效了"
7. 选中 B、C，右键点选区内的 **B** → 保留整个选区、菜单呈多选态，点复制 → 粘出 B、C。同
   上，这也是既有行为，本步验证的是没有回归，不是验证新能力
8. 选中若干文件夹，其中 2 个已共享 → 点共享，只有未共享的被共享，toast 说明跳过了 2 个
9. 选中的文件夹**全部**已共享 → 点共享，不发请求，toast 说明都已共享
10. 浅色 / 深色主题各看一遍第 1、3 步（布局与滚动条）
11. 窄屏（≤768px）打开 `/files` —— 顶栏（`.files-topbar`）在这个宽度下 `flex-direction:
    column` 且允许换行（`Files.vue:735-739`），F17 把它钉住之后不再随内容滚走；确认它换行
    后占的高度没有把列表区挤没——文件列表仍有可用空间，不是被顶栏吃满整个视口

---

## 五、未做的相邻项

- **F10（多选删除 all-or-nothing）** —— 与 F12 同属「批量操作遇不合格成员」语义。机主
  2026-08-09 明确本期只做三条，F10 留给后续期。本期在 F12 上定下的处理方式
  （`shareableFolders` 式的「过滤 + 告知跳过数」）可以直接复用到删除路径上，不需要重新设计
  语义，只需要照抄模式接一遍线。
- **F3 / F4** —— 仍在 `NimoOS-UI/docs/vue3-pending/01-文件区-SP4.md` 清单上，本期未涉及，
  未做任何取证或改动。

### 本批次评审中被判定推迟的小项（未丢失，逐条列出）

1. 测试文件各自建 `createI18n`，与 `vitest.setup.ts` 已全局注册的重复，产生
   `[Vue warn]` 噪音——本仓库范围性存量问题（200+ 文件），本批次未引入也未清理。
2. `Files.vue` 里 `SelectionToolbar` 的 `@copy`/`@cut`/`@download` 处理器仍内联
   `files.entries.filter(e => files.isSelected(e.path))`，没有改读新增的 `selectedEntries`
   计算属性。不是正确性问题——这几条路径从不带被点项，F11 修的单/多选歧义在这里不适用——
   只是遗留的 DRY 机会。
3. 若 `shares.create()` 在部分跳过的批次上失败，"跳过 N 个"的 toast 不会触发，用户只会看到
   通用失败 toast，丢失跳过上下文。
4. `src/files/util/protect.ts:9` 的 `canOperate` 门控自带一份字面量
   `extensions?.share?.shared === 'true'` 比较，是「已共享」语义未来收紧时需要记住的第二处。
5. F17 防复发闸按 CSS 规则整行字符串精确匹配，无害的格式重排会打红它（与相册区同款闸的
   已知取舍一致）。
6. F17 的闸**没有**锁 `.files-listwrap` 的 `min-height: 0`——只锁了 `overflow-y: auto`
   存在、`min-height: 200px` 消失。以后如果这条声明被误删，会在更深一层静默复发
   flex-burst 问题，闸抓不到。

---

## 六、合并纪律

- **文件重叠面**：spec §7 记录的重叠只有 `src/views/Files.vue` 与两个 i18n base 文件。
  plan-b 的 hunk 落在 `Files.vue` 的 16-31 / 204-245 / 492-514 / 621-639，本期落在
  86-145（F11/F12）与 687-695（F17），互不相交。
- **现状变化**：`sp12-plan-b` 在本任务执行期间已经合入 master（提交 `9100418`），分支与
  worktree 已按惯例清理。所以 brief 里"与 plan-b 并行"的说法目前已经变成"本分支是后合入
  master 的一方"。
- **Gate 6 实测结果**：`git merge-tree --write-tree sp12-files-fixes master` → exit 0，
  单行 tree OID（HEAD `3080275` 对 master `9100418`：`c9338f2f608d21a8978b5e1531e75dc257bd53f4`）
  ⇒ 与当前 master（已含 plan-b）无冲突。
- **Gate 2/5 的缺口已在本分支修复**：`filesLayoutHeightCap.test.ts` 那两行含 "photo" 的
  注释已被提交 `3080275` 改写掉（不是加白名单，理由见「三」的教训小节），HEAD `3080275`
  上六道门全部重新跑过并全绿，不再是遗留给合并后处理的缺口。
- **"后合的一方必须在合并结果上重跑全套门，不能拿各自分支上的绿当数"——这条约束现在具体
  落在 `sp12-files-fixes` 身上**：`sp12-plan-b` 已经先合入了 master，所以"后合的一方"
  就是本批次。上表 Gate 1-6 的六个结果，是在**本分支自己的 HEAD**（`3080275`）上跑出来
  的，不是在"本分支合入 master 之后的结果树"上跑的——真正合并（不是 `merge-tree` 的只读
  预演，而是实际执行 merge/生成合并提交）完成后，必须在**合并结果**上把 Gate 1-5 重新跑
  一遍，不能因为"这份文档说本分支绿、master 也绿"就假定合并后自动绿。
