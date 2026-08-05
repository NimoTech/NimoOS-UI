## Task 5: PdfViewer 双源(原生 pdf vs 转换)+ 加载文案

**Files:**
- Modify: `NimoOS-New-UI/src/files/viewers/PdfViewer.vue`
- Modify: `NimoOS-New-UI/src/i18n/zh_cn.ts`(加「正在转换预览…」键)

**Interfaces:**
- Consumes:`service.file.getBytes`(现有)、`service.file.getPreviewBytes`(Task 3);`fileExt`(`../util/ext`)。
- Produces:PdfViewer 对 `.pdf` 用 `getBytes`,其余(doc/wps/xls/ppt/pptx)用 `getPreviewBytes`;加载文案区分(转换态「正在转换预览…」)。

- [ ] **Step 1: 加 i18n 键**

编辑 `src/i18n/zh_cn.ts`,在 `filesViewerLoading` 一行之后加:
```ts
    filesViewerConverting: '正在转换预览…',
```

- [ ] **Step 2: 改 PdfViewer 字节源 + 文案**

编辑 `src/files/viewers/PdfViewer.vue`:

`<script setup>` 顶部 import 加(与现有 import 同区):
```ts
import { fileExt } from '../util/ext'
```
在 `const { t } = useI18n()` 之后加(判定是否需转换):
```ts
const isConvert = fileExt(props.item.name) !== 'pdf'
```
把 `onMounted` 里取字节那行:
```ts
    const buf = await service.file.getBytes(props.item.path)   // 真实路径,走共享 axios(401 自愈)
```
改为:
```ts
    // 原生 .pdf → 直接取;旧版 Office → 后端 LibreOffice 转 PDF 后取(getPreviewBytes)。
    const buf = isConvert
      ? await service.file.getPreviewBytes(props.item.path)
      : await service.file.getBytes(props.item.path)
```
模板里 loading 那行:
```html
      <div v-if="state === 'loading'" class="viewer-status">{{ t('filesViewerLoading') }}</div>
```
改为(转换态显示不同文案):
```html
      <div v-if="state === 'loading'" class="viewer-status">{{ t(isConvert ? 'filesViewerConverting' : 'filesViewerLoading') }}</div>
```

- [ ] **Step 3: 全量测试 + 构建**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test 2>&1 | tail -4 && pnpm build 2>&1 | tail -3
```
Expected: 全量绿、vue-tsc 0、vite build ok。

- [ ] **Step 4: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/files/viewers/PdfViewer.vue src/i18n/zh_cn.ts
git commit -m "feat(files-viewer): PdfViewer 旧版 Office 走 getPreviewBytes(后端转 PDF)+ 转换态文案"
```

---

