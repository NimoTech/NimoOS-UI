### Task 1: spec 勘误与基线固化

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-oss-web-ui-export-design.md`

**Interfaces:**
- Produces: 一份与现场一致的 spec。后续任务引用 spec 章节号时以订正后的版本为准。

本任务无代码,但必须先做 —— spec 的数字被后面 12 个任务当依据,不订正就会被照抄。

- [ ] **Step 1: 把 §0.1 的 sp7/sp8 结论改对**

把「本项目**永久忽略这两条分支,绝不合并**(用户 2026-08-03 拍板)」整句替换为:

```markdown
- **用户 2026-08-04 拍板:快照发布之后仍要把这两支合进 master。**
  → 因此本 spec 的剥离清单只覆盖 **master 上的 AI/相册残留面**;两支合流后,
  清单必须为 `src/photos/**`、`src/ai/**` 两个完整功能区扩张(路由、i18n 分片、
  数十个测试文件),那是一次独立的工作。单源 + 导出脚本的架构正是为此选的。
```

- [ ] **Step 2: 用现场值替换 §0.2 表格**

| 项 | 值 | 取值时 HEAD |
|---|---|---|
| New-UI `src/` 文件数 | 804 | `cd382d5` |
| 测试规模 | 352 文件 / 3078 例(全绿,退出码 1 见 §7.4) | `cd382d5` |
| 命中禁词的 `.test.ts` | 42 个 | `cd382d5` |
| `zh_cn.ts` 待删键 | **44 个**(33 + 11 个 audio 转录键) | `cd382d5` |
| `zh_cn.sp9.ts` 待删键 | 10 个 | `cd382d5` |
| MediaViewer.vue | 852 行 | `cd382d5` |
| 运行时依赖 | 45 个,无一与 AI/相册相关 | `cd382d5` |

- [ ] **Step 3: 在 §0.3 开头加一行「已完成」标记**

```markdown
> **✅ 2026-08-04 已按本节逐条重跑完毕,结论与 14 条偏差见
> `docs/superpowers/plans/2026-08-04-oss-web-ui-export.md` 的「现场核实结论」一节。
> 那份计划是执行依据;本 spec 之后各节凡与它冲突,以计划为准。**
```

- [ ] **Step 4: 新增 §13 勘误表**

把本计划「现场核实结论」的 E1–E14 表格整表复制到 spec 末尾,标题 `## §13 勘误(2026-08-04 现场核实)`,并在表前写一句 `本节推翻前文若干结论,阅读顺序:§0 → §13 → 其余各节。`

- [ ] **Step 5: 提交(注意 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add docs/superpowers/specs/2026-08-03-oss-web-ui-export-design.md \
        docs/superpowers/plans/2026-08-04-oss-web-ui-export.md
git commit -m "docs(oss): spec 勘误 14 条 + 导出机制实施计划"
```

---

