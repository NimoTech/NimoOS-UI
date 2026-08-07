# Task 4 Report: v2 信封解包器 `v2Data`

## 实现摘要

在 `src/v2.ts` 实现了 `v2Data<T>(raw: unknown): T` 导出函数，处理 app_management v2 API 的信封差异：

- **v2 裸信封** `{message, data}` （无 `success` 字段）：直接取 `data`
- **标准信封** 带 `success` 字段：委托给 `unwrap()` 进行状态码验证（200 返回数据，否则抛错）
- **裸值** （无 `data` 键的任意值）：原样返回

实现完全遵循简报代码模板，共 12 行业务逻辑 + 注释。

## 测试命令与输出

### 步骤 2：失败测试（红）
```bash
pnpm vitest run src/v2.test.ts
```
**输出**：
```
Error: Cannot find module './v2' imported from /home/nimo/NimoTech/NimoOS-Service/src/v2.test.ts
```
✓ 预期失败

### 步骤 4：通过测试（绿）
```bash
pnpm vitest run src/v2.test.ts
```
**输出**：
```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```
✓ 三个测试全过：
1. `v2Data({ message: '', data: ['a'] })` → `['a']`（v2 裸信封）
2. `v2Data({ success: 200, data: 7 })` → `7`（标准信封成功）
3. `v2Data({ success: 500, message: 'boom', data: null })` → throw `'boom'`（标准信封失败）
4. `v2Data(['x'])` → `['x']`（裸值）
5. `v2Data(null)` → `null`（null 值）

### 全量回归
```bash
pnpm vitest run
```
**输出**：
```
 Test Files  19 passed (19)
      Tests  88 passed (88)
```
✓ 无回归，现有 18 个测试文件 + Task 4 新增 1 个，共 88 个测试全过

## 自审结论

✓ **代码与简报一致**：实现完全照抄简报模板，逐行核对无差异
✓ **测试断言真实行为**：三个测试场景覆盖所有分支路径
✓ **TDD 流程完成**：红 → 绿 → 全量回归 PASS
✓ **TypeScript 类型安全**：泛型 `<T>` 保留准确类型信息

## 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/v2.ts` | 12 | 核心实现 + 文档注释 |
| `src/v2.test.ts` | 15 | 3 个 `it` 用例，涵盖 5 个断言 |

## Commit

```
Hash: 5c96703
Message: feat(v2): v2Data 解包器——app_management v2 信封无 success 字段,unwrap 会误抛

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

**Task 4 完成✓** · 已准备 Task 5 和 Task 6（Task 5 消费 v2Data 实现 appstore 域）
