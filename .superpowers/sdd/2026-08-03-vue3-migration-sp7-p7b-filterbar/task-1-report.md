# Task 1 报告:photosFilterUtils.ts 纯函数谓词

## 实现了什么

按简报逐字创建两个文件:

- `src/photos/util/photosFilterUtils.ts` —— 导出 `FilterablePhoto` / `ExifFilters` 两个类型,
  `photoYear` / `matchesExifFilters` / `applyExifFilters` 三个纯函数。逻辑对应 Vue2
  `NimoOS-UI src/views/Photos/photosFilterUtils.js`,逐行照抄;唯一偏离是删掉了
  `archiveIds` 形参与分支(D17/F2,理由已写在文件头注释:归档六环在 Vue2 已全死,
  New-UI 未迁归档功能)。
- `src/photos/util/__tests__/photosFilterUtils.test.ts` —— 10 个用例,覆盖 `photoYear`
  的正常/空串/Invalid Date/null-undefined 分支,`matchesExifFilters` 的单维度/AND
  语义/无日期特殊情况/null place-camera 容错,`applyExifFilters` 的列表过滤 + null/undefined
  入参容错,以及 D17/F2 回归(确认 `archiveIds` 键被忽略而非悄悄生效)。

实现前额外核对了一件事(简报里提到但未强制我验证):`Photo` 类型(`assetToPhoto.ts:267`
一带)实际字段是 `date: string`、`place: string | null`、`camera: string | null`
(见 `assetToPhoto.ts:271,294,295`),与本任务定义的 `FilterablePhoto` 结构兼容,
`date` 确实是 `toLocaleDateString('en', {...})` 产出的本地化串(`assetToPhoto.ts:336`),
与简报描述一致,没有另外发现的偏差。

## 测了什么、结果如何

只跑本任务触及的测试文件(遵照本轮的局部测试约束,未跑 `pnpm test` 全量):

```
pnpm exec vitest run src/photos/util/__tests__/photosFilterUtils.test.ts
```
结果:`Test Files 1 passed (1)` / `Tests 10 passed (10)`。

另外跑了 `pnpm exec vue-tsc --noEmit`,exit code 0(全仓类型检查,非仅本文件,但按
本轮约束这属于允许项)。

## TDD 证据

**RED**

命令:
```
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm exec vitest run src/photos/util/__tests__/photosFilterUtils.test.ts
```
先只创建测试文件、不创建实现文件,跑出的失败输出:
```
FAIL  src/photos/util/__tests__/photosFilterUtils.test.ts [ src/photos/util/__tests__/photosFilterUtils.test.ts ]
Error: Failed to resolve import "../photosFilterUtils" from
"src/photos/util/__tests__/photosFilterUtests.test.ts". Does the file exist?
...
Test Files  1 failed (1)
     Tests  no tests
```
这个失败符合预期——简报 Step 2 明确写了预期失败就是这条 import 解析错误(实现文件
尚不存在),不是测试断言失败,证明测试确实在等一个还未创建的实现。

**GREEN**

创建 `photosFilterUtils.ts` 后重跑同一条命令:
```
Test Files  1 passed (1)
     Tests  10 passed (10)
```
随后跑 `pnpm exec vue-tsc --noEmit`,exit code 0,无类型错误。

## 改了哪些文件

- 新建 `src/photos/util/photosFilterUtils.ts`
- 新建 `src/photos/util/__tests__/photosFilterUtils.test.ts`

无其他文件改动。

## 自查发现

- 实现代码与简报给出的代码逐字一致,未做任何"顺手重构"。
- 测试代码与简报给出的代码逐字一致。
- 未新增颜色字面量、未新增 i18n key——本任务是纯 TS,两条硬约束天然不涉及。
- 未超建:没有额外导出、没有额外文件、没有为"未来任务"预留的多余接口。
- 用 `grep` 核对了 `Photo` 类型定义(`assetToPhoto.ts:267` 一带),确认
  `FilterablePhoto` 与其结构兼容且 `date` 字段形态描述准确,测试断言的是真实行为
  (依赖真实的 `Date` 解析 + `Array.includes` + 字符串 split,没有 mock 掉任何被测逻辑)。
- 提交信息与简报给定的完全一致,未自行改写。

## 问题与顾虑

无。任务范围明确、代码与测试均已简报给定,未遇到需要偏离或询问的情况。
