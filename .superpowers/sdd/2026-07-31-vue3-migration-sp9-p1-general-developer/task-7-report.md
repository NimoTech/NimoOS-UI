# Task 7 报告:USB 自动挂载 / 推荐应用 / 新闻流三行

## 实现

- `src/settings/panels/general/UsbAutoMountRow.vue`(新建):自持状态行,
  `getUsbStatus` + `hardwareInfo` 并行读取,`toggleUsbAutoMount({state})` 下发,
  失败弹回原状态并 toast 提示;树莓派警告(`drive_model` 含 "raspberry",大小写不敏感)
  只在「开启」方向给出。
- `src/settings/panels/general/SwitchRow.vue`(新建):服务端 `system` blob 里单个布尔
  字段的通用开关行,两处复用(推荐应用 / 新闻流)。三个 `confirm*Key` prop 同时给才
  启用「开启前确认」;新闻流走这条路径,关闭方向永远直接 `patchSystemConfig`,不弹确认。
- `src/settings/panels/general/switchRows.test.ts`(新建):18 个测试(brief 给的
  16 个原样落地 + 我按外层任务描述补的 2 个交错防护回归测试,brief 里没有这两条,
  见下方“偏离/风险”)。

两个组件都遵循 brief step 3/4 给出的实现,唯一的改动是补上了 brief 代码里缺失的
**交错防护(touched 标志)**:

- `UsbAutoMountRow.vue`:`onMounted` 里 `getUsbStatus().then((v) => { if (!touched) on.value = v })`,
  `touched` 在 `onToggle` 开头置位。
- `SwitchRow.vue`:`onMounted` 里 `readSystemConfig()` 返回后先 `if (touched) return`,
  `touched` 同样在 `onToggle` 开头置位(无论走确认弹窗还是直接保存都算“用户已操作”)。

写法与已完成的 `DiskStandbyRow.vue` / `WebUiPortRow.vue` 一致(就地布尔标志,不抽公共
helper —— 本仓库此前评审已裁定跨组件抽取是过早抽象)。

## 命令与输出摘要

```
$ pnpm test src/settings/panels/general/switchRows.test.ts   # Step 2:确认失败(实现前)
 Test Files  1 failed (1)   —— SwitchRow.vue / UsbAutoMountRow.vue 均不存在,transform 报错

$ pnpm test src/settings/panels/general/switchRows.test.ts   # 实现后(brief 16 条)
 Test Files  1 passed (1)
      Tests  16 passed (16)

# 补充交错防护测试后
$ pnpm test src/settings/panels/general/switchRows.test.ts
 Test Files  1 passed (1)
      Tests  18 passed (18)

$ pnpm test src/settings
 Test Files  18 passed (18)
      Tests  171 passed (171)

$ pnpm test        # 全量
 Test Files  280 passed (280)
      Tests  2060 passed (2060)

$ pnpm exec vue-tsc --noEmit
(无输出,零错误)
```

**任务门:** 基线 279 文件 / 2040 例 → 现在 280 文件 / 2060 例。新增 1 个测试文件、
20 例(相对基线),均高于基线,符合任务门要求。`vue-tsc --noEmit` 零错误。

## 负向验证(移除防护 → 确认交错测试失败 → 复原)

**USB 行:**
1. 把 `onMounted` 里的 `if (!touched) on.value = v` 改回 `on.value = v`(去掉防护)。
2. 重跑 `switchRows.test.ts`:`交错防护:onMounted 的 getUsbStatus 慢于用户翻动时不覆盖(USB)`
   失败 —— `expected 'false' to be 'true'`(旧值 `false` 冲掉了用户翻成的 `true`),
   其余 17 例仍通过。
3. 复原该行,重跑确认 18/18 通过。

**SwitchRow 行:**
1. 删掉 `onMounted` 里的 `if (touched) return`。
2. 重跑:`交错防护:onMounted 的 readSystemConfig 慢于用户翻动时不覆盖(推荐应用)`
   失败 —— `expected 'true' to be 'false'`(默认值 `true` 冲掉了用户关掉后的 `false`),
   其余 17 例仍通过。
3. 复原该行,重跑确认 18/18 通过。

两次负向验证都精确命中预期的那一条测试,其余用例不受影响,证明防护是测试真正依赖的
(而不是凑巧通过)。

## 3 个 design-export 删除 + 未跟踪台账文件

提交前后各跑一次 `git status --short`,两次都确认:
```
D  "design-export/Audio Speaker Segmentation.html"
D  design-export/audio-waveform-design-kit.html
D  design-export/design-final.html
?? docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md
```
三行 `D` 和这一个 `??` 全程未被 `git add`/`git commit`/`git restore` 触碰;
提交用的是显式路径的 `git commit <path> <path> <path>`,没有用 `-a` 或 `-A`。

## 提交

SHA:`36fb6ef`
```
feat(settings): USB 自动挂载 / 推荐应用 / 新闻流三行(SP9-P1)

- 开关下发失败一律弹回原位(Vue2 是 fire-and-forget,失败后界面在骗人)
- 新闻流只在「开启」方向弹确认,关闭直接存(对位 Vue2 rssConfirm)
- 树莓派警告只在开启方向给出
- 两个组件各自的 onMounted 读取都带本地 touched 交错防护标志,并配有
  interleaved 回归测试(brief 未给,按外层任务描述补齐,已做移除-验证-复原的反证)
- 「显示其他 Docker 容器应用」行不做:Vue2 恒不渲染(债务 D15)
```
3 files changed, 424 insertions(+)。

## brief 里我认为有问题/有风险的地方

1. **最主要的偏离:brief 的 Step 1 测试代码和 Step 3/4 实现代码都没有交错防护
   (touched 标志)以及对应的 interleaved 回归测试** —— 而外层任务描述第 3 条
   明确要求「每个防护都要有一个交错的回归测试」,并且详细描述了两个要避开的坑
   (先 await 完再翻 / stale 值在翻动之后才读)。这与 Task 5(`DiskStandbyRow.vue`/
   `TimezoneRow.vue`)、Task 6(`WebUiPortRow.vue`)的既有模式是一致的 —— 那两个
   任务都补了这个防护。我判断 brief 在这一点上是抄了 Step 3/4 的骨架但漏抄了
   防护逻辑,按外层任务描述(而非 brief 字面代码)补齐了两处 `touched` 标志和
   两条 interleaved 测试,并做了移除-验证-复原的反证,细节见上文。
   **如果这个补齐超出了本任务的预期范围,请告知,我可以回退到 brief 字面实现。**
2. 其余 brief 代码(props/i18n key/文件名/类名)核对下来都和现有基础设施
   (`SettingsRow`/`SettingsSwitch`/`AlertDialog`/`systemConfig.ts`/i18n sp9 文件)
   吻合,没有发现需要新增 i18n key 或改动共享文件的情况。
