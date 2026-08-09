# SP10 Task 4 · Step 1 — 两仓测试门 + 开源公开面自查

日期:2026-08-07。纯验证,未改动任何源文件、未碰工作树(未 checkout/stash/commit)。

## A. New-UI 全量门(/home/nimo/NimoTech/NimoOS-New-UI)

命令与结果(完整日志:`/tmp/claude-1000/-home-nimo-NimoTech/99f2ac86-8b2f-48c7-802e-e4bedefc39df/scratchpad/newui-test.log`、`newui-tsc.log`、`newui-build.log`):

### `pnpm test`(= vitest run,全量)

```
 Test Files  3 failed | 600 passed (603)
      Tests  1 failed | 9866 passed | 70 skipped (9937)
   Duration  162.99s
```

失败清单(逐条):

1. `oss/tree.test.mjs` — Failed Suite(beforeAll 抛错,66 个用例整体 skipped)
2. `oss/media-wave.test.mjs` — Failed Suite(同上,4 个用例整体 skipped)
3. `oss/export-rsync.test.mjs` — 1 个用例失败:「导出落盘:node_modules 保留、dist 照常清空 > --out 目录已有 node_modules/哨兵文件,重新导出后哨兵文件还在;已有 dist/ 会被清空」

三条失败的**根因完全相同**:三个测试都会 `execFileSync('node', ['oss/export.mjs', '--out', ..., '--skip-guard', '--no-commit', '--allow-dirty-oss'])`,而 `export.mjs` 内部另有一道独立于 `--allow-dirty-oss` 的工作树洁净检查,报错:

```
[oss] 失败:/home/nimo/NimoTech/NimoOS-New-UI 工作树不干净,导出中止:
?? docs/superpowers/plans/2026-08-07-vue3-migration-sp10-standalone-deploy.md
```

即:`git status` 里唯一的未跟踪文件 `docs/superpowers/plans/2026-08-07-vue3-migration-sp10-standalone-deploy.md`(本期 SDD 计划文档本身,任务开始前已存在,非本次执行产生)让导出脚本的"工作树必须干净"防护触发,连带打红三个 oss 测试文件。

**判断:这 3 个失败与本期代码改动(`scripts/write-root-redirect.sh`、`scripts/writeRootRedirect.test.ts`、`scripts/deploy.sh` 尾部 5 行)无关**——失败原因是仓库里存在一个未跟踪的计划文档,触发的是 `export.mjs` 自身的"禁止脏工作树导出"防护,不是产物树内容问题(没有触及 forbidden 词表、DELETE/PATCH 清单、tree 结构等实质性导出逻辑)。这是环境状态问题,不是代码问题;按任务护栏"不许碰工作树"的要求,我没有 add/commit 这个文件去让门测通过。

补充说明本期新增的两个 git 跟踪文件(`scripts/write-root-redirect.sh`、`scripts/writeRootRedirect.test.ts`)本身**没有**在 DELETE/PATCH/REPLACE 清单里被处理,会原样进入 `git archive` 产物树。已在下面 C 节核查它们内容干净(无私有上下文关键词命中),所以即使按当前清单直接导出,这两个新文件本身不会泄漏敏感信息——只是清单尚未把它们纳入 REPLACE/PATCH(如需要中立化头部注释,是另一个任务的事,不在本 Step 1 范围)。

### `pnpm exec vue-tsc --noEmit`

`EXIT:0`,无错误输出。

### `pnpm build`

`EXIT:0`,`✓ built in 16.52s`,产物正常生成到 `dist/`(仅有 vite 常规的 chunk 体积警告,非错误)。

## B. Vue2 全量门(/home/nimo/NimoTech/NimoOS-UI)

命令:`pnpm exec vitest run`(单次运行,非监听模式)。完整日志:`/tmp/claude-1000/-home-nimo-NimoTech/99f2ac86-8b2f-48c7-802e-e4bedefc39df/scratchpad/vue2-test.log`。

```
 Test Files  2 failed | 158 passed (160)
      Tests  8 failed | 1480 passed (1488)
   Duration  45.98s
```

失败清单(8 条,逐条):

**`tests/nimoTaskBar.test.js`(5 条,均属 NimoTaskBar 组件)**
1. `NimoTaskBar 收起态 > 有任务时收起态显示小图标 + 「X 个后台任务」文字,不显示总百分比/任何明细/进度条`
2. `NimoTaskBar 收起态 > 任务数文字反映当前任务条数`
3. `NimoTaskBar 展开态:按类型分开显示 > 展开后才出现按类型明细与进度条`
4. `NimoTaskBar 展开态:按类型分开显示 > 不同类型各渲染一条独立进度,标签正确`
5. `NimoTaskBar 展开态:按类型分开显示 > 某类型有错误时该类型标记失败,并显示错误详情`

