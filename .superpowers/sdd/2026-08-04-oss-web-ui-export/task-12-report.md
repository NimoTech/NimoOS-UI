# Task 12 报告:README 重写(类 2 · REPLACE)

## 改了什么

- 新建 `oss/files/README.md`(70 行,面向外部开发者)。
- `oss/manifest.mjs`:`REPLACE` 表加第 4 条,`path: 'README.md'`,`privateSha256` 钉住私有版
  `README.md` 当前内容(`ae7e30a5e63f2c66af4e0ecbf7a08cd5500aec89e9d2de86d6db05b2b79027aa`,98 行原文未改动)。
- `oss/tree.test.mjs`:插入 `describe('类 2 · README', …)`,两例(禁词 + 关键词),紧跟在
  「类 2 · MediaViewer 拆转录」之后、「类 2 · 冻结分身注释不泄露内部开发状态」之前
  ——后者是 T11 加的通用守卫,会自动遍历 REPLACE 表扫我这条新条目,不用重复写。

## README 最终内容要点

1. 标题 + 一句话定位(Vue 3 + TypeScript + Vite 的 NimoOS Web 控制台)。
2. 功能覆盖清单(见下方路由核对)。
3. 技术栈清单(Vue 3 / Vite 7 / TS strict / Pinia / vue-router 4 / vue-i18n 9 / reka-ui /
   预览器全家桶 / socket.io-client / tus-js-client / @novnc/novnc / Vitest)。
4. 目录结构 + `packages/service/` 内嵌共享包说明(`file:./packages/service`,clone 即用)。
5. 安装与开发:Node ≥ 20 + pnpm,`pnpm install/dev/test/build` 四条命令,dev proxy
   改法(`vite.config.ts` 里的 `DEV_PROXY`),部署走 `./scripts/deploy.sh`。
6. 配色约定硬约束:token-only、两套主题(`:root` 深色玻璃 / `:root[data-theme="light"]`
   米白纸感)、每个 token 两套都要有值、两类例外(`.ic-*` 品牌色 / 第三方库如 CodeMirror)、
   **写了理由**(配色要能整体切换,不提这条外部贡献者第一个 PR 就会写死色值)。
7. i18n 约定:`zh_cn`/`en_us` 双写,`parity.test.ts` 兜底。
8. 已知缺口四条:文件区快照管理不全 / 只有中英两语言 / 终端 tab 空态(404 依据)/
   存储 tab 是跳转卡(完整功能在 `/storage`)。

## 产出树 router 实际注册路由清单(证明功能清单没写错)

跑 `node oss/export.mjs --out /tmp/t12-tree --skip-guard --no-commit --allow-dirty-oss`
后读 `/tmp/t12-tree/src/router/index.ts`,实际注册路由:

```
/                         home
/files                    files
/files/shares             files-shares
/files/drop               files-drop
/apps                     apps
/apps/store               apps-store
/apps/store/:id           apps-store-detail
/apps/custom              apps-custom
/apps/sources             apps-sources
/apps/:name/settings      apps-settings
/apps/:name/console       apps-console
/storage                  storage
/storage/drives           storage-drives
/storage/raid             storage-raid
/storage/raid/create      storage-raid-create
/storage/raid/:id         storage-raid-detail
...settingsRoutes         (系统设置区)
/kvm                      kvm
/files/:path(.*)*         files-path(兜底)
/login                    login(public)
/welcome                  welcome(public)
```

无 `/photos`、`/ai`、`/search` 任何路由 —— 与 README 未提及三块功能一致。
另外核实存储区确有快照功能:`src/views/StorageRaidDetail.vue` 挂载了
`src/storage/components/SnapshotPanel.vue`(`v-if="detail"` 门控),支持 README 里
「存储(卷 / 磁盘 / RAID / 快照)」这条,与文件区「时间机器」是两套独立功能,不冲突。

## 产出树 package.json 实际 script 清单(证明命令能跑)

