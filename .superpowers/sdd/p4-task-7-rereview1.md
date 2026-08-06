# SP8-P4 Task 7 复审(修复轮 1)—— finally 守卫判别性测试

复审范围:**仅**首轮评审提出的 1 条 Important 发现(`finally` 分支 `seq === reqSeq.value` 守卫缺判别性测试)。独立评审,不采信实现者报告,全部自查/自跑。

## Verdict

**ADDRESSED。**

依据:新增两条用例(`McpServerDetail.test.ts:421-439`、`:441-459`)构造的场景是「server1 点测试(悬挂)→ 切到 server2 → server2 点测试(悬挂,此时 `testing=true` 且是**新一轮** seq)→ 这时才让 server1 的旧请求落地(成功一条 / 抛错一条)→ 断言按钮仍显示 `aiMcpSrvTesting`、`disabled` 属性仍在、`.mcp-test-result` 仍不存在」。这与首轮遗留的两条 D11 用例(`:385-400`、`:402-412`)有本质区别:首轮用例切换服务器后**没有再点击测试**,`watch` 已经把 `testing` 复位为 `false`,所以旧请求落地时无论 finally 有没有 `seq` 比对,`testing` 的终值都是 `false`——两种写法在那两条用例下行为一致,抓不出问题。本轮新用例在切换后**又发起了一轮新测试**,只有这个时刻「有守卫」与「无守卫」才会产生行为分叉(无守卫时旧请求的 `finally` 会把新一轮的 `testing` 错误打回 `false`)。这正是任务书要求的钉子场景,已精确命中。

## 逐条核对

1. **场景是否真的「旧请求落地时新一轮正在进行」**——是。两条新用例都在 `setProps` 切换服务器之后再次 `trigger('click')`(`:430`、`:450`),并用 `mockReturnValueOnce(new Promise(() => {}))` 让新一轮请求永久悬挂,再让旧请求的 `resolveOld`/`rejectOld` 在**此时**才触发。不是「切换后旧请求落地」这种首轮已覆盖的弱场景。

2. **成功落地与抛错落地是否各一条**——是。`:421` 一条走 `resolveOld({ok:true,...})`(成功分支+finally),`:441` 一条走 `rejectOld(Object.assign(new Error(...), {response:{status:500,...}}))`(catch 分支+finally)。两条分别对应 try 成功路径和 catch 路径落地后 finally 的执行,覆盖两条到达 finally 的路径。

3. **断言三点是否齐全**——是,两条用例均同时断言:
   - 按钮文案仍含 `zh.aiMcpSrvTesting`(仍是「测试中…」,`:436`/`:456`)
   - 按钮 `disabled` 属性仍在(`:437`/`:457`)
   - `.mcp-test-result` 仍不存在(`:438`/`:458`)
   三点都断言,不是只挑一个的弱断言。

4. **异步是否用 `flushPromises()`**——是。两条用例在 `resolveOld`/`rejectOld` 触发后都用 `await flushPromises()`(`:435`/`:455`),点击后的同步状态检查用 `nextTick()`(公共约束里规定的用法,与文件里其余 32 条一致),没有用单个 `nextTick()` 顶替 `flushPromises()` 去读取尚未落定的 promise 结果。

## 独立 RED 探针(自己做的,非复述)

把 `McpServerDetail.vue:140-142` 从

```ts
} finally {
  if (seq === reqSeq.value) testing.value = false
}
```

改成无条件

```ts
} finally {
  testing.value = false
}
```

跑 `pnpm exec vitest run src/ai/components/settings/mcp/McpServerDetail.test.ts`:

```
Test Files  1 failed (1)
     Tests  2 failed | 32 passed (34)

FAIL … > finally 守卫:旧请求成功落地时若新一轮测试进行中,不会把 testing 打回 false
  AssertionError: expected '测试连接' to contain '测试中…'
FAIL … > finally 守卫:旧请求抛错落地时若新一轮测试进行中,不会把 testing 打回 false
  AssertionError: expected '测试连接' to contain '测试中…'
```

**精确命中新增的这两条**,其余 32 条(含首轮 D11 守卫用例、D11 对照用例)全部仍绿。已用 `cp` 备份的原文件精确还原,`git status --porcelain` 输出为空。与实现者报告里给出的报红条数/条目**完全一致**。

## 生产代码零改动核实

```
git diff 39fed70..HEAD -- src/ai/components/settings/mcp/McpServerDetail.vue
```
输出为空(0 行)。确认本轮修复只碰了 `.test.ts`。

## 既有 32 条未被削弱核实

```
git diff 39fed70..HEAD --stat -- src/ai/components/settings/mcp/McpServerDetail.test.ts
 .../settings/mcp/McpServerDetail.test.ts | 47 ++++++++++++++++++++++
 1 file changed, 47 insertions(+)
```

`git diff 39fed70..HEAD -- .../McpServerDetail.test.ts | grep -E '^-' | grep -v '^---'` 输出为空——**只有插入,零删除/零修改**。新增内容严格追加在文件尾部既有 `describe('测试连接', ...)` 块收尾前,插在「D11 对照」用例之后,未触及前面任何一条既有断言。

## 修复 diff 范围内的新破坏

无。diff 只新增两条测试,不涉及生产代码、不涉及其余文件。

## 自己实测的三门(独立跑)

```
pnpm test:                  Test Files 300 passed (300) / Tests 2662 passed (2662)   exit=0
pnpm exec vue-tsc --noEmit: (无输出)                                                   exit=0
pnpm build:                 built in 23.81s,仅既有 >500KB chunk 体积警告(ExcelViewer/index-DG5-5xQh 等) exit=0
```

单独跑目标测试文件:`pnpm exec vitest run src/ai/components/settings/mcp/McpServerDetail.test.ts` → `Test Files 1 passed (1) / Tests 34 passed (34)`,与「32+2=34」吻合。

## 范围外观察(deferred,不展开)

无新发现——本轮 diff 只有 47 行测试新增,未见范围外改动。

## 总判定

**可继续。** 首轮 Important 发现已用精确命中的判别性用例修复,生产代码零改动,既有 32 条零削弱,三门全绿。P4 Task 7 可结项。
