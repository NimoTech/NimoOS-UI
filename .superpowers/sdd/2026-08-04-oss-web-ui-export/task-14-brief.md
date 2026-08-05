### Task 14: 接上泄漏守卫,把词表调到零命中

**Files:**
- Modify: `oss/forbidden.mjs`(只加**精确白名单**,禁止放宽词表)
- Test: `oss/tree.test.mjs`

**Interfaces:**
- Consumes: T3 的 `scanTree`、T5 的 `export.mjs` 第 5 步
- Produces: `node oss/export.mjs`(**不带** `--skip-guard`)能跑通

**§10.4 的取舍**:误报(白名单漏一条)→ 脚本报错,加白名单,成本低。漏报(词表缺一个词)→ **真泄漏**,成本高。所以词表宁可宽、白名单宁可细。**禁止用「放宽词表」来消除误报。**

- [ ] **Step 1: 写失败断言**

```js
describe('泄漏守卫', () => {
  it('不带 --skip-guard 也能跑通', () => {
    const out = execFileSync('node', [path.join(OSS, 'export.mjs'), '--out',
      fs.mkdtempSync(path.join(os.tmpdir(), 'oss-guard-')), '--no-commit'],
      { encoding: 'utf8', stdio: 'pipe' })
    expect(out).toContain('零命中')
  }, 180_000)

  it('手工抽查:验收 §11 第 4 条的那条命令零命中', () => {
    const hits = []
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|vue|css|json|md|svg|html|yaml|sh)$/.test(e.name)) {
        const t = fs.readFileSync(p, 'utf8')
        if (/相册|nimo ai|transcript|qdrant|192\.168\.1\.115/i.test(t)) hits.push(path.relative(tree, p))
      }
    } }
    walk(tree)
    expect(hits).toEqual([])
  })
})
```

- [ ] **Step 2: 跑一次守卫,把命中列表拿到手**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
node oss/export.mjs --out /tmp/oss-guard --no-commit 2>&1 | head -80
```

Expected:一批 `✗ file:line [word] excerpt`。**逐条分类**:
- **真泄漏** → 回到 T6–T13 的对应任务补剥离清单(不要在这里加白名单绕过)
- **假阳性** → 往 `forbidden.mjs` 的 `SOFT[].allow` 加一条 `{ file: /精确路径$/, re: /精确内容/ }`

预期会撞上的几类(现场已预判):`pnpm-lock.yaml` 里第三方包名含 `ai`/`search` 子串(如 `@codemirror/search`)· `public/widget-kit.css` 若有 `.ic-ai` 残留 · `src/i18n/*.ts` 里 `appsStoreSearch`(已在白名单)· `scripts/deploy.sh` · `index.html`。

- [ ] **Step 3: 逐条加白名单,直到零命中**

每加一条都跑一遍 `pnpm exec vitest run oss/forbidden.test.mjs`(T3 的词表测试不许退化),再跑守卫。

**特别注意 `pnpm-lock.yaml`**:第三方依赖名里的 `search`/`ai` 子串是纯噪声。给它一条按文件豁免的规则,但**软禁词 `photo`/`gallery`/`transcript` 在 lockfile 里仍必须报** —— 依赖名里真出现这些词才是要人看的信号:

```js
  // pnpm-lock.yaml:第三方包名里的 search/ai 子串是噪声(@codemirror/search 等)。
  // 只豁免这两个词,photo/gallery/transcript/wiki/parser 在 lockfile 里仍然报。
  { file: /^pnpm-lock\.yaml$/, re: /^\s+(resolution|version|specifier|'?@?[\w@/.-]+'?:)/ },
```

- [ ] **Step 4: 确认守卫会响(负向验证)**

同 T9 Step 6:**用 `cp` 备份/还原,不许 `git checkout` / `git stash`。**

```bash
F=src/home/components/HomeTopbar.vue
cp "$F" /tmp/guard-backup.vue
echo "// 打开相册看看" >> "$F"
node oss/export.mjs --out /tmp/oss-guard2 --no-commit; echo "EXIT=$?"
cp /tmp/guard-backup.vue "$F" && rm /tmp/guard-backup.vue
git status --porcelain -- "$F"        # 必须为空 = 已完全还原
ls /tmp/oss-guard2 2>&1               # 必须不存在或为空 —— 一个字节都不落盘
```

Expected:打印 `✗ src/home/components/HomeTopbar.vue:… [相册]` 与 `泄漏守卫命中 1 处,一个字节都不落盘`,`EXIT=1`,`/tmp/oss-guard2` 空。

- [ ] **Step 5: 跑全部 oss 测试**

Run: `pnpm exec vitest run oss/`
Expected: PASS(forbidden / apply / tree 三个文件全绿)

- [ ] **Step 6: 提交**

```bash
git add oss/forbidden.mjs oss/tree.test.mjs
git commit -m "feat(oss): 泄漏守卫接入导出流程,白名单调到零命中"
```

---

