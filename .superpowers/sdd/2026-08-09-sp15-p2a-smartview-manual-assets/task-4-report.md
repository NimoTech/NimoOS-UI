# SP15-P2a Task 4 报告 —— 收尾门 + 验收清单 + 一个carried-in 缺陷修复

分支 `sp15-photos-moments`,工作树 `.claude/worktrees/sp15-photos-moments`。

## 提交

| SHA | 主题 |
|---|---|
| `d32dedf` | fix(photos): give the moment detail page its own [data-selected] rule |
| `64e8486` | fix(oss): register this task's new view test in the leak guard's DELETE list |
| `c908ab2` | docs(sp15): record the P2a gate results and the acceptance list |

## Part A — 携带修复:`PhotosMomentDetail.vue` 的 `[data-selected]` 死标记

**问题**(Task 3 顺手发现,控制器已核实):`PhotosMomentDetail.vue` 的两个网格
(:700 Featured、:730 All photos)一直就在瓦片上绑 `:data-selected`,但仓库里现存的每一条
`[data-selected]` CSS 规则都锁在**另一个组件**自己的 scoped 样式里
(`PhotosGrid.vue` / `PersonAssetGrid.vue` / `PhotosLibraryPicker.vue`),而这一页渲染的是
它自己的 `.tile` 元素——scoped 样式不跨组件边界,所以选择态下点选照片**完全没有视觉反馈**,
用户能感知到的真缺陷。

**修法**:在 `PhotosMomentDetail.vue` 自己的 `<style>` 块里,紧跟在既有的
`.sv-grid-photos .tile img { ... }` 之后,补上与 `PhotosSmartViewDetail.vue`(上一个任务
刚拿到的同一条规则)完全同源的两条规则:

```css
.sv-grid-photos .tile[data-selected="true"] { outline: 3px solid var(--accent); outline-offset: -3px; }
.sv-grid-photos .tile[data-selected="true"]::before {
  content: ""; position: absolute; inset: 0; z-index: 2;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}
```

蒙版颜色用 `color-mix(in srgb, var(--accent) 20%, transparent)`,与 `PhotosSmartViewDetail.vue`
的写法一致(而不是自造第二种视觉语言)。

## 测试:`src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts`

两条用例:

1. **属性真的到达 DOM**:mount 组件,进入选择态,点一张瓦片,断言
   `tile.attributes('data-selected')` 从 `'false'` 变成 `'true'`(未选中的另一张瓦片保持
   `'false'`)——沿用本仓既有先例(`PersonAssetGrid.test.ts:192`、
   `PhotosPersonDetail.test.ts:831` 都是同样的字符串断言,不是布尔)。
2. **样式表里真的有一条能命中它的规则**:用 `node:fs` 读 `PhotosMomentDetail.vue` 的原始
   文本(不用 `?raw` 导入样式表——本仓 `selectPopup.test.ts:32` 已经记录过 `?raw` 对纯
   `.css`/`.scss` 恒为空串这个坑;本文件虽是 `.vue`、`?raw` 对它本身能用,但既然 brief
   明确要求 node:fs,就按字面执行,不留歧义空间),提取 `<style>` 块、剥注释、用与
   `color-guard`/`selectPopup.test.ts` 同款的 `[^{}]+\{[^{}]*\}` 规则切分,断言存在一条
   选择器同时命中 `.tile` 与 `[data-selected]` 的规则。

**测试在没有修复时确实会红**(已实测验证,不是推断):

