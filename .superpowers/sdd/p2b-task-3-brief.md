## Task 3: `SkModal.vue` 弹窗外壳（reka Dialog + portal 回设置页根）

**Files:**
- Create: `src/ai/components/settings/SkModal.vue`
- Create: `src/ai/components/settings/SkModal.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `.sk-modal*` 类
- Produces:
  ```ts
  // props
  { open: boolean; title: string; portalTo?: string /* 默认 '.set-app' */ }
  // emits
  { 'update:open': (v: boolean) => void }
  // slots
  default  // → .sk-modal-body 内容
  footer   // → .sk-modal-foot 内的 .right 容器
  ```
  Task 10（令牌明文弹窗）与 Task 12（加机器人表单、配对码弹窗）各用它。

**背景（D1）：** Vue2 三处弹窗是手写 `.sk-modal-bg` + `@click.self` 裸 div，没有焦点陷阱、Esc 要自己接。本仓改用 reka `Dialog`（文件区 5 处对话框的既有先例），**但必须 portal 回 `.set-app`** —— AI 区 token 定义在 `.agent-app` 作用域（`src/ai/styles/tokens.scss:30`），reka `DialogPortal` 默认传送到 `document.body`，传出去 `var(--bg-elevated)` 一类全部解析失败，弹窗会变透明/错色。

已核 `node_modules/reka-ui/dist/Dialog/DialogPortal.js`：`DialogPortal` 支持 `to`（选择器字符串或元素）、`disabled`、`defer`、`forceMount` 四个 prop，内部转给 reka 的 `Teleport`，`target = props.to ?? configContext.teleportTo ?? 'body'`。**另注意它包了 `useMounted()` 门**：首次渲染返回注释节点，挂载后才吐真内容 —— 所以测试里挂载后必须先 `await nextTick()` 再查 `document.body`（P2a Task 6 已用一次性临时测试对未改动的 `AlertDialog.vue` 复现过同款失败，是 reka 固有特性，不是本组件引入）。

- [ ] **Step 1: 写失败的测试**

`src/ai/components/settings/SkModal.test.ts`：

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, defineComponent, h } from 'vue'
import SkModal from './SkModal.vue'

// reka 的 Portal 目标默认是 '.set-app'(设置页根元素)。测试里手工造一个,
// 顺带证明「内容确实落在这个容器里、而不是 document.body 直挂」——这正是
// D1 要防的 token 作用域逃逸。
function withHost() {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

describe('SkModal', () => {
  let host: HTMLElement
  beforeEach(() => { host = withHost() })
  afterEach(() => { document.body.innerHTML = '' })

  it('open=false 时不渲染任何弹窗内容', async () => {
    mount(SkModal, { props: { open: false, title: '标题' }, attachTo: document.body })
    await nextTick()
    expect(host.querySelector('.sk-modal')).toBeNull()
  })

  it('open=true 时内容渲染进 .set-app 容器内（不是 body 直挂）', async () => {
    mount(SkModal, {
      props: { open: true, title: '令牌已创建' },
      slots: { default: '<p class="probe">正文</p>' },
      attachTo: document.body,
    })
    await nextTick()
    const modal = host.querySelector('.sk-modal')
    expect(modal).not.toBeNull()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('令牌已创建')
    expect(host.querySelector('.sk-modal-body .probe')?.textContent).toBe('正文')
    // 关键断言:弹窗节点的祖先链上必须有 .set-app,否则 AI 区 token 全部失效
    expect(modal!.closest('.set-app')).toBe(host)
  })

  it('footer 插槽渲染进 .sk-modal-foot 的 .right 里', async () => {
    mount(SkModal, {
      props: { open: true, title: 't' },
      slots: { footer: '<button class="fbtn">完成</button>' },
      attachTo: document.body,
    })
    await nextTick()
    expect(host.querySelector('.sk-modal-foot .right .fbtn')?.textContent).toBe('完成')
  })

  it('没有 footer 插槽时不渲染脚部（Vue2 的令牌弹窗有脚、配对码弹窗结构一致，加机器人表单也有脚；但保持插槽可选）', async () => {
    mount(SkModal, { props: { open: true, title: 't' }, attachTo: document.body })
    await nextTick()
    expect(host.querySelector('.sk-modal-foot')).toBeNull()
  })

  it('点关闭按钮 emit update:open=false', async () => {
    const w = mount(SkModal, { props: { open: true, title: 't' }, attachTo: document.body })
    await nextTick()
    const x = host.querySelector('.sk-x') as HTMLElement
    expect(x).not.toBeNull()
    x.click()
    await nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('portalTo 可覆盖（给非设置页复用留口）', async () => {
    const other = document.createElement('div')
    other.id = 'other-host'
    document.body.appendChild(other)
    mount(SkModal, { props: { open: true, title: 't', portalTo: '#other-host' }, attachTo: document.body })
    await nextTick()
    expect(other.querySelector('.sk-modal')).not.toBeNull()
    expect(host.querySelector('.sk-modal')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/ai/components/settings/SkModal.test.ts`
Expected: FAIL —— 找不到 `./SkModal.vue`。

- [ ] **Step 3: 实现组件**

`src/ai/components/settings/SkModal.vue`：

