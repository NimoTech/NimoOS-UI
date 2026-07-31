import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import AddSkillModal from './AddSkillModal.vue'
import { SKILL_COLOR_IDS } from './SkillTile.vue'

// SP8-P3b Task 5 —— AddSkillModal.vue 的测试。挂载手法与 ChannelsSection.test.ts /
// SkModal.test.ts 一致:SkModal 的 DialogPortal 默认 portal 到 '.set-app',目标元素必须
// 在组件挂载前就存在于 DOM。
//
// jsdom 里 File.prototype.text 不存在(已实测,见任务报告),brief 允许「若不可用则
// mock」——这里不构造真实 File,直接给 <input type="file"> 的 files 属性喂一个
// 「够用的假 FileList」(带 name/size/text() 的普通对象数组;数组本身可迭代,
// Array.from() 在组件里就够用了),用 Object.defineProperty 覆盖只读的 .files。

function withHost() {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountModal(props: Partial<{ open: boolean; saving: boolean; serverError: string }> = {}) {
  return mount(AddSkillModal, {
    props: { open: true, saving: false, serverError: '', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
// 组件的打开态聚焦用 setTimeout(fn, 0)(宏任务)覆盖 reka 的默认 mount-auto-focus
// (见组件头注释「reka 初始焦点实测结论」),纯微任务级的 flush() 追不上,需要真的
// 让一个宏任务跑完。
const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }

function nameInput() {
  return document.querySelector('.sk-modal .sk-field:nth-of-type(1) input') as HTMLInputElement
}
function descInput() {
  return document.querySelector('.sk-modal .sk-field:nth-of-type(2) textarea') as HTMLTextAreaElement
}
function submitBtn() {
  return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement
}
function fileInput() {
  return document.querySelector('.sk-modal input[type="file"]') as HTMLInputElement
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  el.value = v
  el.dispatchEvent(new Event('input'))
}

function pickFiles(files: Array<{ name: string; size: number; text: () => Promise<string> }>) {
  Object.defineProperty(fileInput(), 'files', { value: files, configurable: true })
  fileInput().dispatchEvent(new Event('change'))
}

beforeEach(() => { withHost() })
afterEach(() => { document.body.innerHTML = '' })

describe('AddSkillModal', () => {
  it('两字段非空才启用创建按钮', async () => {
    mountModal()
    await macroFlush()
    expect(submitBtn().disabled).toBe(true) // 两字段都空

    setValue(nameInput(), 'invoice-tagger')
    await flush()
    expect(submitBtn().disabled).toBe(true) // 只填了名称

    setValue(descInput(), '标记发票')
    await flush()
    expect(submitBtn().disabled).toBe(false) // 两字段都非空

    setValue(nameInput(), '   ')
    await flush()
    expect(submitBtn().disabled).toBe(true) // 名称退回纯空格
  })

  it('提交 payload 逐字段正确:title===name、scripts 路径前缀 scripts/、examples: []', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), 'invoice-tagger')
    setValue(descInput(), 'Tags invoices automatically')
    await flush()

    pickFiles([{ name: 'run.py', size: 100, text: async () => 'print(1)' }])
    await flush()

    submitBtn().click()
    await flush()

    expect(w.emitted('save')).toHaveLength(1)
    expect(w.emitted('save')![0][0]).toEqual({
      name: 'invoice-tagger',
      title: 'invoice-tagger',
      description: 'Tags invoices automatically',
      trigger: 'auto',
      color: 'blue',
      md: '',
      examples: [],
      scripts: [{ path: 'scripts/run.py', content: 'print(1)' }],
    })
  })

  // 【P3b 终审 C1】此前用 'Invoice_Tagger' 当"非法名字"的例子——但后端先
  // `slugify(name)` 再校验(skills_store.go:221),'Invoice_Tagger' 会被 slug 成合法
  // 的 'invoice-tagger',后端/Vue2 都能建成功,不是一个真的非法例子(把这条钉成"非法"
  // 就是把 C1 那个功能回退编码进了断言)。换成 slugify 之后仍然是空串的真非法输入
  // (纯中文,没有任何 [a-z0-9] 字符能保留下来)。
  it('名称非法(slugify 后仍无合法字符,如纯中文)→ 行内错误(aiSkErrNameNoAlnum)且不 emit save(钉住偏离 2)', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), '仅中文技能名')
    setValue(descInput(), '合法描述')
    await flush()
    // valid 只查两字段非空,不做格式校验 —— 按钮此时应可点
    expect(submitBtn().disabled).toBe(false)

    submitBtn().click()
    await flush()

    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.getAttribute('role')).toBe('alert')
    expect(err.textContent).toBe(zh.aiSkErrNameNoAlnum)
    expect(w.emitted('save')).toBeUndefined()
  })

  // 【P3b 终审 C1,补充用例】'Invoice_Tagger' 这类"看起来非法但 slugify 后合法"的
  // 名字必须能建成功——payload 里的 name/title 仍是原始 trimmed 输入(后端自己再
  // slugify 一次生成 id),前端不改写用户输入。
  it('名称含大写/下划线但 slugify 后合法(如 "Invoice_Tagger")→ 校验通过、正常 emit save', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), 'Invoice_Tagger')
    setValue(descInput(), '合法描述')
    await flush()

    submitBtn().click()
    await flush()

    expect(document.querySelector('.sk-modal .sk-field-err')).toBeNull()
    expect(w.emitted('save')).toHaveLength(1)
    expect(w.emitted('save')![0][0]).toMatchObject({ name: 'Invoice_Tagger', title: 'Invoice_Tagger' })
  })

  it('描述超过 256 个 Unicode 码点 → 行内错误(aiSkErrDescTooLong)且不 emit save', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), 'invoice-tagger')
    setValue(descInput(), 'a'.repeat(257))
    await flush()

    submitBtn().click()
    await flush()

    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
    expect(err.textContent).toBe(zh.aiSkErrDescTooLong)
    expect(w.emitted('save')).toBeUndefined()
  })

  it('7 个颜色点渲染,data-color 顺序与 SKILL_COLOR_IDS 一致;点击切换 data-active;零内联颜色(钉住偏离 1)', async () => {
    mountModal()
    await macroFlush()
    const dots = Array.from(document.querySelectorAll('.sk-modal .sk-color-dot')) as HTMLElement[]
    expect(dots).toHaveLength(7)
    expect(dots.map((d) => d.dataset.color)).toEqual([...SKILL_COLOR_IDS])
    expect(dots[0].dataset.active).toBe('true') // 默认 color: 'blue' = 第一个 id
    // 钉住偏离 1:任何一个色点都不许带内联 style(Vue2 :61 是 :style="{ background: c.bg }")
    dots.forEach((d) => expect(d.getAttribute('style')).toBeNull())

    dots[3].click()
    await nextTick()
    expect(dots[3].dataset.active).toBe('true')
    expect(dots[0].dataset.active).toBe('false')
  })

  it('三个触发选项互斥切换', async () => {
    mountModal()
    await macroFlush()
    const opts = Array.from(document.querySelectorAll('.sk-modal .sk-trig-option')) as HTMLElement[]
    expect(opts).toHaveLength(3)
    expect(opts[0].dataset.active).toBe('true') // 默认 trigger: 'auto'

    opts[1].click()
    await nextTick()
    expect(opts[1].dataset.active).toBe('true')
    expect(opts[0].dataset.active).toBe('false')
    expect(opts[2].dataset.active).toBe('false')

    opts[2].click()
    await nextTick()
    expect(opts[2].dataset.active).toBe('true')
    expect(opts[1].dataset.active).toBe('false')
  })

  it('>1 MiB 文件被跳过且出现行内提示;≤1 MiB 的正常读入(钉住偏离 3)', async () => {
    mountModal()
    await macroFlush()
    pickFiles([
      { name: 'small.py', size: 100, text: async () => 'print(1)' },
      { name: 'big.bin', size: 1024 * 1024 + 1, text: async () => 'should-not-be-read' },
    ])
    await flush()

    expect(document.body.textContent).toContain('small.py')
    expect(document.body.textContent).not.toContain('big.bin')
    const expectedHint = zh.aiSkFilesSkippedTooBig.replace('{n}', '1')
    expect(document.body.textContent).toContain(expectedHint)
  })

  it('恰好 1 MiB 的文件不算超限(边界:size > 1024*1024 才跳过)', async () => {
    mountModal()
    await macroFlush()
    pickFiles([{ name: 'exact.bin', size: 1024 * 1024, text: async () => 'ok' }])
    await flush()
    expect(document.body.textContent).toContain('exact.bin')
    expect(document.body.textContent).not.toContain(zh.aiSkFilesSkippedTooBig.replace('{n}', '1'))
  })

  it('saving 为 true 时按钮文案变为「创建中…」且禁用', async () => {
    mountModal({ saving: true })
    await macroFlush()
    setValue(nameInput(), 'foo')
    setValue(descInput(), 'bar')
    await flush()
    expect(submitBtn().disabled).toBe(true)
    expect(submitBtn().textContent).toContain(zh.aiSkCreating)
  })

  it('serverError 非空时显示在行内错误位', async () => {
    mountModal({ serverError: zh.aiSkErrDuplicate })
    await macroFlush()
    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.textContent).toBe(zh.aiSkErrDuplicate)
  })

  // reka 初始焦点实测结论的回归守卫:见组件头注释,默认会被 FocusScope 抢到 .sk-x,
  // 这里钉住显式覆盖之后真的落在名称输入框上。
  it('打开时焦点最终落在名称输入框(覆盖 reka 默认聚焦到 .sk-x 关闭按钮)', async () => {
    mountModal()
    await macroFlush()
    expect(document.activeElement).toBe(nameInput())
  })

  it('关闭后重新打开:表单复位为初始值(组件常驻,不像 Vue2 每次打开都是全新实例)', async () => {
    const w = mountModal()
    await macroFlush()
    setValue(nameInput(), 'foo')
    setValue(descInput(), 'bar')
    await flush()

    await w.setProps({ open: false })
    await flush()
    await w.setProps({ open: true })
    await macroFlush()

    expect(nameInput().value).toBe('')
    expect(descInput().value).toBe('')
  })

  it('取消按钮 emit update:open(false),不 emit save', async () => {
    const w = mountModal()
    await macroFlush()
    const cancelBtn = Array.from(document.querySelectorAll('.sk-modal-foot .sk-btn.ghost'))
      .find((b) => b.textContent?.trim() === zh.aiCancel) as HTMLButtonElement
    expect(cancelBtn).toBeTruthy()
    cancelBtn.click()
    await flush()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('save')).toBeUndefined()
  })
})