```
$ git stash -- src/views/PhotosMomentDetail.vue
$ pnpm exec vitest run src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts
 ✗ carries its own [data-selected="true"] rule reachable from a .tile element
   AssertionError: no selector in this file's own <style> block can match .tile[data-selected]
 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
$ git stash pop
$ pnpm exec vitest run src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

（第一条用例——属性到达 DOM——在修复前后都是绿的,因为属性绑定本身从 P1 起就存在;
真正证伪修复的是第二条。）

回归检查:`pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/views/__tests__/PhotosSmartViewDetail.test.ts`
—— 2 文件 / 130 例全绿(既有覆盖一行未破)。

## Part B — 六道门(工作树干净时复跑)

| 门 | 命令 | 结果 |
|---|---|---|
| 类型 | `pnpm exec vue-tsc --noEmit` | clean,退出码 0,零输出 |
| 测试 | `pnpm test` | **682 文件 / 10849 例全绿** |
| i18n 对齐 | `pnpm exec vitest run src/i18n/parity.test.ts` | 1 文件 / **9 例全绿** |
| 开源导出 | `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss` | **DELETE 78 · REPLACE 4 · PATCH 258,零真实泄漏**(3 个二进制文件按预期跳过内容扫描,已在日志里逐条列出) |
| 构建 | `pnpm build` | ✓ **37.73s**(仅既有的 chunk-size 警告,与本期无关) |
| 样式守卫 | `pnpm exec vitest run src/styles` | 4 文件 / **1075 例全绿** |

### 一次真失败,已就地修掉

**第一轮 `pnpm test` 与 `oss` 门都是红的**:

- `pnpm test` 里 `oss/tree.test.mjs` 的「产物树能构建」子测试报
  `Cannot find module '../../photos/stores/moments'`——因为我新建的测试文件导入
  `src/photos/**`,而这整个域目录在产物树里被整体剥离(`oss/manifest.mjs` 的
  `'src/photos'` DELETE 条目),测试文件本身却没有被一并剥离,产物树上就成了一个
  引用不存在模块的孤儿文件。
- 单独跑 `pnpm exec vitest run oss` 报泄漏守卫命中 **18 处**,全部来自这同一个文件。

相册区的视图测试清单是**逐个文件枚举**的(不是 glob),Task 3 的报告已经记录过同一类遗漏
发生了两次(`photos.smartviewAssets.test.ts` 漏登记两次)。这是第四次同款遗漏——我自己
新建的测试文件同样没有登记进 `oss/manifest.mjs` 的 `VIEW_DELETE` 表。

修法:把 `'src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts'` 加进该表
（插在 `photosLayoutHeightCap.test.ts` 与 `PhotosPeople.test.ts` 之间,按字母序),
并更新旁边注释里的计数(20→21 view tests、17→18 under `__tests__/`)。

修复后:`pnpm exec vitest run oss` = **20 文件 / 465 例全绿**;完整 `pnpm test` 重跑 =
**682 文件 / 10849 例全绿**。

已知 flake(出现但与本期无关):jsdom `Not implemented: navigation` 噪声(来自
`favorites.test.ts` 的 zip 导出跳转);本次全量跑没有撞见 `DesktopContextMenu.test.ts`
单跑失败或 `persist.test.ts:55` 偶发红这两个。

## CSS 注释自查

对本阶段(Task 1-4)改动过的每一个文件跑了 `grep -n '\*/' <file>`,逐条读上下文确认每个
`*/` 都紧跟在完整的中文句子或英文句子末尾结束,没有一处「`*` 紧贴 `/`」提前把注释腰斩、
吞掉后面的规则。检查过的文件:`oss/manifest.mjs`、`packages/service/src/photos.ts`、
`src/i18n/{en_us,zh_cn}.photos.ts`、`src/photos/components/PhotosLibraryPicker.vue`、
`src/photos/stores/smartViews.ts`、`src/photos/util/assetToPhoto.ts`、
`src/views/PhotosAlbumDetail.vue`、`src/views/PhotosAlbums.vue`、
`src/views/PhotosMomentDetail.vue`、`src/views/PhotosSmartViewDetail.vue`,
以及本任务与前几个任务新增的测试文件。全部干净。

## Part C — 验收清单

`docs/superpowers/2026-08-09-sp15-p2a-acceptance.md`,结构参照
`docs/superpowers/2026-08-09-sp15-p1-acceptance.md`。开篇是设计文档 §2.1/§2.2 的第 0 步
（新建日期条件智能视图并置 live)与第 1 行提示（已排除分节在旧 9 个视图上永远出不来,
后端 RemoveAssets 分层)照抄。随后按加照片 / pin 角标 / 选择与移除 / 已排除分节 / 两套主题
分节列出验收步骤,并把 Part A 的携带修复列为独立的第 14 步（moments 详情页选择高亮)。

## 文件改动

- `src/views/PhotosMomentDetail.vue`(+CSS 规则)
- `src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts`(新增)
- `oss/manifest.mjs`(补登记 + 更新计数注释)
- `docs/superpowers/2026-08-09-sp15-p2a-acceptance.md`(新增)
- `.superpowers/sdd/2026-08-09-sp15-p2a-smartview-manual-assets/progress.md`(补 Task 4 条目)
- `.superpowers/sdd/2026-08-09-sp15-p2a-smartview-manual-assets/task-4-brief.md`(入库,此前未提交)

## 关注点 / 挂账

1. **本期(P2a 全部四个任务)均未推 origin、未部署、未合 master**,真机验收一步没跑——
   验收文档已写好,等待机主安排真机验收窗口。
2. **`.superpowers/sdd/.gitignore`(一行 `*`)在本任务执行期间又出现了一次**——按机主既有
   约束直接删除,未重建,未去调查是什么脚本在重建它(设计文档 §6 已点名这是
   `review-package` 脚本的已知行为,本期流程被拍板跳过逐任务评审,没有跑那个脚本,
   但文件仍然出现了,说明触发源不止那一个,值得后续留意)。
3. **验收清单第 0 步是否真的能在设备上创建出一个立即评估的日期条件视图,没有实测过**——
   本任务只核对了后端契约与设计文档的推导链路,没有访问真实设备。若第 0 步走不通,
   清单已经在「已知挂账」一节声明了「已排除 + 恢复」两条路径整体挂账的退路。
4. Part A 修复本身范围很小(2 条 CSS 规则 + 1 个测试文件),没有触及
   `PhotosMomentDetail.vue` 抽 grid 子组件这张 P1 遗留的独立票——按 brief 要求,只做
   「同款处置」,不做无关重构。
