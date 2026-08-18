# 文件夹大小按需计算 — 设计文档

日期:2026-08-12
状态:已与用户逐段确认定稿

## 背景与目标

New-UI 文件区列表视图中,文件夹的大小列一直为空(`FileRow.vue:56` 对 `is_dir` 渲染空串)。
这是照抄 Vue2 的既有行为——列表接口返回的目录 `size` 是 inode 大小(4096),直接渲染会误导。
后端有现成接口 `GET /v1/folder/size`(`NimoOS/route/v1.go:179` → `GetSize` →
`GetFileOrDirSize` → `DirSizeB` 递归遍历),但两代前端都从未调用过。

目标:在列表视图的大小格提供**点击按需计算**,显示文件夹真实总大小。

**已确认的范围裁定:**

- 只做列表视图(FileListView/FileRow);网格视图(FileTile)本来不显示任何大小,不动。
- 不做属性弹窗(未来可另立一期)。
- 不做跨视图持久缓存(理由见"失效规则")。

## 后端事实(设计依据)

- `GetSize` 每次调用**从头 `filepath.Walk` 现算,无任何缓存**
  (`NimoOS/pkg/utils/file/file.go:622` `DirSizeB`)。跳过挂载点,只累加同设备文件。
- 请求形如 `GET /v1/folder/size?path=<path>`,返回标准信封
  `{success: 200, message: "ok", data: <int64 字节数>}`;失败返回 `success: 500`。
- 大目录(几十万文件、机械盘)遍历可达几十秒;`checkPathAccess` 先做路径权限校验。
- service 包已有现成封装 `service.folder.getFolderSize(path)`
  (`packages/service/src/folder.ts:19`),但返回类型是 `unknown`,本期收紧为 `number`。

## UI 与交互(FileRow 大小格四态)

| 状态 | 显示 | 交互 |
|---|---|---|
| `idle` | 「计算」,弱化色 `var(--fg-muted)`,hover 变强调色 | 点击 → 发起计算 |
| `loading` | 「计算中…」 | 不可点 |
| `done` | `renderSize(bytes)`,与文件大小同样式 | 纯文本 |
| `error` | 「重试」,弱化色 | 点击 → 重新发起 |

- 点击只作用于大小格,`@click.stop` 阻止冒泡,不得触发行选中/进入文件夹。
- 上传中占位行维持现状(显示上传中标签),无计算入口。
- 快照浏览(只读视图)中可用——计算是只读操作。
- 颜色一律 theme token,禁止字面量(仓库硬约束)。
- 新增 3 个 i18n 键(计算/计算中…/重试),`zh_cn.ts` + `en_us.ts` 同时加。
  中文文案需查 Vue2 `zh_CN.json` 是否已有既有译法,有则沿用。

## 数据流与组件改动(共 4 处)

1. **新建 `src/files/stores/folderSizes.ts`**(唯一新文件):
   - 状态:`Record<path, {status: 'loading'|'done'|'error', bytes?: number}>`
     (无记录即 idle)+ `epoch` 计数器。
   - `compute(path)`:若已 `loading`/`done` 直接返回(视图内缓存/去重);
     否则记录当前 epoch → 置 `loading` → 调 `service.folder.getFolderSize(path)` →
     **响应回来先核对 epoch,不一致静默丢弃**(异步过期守卫,仓库既有纪律)→
     一致则写 `done`/`error`。
   - `reset()`:清空全部状态,`epoch++`。
2. **失效挂接**:files store 目录列表**每次加载成功后**调 `folderSizes.reset()`。
   导航、右键刷新、文件操作后的重拉全部经过列表加载,一处挂接覆盖所有失效时机。
3. **`FileRow.vue`**:目录行大小格按 store 状态渲染四态。
4. **`packages/service/src/folder.ts`**:`getFolderSize` 返回类型收紧为
   `Promise<number>`,并对该请求单独设 **300000ms(5 分钟)超时**——http 层默认
   60s(`http.ts:50`)会砍断大目录遍历。
   ⚠️ 改 service 包需重启 dev server + 硬刷新(仓库已知坑,见 CLAUDE.md)。

## 失效规则(为什么不做更久的缓存)

- 后端无缓存、无变更通知;目录 mtime 只反映直接子项增删,深层变化不冒泡,
  前端**无法判定**"文件夹没变过"。
- NAS 上 Web UI 不是唯一写通道(Samba/Docker 应用/定时任务),跨视图持久缓存
  必然出现无提示的陈旧数字。
- 故缓存生命周期 = 当前目录列表的生命周期。列表一重载即全清。
  视图内 `done` 即缓存,重复渲染/滚动回收不重发。
- 代价:回到目录后想看需重新点一次。宁可多点一次,不显示错的数。
- 可接受的快照语义:停在目录不刷新期间,外部改动不反映(同 Windows 属性框行为)。

## 错误处理

1. **后端错误**(无权限/目录已删/IO 错):信封 `success: 500`,`unwrap` 抛错 →
   该路径置 `error`,格子显示「重试」。**不弹 toast**——行内局部操作就地呈现错误。
2. **超时/网络断**:同样落 `error` 态。5 分钟超时兜底;仍超时的目录重试无意义,
   但「重试」至少让用户知道没算出来,而非永远转圈。
3. **过期响应**:epoch 不一致 → 静默丢弃,不写任何状态。此时 `reset()` 已把格子
   打回 idle。
4. 计算入口只在单行大小格,与多选/批量无关,无批量计算语义。

## 测试策略(vitest/jsdom,与仓库同形)

1. **`folderSizes.test.ts`**(新):成功→done+字节数;对 loading/done 去重不重发;
   后端错误→error;**epoch 守卫:挂起中 reset,响应回来不得写入**;reset 清空。
   fixture 用真机信封 `{success:200, message:"ok", data:<number>}`,不手编想象。
2. **`FileRow.test.ts`**(扩展):四态渲染;点击调 store 且不冒泡;文件行无计算入口。
3. **`files.test.ts`**(扩展):列表加载成功后 reset 被调用。
4. **`folder.test.ts`**(service 包,扩展):返回 number;请求带自定义超时。
5. **i18n parity**:现有 `parity.test.ts` 自动守卫。

真机验收:小文件夹秒回;大文件夹(如 /DATA 下媒体库)点击后「计算中…」持续可见且
最终出数;计算中导航离开再回来,格子回到「计算」且无串数据;快照视图中可用。