```vue
<!--
  SP8-P2b Task 3 —— 设置区弹窗外壳。

  Vue2 的三处弹窗(McpTokensSection 令牌明文 / ChannelsSection 加机器人 + 配对码)
  是手写 `.sk-modal-bg` 裸 div + `@click.self` 关闭,没有焦点陷阱、Esc 也没接。
  本仓改用 reka Dialog(用户 2026-07-28 拍板;先例见 src/files/components/ 下 5 处
  对话框),视觉规则仍是 Task 1 移植进 sk-shared.scss 的 `.sk-modal*`,故用户看不出
  结构换了。

  【D1 关键约束】必须 portal 回设置页根元素 `.set-app`。AI 区 token 定义在
  `.agent-app` 作用域(src/ai/styles/tokens.scss:30),reka DialogPortal 默认把内容
  传送到 document.body —— 传出去就不在作用域里,`var(--bg-elevated)` / `var(--line)`
  一类全部解析失败,弹窗会变成透明底/错色。`defer` 打开是为了让 Teleport 在目标
  元素挂载后再解析选择器(设置页根元素与本组件同一棵树,顺序上安全,但 defer 不花钱)。
-->
<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import AgentIcon from '../icons/AgentIcon.vue'

const props = withDefaults(
  defineProps<{ open: boolean; title: string; portalTo?: string }>(),
  { portalTo: '.set-app' },
)
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
const slots = defineSlots<{ default?: () => unknown; footer?: () => unknown }>()
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal :to="props.portalTo" defer>
      <DialogOverlay class="sk-modal-bg">
        <DialogContent class="sk-modal" :aria-describedby="undefined">
          <div class="sk-modal-head">
            <DialogTitle class="sk-modal-title">{{ props.title }}</DialogTitle>
            <button type="button" class="sk-x" @click="emit('update:open', false)">
              <AgentIcon name="x" :size="14" />
            </button>
          </div>
          <div class="sk-modal-body"><slot /></div>
          <div v-if="slots.footer" class="sk-modal-foot">
            <div class="right"><slot name="footer" /></div>
          </div>
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* 关闭按钮:Vue2 里是 McpTokensSection 的 .mcp-x 与 ChannelsSection 的 .chan-x
   两份一模一样的 scoped 样式(见两文件 <style> 块),这里收成一份。 */
.sk-x {
  width: 28px; height: 28px;
  display: inline-grid; place-items: center;
  border: 0; background: transparent;
  border-radius: 8px; cursor: pointer;
  color: var(--text-secondary);
  transition: background 100ms ease, color 100ms ease;
}
.sk-x:hover { background: var(--bg-chip); color: var(--text-primary); }
</style>
```

⚠️ **`.sk-modal-bg` 是 `DialogOverlay` 本身**（不是外层包裹 div）：Task 1 移植的规则里它是 `position: fixed; inset: 0; display: grid; place-items: center;`，正好承担遮罩 + 居中两件事，reka 的 Overlay 又天然接管点击外部关闭，所以把类挂在 Overlay 上、`DialogContent` 作为它的子节点，结构最贴近 Vue2。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/ai/components/settings/SkModal.test.ts`
Expected: PASS（6 例）

若第 2 条断言 `modal!.closest('.set-app')` 失败（内容落到 body 上），检查 `to` 是否被 `ConfigProvider` 的 `teleportTo` 覆盖 —— reka 的 `Teleport` 取值顺序是 `props.to ?? configContext.teleportTo ?? 'body'`，`props.to` 优先，若失效说明传参没生效而不是被覆盖。

- [ ] **Step 5: 全量测试门**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
```

- [ ] **Step 6: ⚠️ 必做的运行时验证（不能只靠单测）**

单测在 jsdom 里跑，**测不出 `position: fixed` 被 transform 祖先困住**这类真实布局问题。起 dev server 手工确认：

```bash
pnpm dev --host --port 5288
```

因为此时还没有任何分区在用 `SkModal`（Task 10/12 才接），临时验证法：在 `SettingsPage.vue` 里临时挂一个 `<SkModal :open="true" title="临时验证" />`，浏览器打开 `http://192.168.1.143:5288/app/#/ai/settings`，确认三件事：

1. 弹窗**相对视口居中**（不是相对页面某个角落偏移）——若偏移，说明 `.set-app` 或其祖先带了 `transform` / `filter` / `backdrop-filter`，把 `position: fixed` 的包含块换掉了。
2. 弹窗底色是 AI 区的浅色卡片色（浅色主题下应为近白 `--bg-elevated`），**不是透明或深色**——透明/深色就是 token 作用域逃逸。
3. 切到暗色主题（顶栏日夜按钮）后弹窗随之变深。

**若第 1 条失败的回退方案**：不要改 `.set-app` 的样式（会动 P2a 的布局）；改成给 `SkModal` 的 `portalTo` 传 `document.body`，同时在 `sk-shared.scss` 里给 `.sk-modal-bg` 追加一条 `[data-sk-scope]` 变体、把 AI 区用到的 8 个 token（`--bg-elevated` / `--line` / `--line-faint` / `--bg-canvas` / `--text-primary` / `--text-secondary` / `--text-tertiary` / `--bg-chip`）在该选择器下重新声明一遍（值从 `tokens.scss` 的 light 块与 dark 块各取一份）。**这是次选方案，只在第 1 条真失败时用**，并且要在台账里登记原因。

验证完删掉临时挂载的那行，不要提交它。

- [ ] **Step 7: 提交**

```bash
git add src/ai/components/settings/SkModal.vue src/ai/components/settings/SkModal.test.ts
git commit -m "SP8-P2b Task 3: SkModal 弹窗外壳(reka Dialog + portal 回 .set-app 保住 token 作用域)"
git show --stat HEAD && git status
```

---