该测试文件顶部 mock 的是 `@/service/photos.js` 与背景壁纸资源,与 Home.vue 的桌面死链按钮无关(未 grep 命中任何相关字符串)。

**`tests/settingsStore.test.js`(3 条,均属 AI Settings store)**
6. `createSettingsStore - factory + initial state > initial state has expected shape` —— 断言 `servicesStatus` 应为 `{ ollama, agent }`,实际多了一个 `openvino` key
7. `loadServicesStatus normalizes nested .running into booleans` —— 同上,`openvino` 多余
8. `loadServicesStatus sets false on error` —— 同上

`openvino` key 的来源是 `src/views/AI/Settings/store/settingsStore.js` 与 `src/views/AI/Settings/Settings.vue`(grep 确认),是 AI 设置区既有的服务状态字段漂移,与本期 Home.vue 改动无关。

**判定与取证方法**:对两个失败文件分别 `grep -nE 'enter-next|New homepage|Try the new homepage|/next/|Home\.vue' tests/nimoTaskBar.test.js tests/settingsStore.test.js` —— 无命中(grep exit 1)。另外单独跑本期新建的 `src/views/__tests__/Home.nextLink.spec.js` 及既有的 `Home.settingsCutover.spec.js` / `Home.storageCutover.spec.js`(未在失败列表,单独确认 `Home.nextLink.spec.js`:3 passed / 0 failed)。

**结论:8 条失败,其中 0 条与本期改动(删除 Home.vue 死链按钮 `enter-next` + 新建 `Home.nextLink.spec.js`)有关。** 均为既有失败(NimoTaskBar 组件用例、AI Settings store 的 `openvino` 字段漂移),与本次改动的文件、类名、i18n 键、链接路径均无交集。

## C. 开源公开面自查(/home/nimo/NimoTech/NimoOS-New-UI)

```
$ grep -nE 'Vue ?2|strangler|台账|SP[0-9]|\.superpowers' scripts/write-root-redirect.sh scripts/writeRootRedirect.test.ts scripts/deploy.sh
(无输出,grep exit 1)
```

三个文件(新增两个 + 修改的 deploy.sh)均无私有上下文关键词命中,干净。

### manifest.mjs 里 deploy.sh 的 PATCH 锚点核查

`oss/manifest.mjs` 第 2007-2009 行确有一条 PATCH,把 `deploy.sh` 头部注释里的私有仓名中立化:

```js
{ path: 'scripts/deploy.sh',
  find: '# 构建 NimoOS-New-UI 并部署到 Gateway 的 /app/ 静态目录。',
  replace: '# 构建本项目并部署到 Gateway 的 /app/ 静态目录。' },
```

实测锚点命中次数:

```
$ grep -cF '# 构建 NimoOS-New-UI 并部署到 Gateway 的 /app/ 静态目录。' scripts/deploy.sh
1
```

恰好命中 1 次,未被打断。本期改动只在 `deploy.sh` 尾部追加了 5 行(调用 `./scripts/write-root-redirect.sh /var/lib/nimoos/www` 并打印新提示),锚点在文件第 2 行,未受影响。

## 结论汇总

| 项 | 结果 |
|---|---|
| New-UI `pnpm test` | 603 文件 / 9937 用例,3 文件失败(1 用例失败),**均因未跟踪计划文档触发导出脚本的脏工作树防护,与本期代码改动无关** |
| New-UI `vue-tsc --noEmit` | 通过,0 错误 |
| New-UI `pnpm build` | 通过,产物正常生成 |
| Vue2 `vitest run` | 160 文件 / 1488 用例,2 文件 8 用例失败,**均为既有失败(NimoTaskBar + AI Settings openvino 漂移),与本期改动无关** |
| OSS grep 自查 | 干净,无私有上下文关键词命中 |
| manifest.mjs deploy.sh 锚点 | 命中恰好 1 次,未被本期尾部追加打断 |

## 疑虑

- New-UI 的 3 个 oss 测试失败虽判定与本期代码无关,但确实说明**当前工作树处于"不干净"状态**(未跟踪的 SDD 计划文档),导致这几个门测无法在当前状态下验证"真实导出"逻辑本身是否还正确——它们只验证到"脏检查生效"这一步就提前退出了。若要让这三个测试跑到实质断言,需要该计划文档被跟踪或加入 `.gitignore`(不在本 Step 1 范围,仅记录供后续任务参考)。
- 本期新增的两个 git 跟踪文件(`write-root-redirect.sh`、`writeRootRedirect.test.ts`)尚未被 `oss/manifest.mjs` 的任何清单条目处理,会原样进入公开产物树。内容本身干净(已核查),不构成阻塞项,但如果这两个文件将来长出私有上下文注释,目前没有清单条目会拦截/中立化它们。