```json
"scripts": {
  "dev": "vite",
  "build": "vue-tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

`@nimotech/nimoos-service` 依赖项为 `"file:./packages/service"`,`packages/service/package.json`
里 `name` 确为 `@nimotech/nimoos-service`(version `0.0.1`)—— 与 README「内嵌共享包」一节一致。
`scripts/deploy.sh` 存在,内容为 `pnpm build` + `rsync --delete` 到
`/var/lib/nimoos/www/app/`,与 README 部署说明一致(未在 README 里复述 sudo mkdir 首装步骤,
不属于本任务范围)。

## 四条已知缺口的依据(实测)

1. 快照:`grep -rl "snapshot" src/files/` 命中 `src/files/stores/snapshotBrowse.ts`、
   `src/files/snapshot/TimeMachineOverlay.test.ts` 等——时间机器组件存在,但没有完整快照
   管理面板(对照存储区 `SnapshotPanel.vue` 的完整程度,文件区确实只有时间轴浏览)。
2. 语言:`ls src/i18n/` 只有 `zh_cn.ts`/`zh_cn.sp9.ts`(同一语言分片)+ `en_us.ts`/`en_us.sp9.ts`,
   无第三语言。
3. 终端:`src/settings/panels/TerminalPanel.vue` 头部注释明写
   `实测 GET /v1/sys/wsssh → 404`、`GET /v1/terminal/settings → 404`;
   `TerminalPanel.test.ts` 有「渲染终端服务不可用的空态」用例。
4. 存储 tab:`src/settings/panels/StoragePanel.vue` 头部注释明写只放
   「一张容量概览卡 + 一张『打开存储区』入口卡,点击跳 `/storage`」。

## 固定禁词清单自查

`describe('类 2 · 冻结分身注释不泄露内部开发状态', …)`(T11 加的通用守卫)自动遍历
`REPLACE` 表逐条扫 `[/Task \d/, /SP\d/i, /\bsp[789]\b/i, /spec §/, /本期/, /做样子/, /Vue2/, /NimoOS-UI/]`,
README 这条新条目随表被扫到,测试跑绿即通过。另外手动跑了一遍脚本对 `oss/files/README.md`
逐条正则核对(含 brief Step 1 里追加的 `/Vue 2/`、`/strangler/i`、`/NimoOS-New-UI/`、
`file:../NimoOS-Service`、`同级目录`),全部 `ok`(无命中)。

## 测试输出

```
$ pnpm exec vitest run oss/tree.test.mjs
 Test Files  1 passed (1)
      Tests  48 passed (48)
```

46(原有)+ 2(新增 README 描述块)= 48,全绿。另跑
`node oss/export.mjs --out /tmp/t12-tree --skip-guard --no-commit --allow-dirty-oss`,
确认 `REPLACE` 计数从 3 → 4,`/tmp/t12-tree/README.md` 与 `oss/files/README.md`
`diff` 完全一致。

哈希钉负向验证:在 `/tmp` 下建了一次性临时目录直接 `import` `oss/apply.mjs` 的
`applyReplace`,故意传错的 `privateSha256`('deadbeef'),得到预期报错
`私有仓的 README.md 变了(sha256 … ≠ 钉住的 deadbeef…)`——未触碰本仓
`src/**` 或 `README.md`,未撞 `checkClean`(直接调函数,绕过了 export.mjs 的
前置检查顺序)。

`git status --porcelain` 提交前只有:3 行 design-export 删除态(既有,不属本任务)+
`M oss/manifest.mjs` + `M oss/tree.test.mjs` + `?? oss/files/README.md`。

## 自查结论

- 只改了铁律允许的三个文件,未碰 `src/**`,未碰本仓根目录 `README.md`。
- 未 `git checkout`/`stash`/`reset`,3 个 design-export 删除态原样保留。
- 未做 T13(测试同步)/ T14(守卫白名单)/ T15(出包)范围内的活。
- 未跑全量 `pnpm test`,只跑了 `oss/tree.test.mjs`(48 例全绿)。

## 遗留疑问

无。若后续 T14 接通泄漏守卫全量扫描,README 已按同一份禁词清单自查过,预期不会
新增命中;但 T14 的词表是否比 T11 那份通用清单更严格(比如新增中文词条),届时需要
再核对一遍 README 全文,不在本任务范围内处理。
