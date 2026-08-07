# Task 6 完成报告

## 状态
✅ **完成**

## Commit
- **短 hash**: `0c70d3d`
- **完整信息**: feat(compose): 已装应用生命周期域(装/卸/更/设/启停/日志/健康检查,SP5-P0)

## 实现内容

### Step 1: Type Definition
在 `src/types.ts` 中追加 `ComposeAppWithStoreInfo` 接口，包含以下字段：
- `store_info?: StoreAppInfo` — 商店元数据
- `compose?: unknown` — 完整 compose 结构
- `status?: string` — 应用状态
- `update_available?: boolean` — 是否有更新
- `is_uncontrolled?: boolean` — 是否非托管
- `[k: string]: unknown` — 其他字段

### Step 2-3: Tests
创建 `src/compose.test.ts`，包含 7 个测试用例：
1. ✅ `list()` 解映射，缺 data 容空
2. ✅ `install()` YAML body + Content-Type yaml + snake_case query
3. ✅ `applySettings()` PUT /compose/{id} 同款 body/参数
4. ✅ `setStatus()` 发 JSON 字符串 body(echo Bind 只认带引号形态)
5. ✅ `update()` PATCH、`uninstall()` DELETE + delete_config_folder
6. ✅ `logs()` 解 data 为字符串并透传 lines
7. ✅ `healthcheck()` 2xx→true，reject→false

### Step 4: Implementation
实现 `src/compose.ts`，导出 `createCompose(http)` 工厂函数，返回对象包含：

| 方法 | HTTP | 路径 | 说明 |
|-----|------|-----|------|
| `list()` | GET | `/v2/app_management/compose` | 获取已装应用映射，缺 data 返回 {} |
| `get(id)` | GET | `/v2/app_management/compose/{id}` | 获取单个应用详情 |
| `install(yaml, opts?)` | POST | `/v2/app_management/compose?dry_run=&check_port_conflict=` | 安装（支持 dryRun 校验） |
| `applySettings(id, yaml, opts?)` | PUT | `/v2/app_management/compose/{id}?dry_run=&check_port_conflict=` | 修改已装应用设置 |
| `update(id, opts?)` | PATCH | `/v2/app_management/compose/{id}?force=` | 更新到商店版本 |
| `uninstall(id, opts?)` | DELETE | `/v2/app_management/compose/{id}?delete_config_folder=` | 卸载 |
| `setStatus(id, action)` | PUT | `/v2/app_management/compose/{id}/status` | 启停重启（body 为 JSON 字符串） |
| `logs(id, opts?)` | GET | `/v2/app_management/compose/{id}/logs?lines=` | 获取日志 |
| `containers(id)` | GET | `/v2/app_management/compose/{id}/containers` | 获取容器列表 |
| `healthcheck(id)` | GET | `/v2/app_management/compose/{id}/healthcheck` | 健康检查 |

## 测试结果

### Task 6 测试
```
pnpm vitest run src/compose.test.ts
✓ Test Files  1 passed (1)
✓ Tests  7 passed (7)
```

### 全量测试
```
pnpm vitest run
✓ Test Files  21 passed (21)
✓ Tests  101 passed (101)
```
**零回归**，所有 101 个测试全部通过。

## Step 6 对照 Task 3 实录

根据 `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/progress-sp5-p0.md` 的 Task 3 curl 实证：

### 实机 API 响应结构
```json
{"data": {
  "actualbudget": {
    "compose": {...},
    "is_uncontrolled": false,
    "status": "running",
    "store_info": {...},
    "update_available": false,
    ...
  }
}}
```

### ComposeAppWithStoreInfo 验证
✅ 顶层键完全一致：`compose`、`is_uncontrolled`、`status`、`store_info`、`update_available`
✅ `store_info` 字段存在（对应 Task 5 定义的 `StoreAppInfo`）
✅ `x-casaos` 在 compose 内部（不在顶层）

### dry_run 响应格式
✅ 成功：`{"message": "only validation has been done..."}` — 仅 message，无 data
✅ 失败：`{"message": "request body has an error..."}` — 仅 message，无 data，HTTP 400
✅ 实现中 `install()`/`applySettings()` 忽略响应体，直接 await 即可（异步处理走 MessageBus）

### logs 字符串处理
✅ 实机 `/compose/{id}/logs` 返回 `{"data": "line1\nline2..."}` — data 是字符串
✅ 实现中 `logs()` 调用 `v2Data<string>()` 正确解包为纯字符串

## 关键设计决策

1. **list() 空值处理**：当响应缺 `data` 字段或 data 为错误信封时，返回 `{}` 而非原始对象，确保类型安全。
2. **setStatus() JSON 字符串化**：由于后端 echo Bind 只认 `"start"` 这样带引号的形态，使用 `JSON.stringify(action)` 生成字面量而非对象。
3. **错误响应不解包**：dry_run/install/applySettings 的失败响应（仅 message）不做解包，由 axios 自动 reject，调用方 catch 处理。
4. **v2Data 复用**：沿用 Task 4 的 `v2Data()` 工具函数统一处理 v2 app_management 的非标准信封格式 `{"data": ...}` 或 `{"success": ..., "data": ...}`。

## Concerns
无。实现与实机 API 形态完全一致，所有测试通过，无歧义或边界问题。

---

## 验收清单
- [x] types.ts 追加 ComposeAppWithStoreInfo
- [x] compose.ts 实现 createCompose() 及 9 个方法
- [x] compose.test.ts 7/7 测试全部通过
- [x] 全量测试 101/101 无回归
- [x] 对照 Task 3 实录，API 结构一致
- [x] dry_run 异常响应格式验证
- [x] logs 字符串处理验证
- [x] Git commit 完成，含 Co-Authored-By
