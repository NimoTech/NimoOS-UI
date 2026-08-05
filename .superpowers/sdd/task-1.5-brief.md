# Task 1.5(重构):抽共享扩展名分类常量

**目标:** 消除 `src/files/viewers/panelMap.ts` 的 `typeMap` 与 `src/files/util/icons.ts` 的 `TYPE_MAP` 之间的扩展名分类数组重复(~80 字符串两份)。抽成单一共享常量模块 `src/files/util/fileCategories.ts`,两处 import。**行为必须逐字节不变**(尤其 icons 的 last-match-wins 图标映射)。

**这是纯重构:不改任何可观察行为,不加功能,不改测试断言(除非某测试直接 import 了被移动的常量)。**

## 背景(务必读懂再动)

### icons.ts 现状(`src/files/util/icons.ts`)
`const TYPE_MAP: Record<string, string[]>` 含以下键,**顺序重要**:
`image-x-generic, video-x-generic, audio-x-generic, text-x-generic, text-markdown, text-css, text-html, application-vnd.ms-word, application-vnd.ms-excel, application-vnd.ms-powerpoint, application-pdf, application-photoshop, application-illustrator, application-x-wine-extension-cpl, application-apk, application-x-zip, application-x-cd-image, application-x-apple, application-x-pem-key, text-x-cmake, text-dockerfile`

**⚠️ 关键不变量:** 紧随 TYPE_MAP 之后有:
```ts
const EXT_TO_ICON: Record<string, string> = {}
for (const [icon, exts] of Object.entries(TYPE_MAP)) {
  for (const e of exts) EXT_TO_ICON[e] = icon   // last-match-wins
}
```
`dockerfile` 同时在 `text-x-cmake` 与 `text-dockerfile`,因 `text-dockerfile` 排在**最后**,`dockerfile` 最终归 `text-dockerfile`。**重构后 TYPE_MAP 的键顺序必须与现在完全一致**,否则 EXT_TO_ICON 变、图标错。还有 `export const IMAGE_EXTS = new Set(TYPE_MAP['image-x-generic'])` 必须保留可用。

### panelMap.ts 现状(`src/files/viewers/panelMap.ts`,Task 1 建)
本地 `typeMap` 含 8 个键:`image-x-generic, audio-x-generic, text-x-generic, text-markdown, text-css, text-html, text-x-cmake, text-dockerfile`(全部与 icons.ts 中同名数组**逐字节相同**)。另有本地 `browserPlayableVideo = ['mp4','m4v','webm','mov','3gp']`(**panel 专属,icons 没有,保留在 panelMap 不动**)。`filePanelMap` 用这些数组组装。

## 要做的

- [ ] **Step 1: 建 `src/files/util/fileCategories.ts`**——把 icons.ts TYPE_MAP 里的**全部**分类数组抽成命名 const(单一真源),逐字节照搬,命名用大写蛇形对应 key,例如:
```ts
// 文件扩展名分类的单一真源(供 icons.ts 图标映射 + panelMap.ts 查看器映射复用)
export const IMAGE_X_GENERIC = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'svg', 'tiff']
export const VIDEO_X_GENERIC = ['mkv', 'mp4', '3gp', 'avi', 'm2ts', 'webm', 'flv', 'vob', 'ts', 'mts', 'mov', 'wmv', 'rm', 'rmvb', 'asf', 'mpg', 'm4v', 'mpeg', 'f4v']
export const AUDIO_X_GENERIC = ['aac', 'aiff', 'alac', 'amr', 'ape', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wma', 'wav']
export const TEXT_X_GENERIC = ['txt', 'log', 'pages', 'conf', 'config', 'list', 'ini', 'toml', 'cfg', 'rc', 'env', 'service', 'conf.d', 'htaccess', 'gitconfig', 'vim', 'curlrc', 'wgetrc', 'gitignore']
export const TEXT_MARKDOWN = ['md']
export const TEXT_CSS = ['php', 'css', 'less', 'scss', 'sass', 'aspx', 'lua', 'vue', 'js', 'go', 'asp', 'bat', 'c', 'cpp', 'cs', 'json', 'py', 'perl', 'sh', 'xml', 'yaml', 'vb', 'vbs', 'sql', 'swift', 'rust', 'rs', 'jsp', 'yml', 'r', 'pl', 'rb', 'src', 'h', 'tex', 'rtf', 'jsonld', 'ttl', 'n3', 'rss', 'atom', 'srt', 'ass', 'tsv', 'vcard', 'asc', 'url', 'diff', 'plaintext']
export const TEXT_HTML = ['html', 'htm', 'shtml', 'shtm']
export const APPLICATION_VND_MS_WORD = ['doc', 'docx', 'wps']
export const APPLICATION_VND_MS_EXCEL = ['xls', 'xlsx', 'csv']
export const APPLICATION_VND_MS_POWERPOINT = ['ppt', 'pptx']
export const APPLICATION_PDF = ['pdf']
export const APPLICATION_PHOTOSHOP = ['psd', 'psb']
export const APPLICATION_ILLUSTRATOR = ['ai', 'eps']
export const APPLICATION_X_WINE_EXTENSION_CPL = ['exe']
export const APPLICATION_APK = ['apk']
export const APPLICATION_X_ZIP = ['zip', 'rar', '7z', 'gz', 'ace', 'xz']
export const APPLICATION_X_CD_IMAGE = ['iso', 'img', 'vmdk', 'raw', 'vhd']
export const APPLICATION_X_APPLE = ['dmg', 'ipa', 'pkg']
export const APPLICATION_X_PEM_KEY = ['pem', 'crt', 'ca-bundle', 'p7b', 'p7s', 'der', 'cer', 'pfx', 'p12']
export const TEXT_X_CMAKE = ['makefile', 'cmake', 'dockerfile']
export const TEXT_DOCKERFILE = ['dockerfile']
```
(**逐字核对**上面每个数组与 icons.ts 现值一致——以 icons.ts 源为准,若本 brief 有出入以 icons.ts 为准。)

