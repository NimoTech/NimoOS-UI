# SP8-P4 Task 3 复审(修复轮 1)—— `mcpErrorKey.ts`

范围:`39f7e44..HEAD`(commit `ae161ca`),只核首轮评审那 1 条 Important 是否解决 + 该 diff 内有没有新破坏。不漫游到其余范围。

## 待核发现

> Important —— 裸字符串 body / 数组 body / `error_key: null` / 502+非常规 body 四种边界形状,靠 `typeof`/`Array.isArray` 类型防御安全兜住但 `mcpErrorKey.test.ts` 无对应用例。

## Verdict:**ADDRESSED**

逐条核对协调者的四点要求:

1. **四种形状是否都有用例** —— 是。diff(`p4-task-3-rereview1-package.md`)新增 7 条:
   - 裸字符串 body:`saveServerErrorKey`(test.ts:48-52)、`parseCommandErrorKey`(test.ts:100-104)
   - 数组 body:`saveServerErrorKey`(test.ts:55-60)、`parseCommandErrorKey`(test.ts:105-110)
   - `error_key: null`:`toTestView`(test.ts:164-168)
   - 502+非常规 body:`toTestViewFromError` 两条——非常规对象 body(test.ts:192-196)、裸字符串 body(test.ts:197-201)

2. **四个函数是否都覆盖了该碰到的形状** —— 基本是,按形状与函数的实际关联性合理分配:
   - 裸字符串/数组:只在 `saveServerErrorKey`/`parseCommandErrorKey` 补(两者共用 `rawMessage`,都从 `e.response.data` 取值,是这两种形状真正的入口)。`toTestView` 早已有 `toTestView('nope')`(裸串,pre-existing)覆盖同类场景;`toTestViewFromError` 的裸串场景由新增的「502+裸串」间接覆盖了 `data` 取值链的类型防御(见下方"次要观察")。
   - `error_key: null`:只有 `toTestView` 涉及 `error_key` 字段,合理只放这一处。
   - 502+非常规 body:只有 `toTestViewFromError` 有 502 判定逻辑,合理只放这一处,且两条子形状(对象/字符串)都补了。
   - 这个分配符合"形状只在真正会撞到它的函数里测"的原则,不是偷懒漏测。

3. **断言是否为强断言** —— 是。通读全部 7 条新增用例(`mcpErrorKey.test.ts:48-60, 100-110, 164-168, 192-201`),每条都是"① 兜底键相等 + ② `JSON.stringify(...).not.toContain(...)`"双重断言,**未发现任何 `.not.toBeNull()` 或"只断言存在"类弱断言**。

4. **新用例是否有判别力(我自己独立 RED 探针)**:
   - 探针 A(单独改动,不复用报告的组合突变):把 `toTestViewFromError` 里
     `if (status === 502 || bodyError === 'agent unreachable')` 的 `status === 502 ||` 删掉,只留 `bodyError === 'agent unreachable'`。
   - 结果:`pnpm exec vitest run src/ai/util/mcpErrorKey.test.ts` → **精确报红 2 条**(且只有这 2 条):
     - `toTestViewFromError —— 抛出的错误 → 视图 > 502 但 body 形状不是预期的那个(非常规对象)→ 仍判 agentDown,不泄漏 body 内容`
     - `toTestViewFromError —— 抛出的错误 → 视图 > 502 且 body 是裸字符串 → 仍判 agentDown,不泄漏该字符串`
     其余 34 条不受影响(含前例"502 agent unreachable"仍绿,因为它的 body 恰好有 `error:'agent unreachable'` 字段能命中另一半 `||` 条件)。
   - 还原:`cp` 备份文件精确还原 → 复跑 `Tests 36 passed (36)` → `git status --short` 无输出。
   - 补充观察(非本次判定依据,如实记录):我先复现了报告 round-2 描述的"`rawMessage` 加 `?? String(data)` 兜底"单独这一处突变,发现**单独**改这一处对 36 条测试**毫无影响**(全绿)——因为 `saveServerErrorKey`/`parseCommandErrorKey` 的兜底分支是硬编码 `return 'aiCfgSaveFailed'`/`'aiMcpSrvParseFailed'`,不读 `s` 的值,`s` 被污染成 `'a,b'` 也不影响返回值。报告里真正报红的是**两处联动**(`rawMessage` 加 `String(data)` **同时** 兜底分支改成 `return s || 'aiCfgSaveFailed'`)。这与报告原文描述一致(报告确实写了是"两轮/多处联动改动"),不是报告的错误,只是提醒:单看某一行 typeof 防御未必能孤立复现报告的 RED,需要连同兜底逻辑一起看,报告本身对此有如实记录,不构成新发现。

