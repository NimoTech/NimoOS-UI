# acceptance-fix-3: StorageShell 滚动/裁切修复

commit: `46cce21`

## 症状

RAID 详情页左栏快照面板内容被裁掉,且页面不能下拉滚动。

## 根因(三者叠加)

1. `src/styles/theme.css:302` — `body { overflow: hidden }`(桌面体验需要,不改)。
2. `src/storage/components/StorageShell.vue:29`(改前)— `.storage-shell` 用
   `min-height: 100dvh` 而非 `height`,壳随内容长高,永不受视口约束。
3. `.st-body { flex: 1; overflow-y: auto }` 因此拿不到受限高度,滚动条永不激活。

参照仓内已工作正常的同型外壳 `src/components/shell/AreaShell.vue`(文件区在用,滚动正常)
对齐写法。

## 改动前后 CSS 对照

```diff
- .storage-shell { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); color: var(--fg); }
- .st-bar { display: flex; align-items: center; gap: 14px; padding: 14px 22px; }
+ .storage-shell { height: 100vh; height: 100dvh; display: flex; flex-direction: column; background: var(--bg); color: var(--fg); }
+ .st-bar { display: flex; align-items: center; gap: 14px; padding: 14px 22px; flex: 0 0 auto; }
  ...
- .st-body { flex: 1; overflow-y: auto; padding: 8px 22px 28px; }
+ .st-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px 22px 28px; }
```

三处改动:

1. `.storage-shell`:`min-height: 100dvh` → `height: 100vh; height: 100dvh;`
   (两行是给不支持 `dvh` 的旧浏览器的回退,照 AreaShell 的写法保留两行)。
2. `.st-bar`:补 `flex: 0 0 auto`,防止顶栏被压缩/拉伸。
3. `.st-body`:`flex: 1` → `flex: 1 1 auto`,补 `min-height: 0`
   (flex 子项默认 `min-height: auto`,会阻止收缩到小于内容高度,导致
   `overflow-y: auto` 失效;AreaShell 靠 `flex: 1 1 auto` 侥幸没踩到,这里显式写 0 更稳)。

视觉数值(padding/gap/背景色/字号等)全部保留不变,只改布局与溢出相关属性。
注释已写入源码,标明根因坐标(`theme.css:302`、`AreaShell.vue`),防止后人改回
`min-height`。

## 影响范围

`StorageShell` 被存储区全部 5 个视图(`StorageVolumes`/`StorageDrives`/`StorageRaid`/
`StorageRaidDetail`/`StorageRaidCreate`)共用,改这一处即全部生效。用户先在快照面板
撞上,只是因为那一页内容最高。

## 测试

检查了 `StorageShell.test.ts`——里面 4 个用例只断言标题/页签/active 状态/回主页跳转,
不涉及被改的类名或样式,无需更新。未新增 jsdom 布局/滚动断言(jsdom 无真实布局引擎,
量不出高度和溢出,SP6-P2、P4c 已吃过这个教训,写测不出问题的假测试比不写更糟)。

## 验证门输出

```
pnpm test
 Test Files  246 passed (246)
      Tests  1508 passed (1508)
   Duration  76.67s

pnpm exec vue-tsc --noEmit
(无输出,零错误)

pnpm build
✓ built in 10.63s
(仅有预置的 chunk 体积警告,与本次改动无关,改动前已存在)
```

`package.json` 里没有 color-guard 之类的独立样式检查脚本(`scripts` 只有
dev/build/preview/test/test:watch),`build` 本身已内含 `vue-tsc --noEmit`。

## 是否该把 StorageShell 并入 AreaShell?

**建议:值得做,但不是本次范围。** 理由:

- 两者结构、CSS 属性名几乎一一对应(`storage-shell`/`area-shell`,`st-bar`/`area-bar`,
  `st-body`/`area-body`),这次修复后行为也已一致,唯一实质差异是 `StorageShell`
  多了页签导航(`st-tabs`)和 `max-width: 980px` 的内容居中。
- 合并成通用壳(比如 `AreaShell` 加一个可选的 `tabs` slot,或抽一个共享的
  `useAreaShellLayout` mixin/组合式函数封装这三条 flex/height 规则)能消灭"两处
  各自维护同一套裁切/滚动逻辑,改一处忘改另一处"的风险——这次的 bug 本质上就是
  两个外壳实现分叉导致的行为漂移。
- 但这是一次跨组件重构,会牵涉 `AreaShell.vue` 的调用方(文件区)和
  `StorageShell.vue` 的调用方(存储区 5 个视图)的回归验证,超出"修一个 CSS bug"
  的范围,且用户明确要求本次不做这个重构。列为后续 SP6 收尾候选项。

## 顾虑

无阻断性顾虑。改动局限于纯 CSS 属性调整,未涉及 token/颜色,未触碰
`theme.css`/`AreaShell.vue`。建议真机验证时重点看 RAID 详情页在小视口/内容溢出时
`.st-body` 是否出现滚动条、顶栏 `.st-bar` 是否不再被压缩。
