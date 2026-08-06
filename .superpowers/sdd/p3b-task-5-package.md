# Task 5 review package — af1cdc0..HEAD

## commits
c27e050 sp8-ai P3b Task 5: add AddSkillModal.vue (skills write area)

## diff --stat
 src/ai/components/settings/SkModal.test.ts         |  35 +++
 src/ai/components/settings/SkModal.vue             |  14 +-
 .../settings/skills/AddSkillModal.test.ts          | 258 +++++++++++++++++++
 .../components/settings/skills/AddSkillModal.vue   | 275 +++++++++++++++++++++
 src/ai/styles/settingsStyles.test.ts               |  11 +
 src/ai/styles/sk-shared.scss                       |   5 +
 6 files changed, 596 insertions(+), 2 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/SkModal.test.ts b/src/ai/components/settings/SkModal.test.ts
index 5dc6fb2..db06bbf 100644
--- a/src/ai/components/settings/SkModal.test.ts
+++ b/src/ai/components/settings/SkModal.test.ts
@@ -58,20 +58,55 @@ describe('SkModal', () => {
   it('点关闭按钮 emit update:open=false', async () => {
     const w = mount(SkModal, { props: { open: true, title: 't' }, attachTo: document.body })
     await nextTick()
     const x = host.querySelector('.sk-x') as HTMLElement
     expect(x).not.toBeNull()
     x.click()
     await nextTick()
     expect(w.emitted('update:open')).toEqual([[false]])
   })
 
+  // SP8-P3b Task 5 —— footerLeft 插槽(AddSkillModal 消费:左边「保存在这台 NAS 本地」
+  // 说明,右边取消/创建按钮),纯增量,不改动上面任何既有断言。
+  it('footerLeft 插槽渲染成 .right 的前置兄弟节点(左右两栏并存)', async () => {
+    mount(SkModal, {
+      props: { open: true, title: 't' },
+      slots: {
+        footerLeft: '<span class="save-note-probe">保存说明</span>',
+        footer: '<button class="fbtn2">创建</button>',
+      },
+      attachTo: document.body,
+    })
+    await nextTick()
+    const foot = host.querySelector('.sk-modal-foot') as HTMLElement
+    expect(foot).not.toBeNull()
+    const left = foot.querySelector('.save-note-probe')
+    const right = foot.querySelector('.right .fbtn2')
+    expect(left).not.toBeNull()
+    expect(right).not.toBeNull()
+    // 左栏必须在 DOM 顺序上先于 .right(即视觉上落在它左边,而不是被塞进 .right 内部)
+    expect(left!.compareDocumentPosition(right!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
+    expect(right!.closest('.right')).not.toBeNull()
+    expect(left!.closest('.right')).toBeNull()
+  })
+
+  it('只传 footerLeft、不传 footer 时仍渲染 .sk-modal-foot(条件逻辑要自洽,本期暂无消费方这么用)', async () => {
+    mount(SkModal, {
+      props: { open: true, title: 't' },
+      slots: { footerLeft: '<span class="only-left-probe">仅左栏</span>' },
+      attachTo: document.body,
+    })
+    await nextTick()
+    expect(host.querySelector('.sk-modal-foot')).not.toBeNull()
+    expect(host.querySelector('.only-left-probe')).not.toBeNull()
+  })
+
   it('portalTo 可覆盖(给非设置页复用留口)', async () => {
     const other = document.createElement('div')
     other.id = 'other-host'
     document.body.appendChild(other)
     mount(SkModal, { props: { open: true, title: 't', portalTo: '#other-host' }, attachTo: document.body })
     await nextTick()
     expect(other.querySelector('.sk-modal')).not.toBeNull()
     expect(host.querySelector('.sk-modal')).toBeNull()
   })
 })
diff --git a/src/ai/components/settings/SkModal.vue b/src/ai/components/settings/SkModal.vue
index 0a3939a..a34ba76 100644
--- a/src/ai/components/settings/SkModal.vue
+++ b/src/ai/components/settings/SkModal.vue
@@ -15,36 +15,46 @@
 -->
 <script setup lang="ts">
 import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
 import AgentIcon from '../icons/AgentIcon.vue'
 
 const props = withDefaults(
   defineProps<{ open: boolean; title: string; portalTo?: string }>(),
   { portalTo: '.set-app' },
 )
 const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
-const slots = defineSlots<{ default?: () => unknown; footer?: () => unknown }>()
+// SP8-P3b Task 5 —— 加一个可选的 footerLeft 插槽。Vue2 AddSkillModal.vue:96-108 的底栏是
+// 两栏:左边 `.save-note`(保存说明 + check 图标)、右边 `.right`(取消/创建两个按钮),
+// sk-shared.scss:139-150 的 `.sk-modal-foot` 本来就同时支持 `.save-note` 与 `.right`
+// (后者 `margin-left: auto`),但本组件原先把 `#footer` 插槽整个塞进 `.right` 里 ——
+// AddSkillModal 若只用现成插槽,「保存在本机」那行会被推到右边贴着按钮,与 Vue2 视觉不符。
+// 纯增量:footerLeft 缺省不传时 <slot name="footerLeft" /> 不渲染任何内容,现有三个消费方
+// (ChannelsSection 两处、McpTokensSection 一处)只传 #footer,行为不变。
+const slots = defineSlots<{ default?: () => unknown; footer?: () => unknown; footerLeft?: () => unknown }>()
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
-          <div v-if="slots.footer" class="sk-modal-foot">
+          <!-- v-if 同时看两个插槽:只传 footerLeft 不传 footer 这条件在逻辑上也要立得住
+               (哪怕本期没有消费方这么用),不能写一个只覆盖 footer 单侧的条件。 -->
+          <div v-if="slots.footer || slots.footerLeft" class="sk-modal-foot">
+            <slot name="footerLeft" />
             <div class="right"><slot name="footer" /></div>
           </div>
         </DialogContent>
       </DialogOverlay>
     </DialogPortal>
   </DialogRoot>
 </template>
 
 <style scoped>
 /* 关闭按钮:Vue2 里是 McpTokensSection.vue:241-244 的 .mcp-x 与
diff --git a/src/ai/components/settings/skills/AddSkillModal.test.ts b/src/ai/components/settings/skills/AddSkillModal.test.ts
new file mode 100644
index 0000000..3503036
--- /dev/null
+++ b/src/ai/components/settings/skills/AddSkillModal.test.ts
@@ -0,0 +1,258 @@
+import { describe, it, expect, beforeEach, afterEach } from 'vitest'
+import { mount } from '@vue/test-utils'
+import { nextTick } from 'vue'
+import { createI18n } from 'vue-i18n'
+import zh from '../../../../i18n/zh_cn'
+import AddSkillModal from './AddSkillModal.vue'
+import { SKILL_COLOR_IDS } from './SkillTile.vue'
+
+// SP8-P3b Task 5 —— AddSkillModal.vue 的测试。挂载手法与 ChannelsSection.test.ts /
+// SkModal.test.ts 一致:SkModal 的 DialogPortal 默认 portal 到 '.set-app',目标元素必须
+// 在组件挂载前就存在于 DOM。
+//
+// jsdom 里 File.prototype.text 不存在(已实测,见任务报告),brief 允许「若不可用则
+// mock」——这里不构造真实 File,直接给 <input type="file"> 的 files 属性喂一个
+// 「够用的假 FileList」(带 name/size/text() 的普通对象数组;数组本身可迭代,
+// Array.from() 在组件里就够用了),用 Object.defineProperty 覆盖只读的 .files。
+
+function withHost() {
+  const host = document.createElement('div')
+  host.className = 'set-app'
+  document.body.appendChild(host)
+  return host
+}
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+function mountModal(props: Partial<{ open: boolean; saving: boolean; serverError: string }> = {}) {
+  return mount(AddSkillModal, {
+    props: { open: true, saving: false, serverError: '', ...props },
+    global: { plugins: [i18n] },
+    attachTo: document.body,
+  })
+}
+
+const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
+// 组件的打开态聚焦用 setTimeout(fn, 0)(宏任务)覆盖 reka 的默认 mount-auto-focus
+// (见组件头注释「reka 初始焦点实测结论」),纯微任务级的 flush() 追不上,需要真的
+// 让一个宏任务跑完。
+const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }
+
+function nameInput() {
+  return document.querySelector('.sk-modal .sk-field:nth-of-type(1) input') as HTMLInputElement
+}
+function descInput() {
+  return document.querySelector('.sk-modal .sk-field:nth-of-type(2) textarea') as HTMLTextAreaElement
+}
+function submitBtn() {
+  return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement
+}
+function fileInput() {
+  return document.querySelector('.sk-modal input[type="file"]') as HTMLInputElement
+}
+
+function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
+  el.value = v
+  el.dispatchEvent(new Event('input'))
+}
+
+function pickFiles(files: Array<{ name: string; size: number; text: () => Promise<string> }>) {
+  Object.defineProperty(fileInput(), 'files', { value: files, configurable: true })
+  fileInput().dispatchEvent(new Event('change'))
+}
+
+beforeEach(() => { withHost() })
+afterEach(() => { document.body.innerHTML = '' })
+
+describe('AddSkillModal', () => {
+  it('两字段非空才启用创建按钮', async () => {
+    mountModal()
+    await macroFlush()
+    expect(submitBtn().disabled).toBe(true) // 两字段都空
+
+    setValue(nameInput(), 'invoice-tagger')
+    await flush()
+    expect(submitBtn().disabled).toBe(true) // 只填了名称
+
+    setValue(descInput(), '标记发票')
+    await flush()
+    expect(submitBtn().disabled).toBe(false) // 两字段都非空
+
+    setValue(nameInput(), '   ')
+    await flush()
+    expect(submitBtn().disabled).toBe(true) // 名称退回纯空格
+  })
+
+  it('提交 payload 逐字段正确:title===name、scripts 路径前缀 scripts/、examples: []', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'invoice-tagger')
+    setValue(descInput(), 'Tags invoices automatically')
+    await flush()
+
+    pickFiles([{ name: 'run.py', size: 100, text: async () => 'print(1)' }])
+    await flush()
+
+    submitBtn().click()
+    await flush()
+
+    expect(w.emitted('save')).toHaveLength(1)
+    expect(w.emitted('save')![0][0]).toEqual({
+      name: 'invoice-tagger',
+      title: 'invoice-tagger',
+      description: 'Tags invoices automatically',
+      trigger: 'auto',
+      color: 'blue',
+      md: '',
+      examples: [],
+      scripts: [{ path: 'scripts/run.py', content: 'print(1)' }],
+    })
+  })
+
+  it('名称非法(含大写/下划线)→ 行内错误(aiSkErrBadId)且不 emit save(钉住偏离 2)', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'Invoice_Tagger')
+    setValue(descInput(), '合法描述')
+    await flush()
+    // valid 只查两字段非空,不做格式校验 —— 按钮此时应可点
+    expect(submitBtn().disabled).toBe(false)
+
+    submitBtn().click()
+    await flush()
+
+    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
+    expect(err).not.toBeNull()
+    expect(err.getAttribute('role')).toBe('alert')
+    expect(err.textContent).toBe(zh.aiSkErrBadId)
+    expect(w.emitted('save')).toBeUndefined()
+  })
+
+  it('描述超过 256 个 Unicode 码点 → 行内错误(aiSkErrDescTooLong)且不 emit save', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'invoice-tagger')
+    setValue(descInput(), 'a'.repeat(257))
+    await flush()
+
+    submitBtn().click()
+    await flush()
+
+    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
+    expect(err.textContent).toBe(zh.aiSkErrDescTooLong)
+    expect(w.emitted('save')).toBeUndefined()
+  })
+
+  it('7 个颜色点渲染,data-color 顺序与 SKILL_COLOR_IDS 一致;点击切换 data-active;零内联颜色(钉住偏离 1)', async () => {
+    mountModal()
+    await macroFlush()
+    const dots = Array.from(document.querySelectorAll('.sk-modal .sk-color-dot')) as HTMLElement[]
+    expect(dots).toHaveLength(7)
+    expect(dots.map((d) => d.dataset.color)).toEqual([...SKILL_COLOR_IDS])
+    expect(dots[0].dataset.active).toBe('true') // 默认 color: 'blue' = 第一个 id
+    // 钉住偏离 1:任何一个色点都不许带内联 style(Vue2 :61 是 :style="{ background: c.bg }")
+    dots.forEach((d) => expect(d.getAttribute('style')).toBeNull())
+
+    dots[3].click()
+    await nextTick()
+    expect(dots[3].dataset.active).toBe('true')
+    expect(dots[0].dataset.active).toBe('false')
+  })
+
+  it('三个触发选项互斥切换', async () => {
+    mountModal()
+    await macroFlush()
+    const opts = Array.from(document.querySelectorAll('.sk-modal .sk-trig-option')) as HTMLElement[]
+    expect(opts).toHaveLength(3)
+    expect(opts[0].dataset.active).toBe('true') // 默认 trigger: 'auto'
+
+    opts[1].click()
+    await nextTick()
+    expect(opts[1].dataset.active).toBe('true')
+    expect(opts[0].dataset.active).toBe('false')
+    expect(opts[2].dataset.active).toBe('false')
+
+    opts[2].click()
+    await nextTick()
+    expect(opts[2].dataset.active).toBe('true')
+    expect(opts[1].dataset.active).toBe('false')
+  })
+
+  it('>1 MiB 文件被跳过且出现行内提示;≤1 MiB 的正常读入(钉住偏离 3)', async () => {
+    mountModal()
+    await macroFlush()
+    pickFiles([
+      { name: 'small.py', size: 100, text: async () => 'print(1)' },
+      { name: 'big.bin', size: 1024 * 1024 + 1, text: async () => 'should-not-be-read' },
+    ])
+    await flush()
+
+    expect(document.body.textContent).toContain('small.py')
+    expect(document.body.textContent).not.toContain('big.bin')
+    const expectedHint = zh.aiSkFilesSkippedTooBig.replace('{n}', '1')
+    expect(document.body.textContent).toContain(expectedHint)
+  })
+
+  it('恰好 1 MiB 的文件不算超限(边界:size > 1024*1024 才跳过)', async () => {
+    mountModal()
+    await macroFlush()
+    pickFiles([{ name: 'exact.bin', size: 1024 * 1024, text: async () => 'ok' }])
+    await flush()
+    expect(document.body.textContent).toContain('exact.bin')
+    expect(document.body.textContent).not.toContain(zh.aiSkFilesSkippedTooBig.replace('{n}', '1'))
+  })
+
+  it('saving 为 true 时按钮文案变为「创建中…」且禁用', async () => {
+    mountModal({ saving: true })
+    await macroFlush()
+    setValue(nameInput(), 'foo')
+    setValue(descInput(), 'bar')
+    await flush()
+    expect(submitBtn().disabled).toBe(true)
+    expect(submitBtn().textContent).toContain(zh.aiSkCreating)
+  })
+
+  it('serverError 非空时显示在行内错误位', async () => {
+    mountModal({ serverError: zh.aiSkErrDuplicate })
+    await macroFlush()
+    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
+    expect(err).not.toBeNull()
+    expect(err.textContent).toBe(zh.aiSkErrDuplicate)
+  })
+
+  // reka 初始焦点实测结论的回归守卫:见组件头注释,默认会被 FocusScope 抢到 .sk-x,
+  // 这里钉住显式覆盖之后真的落在名称输入框上。
+  it('打开时焦点最终落在名称输入框(覆盖 reka 默认聚焦到 .sk-x 关闭按钮)', async () => {
+    mountModal()
+    await macroFlush()
+    expect(document.activeElement).toBe(nameInput())
+  })
+
+  it('关闭后重新打开:表单复位为初始值(组件常驻,不像 Vue2 每次打开都是全新实例)', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'foo')
+    setValue(descInput(), 'bar')
+    await flush()
+
+    await w.setProps({ open: false })
+    await flush()
+    await w.setProps({ open: true })
+    await macroFlush()
+
+    expect(nameInput().value).toBe('')
+    expect(descInput().value).toBe('')
+  })
+
+  it('取消按钮 emit update:open(false),不 emit save', async () => {
+    const w = mountModal()
+    await macroFlush()
+    const cancelBtn = Array.from(document.querySelectorAll('.sk-modal-foot .sk-btn.ghost'))
+      .find((b) => b.textContent?.trim() === zh.aiCancel) as HTMLButtonElement
+    expect(cancelBtn).toBeTruthy()
+    cancelBtn.click()
+    await flush()
+    expect(w.emitted('update:open')).toEqual([[false]])
+    expect(w.emitted('save')).toBeUndefined()
+  })
+})
diff --git a/src/ai/components/settings/skills/AddSkillModal.vue b/src/ai/components/settings/skills/AddSkillModal.vue
new file mode 100644
index 0000000..960249a
--- /dev/null
+++ b/src/ai/components/settings/skills/AddSkillModal.vue
@@ -0,0 +1,275 @@
+<!--
+  SP8-P3b Task 5 —— 1:1 移植自 Vue2 src/views/AI/Skills/AddSkillModal.vue(188 行)。
+
+  外壳换成 SkModal(reka Dialog),不照抄 Vue2 裸 `.sk-modal-bg` + `@click.self`
+  (P2b Task 3 已定先例,视觉规则不变)。footer 用 SkModal 本任务新加的 `footerLeft`
+  插槽承载「保存在这台 NAS 本地」说明,`footer` 插槽承载取消/创建两个按钮 —— 对齐
+  Vue2 :96-108 的两栏布局(左 `.save-note`,右 `.right`),详见 SkModal.vue 头注释。
+
+  ===== 三处拍板偏离(逐条三件套,公共约束 §3.6/3.7/3.8,brief §5.1)=====
+
+  【偏离 1 —— 颜色圆点不用内联 :style】
+  Vue2 :56-64 用 `:style="{ background: c.bg }"` 内联传渐变字符串,本仓禁内联颜色
+  (公共约束 §6)。改 `:data-color="id"`,底色由 T1 埋进 skills-styles.scss:717-723 的
+  7 条 `[data-color=…]` 规则供(值为 P3a Task 1 建的 `--grad-sk-*` token)。选中态仍走
+  `:data-active`,与 Vue2 :60 语义一致。
+
+  【偏离 2 —— 提交前本地校验】
+  Vue2 :173-174 `submit()` 只查 `!this.valid`(两字段非空),填完一整屏才被后端一句英文
+  顶回来。这里 submit() 先跑 T2 的 `validateSkillForm(name, description)`(逐条对齐后端
+  skills_store.go 的校验规则),非 null 则把对应 i18n 键渲染进 `.sk-field-err`(落在
+  `.sk-modal-body` 顶部,先于所有字段)。`valid`(按钮禁用条件,:137-139)仍只查两字段
+  非空 —— 完整校验只在点击时跑,不塞进禁用态,否则用户不知道为什么点不动。
+  `serverError` prop 与本地校验错误显示在同一个位——本地校验通不过时不会发请求,两者
+  天然互斥,不需要额外的优先级判断。
+
+  【偏离 3 —— >1 MiB 文件不再静默丢弃】
+  Vue2 :164-167 `f.size > 1024*1024` 直接 `continue`,用户看不到文件消失。这里改为累计
+  跳过数(`skippedCount`),达到 >0 时在文件字段下方追加一条 `.sk-field-hint`,文案
+  `aiSkFilesSkippedTooBig`(先例:P1c1 附件管线的 500 MB 门)。
+
+  ===== reka 初始焦点实测结论(任务书要求先实测,不要照猜)=====
+  用 SkModal.vue 现有测试同款手法起了一个探针挂载(mount 后连续 `nextTick` 查
+  `document.activeElement`):reka Dialog 的 FocusScope 默认把 mount-auto-focus 落在
+  DialogContent 内**第一个可聚焦元素**——本组件里那是 SkModal 内置的 `.sk-x` 关闭按钮
+  (它在 DOM 顺序上先于本组件的名称输入框),不是名称框。与 Vue2 :133-135「打开即聚焦
+  名称输入框」不一致,所以需要显式 `focus()`。
+  但进一步实测发现:reka 的 auto-focus 分派发生在 `FocusScope` 自己的
+  `watchEffect(async () => { await nextTick(); ...dispatchMountAutoFocus... })` 里,
+  与本组件在 `watch(() => props.open, ...)` 里同样用 `nextTick()` 再 `focus()` 是**同一
+  微任务级时序在赛跑**——实测两者谁赢不确定(在 jsdom 环境下 reka 的分派后跑,直接抢回
+  `.sk-x`)。改成宏任务级延迟(`setTimeout(fn, 0)`)后实测稳定胜出、落在名称输入框上,
+  不再被 reka 的默认行为抢走(不修改 SkModal 本身的默认聚焏逃辑,只在本组件里用更晚的
+  时机覆盖它,不影响 ChannelsSection/McpTokensSection 两个既有消费方的默认聚焦)。
+
+  ===== 非「拍板偏离」但需要说明的实现细节 =====
+  Vue2 每次打开这个弹窗都是父级 `v-if` 重新创建一份组件实例(`mounted()` 天然只跑一次,
+  表单永远从空白开始)。本组件走 SkModal 的 `open` prop 控制可见性,组件实例本身是
+  常驻的,不会随每次打开/关闭重新创建——若不显式复位,「取消」后再次打开会看到上一次
+  残留的输入。这不是新增行为,是为了在架构变化后仍旧还原 Vue2 那个「每次打开都是空表单」
+  的可见行为:`watch(open)` 在关闭时（`v === false`）复位全部字段,不在这里额外申报为
+  行为偏离。
+-->
+<script setup lang="ts">
+import { ref, computed, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import SkModal from '../SkModal.vue'
+import AgentIcon from '../../icons/AgentIcon.vue'
+import { SKILL_COLOR_IDS } from './SkillTile.vue'
+import { validateSkillForm } from '../../../util/skillsErrorKey'
+
+interface SkillScript { path: string; content: string }
+interface SkillFormPayload {
+  name: string
+  title: string
+  description: string
+  trigger: 'auto' | 'slash' | 'manual'
+  color: string
+  md: string
+  examples: string[]
+  scripts: SkillScript[]
+}
+interface PickedFile { name: string; content: string; size: number }
+
+const props = defineProps<{ open: boolean; saving: boolean; serverError: string }>()
+const emit = defineEmits<{
+  (e: 'update:open', v: boolean): void
+  (e: 'save', payload: SkillFormPayload): void
+}>()
+
+const { t } = useI18n()
+
+const name = ref('')
+const description = ref('')
+const trigger = ref<'auto' | 'slash' | 'manual'>('auto')
+const color = ref<string>(SKILL_COLOR_IDS[0]) // Vue2 data() color: 'blue' —— 首个 id 即 blue
+const md = ref('')
+const files = ref<PickedFile[]>([])
+const skippedCount = ref(0)
+const localErrorKey = ref('')
+
+const nameInputEl = ref<HTMLInputElement | null>(null)
+const filesInputEl = ref<HTMLInputElement | null>(null)
+
+// Vue2 :137-139 —— 按钮禁用条件只查两字段非空,完整校验只在 submit() 时跑。
+const valid = computed(() => name.value.trim().length > 0 && description.value.trim().length > 0)
+
+// 偏离 2:本地校验错误优先显示;两者互斥(本地校验不过就不会发请求,serverError 不会
+// 与本地错误同时非空)。
+const errorText = computed(() => (localErrorKey.value ? t(localErrorKey.value) : props.serverError || ''))
+
+// 对齐 ChannelsSection.vue:176-177 的既定手法——用户一动字段就撤掉旧错误,免得改完
+// 还挂着上一次的红字。
+watch([name, description], () => { localErrorKey.value = '' })
+
+const triggerOptions: { id: 'auto' | 'slash' | 'manual'; nameKey: string; descKey: string }[] = [
+  { id: 'auto', nameKey: 'aiSkTrigOptAuto', descKey: 'aiSkTrigDescAuto' },
+  { id: 'slash', nameKey: 'aiSkTrigOptSlash', descKey: 'aiSkTrigDescSlash' },
+  // 手动选项名复用 aiSkTagManual(与技能列表的「手动」标签同一个词,Vue2 :147 用的也是
+  // 同一个 $t('Manual')),公共约束 §7 点名的可复用键之一。
+  { id: 'manual', nameKey: 'aiSkTagManual', descKey: 'aiSkTrigDescManual' },
+]
+
+// Vue2 :150-153 computed mdPlaceholder。
+const mdPlaceholder = computed(() => {
+  const head = name.value.trim() || t('aiSkMdPlaceholderHead')
+  return `## ${head}\n\n${t('aiSkMdPlaceholderBody')}`
+})
+
+function resetForm() {
+  name.value = ''
+  description.value = ''
+  trigger.value = 'auto'
+  color.value = SKILL_COLOR_IDS[0]
+  md.value = ''
+  files.value = []
+  skippedCount.value = 0
+  localErrorKey.value = ''
+  if (filesInputEl.value) filesInputEl.value.value = ''
+}
+
+watch(
+  () => props.open,
+  (v) => {
+    if (!v) {
+      resetForm()
+      return
+    }
+    // 显式聚焦名称输入框,对齐 Vue2 :133-135。见头注释「reka 初始焦点实测结论」——
+    // 必须是宏任务级延迟才能稳定压过 reka FocusScope 自己的 mount-auto-focus。
+    setTimeout(() => { nameInputEl.value?.focus() }, 0)
+  },
+  { immediate: true },
+)
+
+async function onFilesPicked(e: Event) {
+  const input = e.target as HTMLInputElement
+  const list = Array.from(input.files || [])
+  const out: PickedFile[] = []
+  let skipped = 0
+  for (const f of list) {
+    if (f.size > 1024 * 1024) {
+      // 偏离 3:Vue2 :164-167 直接 continue 静默丢弃,这里累计跳过数,行内提示。
+      skipped++
+      continue
+    }
+    const text = await f.text()
+    out.push({ name: f.name, content: text, size: f.size })
+  }
+  files.value = out
+  skippedCount.value = skipped
+}
+
+function submit() {
+  if (!valid.value) return
+  const key = validateSkillForm(name.value, description.value)
+  if (key) {
+    localErrorKey.value = key
+    return
+  }
+  localErrorKey.value = ''
+  emit('save', {
+    name: name.value.trim(),
+    title: name.value.trim(),
+    description: description.value.trim(),
+    trigger: trigger.value,
+    color: color.value,
+    md: md.value.trim(),
+    examples: [],
+    scripts: files.value.map((f) => ({ path: 'scripts/' + f.name, content: f.content })),
+  })
+}
+
+function onCancel() {
+  emit('update:open', false)
+}
+</script>
+
+<template>
+  <SkModal :open="props.open" :title="t('aiSkAddTitle')" @update:open="(v) => emit('update:open', v)">
+    <p v-if="errorText" class="sk-field-err" role="alert">{{ errorText }}</p>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiSkFieldName') }}</label>
+      <input
+        ref="nameInputEl"
+        type="text"
+        :placeholder="t('aiSkNamePlaceholder')"
+        v-model="name"
+        @keydown.enter.prevent
+      >
+      <div class="sk-field-hint">{{ t('aiSkNameHint') }}</div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiSkDescription') }}</label>
+      <textarea :placeholder="t('aiSkDescPlaceholder')" v-model="description" />
+      <div class="sk-field-hint">{{ t('aiSkDescFormHint') }}</div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiSkTrigger') }}</label>
+      <div class="sk-trig-options">
+        <button
+          v-for="o in triggerOptions" :key="o.id" type="button" class="sk-trig-option"
+          :data-active="trigger === o.id ? 'true' : 'false'"
+          @click="trigger = o.id"
+        >
+          <span class="name">{{ t(o.nameKey) }}</span>
+          <span class="desc">{{ t(o.descKey) }}</span>
+        </button>
+      </div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiSkFieldColor') }}</label>
+      <div class="sk-color-row">
+        <div
+          v-for="id in SKILL_COLOR_IDS" :key="id" class="sk-color-dot"
+          :data-color="id"
+          :data-active="color === id ? 'true' : 'false'"
+          @click="color = id"
+        />
+      </div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">
+        SKILL.md
+        <span class="sk-field-optional">({{ t('aiSkOptional') }})</span>
+      </label>
+      <textarea
+        v-model="md"
+        :placeholder="mdPlaceholder"
+        style="min-height: 110px; font-family: var(--font-mono); font-size: 12.5px"
+      />
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">
+        {{ t('aiSkScriptFiles') }}
+        <span class="sk-field-optional">({{ t('aiSkOptional') }})</span>
+      </label>
+      <input ref="filesInputEl" type="file" multiple @change="onFilesPicked">
+      <div class="sk-field-hint">{{ t('aiSkScriptsHint') }}</div>
+      <div v-if="skippedCount > 0" class="sk-field-hint">{{ t('aiSkFilesSkippedTooBig', { n: skippedCount }) }}</div>
+      <ul v-if="files.length" style="font-size: 12px; color: var(--text-tertiary); margin-top: 6px">
+        <li v-for="f in files" :key="f.name">{{ f.name }} — {{ f.size }} B</li>
+      </ul>
+    </div>
+
+    <template #footerLeft>
+      <span class="save-note">
+        <AgentIcon name="check" :size="11" />
+        {{ t('aiSkSavedLocally') }}
+      </span>
+    </template>
+    <template #footer>
+      <button type="button" class="sk-btn ghost" @click="onCancel">{{ t('aiCancel') }}</button>
+      <button type="button" class="sk-btn primary" :disabled="!valid || props.saving" @click="submit">
+        <AgentIcon name="plus" :size="13" />
+        {{ props.saving ? t('aiSkCreating') : t('aiSkCreate') }}
+      </button>
+    </template>
+  </SkModal>
+</template>
diff --git a/src/ai/styles/settingsStyles.test.ts b/src/ai/styles/settingsStyles.test.ts
index 7e76577..7808900 100644
--- a/src/ai/styles/settingsStyles.test.ts
+++ b/src/ai/styles/settingsStyles.test.ts
@@ -195,20 +195,31 @@ describe('sk-shared.scss', () => {
       '.sk-modal-body', '.sk-modal-foot', '.sk-field', '.sk-field-label', '.sk-field-hint',
     ]) {
       expect(css).toContain(sel)
     }
   })
 
   it('SP8-P2b Task 1 —— 保留两个入场动画关键帧', () => {
     expect(css).toContain('@keyframes sk-fade-in')
     expect(css).toContain('@keyframes sk-pop')
   })
+
+  // SP8-P3b Task 5 —— AddSkillModal 提交前本地校验命中时用的行内错误条,先例
+  // .chan-field-err(settings-styles.scss:234)。
+  it('SP8-P3b Task 5 —— 导出行内错误类 .sk-field-err,走 --danger token 无裸色', () => {
+    const at = css.indexOf('.sk-field-err {')
+    expect(at, '找不到 .sk-field-err 规则').toBeGreaterThanOrEqual(0)
+    const rule = css.slice(at, css.indexOf('}', at))
+    expect(rule).toContain('color: var(--danger)')
+    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
+    expect(rule).not.toMatch(/rgba?\(/)
+  })
 })
 
 // SP8-P3a 整期终审 I1 守卫 —— `.empty-title`/`.empty-sub` 与 `agent-styles.scss`
 // 的 `.agent-app .empty-title`/`.agent-app .empty-sub` 同优先级碰撞(详见
 // skills-styles.scss:424-450 的三件套注释)。New-UI 独有回归,不是 Vue2 走样:
 // Vue2 蓝本 `Settings/Settings.vue:2` 根节点只有 `class="set-app"`,不含
 // `agent-app`,这两条规则在 Vue2 里永不相遇;New-UI `SettingsPage.vue:371`
 // 根节点是 `agent-app set-app`,两条规则同时命中同一个空态元素,同优先级下
 // 全靠 `router/index.ts` 的 import 顺序侥幸决胜,且 agent-styles 没声明的属性
 // (letter-spacing/margin/color)会直接泄漏进来。
diff --git a/src/ai/styles/sk-shared.scss b/src/ai/styles/sk-shared.scss
index da310ee..afd97f8 100644
--- a/src/ai/styles/sk-shared.scss
+++ b/src/ai/styles/sk-shared.scss
@@ -155,20 +155,25 @@
 .sk-field-label {
   font-size: 12px; font-weight: 600;
   color: var(--text-secondary);
   letter-spacing: -0.005em;
   .sk-field-optional {
     color: var(--text-tertiary);
     font-weight: 400;
   }
 }
 .sk-field-hint { font-size: 11px; color: var(--text-tertiary); }
+// SP8-P3b Task 5 —— 行内校验错误条(AddSkillModal 提交前本地校验命中时用,落在
+// .sk-modal-body 顶部)。先例是 ChannelsSection 添加机器人失败的 .chan-field-err
+// (settings-styles.scss:234),值逐字同款;这里新建同名同款的 .sk-field-err,不借用
+// 带 chan 前缀的那份(那是聊天渠道分区自己的类,借用属于跨分区复用)。
+.sk-field-err { margin: 0 0 6px; font-size: 12px; color: var(--danger); line-height: 1.5; }
 .sk-field input[type="text"],
 .sk-field textarea {
   width: 100%;
   border: 1px solid var(--line);
   border-radius: var(--r-md);
   padding: 9px 12px;
   font-size: 13.5px;
   background: var(--bg-canvas);
   color: var(--text-primary);
   outline: none;