**结论**:四点要求全部满足,判 **ADDRESSED**。

## 修复 diff 内的新破坏

**None.** 逐行读了 `p4-task-3-rereview1-package.md` 的完整 diff(`test.ts` +49 行,`ts` 1 行注释),以及当前仓库里两个文件的实际内容(与 diff 对应一致):
- 生产代码改动只有 1 行,是纯注释(见下方独立核实)。
- 测试新增的 7 条断言逐条读过,选值(`'plain text error'`、`['a','b']`、`error_key: null`、`{unexpected:'LEAKED-UNEXPECTED-SHAPE'}`、`'LEAKED-STRING-BODY'`)与预期兜底键、类型防御路径一一对应,没有断言写错或 typo。
- `git show --stat ae161ca`(通过 diff 包已确认)只含这两个文件,无关文件零改动。

## 生产代码那 1 行改动独立核实

`mcpErrorKey.ts` 里 `toTestViewFromError` 的 doc comment 引用从 `` `mcp.go:349` `` 改成 `` `mcp.go:351` ``。

独立 grep `/home/nimo/NimoTech/NimoOS-AI/route/v2/mcp.go`:
```
351:  return c.JSON(http.StatusBadGateway, map[string]any{"ok": false, "error": "agent unreachable"})
```
`agent unreachable` 确实在第 **351** 行(`c.JSON` 直出,不经 `echo.NewHTTPError`,与注释描述吻合)。改后的注释是**正确的**;diff 里这一行前后除数字外文本完全一致(`git diff` 已核对,只有 `349`→`351` 变化),**没有夹带任何逻辑改动**。

顺带核实了同一改动报告里提到的 5 处 404 "mcp server not found"(`152,168,186,332,441`)——`grep -n "mcp server not found" route/v2/mcp.go` 结果与报告/文件注释完全一致,无遗漏无多算。

## 范围外观察(deferred minor,不展开)

- `toTestView` 未单独补"数组 body"用例(如 `toTestView(['a','b'])`);代码走 `typeof body!=='object'` 判断,数组会通过该判断进入函数体,最终因缺少 `.error_key`/`.ok` 字段落 default 分支,结果安全,但没有专门断言钉住。风险低(结构上无法泄漏,与 `error_key:null`/502 这类真正需要类型防御判别力的场景不同),不影响本次 Important 判定,记为 deferred minor,不要求本轮修。
- `toTestView` 里 `Array.isArray(b.tools)` 这条类型防御(第 84 行,针对 200 成功响应的 `tools` 字段)没有反例用例(如 `tools` 是字符串而非数组的情形)——这条防御与本次 Important 讨论的"错误路径四形状"无关(它在成功路径),超出本轮复审范围,只作记录。

## 我自己实测的三门数字

```
pnpm test:                   Test Files 298 passed (298) / Tests 2619 passed (2619)
pnpm exec vue-tsc --noEmit:  exit 0(无输出)
pnpm build:                  exit 0,仅 >500KB chunk 警告(许可范围内),built in 59.78s
```
与报告数字完全一致,无红项。

## 总判定

**可继续。** 该 Important 发现已充分解决,修复 diff 范围内未发现新的 Critical/Important 问题,生产代码唯一改动(1 行注释行号)已独立核实为正确且无逻辑变化。三门本地复测全绿,`git status` 全程干净。
