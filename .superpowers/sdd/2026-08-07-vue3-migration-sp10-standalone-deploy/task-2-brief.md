### Task 2: 把重定向脚本接进 deploy.sh

**Files:**
- Modify: `NimoOS-New-UI/scripts/deploy.sh`
- Test: `NimoOS-New-UI/scripts/writeRootRedirect.test.ts`(追加一个 describe 块)

**Interfaces:**
- Consumes: Task 1 的 `scripts/write-root-redirect.sh <www-root>`
- Produces: `deploy.sh` 在 rsync 之后调用 `./scripts/write-root-redirect.sh /var/lib/nimoos/www`。后续任务不依赖新符号。

- [ ] **Step 1: 写失败测试**

在 `NimoOS-New-UI/scripts/writeRootRedirect.test.ts` **末尾追加**:

```ts
describe('deploy.sh 接线', () => {
  // 用文件顶部已有的 HERE 常量拼路径。⚠️ 不要写 `new URL('./deploy.sh', import.meta.url)`:
  // 这个两参数字面量形态会被 Vite 当资源 URL 静态转换,vitest(jsdom)下解析成 http: 而非
  // file:,fileURLToPath 直接抛 TypeError 且整个测试文件 0 collected(Task 1 已实测踩过)。
  const deploySrc = readFileSync(join(HERE, 'deploy.sh'), 'utf8')

  it('调用了重定向脚本,并且传的是 www 根而不是 app 子目录', () => {
    expect(deploySrc).toContain('./scripts/write-root-redirect.sh /var/lib/nimoos/www')
    expect(deploySrc).not.toContain('write-root-redirect.sh /var/lib/nimoos/www/app')
  })

  it('调用点在 rsync 之后(先把应用铺好,再补根目录那一跳)', () => {
    const rsyncAt = deploySrc.indexOf('rsync -a --delete')
    const callAt = deploySrc.indexOf('./scripts/write-root-redirect.sh')
    expect(rsyncAt).toBeGreaterThan(-1)
    expect(callAt).toBeGreaterThan(rsyncAt)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

预期:新增的 2 条失败(`expected '…' to contain './scripts/write-root-redirect.sh …'`),原有 8 条仍通过。

- [ ] **Step 3: 改 deploy.sh**

`NimoOS-New-UI/scripts/deploy.sh` 里,把这一行:

```bash
find /var/lib/nimoos/www/app/assets -type f -mtime +14 -delete 2>/dev/null || true
```

改成:

```bash
find /var/lib/nimoos/www/app/assets -type f -mtime +14 -delete 2>/dev/null || true
# 本应用挂在 /app/ 下,根目录不属于它 —— 补一个 / → /app/ 的重定向页,
# 让只部署了本应用的机器上,输入 / 也能落到应用里。
# 脚本自带覆盖守卫:根目录已有别的首页时一字不动(详见脚本头部注释)。
# 本脚本开头已 `cd "$(dirname "$0")/.."`,所以这里的相对路径就是仓库根。
./scripts/write-root-redirect.sh /var/lib/nimoos/www
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

预期:10 passed。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add scripts/deploy.sh scripts/writeRootRedirect.test.ts
git commit -m "feat(sp10): deploy.sh 部署后补写根目录重定向页"
```

---

