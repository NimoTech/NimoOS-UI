# SP7-P3 真机反馈 · 收尾修复 R1 报告

工作目录:`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(分支 `sp7-photos`)

## 修复1:收藏星标浅色主题白色挖空(核对,未重写)

前一子代理留下的未提交改动经核实**逻辑正确,原样保留**,未做任何修改:

```css
.tile-fav.is-fav { color: var(--star-fg, #ffd60a); }
:global(:root[data-theme="light"]) .tile-fav.is-fav {
  background: var(--star-fg, #ffd60a);
  color: var(--on-accent, #fff);
}
```

核实结论:
- `:global(:root[data-theme="light"])` 只命中浅色主题,深色主题(`:root` 默认块)不受影响 —— 符合"深色不变"要求。
- **`--on-accent` 不是 fallback-only 的伪 token,而是本仓 `src/styles/theme.css` 中两套主题都显式定义的真实语义 token**:
  - `:root`(默认/深色玻璃主题,L48):`--on-accent: #16203a`(深色主题的 accent 是亮蓝 `#8ab4ff`,故其上文字取深色以保证对比度)。
  - `:root[data-theme="light"]`(L177):`--on-accent: #ffffff`(浅色主题的 accent 是较深的蓝 `#3b5bdb`,其上文字取白色)。
  - 因为改动只在 `[data-theme="light"]` 作用域内生效,`var(--on-accent, #fff)` 在浅色主题下解析为 `#ffffff`(token 命中,fallback 不会被用到,只是兜底防御)。
  - `PhotosToolbar.vue` 的 `.density button[data-active="true"]` 已有 `color: var(--on-accent)` 先例,复用同一 token 语义(饱和填充色之上的可读前景色),未新增 token。
- **color-guard(`src/styles/color-guard.test.ts`)判定**:其 `stripVar()` 会把整个 `var(...)` 表达式(含 fallback 字面量)整体剔除后再扫描裸颜色,因此 `var(--star-fg, #ffd60a)` 与 `var(--on-accent, #fff)` 两处 fallback 十六进制值**均不计入违规扫描** —— 无需加 `theme-exception` 注释,写法本身即合规。跑 `color-guard.test.ts` 结果:通过(该文件覆盖全仓 244 个源文件,含本文件在内均为 0 offenders)。

结论:修复1 无需改动,直接沿用。

## 修复2:术语统一「回收站」→「最近删除」(仅 zh_cn,en_us 不动)

`src/i18n/zh_cn.ts` 精确改了 5 个值 + 1 处注释,**键名一律未动**:

| 键 | 旧值 | 新值 |
|---|---|---|
| `photosTrash` | `'回收站'` | `'最近删除'` |
| `photosTrashEmptyTitle` | `'回收站是空的'` | `'最近删除是空的'` |
| `photosTrashEmpty` | `'清空回收站'` | `'清空最近删除'` |
| `photosTrashEmptiedToast` | `'回收站已清空 · 释放 {size} MB'` | `'最近删除已清空 · 释放 {size} MB'` |
| `photosDeleteConfirmBody` | `'将移入最近删除,可在回收站恢复。'` | `'将移入最近删除,可从中恢复。'` |
| 注释 | `// ── 相册:回收站视图 ──` | `// ── 相册:最近删除视图 ──` |

`grep -n 回收站 src/i18n/zh_cn.ts` 结果为空,确认无遗漏。`parity.test.ts`(键集合一致性)不受影响,因为只改值不改键。

### 连带修复:2 处断言旧文案的测试(未在原任务清单内,但改值后必然变红,已顺手同步)

- `src/photos/components/__tests__/PhotosSidebar.test.ts`:断言侧栏第三项文案 `toContain('回收站')` → 改为 `toContain('最近删除')`(该组件的 `labelKey` 正是 `photosTrash`);测试标题同步中文措辞。
- `src/views/__tests__/PhotosTrash.test.ts`:空态断言 `toContain('回收站是空的')` → `toContain('最近删除是空的')`;两处测试标题/注释里的「清空回收站」措辞同步为「清空最近删除」。

未改动任何非文案断言、未改动组件/store 逻辑。

## 测试与类型检查

```bash
pnpm test                      # 244 test files passed, 1503 tests passed
pnpm exec vue-tsc --noEmit     # 无输出,0 错误
```

`pnpm test` 全量输出末尾:
```
 Test Files  244 passed (244)
      Tests  1503 passed (1503)
```
(过程中出现的 `Error: Not implemented: navigation (except hash changes)` 是 `favorites.test.ts` 里 `exportZip` 触发 jsdom 对 `location.href` 赋值的已知无害 stderr 噪音,与本次改动无关,不影响测试通过判定 —— 该用例本身标记为 passed。)

另单独复核两个关键约定测试:
```bash
pnpm exec vitest run src/i18n/parity.test.ts src/styles/color-guard.test.ts
# Test Files  2 passed (2)  /  Tests  113 passed (113)
```

## 提交

一个提交,包含上述全部改动(修复1 原样保留 + 修复2 术语统一 + 2 处连带测试同步)。
