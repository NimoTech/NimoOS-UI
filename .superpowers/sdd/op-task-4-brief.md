## Task 4: 前端 panelMap 路由(TDD)

**Files:**
- Modify: `NimoOS-New-UI/src/files/viewers/panelMap.ts`
- Modify: `NimoOS-New-UI/src/files/viewers/panelMap.test.ts`

**Interfaces:**
- Produces:`pdf-viewer` 覆盖 `['pdf','doc','wps','xls','ppt','pptx']`;`excel-viewer` = `['xlsx','csv']`(去 `xls`);`doc-viewer` = `['docx']`(不变)。

- [ ] **Step 1: 改测试(RED)**

编辑 `NimoOS-New-UI/src/files/viewers/panelMap.test.ts`:把原「word doc/docx/wps → doc-viewer」用例替换为下面这组,并加 pdf-viewer/excel 断言:
```ts
  it('docx → doc-viewer; 旧版 doc/wps → pdf-viewer(转换)', () => {
    expect(getPanelType('a.docx')).toBe('doc-viewer')
    expect(getPanelType('a.doc')).toBe('pdf-viewer')
    expect(getPanelType('a.wps')).toBe('pdf-viewer')
  })
  it('pdf + 旧版 ppt/pptx/xls → pdf-viewer', () => {
    expect(getPanelType('a.pdf')).toBe('pdf-viewer')
    expect(getPanelType('a.ppt')).toBe('pdf-viewer')
    expect(getPanelType('a.pptx')).toBe('pdf-viewer')
    expect(getPanelType('a.xls')).toBe('pdf-viewer')
  })
  it('新版 xlsx/csv → excel-viewer(不含 xls)', () => {
    expect(getPanelType('a.xlsx')).toBe('excel-viewer')
    expect(getPanelType('a.csv')).toBe('excel-viewer')
    expect(getPanelType('a.xls')).not.toBe('excel-viewer')
  })
```
（若旧文件里已有的 word/excel 用例与之冲突,一并删除旧的,保留这三条。）

- [ ] **Step 2: 跑测试确认 RED**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/files/viewers/panelMap.test.ts 2>&1 | tail -10
```
Expected: FAIL(doc/xls/ppt 当前不映射到 pdf-viewer)。

- [ ] **Step 3: 改 panelMap**

编辑 `src/files/viewers/panelMap.ts`。`filePanelMap` 改为(注意 pdf-viewer 用字面量数组合并 pdf + 旧版 Office;doc-viewer 仍 `['docx']`;excel 去 xls):
```ts
  'pdf-viewer': ['pdf', 'doc', 'wps', 'xls', 'ppt', 'pptx'],
  'doc-viewer': ['docx'],
  'excel-viewer': ['xlsx', 'csv'],
```
若 `APPLICATION_PDF` / `APPLICATION_VND_MS_WORD` / `APPLICATION_VND_MS_EXCEL` 因此不再被引用,从 import 里删掉(避免未使用导入报错)。保留 `union` 及其它组的用法。首行注释更新为:pdf-viewer 覆盖原生 pdf + 需后端转换的旧版 Office;各组扩展名互不相交,first-match 成立。

- [ ] **Step 4: 跑测试确认 GREEN**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/files/viewers/panelMap.test.ts 2>&1 | tail -6
```
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/files/viewers/panelMap.ts src/files/viewers/panelMap.test.ts
git commit -m "feat(files-viewer): 旧版 Office(doc/wps/xls/ppt/pptx)路由到 PDF 查看器(转换),xls 出 excel"
```

---

