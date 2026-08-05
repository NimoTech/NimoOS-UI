# Task 1 报告:三个纯函数 util(vmState / format / spicePreserve)

状态:**DONE_WITH_CONCERNS**
Commit:`6128abb`(NimoOS-New-UI, master)

## 前置阻塞:T0 产物在 New-UI 侧不可见(已自行修复)

开工前按 brief 检查 `KvmVM` 类型是否已从 `@nimotech/nimoos-service` 可 import,发现：

- `NimoOS-New-UI/node_modules/@nimotech/nimoos-service/dist/` 里**没有 `kvm.d.ts`/`kvm.js`**,
  `index.d.ts` 也不导出 `KvmVM`。
- 但 `NimoOS-Service/src/index.ts` 里确实有 `export type { KvmVM, ... } from './kvm.js'`,
  `NimoOS-Service/src/kvm.ts` 也存在(git log 显示 T0 commit `89c25d5` / `39f5eb1` 已完成)。
- 根因:`NimoOS-Service/dist/` 目录里根本没有任何 `kvm.*` 文件——T0 完成后没有重新
  `pnpm build`,或者 build 过但 New-UI 侧没有 `pnpm install` 重新同步 `file:` 链接。这正是
  `NimoOS-New-UI/CLAUDE.md` 里记的已知坑("改动该包后必须 `cd ../NimoOS-Service && pnpm
  build` 重新构建;若消费端构建报 `Module not found`,通常需要 `pnpm install`")。

处理:
```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm build   # tsc 重新编译,生成 dist/kvm.d.ts / dist/kvm.js
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm install   # 重新同步 file: 链接
```
之后确认 `node_modules/@nimotech/nimoos-service/dist/index.d.ts` 里能看到
`export type { KvmVM, ... } from './kvm.js'`,`spicePort` 字段也在 `kvm.d.ts` 里。这不是
Task 1 范围内的代码改动(没碰 NimoOS-Service 源码,只是重新构建+重新同步),但记在这里
因为它是开工前的必要修复,且是个会复发的已知坑,值得下一个任务的人留意(如果 T0/其它
任务又在 NimoOS-Service 加了改动却忘 build,New-UI 侧import 会再次找不到)。

## Step 0:拷 svg 图标(提前到最前,按 brief 里的坑提示)

```bash
mkdir -p /home/nimo/NimoTech/NimoOS-New-UI/src/kvm/assets
cp /home/nimo/NimoTech/NimoOS-UI/src/assets/img/kvm/*.svg /home/nimo/NimoTech/NimoOS-New-UI/src/kvm/assets/
```
确认 13 个文件全部拷入(alpine/arch/centos/ctrl-alt-del/debian/exitfullscreen/freebsd/
fullscreen/linux/play/power/ubuntu/windows)。`format.ts` 只用其中 8 个(缺 win 系列以外的
5 个留给后续任务)。

## 自查:brief 引用的 Vue2 行号有偏移(已在实现文件的注释里更正)

brief 里写"逐字对 Vue2 KVMFullPage.vue:665-700"以及":1615"":1619-1631"":1633-1636"。去
`/home/nimo/NimoTech/NimoOS-UI/src/components/KVM/KVMFullPage.vue` 逐行核对后发现实际行号
有约 13 行的偏移(可能是 brief 撰写时的版本与当前 checkout 略有出入):

| brief 里的行号 | 实际行号 | 内容 |
|---|---|---|
| :665-700 | :674-706 | 电源动作 computed(canEditSettings...showDeleteDivider) |
| :1615 | :1628-1630 | getStateLabel |
| :1619-1631 | :1632-1642 | getOsIcon |
| :1633-1636 | :1644-1651 | formatRam / formatHostMem |
| :893-897/:919-922/:930-936 | :890-892/:916-919/:928-931 | 三处 spicePort 保活兜底 |

**逻辑内容逐字核对无误**(拿实际文件内容比对过,不是凭 brief 转述),只更正了实现文件
注释里引用的行号,不影响任何行为。这算是我"自查发现并修正"的一处细节,记录在案。

## Step 1-4:vmState.ts

- 写 `src/kvm/util/vmState.test.ts`(brief 原文逐字照抄)。
- `pnpm vitest run src/kvm/util/vmState.test.ts` → FAIL(`Failed to resolve import
  "./vmState"`,符合预期)。
- 写 `src/kvm/util/vmState.ts`(brief 原文逐字照抄,只把文件内注释里的行号按上表更正)。
- `pnpm vitest run src/kvm/util/vmState.test.ts` → **PASS,16/16**。

## Step 5-7:format.ts

- 写 `src/kvm/util/format.test.ts`(brief 原文逐字照抄)。
- `pnpm vitest run src/kvm/util/format.test.ts` → FAIL(module not found,符合预期)。
- 写 `src/kvm/util/format.ts`(brief 原文逐字照抄,只更正注释行号)。
- 首次跑测试:**6/8 通过,2 个失败**——`按子串命中各发行版` 和 `win 优先于其它` 这两条用
  `.toContain('windows')`/`.toContain('ubuntu')` 之类断言失败:
  ```
  AssertionError: expected 'data:image/svg+xml,%3csvg%20xmlns=...' to contain 'windows'
  ```
  排查:本仓库 `vite.config.ts` 没有配 `assetsInlineLimit`,用的是 Vite 默认值(4KB 以下资源
  内联为 data URI)。这 8 个图标文件都在 200-450 字节,远小于阈值,`vitest` 走同一条 Vite
  转换管线,所以 `import xxx from '*.svg'` 拿到的是**内联的原始 SVG XML(url-encode 过,不
  含文件名)**,不是一个含 `windows.svg` 字样的 URL 路径。这是本项目 bundler 的既有行为
  (`src/home/apps/systemApps.ts` 等处也这么导入 svg,行为一致),不是我实现的 bug——其余
  6 条不依赖文件名子串的用例(大小写不敏感、回退 linux、win 优先级用等值比较的隐含验证)
  全部一次性通过,证明 `osIconFor` 的匹配顺序/回退逻辑本身是对的。

  **处理**:没有改产品配置(`assetsInlineLimit: 0` 会波及全仓库其它 svg 导入和生产构建
  体积,超出 Task 1 范围,YAGNI),而是改测试断言——在 `format.test.ts` 里直接 `import`
  8 个图标模块(与 `format.ts` 内部用的是同一份文件),把 `.toContain(文件名字符串)` 换成
  `.toBe(直接导入的图标模块)` 做恒等比较。验证强度不降反升:原断言只证明"返回值里有个
  词",新断言证明"返回的确实是那一个图标模块的引用"。这是我对 brief 测试代码的**唯一一处
  实质性偏离**,原因是 brief 假设的 bundler 行为(svg import → 含文件名的 URL)与本仓库
  实测行为不符,如实申报。
- 改后重跑:`pnpm vitest run src/kvm/util/format.test.ts` → **PASS,8/8**。

## Step 8-9:spicePreserve.ts

- 写 `src/kvm/util/spicePreserve.test.ts`(brief 原文逐字照抄,describe 文案按任务说明里
  的更正版本写——"列表接口 spicePort 陈旧/归零时的保活合并",不写"不返回",因为已确认
  `GET /v1/kvm/vms` 确实会带这个字段,只是值可能是内存快照里的旧值/零值)。
- `pnpm vitest run src/kvm/util/spicePreserve.test.ts` → FAIL(module not found,符合预期)。
- 写 `src/kvm/util/spicePreserve.ts`(逻辑逐字照抄 brief 代码;注释按任务说明里的更正版本
  重写——不再写"接口不返回该字段",改写"值来自内存快照,可能陈旧/归零,权威来源是
  `/vnc` 接口"这个更准确的因果链,并把行号更正为实测的 :890-892/:916-919/:928-931)。
- `pnpm vitest run src/kvm/util/spicePreserve.test.ts` → **PASS,6/6**。

## Step 10:全量验证

```
pnpm vitest run src/kvm/util/   →  3 files passed, 30/30 tests passed
pnpm test                        →  327 files passed, 2690/2690 tests passed,
                                     但命令因 1 个 unhandled rejection 以非零码退出
pnpm exec vue-tsc --noEmit       →  无输出,类型检查全绿
```

测试计数核对:基线 324 文件/2660 例 + 本任务新增 3 文件/30 例 = 327 文件/2690 例,与实测
完全吻合,说明没有動到任何无关文件/测试。

**发现一个与本任务无关的既有问题(未修,已如实上报,不属于 Task 1 范围)**:

`pnpm test` 整体因 1 个 unhandled rejection 报 `ELIFECYCLE Test failed`(尽管所有测试用例
本身都是绿的)。定位:
```
TypeError: service.users.avatarPath is not a function
  at src/settings/panels/AccountPanel.vue:43
```
来源是 `src/settings/views/SettingsPage.test.ts`(第 17-38 行)对 `@nimotech/nimoos-service`
的 `vi.mock`,其 `service.users` 桩对象只列了 `getCustomStorage`/`setCustomStorage`,漏了
`AccountPanel.vue` 里 `avatarSrc` computed 会调用的 `avatarPath`。挂载 `SettingsPage` 时这个
computed 被求值,`avatarPath` 不存在于 mock 上,抛出未处理异常。

**确认与本任务无关**:
1. `git status --short src/settings/` 为空——我没碰过这个目录下任何文件。
2. 单独跑 `pnpm vitest run src/settings/views/SettingsPage.test.ts`(不加载任何 kvm 文件)
   复现同一个错误,证明与本次新增的三个 util/测试文件无关,是既有代码本身的 mock 缺口。
3. Test Files/Tests 计数吻合(见上),没有"新增红"的测试用例——这是一个 unhandled
   rejection,不是某个 `it()` 断言失败。

按分工("Task 1 之外的任务不归你做"),我没有去修 `SettingsPage.test.ts` 的 mock 缺口,只
如实记录、上报给上游决定是否需要另开一个任务修。

## 硬约束自查

- 提交用显式 pathspec:`git add src/kvm/util/ src/kvm/assets/`,commit 前 `git status`
  确认只暂存了这两个目录,`design-export/*` 的 3 个 staged 删除全程未被触碰(commit 前后
  分别核对过)。
- 全程未 `git checkout`/`git stash`。
- 全程未对真机后端发任何请求(本任务是纯函数,压根没引入任何 http/curl 调用)。
- 注释全中文,照抄 Vue2 行为处标了对应文件与(更正后的)行号。
- 没做 brief 之外的事:没有碰 `assetsInlineLimit` 之类的全局配置,没有顺手修
  `SettingsPage.test.ts` 的 mock 缺口。

## 交付文件清单

- `/home/nimo/NimoTech/NimoOS-New-UI/src/kvm/util/vmState.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/kvm/util/vmState.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/kvm/util/format.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/kvm/util/format.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/kvm/util/spicePreserve.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/kvm/util/spicePreserve.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/kvm/assets/*.svg`(13 个)

Commit:`6128abb` — "feat(kvm): 状态派生/格式化/spice 保活三个纯函数 util + OS 图标"