- [ ] **Step 2: 改 icons.ts**——`TYPE_MAP` 改为引用这些常量,**键顺序原样不动**:
```ts
import { IMAGE_X_GENERIC, VIDEO_X_GENERIC, AUDIO_X_GENERIC, TEXT_X_GENERIC, TEXT_MARKDOWN, TEXT_CSS, TEXT_HTML, APPLICATION_VND_MS_WORD, APPLICATION_VND_MS_EXCEL, APPLICATION_VND_MS_POWERPOINT, APPLICATION_PDF, APPLICATION_PHOTOSHOP, APPLICATION_ILLUSTRATOR, APPLICATION_X_WINE_EXTENSION_CPL, APPLICATION_APK, APPLICATION_X_ZIP, APPLICATION_X_CD_IMAGE, APPLICATION_X_APPLE, APPLICATION_X_PEM_KEY, TEXT_X_CMAKE, TEXT_DOCKERFILE } from './fileCategories'

const TYPE_MAP: Record<string, string[]> = {
  'image-x-generic': IMAGE_X_GENERIC,
  'video-x-generic': VIDEO_X_GENERIC,
  'audio-x-generic': AUDIO_X_GENERIC,
  'text-x-generic': TEXT_X_GENERIC,
  'text-markdown': TEXT_MARKDOWN,
  'text-css': TEXT_CSS,
  'text-html': TEXT_HTML,
  'application-vnd.ms-word': APPLICATION_VND_MS_WORD,
  'application-vnd.ms-excel': APPLICATION_VND_MS_EXCEL,
  'application-vnd.ms-powerpoint': APPLICATION_VND_MS_POWERPOINT,
  'application-pdf': APPLICATION_PDF,
  'application-photoshop': APPLICATION_PHOTOSHOP,
  'application-illustrator': APPLICATION_ILLUSTRATOR,
  'application-x-wine-extension-cpl': APPLICATION_X_WINE_EXTENSION_CPL,
  'application-apk': APPLICATION_APK,
  'application-x-zip': APPLICATION_X_ZIP,
  'application-x-cd-image': APPLICATION_X_CD_IMAGE,
  'application-x-apple': APPLICATION_X_APPLE,
  'application-x-pem-key': APPLICATION_X_PEM_KEY,
  'text-x-cmake': TEXT_X_CMAKE,
  'text-dockerfile': TEXT_DOCKERFILE,
}
```
其余(EXT_TO_ICON 循环、IMAGE_EXTS、FOLDER_BY_NAME、iconNameFor 等)**一律不动**。

- [ ] **Step 3: 改 panelMap.ts**——本地 `typeMap` 8 个数组改为 import 共享常量。`getPanelType`/`PanelType`/`browserPlayableVideo`/`filePanelMap` 组装逻辑与签名**不变**:
```ts
import { fileExt } from '../util/ext'
import { IMAGE_X_GENERIC, AUDIO_X_GENERIC, TEXT_X_GENERIC, TEXT_MARKDOWN, TEXT_CSS, TEXT_HTML, TEXT_X_CMAKE, TEXT_DOCKERFILE } from '../util/fileCategories'
```
把原来内联的 `typeMap[...]` 引用替换为对应常量(`union(TEXT_X_GENERIC, TEXT_CSS, TEXT_HTML, TEXT_X_CMAKE, TEXT_DOCKERFILE)` 等)。`browserPlayableVideo` 保留在 panelMap(panel 专属)。

- [ ] **Step 4: 跑两边测试确认零回归**(不改任何测试断言):
```
pnpm test -- icons
pnpm test -- panelMap
```
两个都必须全绿。若 icons 无独立测试文件,则跑覆盖 icons 的测试(FileRow/FileTile/icons 相关);若确无,用 `pnpm exec vue-tsc --noEmit` 保编译通过并在报告说明「icons 无单测,靠 tsc + panelMap 测试 + 人工核对键顺序」。

- [ ] **Step 5: 类型检查** `pnpm exec vue-tsc --noEmit` → 0 错误。

- [ ] **Step 6: 提交**
```bash
git add src/files/util/fileCategories.ts src/files/util/icons.ts src/files/viewers/panelMap.ts
git commit -m "refactor(files): 抽 fileCategories 共享扩展名分类常量(icons.ts + panelMap.ts 复用,消除重复)"
```
(若某测试文件因 import 变动需微调,一并 `git add` 该测试文件。)

## 验收
- `fileCategories.ts` 是分类数组的唯一真源;icons.ts 与 panelMap.ts 都从它 import,无重复数组字面量。
- icons.ts `TYPE_MAP` 键顺序与重构前完全一致(dockerfile → text-dockerfile 图标不变)。
- icons + panelMap 测试全绿,tsc 0 错误。
- 无功能改动、无断言弱化。
